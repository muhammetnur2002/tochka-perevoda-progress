-- =============================================================================
-- 0013_payments_policy.sql
-- Схема оплаты:
--  * предоплата для крупных и нотариальных заказов (остальное — полностью онлайн);
--  * оплата в точке (наличные/терминал) для клиентов без российской карты;
--  * ссылка на оплату из CRM — остаток или доплата (срочность, доп. страницы);
--  * возвраты по платежам (частичные и полные) с учётом в paid_amount.
-- Деньги меняет только сервер (service_role); сотрудникам — чтение.
-- Идемпотентно.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Настройки: предоплата, порог и оплата в точке — публичные (их показывает сайт)
-- ---------------------------------------------------------------------------
insert into public.settings (key, value, is_public) values
  ('prepayment_threshold', '3000', true),
  ('pay_in_office_enabled', 'true', true)
on conflict (key) do nothing;

-- Рекомендованная схема: 50% предоплаты для заказов от порога и нотариальных.
-- Меняем только заводское значение 100 — если владелец уже задал своё, оно остаётся.
update public.settings
   set value = '50', is_public = true
 where key = 'prepayment_percent' and value = '100'::jsonb;
update public.settings set is_public = true where key = 'prepayment_percent';

-- ---------------------------------------------------------------------------
-- Заказ: способ оплаты и доплата
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists payment_mode text not null default 'online'
    check (payment_mode in ('online', 'office')),
  add column if not exists extra_charge numeric(12, 2) not null default 0
    check (extra_charge >= 0);

-- Итог: (Σ позиций − объёмная скидка) × срочность + заверение + доставка + доплата − промо
create or replace function public.recalc_order_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order uuid;
begin
  target_order := coalesce(new.order_id, old.order_id);

  update public.orders o
  set subtotal = coalesce((
        select sum(oi.price) from public.order_items oi where oi.order_id = target_order
      ), 0),
      total_price = greatest(0, round(
        (coalesce((select sum(oi.price) from public.order_items oi where oi.order_id = target_order), 0)
         - o.discount)
        * o.urgency_coefficient
        + o.notary_fee + o.delivery_fee + o.extra_charge
        - o.promo_discount
        , 2))
  where o.id = target_order;

  return null;
end;
$$;

-- Доплата меняет итог сразу (позиции при этом не трогаем)
create or replace function public.orders_apply_extra_charge()
returns trigger
language plpgsql
as $$
begin
  new.total_price := greatest(0, round(
    (coalesce((select sum(oi.price) from public.order_items oi where oi.order_id = new.id), 0) - new.discount)
    * new.urgency_coefficient
    + new.notary_fee + new.delivery_fee + new.extra_charge
    - new.promo_discount
    , 2));
  return new;
end;
$$;

drop trigger if exists trg_orders_extra_charge on public.orders;
create trigger trg_orders_extra_charge
  before update of extra_charge on public.orders
  for each row
  when (old.extra_charge is distinct from new.extra_charge)
  execute function public.orders_apply_extra_charge();

-- ---------------------------------------------------------------------------
-- Запросы на оплату из CRM: остаток или доплата, оплачиваются по ссылке
-- ---------------------------------------------------------------------------
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  reason text,
  -- true — сумма добавлена к стоимости заказа (orders.extra_charge)
  is_extra boolean not null default false,
  status text not null default 'open' check (status in ('open', 'paid', 'cancelled')),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists idx_payment_requests_order on public.payment_requests (order_id, created_at desc);

alter table public.payments
  add column if not exists request_id uuid references public.payment_requests (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Возвраты
-- ---------------------------------------------------------------------------
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'canceled')),
  provider text not null default 'manual',
  provider_refund_id text unique,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_refunds_order on public.refunds (order_id);
create index if not exists idx_refunds_payment on public.refunds (payment_id);

drop trigger if exists trg_refunds_updated on public.refunds;
create trigger trg_refunds_updated before update on public.refunds
  for each row execute function public.set_updated_at();

-- Оплачено = успешные платежи − успешные возвраты
create or replace function public.payments_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order uuid;
begin
  target_order := coalesce(new.order_id, old.order_id);

  update public.orders o
  set paid_amount = greatest(0,
        coalesce((
          select sum(p.amount) from public.payments p
          where p.order_id = target_order and p.status in ('succeeded', 'refunded')
        ), 0)
        - coalesce((
          select sum(r.amount) from public.refunds r
          where r.order_id = target_order and r.status = 'succeeded'
        ), 0)),
      status = case
        when o.status = 'new'
             and exists (
               select 1 from public.payments p
               where p.order_id = target_order and p.status = 'succeeded'
             )
        then 'confirmed'::public.order_status
        else o.status
      end
  where o.id = target_order;

  return null;
end;
$$;

drop trigger if exists trg_refunds_order on public.refunds;
create trigger trg_refunds_order
  after insert or update or delete on public.refunds
  for each row execute function public.payments_after_change();

-- ---------------------------------------------------------------------------
-- RLS: чтение — менеджерам; запись — только сервер
-- ---------------------------------------------------------------------------
alter table public.payment_requests enable row level security;
alter table public.refunds enable row level security;

drop policy if exists payment_requests_select on public.payment_requests;
create policy payment_requests_select on public.payment_requests
  for select to authenticated using (public.is_manager());
drop policy if exists refunds_select on public.refunds;
create policy refunds_select on public.refunds
  for select to authenticated using (public.is_manager());

revoke all on public.payment_requests, public.refunds from anon;
grant select on public.payment_requests, public.refunds to authenticated;
grant select, insert, update, delete on public.payment_requests, public.refunds to service_role;

-- Аудит денежных операций
drop trigger if exists trg_audit_refunds on public.refunds;
create trigger trg_audit_refunds
  after insert or update or delete on public.refunds
  for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_payment_requests on public.payment_requests;
create trigger trg_audit_payment_requests
  after insert or update or delete on public.payment_requests
  for each row execute function public.audit_row_change();
