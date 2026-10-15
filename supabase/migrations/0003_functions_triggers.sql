-- =============================================================================
-- 0003_functions_triggers.sql
-- Функции и триггеры: авторизация, номера заказов, пересчёт цен, аудит,
-- уведомления, привязка гостевых заказов.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Роль текущего пользователя (SECURITY DEFINER — обход рекурсии RLS)
-- ---------------------------------------------------------------------------
create or replace function public.get_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.users where id = auth.uid()), 'guest'::public.user_role);
$$;

-- Сотрудник: любой, у кого есть доступ к рабочему контуру
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('manager','admin','translator','notary','printer')
       from public.users where id = auth.uid()),
    false
  );
$$;

-- Управленец: менеджер или администратор
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('manager','admin') from public.users where id = auth.uid()),
    false
  );
$$;

-- Администратор
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.users where id = auth.uid()),
    false
  );
$$;

-- Назначен ли текущий пользователь исполнителем по заказу (переводчик/нотариус/печатник)
create or replace function public.is_assigned_to_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.order_assignments a
    where a.order_id = p_order_id
      and a.user_id = auth.uid()
      and a.status <> 'rejected'
  );
$$;

grant execute on function public.is_assigned_to_order(uuid) to authenticated;
grant execute on function public.get_user_role() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_manager() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Нормализация телефона РФ к виду 79001234567 (зеркало normalizePhone в TS)
-- ---------------------------------------------------------------------------
create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  d text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if length(d) = 11 and left(d, 1) = '8' then
    d := '7' || substr(d, 2);
  elsif length(d) = 10 then
    d := '7' || d;
  end if;
  return nullif(d, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- Автосоздание профиля при регистрации в Supabase Auth
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_phone(coalesce(new.raw_user_meta_data ->> 'phone', new.phone));
  v_name text := coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Клиент');
begin
  -- ВАЖНО: роль НЕ берётся из raw_user_meta_data (её задаёт сам пользователь при signUp).
  -- Повышенные роли выдаёт только администратор или service_role через raw_app_meta_data.
  insert into public.users (id, role, name, email, phone, telegram_id, telegram_username)
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'client'),
    v_name,
    new.email,
    v_phone,
    nullif(new.raw_user_meta_data ->> 'telegram_id', '')::bigint,
    new.raw_user_meta_data ->> 'telegram_username'
  )
  on conflict (id) do nothing;

  -- Карточка клиента. Гостевые заказы по телефону НЕ привязываются здесь:
  -- телефон при регистрации не подтверждён. Привязка — claim_guest_orders()
  -- после SMS-кода или контакта Telegram (см. /api/account/phone).
  if not exists (select 1 from public.clients c where c.user_id = new.id) then
    insert into public.clients (user_id, name, phone, email, created_by)
    values (new.id, v_name, v_phone, new.email, new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Запрет повышения роли (только администратор меняет роли)
-- ---------------------------------------------------------------------------
create or replace function public.users_prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Разрешаем администраторам и service_role (серверным процессам: сиды, вебхуки)
  if (new.role is distinct from old.role
      or new.telegram_id is distinct from old.telegram_id
      or new.is_active is distinct from old.is_active)
     and not public.is_admin()
     and coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'Роль, Telegram-привязку и активность меняет только администратор';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_users_role_escalation on public.users;
create trigger trg_users_role_escalation
  before update of role, telegram_id, is_active on public.users
  for each row execute function public.users_prevent_role_escalation();

-- ---------------------------------------------------------------------------
-- Автообновление updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated on public.users;
create trigger trg_users_updated before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists trg_clients_updated on public.clients;
create trigger trg_clients_updated before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists trg_services_updated on public.services;
create trigger trg_services_updated before update on public.services
  for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists trg_payments_updated on public.payments;
create trigger trg_payments_updated before update on public.payments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated on public.settings;
create trigger trg_settings_updated before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Генерация публичного номера заказа: ТП-2026-000123
-- ---------------------------------------------------------------------------
create sequence if not exists public.order_number_seq start with 1;

create or replace function public.generate_order_number()
returns trigger
language plpgsql
as $$
begin
  new.public_number := 'ТП-' || to_char(now(), 'YYYY') || '-' ||
                       lpad(nextval('public.order_number_seq')::text, 6, '0');
  return new;
end;
$$;

drop trigger if exists trg_orders_number on public.orders;
create trigger trg_orders_number
  before insert on public.orders
  for each row execute function public.generate_order_number();

-- ---------------------------------------------------------------------------
-- Служебные даты при смене статуса (BEFORE UPDATE)
-- ---------------------------------------------------------------------------
create or replace function public.orders_set_dates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'issued' and new.issued_at is null then new.issued_at = now(); end if;
    if new.status = 'completed' and new.completed_at is null then new.completed_at = now(); end if;
    if new.status = 'cancelled' and new.cancelled_at is null then new.cancelled_at = now(); end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_dates on public.orders;
create trigger trg_orders_dates
  before update of status on public.orders
  for each row execute function public.orders_set_dates();

-- ---------------------------------------------------------------------------
-- История смены статусов (AFTER UPDATE)
-- ---------------------------------------------------------------------------
create or replace function public.orders_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.status_history (order_id, from_status, to_status, changed_by, comment)
    values (new.id, old.status, new.status, auth.uid(),
            nullif(current_setting('app.status_comment', true), ''));
  end if;
  return null;
end;
$$;

drop trigger if exists trg_orders_status_history on public.orders;
create trigger trg_orders_status_history
  after update of status on public.orders
  for each row execute function public.orders_status_history();

-- ---------------------------------------------------------------------------
-- Внутреннее уведомление при смене статуса (AFTER UPDATE)
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_status_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (user_id, order_id, channel, subject, message)
    values (new.user_id, new.id, 'inapp',
            'Статус заказа изменён',
            'Заказ ' || new.public_number || ': ' || new.status::text);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_orders_notify on public.orders;
create trigger trg_orders_notify
  after update of status on public.orders
  for each row execute function public.enqueue_status_notification();

-- ---------------------------------------------------------------------------
-- Пересчёт итогов заказа при изменении позиций
-- ---------------------------------------------------------------------------
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
      total_price = round(
        (coalesce((select sum(oi.price) from public.order_items oi where oi.order_id = target_order), 0)
         - o.discount)
        * o.urgency_coefficient
        + o.notary_fee + o.delivery_fee
        , 2)
  where o.id = target_order;

  return null;
end;
$$;

drop trigger if exists trg_order_items_totals on public.order_items;
create trigger trg_order_items_totals
  after insert or update or delete on public.order_items
  for each row execute function public.recalc_order_totals();

-- ---------------------------------------------------------------------------
-- Обновление оплаты/статуса заказа при изменении платежа
-- ---------------------------------------------------------------------------
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
  set paid_amount = coalesce((
        select sum(p.amount) from public.payments p
        where p.order_id = target_order and p.status = 'succeeded'
      ), 0),
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

drop trigger if exists trg_payments_order on public.payments;
create trigger trg_payments_order
  after insert or update on public.payments
  for each row execute function public.payments_after_change();

-- ---------------------------------------------------------------------------
-- Аудит изменений чувствительных таблиц
-- ---------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, actor_role, entity, entity_id, action, before, after)
  values (
    auth.uid(),
    public.get_user_role(),
    tg_table_name,
    coalesce(new.id, old.id)::text,
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_orders on public.orders;
create trigger trg_audit_orders
  after insert or update or delete on public.orders
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_order_items on public.order_items;
create trigger trg_audit_order_items
  after insert or update or delete on public.order_items
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_payments on public.payments;
create trigger trg_audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_services on public.services;
create trigger trg_audit_services
  after insert or update or delete on public.services
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_users on public.users;
create trigger trg_audit_users
  after insert or update or delete on public.users
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Привязка гостевых заказов по совпадению телефона (после регистрации)
-- ---------------------------------------------------------------------------
create or replace function public.claim_guest_orders(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
  p_phone text;
begin
  -- Только сервер (после подтверждения телефона) или администратор
  if coalesce(auth.role(), 'service_role') <> 'service_role' and not public.is_admin() then
    raise exception 'Привязка заказов доступна только после подтверждения телефона';
  end if;

  select phone into p_phone from public.users where id = p_user_id;
  if p_phone is null then
    return 0;
  end if;

  -- связываем клиента
  update public.clients c
  set user_id = p_user_id
  where c.user_id is null and c.phone = p_phone;

  -- привязываем заказы
  update public.orders o
  set user_id = p_user_id
  where o.user_id is null
    and o.client_id in (select c.id from public.clients c where c.phone = p_phone);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.claim_guest_orders(uuid) from public, anon, authenticated;
grant execute on function public.claim_guest_orders(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Пересчёт текущей нагрузки переводчика при изменении назначений
-- ---------------------------------------------------------------------------
create or replace function public.sync_translator_load()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
begin
  target_user := coalesce(new.user_id, old.user_id);

  update public.translators t
  set current_load = (
    select count(*)
    from public.order_assignments a
    where a.user_id = target_user
      and a.role = 'translator'
      and a.status in ('assigned','accepted','in_progress')
  )
  where t.user_id = target_user;

  return null;
end;
$$;

drop trigger if exists trg_assignments_load on public.order_assignments;
create trigger trg_assignments_load
  after insert or update or delete on public.order_assignments
  for each row execute function public.sync_translator_load();

-- ---------------------------------------------------------------------------
-- Смена статуса заказа с комментарием (RLS применяется: SECURITY INVOKER).
-- Комментарий передаётся в триггер истории через локальную настройку сессии.
-- ---------------------------------------------------------------------------
create or replace function public.change_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_comment text default null,
  p_cancel_reason text default null
)
returns public.orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.orders;
begin
  perform set_config('app.status_comment', coalesce(p_comment, ''), true);
  update public.orders
     set status = p_status,
         cancel_reason = case when p_status = 'cancelled'
                              then coalesce(p_cancel_reason, p_comment) else cancel_reason end
   where id = p_order_id
  returning * into result;
  if result.id is null then
    raise exception 'Заказ не найден или нет прав';
  end if;
  return result;
end;
$$;

grant execute on function public.change_order_status(uuid, public.order_status, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Исполнитель может менять только статус своего назначения
-- ---------------------------------------------------------------------------
create or replace function public.assignments_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_manager() or coalesce(auth.role(), 'service_role') = 'service_role') then
    if new.order_id is distinct from old.order_id
       or new.order_item_id is distinct from old.order_item_id
       or new.user_id is distinct from old.user_id
       or new.role is distinct from old.role
       or new.due_at is distinct from old.due_at
       or new.assigned_by is distinct from old.assigned_by then
      raise exception 'Исполнитель может менять только статус задачи';
    end if;
  end if;
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assignments_guard on public.order_assignments;
create trigger trg_assignments_guard
  before update on public.order_assignments
  for each row execute function public.assignments_guard();

-- ---------------------------------------------------------------------------
-- Рейт-лимит в БД (общий для нескольких инстансов приложения). Только сервер.
-- Возвращает true, если запрос разрешён.
-- ---------------------------------------------------------------------------
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_identifier text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.rate_limits as r (bucket, identifier, count, reset_at)
  values (p_bucket, p_identifier, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (bucket, identifier) do update
    set count = case when r.reset_at <= now() then 1 else r.count + 1 end,
        reset_at = case when r.reset_at <= now()
                        then now() + make_interval(secs => p_window_seconds)
                        else r.reset_at end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke all on function public.rate_limit_hit(text, text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, int, int) to service_role;
