-- =============================================================================
-- 0011_promo_codes.sql
-- Промокоды и автоматические скидки. Создаёт и настраивает персонал в CRM.
--  * код вводит клиент в корзине; auto_apply — скидка применяется сама, без кода;
--  * скидка: процент (с потолком) или фиксированная сумма; считается от стоимости
--    услуг с учётом срочности, без заверения и доставки;
--  * ограничения: минимальная сумма, период, общий лимит и лимит на клиента,
--    только для первого заказа.
-- Клиентам таблица недоступна (чтобы нельзя было перебрать коды): проверка
-- идёт через сервер (service_role) с лимитом запросов.
-- Идемпотентно.
-- =============================================================================

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  -- Код хранится в верхнем регистре (нормализует приложение); NULL — только для auto_apply
  code text,
  name text not null,
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  value numeric(10, 2) not null check (value > 0),
  max_discount numeric(10, 2) check (max_discount is null or max_discount > 0),
  min_order_amount numeric(10, 2) not null default 0 check (min_order_amount >= 0),
  auto_apply boolean not null default false,
  first_order_only boolean not null default false,
  valid_from timestamptz,
  valid_to timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  max_uses_per_client integer check (max_uses_per_client is null or max_uses_per_client > 0),
  is_active boolean not null default true,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_percent_range check (discount_type <> 'percent' or value <= 100),
  constraint promo_code_or_auto check (code is not null or auto_apply),
  constraint promo_code_format check (code is null or code ~ '^[^[:space:]]{3,32}$'),
  constraint promo_dates check (valid_from is null or valid_to is null or valid_to > valid_from)
);

create unique index if not exists promo_codes_code_key on public.promo_codes (code) where code is not null;
create index if not exists idx_promo_codes_auto on public.promo_codes (is_active, auto_apply);

drop trigger if exists trg_promo_codes_updated on public.promo_codes;
create trigger trg_promo_codes_updated before update on public.promo_codes
  for each row execute function public.set_updated_at();

alter table public.promo_codes enable row level security;

drop policy if exists promo_codes_select on public.promo_codes;
create policy promo_codes_select on public.promo_codes
  for select to authenticated using (public.is_manager());
drop policy if exists promo_codes_insert on public.promo_codes;
create policy promo_codes_insert on public.promo_codes
  for insert to authenticated with check (public.is_manager());
drop policy if exists promo_codes_update on public.promo_codes;
create policy promo_codes_update on public.promo_codes
  for update to authenticated using (public.is_manager()) with check (public.is_manager());
drop policy if exists promo_codes_delete on public.promo_codes;
create policy promo_codes_delete on public.promo_codes
  for delete to authenticated using (public.is_manager());

revoke all on public.promo_codes from anon;
grant select, insert, update, delete on public.promo_codes to authenticated, service_role;

drop trigger if exists trg_audit_promo_codes on public.promo_codes;
create trigger trg_audit_promo_codes
  after insert or update or delete on public.promo_codes
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Заказ хранит применённую скидку: сумму (источник правды для итога), код-снимок
-- и ссылку на промокод (для лимитов и отчёта)
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists promo_code_id uuid references public.promo_codes (id) on delete restrict,
  add column if not exists promo_code text,
  add column if not exists promo_discount numeric(12, 2) not null default 0 check (promo_discount >= 0);
create index if not exists idx_orders_promo on public.orders (promo_code_id) where promo_code_id is not null;

-- Итог: (Σ позиций − объёмная скидка) × срочность + заверение + доставка − промо
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
        + o.notary_fee + o.delivery_fee
        - o.promo_discount
        , 2))
  where o.id = target_order;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Использование промокодов (для CRM): без отменённых заказов
-- ---------------------------------------------------------------------------
create or replace view public.v_promo_usage
  with (security_invoker = true) as
select
  p.id as promo_code_id,
  count(o.id) filter (where o.status <> 'cancelled') as uses,
  coalesce(sum(o.promo_discount) filter (where o.status <> 'cancelled'), 0) as discount_total
from public.promo_codes p
left join public.orders o on o.promo_code_id = p.id
group by p.id;

grant select on public.v_promo_usage to authenticated, service_role;
