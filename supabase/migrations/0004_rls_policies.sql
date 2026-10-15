-- =============================================================================
-- 0004_rls_policies.sql
-- Row Level Security. Матрица доступа:
--   гость (anon)        — каталог (services, price_rules, languages) и публичные settings;
--                         заказы/файлы/согласия создаёт только сервер (service_role);
--   клиент              — свои заказы, позиции, файлы, платежи, историю, чат, согласия;
--   менеджер/админ      — всё;
--   переводчик/нотариус/печатник — только заказы из своих назначений (order_assignments)
--                         и статус своего назначения;
--   audit_log           — чтение только администратору, запись только триггерами.
-- Хелперы is_manager()/is_admin()/is_assigned_to_order() — SECURITY DEFINER (0003).
-- =============================================================================

alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.price_rules enable row level security;
alter table public.languages enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.files enable row level security;
alter table public.payments enable row level security;
alter table public.status_history enable row level security;
alter table public.notifications enable row level security;
alter table public.translators enable row level security;
alter table public.order_assignments enable row level security;
alter table public.audit_log enable row level security;
alter table public.consents enable row level security;
alter table public.chat_messages enable row level security;
alter table public.settings enable row level security;
alter table public.rate_limits enable row level security;

-- Видит ли текущий пользователь заказ: владелец, менеджер или назначенный исполнитель
create or replace function public.can_view_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_manager()
      or exists (select 1 from public.orders o where o.id = p_order_id and o.user_id = auth.uid())
      or public.is_assigned_to_order(p_order_id);
$$;

-- Владелец заказа (клиент)
create or replace function public.owns_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.orders o where o.id = p_order_id and o.user_id = auth.uid());
$$;

grant execute on function public.can_view_order(uuid) to authenticated;
grant execute on function public.owns_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- users: себя видит каждый, всех — менеджер. Чувствительные колонки защищены
-- триггером users_prevent_role_escalation.
-- ---------------------------------------------------------------------------
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated using (id = auth.uid() or public.is_manager());

drop policy if exists users_insert on public.users;
create policy users_insert on public.users
  for insert to authenticated with check (public.is_admin());

drop policy if exists users_update on public.users;
create policy users_update on public.users
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists users_delete on public.users;
create policy users_delete on public.users
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select to authenticated using (public.is_manager() or user_id = auth.uid());

drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients
  for insert to authenticated with check (public.is_manager());

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients
  for update to authenticated
  using (public.is_manager() or user_id = auth.uid())
  with check (public.is_manager() or user_id = auth.uid());

drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- services / price_rules / languages — публичное чтение, правка менеджерами
-- ---------------------------------------------------------------------------
drop policy if exists services_select on public.services;
create policy services_select on public.services
  for select using (is_active or public.is_manager());
drop policy if exists services_insert on public.services;
create policy services_insert on public.services
  for insert to authenticated with check (public.is_manager());
drop policy if exists services_update on public.services;
create policy services_update on public.services
  for update to authenticated using (public.is_manager()) with check (public.is_manager());
drop policy if exists services_delete on public.services;
create policy services_delete on public.services
  for delete to authenticated using (public.is_admin());

drop policy if exists price_rules_select on public.price_rules;
create policy price_rules_select on public.price_rules for select using (true);
drop policy if exists price_rules_insert on public.price_rules;
create policy price_rules_insert on public.price_rules
  for insert to authenticated with check (public.is_manager());
drop policy if exists price_rules_update on public.price_rules;
create policy price_rules_update on public.price_rules
  for update to authenticated using (public.is_manager()) with check (public.is_manager());
drop policy if exists price_rules_delete on public.price_rules;
create policy price_rules_delete on public.price_rules
  for delete to authenticated using (public.is_manager());

drop policy if exists languages_select on public.languages;
create policy languages_select on public.languages for select using (true);
drop policy if exists languages_insert on public.languages;
create policy languages_insert on public.languages
  for insert to authenticated with check (public.is_manager());
drop policy if exists languages_update on public.languages;
create policy languages_update on public.languages
  for update to authenticated using (public.is_manager()) with check (public.is_manager());
drop policy if exists languages_delete on public.languages;
create policy languages_delete on public.languages
  for delete to authenticated using (public.is_manager());

-- ---------------------------------------------------------------------------
-- orders: создание — только сервер (цена считается на сервере) или менеджер.
-- Исполнители — только чтение назначенных заказов.
-- ---------------------------------------------------------------------------
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated using (
    public.is_manager() or user_id = auth.uid() or public.is_assigned_to_order(id)
  );

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert to authenticated with check (public.is_manager());

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select to authenticated using (public.can_view_order(order_id));

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert to authenticated with check (public.is_manager());

drop policy if exists order_items_update on public.order_items;
create policy order_items_update on public.order_items
  for update to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists order_items_delete on public.order_items;
create policy order_items_delete on public.order_items
  for delete to authenticated using (public.is_manager());

-- ---------------------------------------------------------------------------
-- files: метаданные. Загрузка идёт через /api/upload (service_role) с проверкой прав.
-- ---------------------------------------------------------------------------
drop policy if exists files_select on public.files;
create policy files_select on public.files
  for select to authenticated using (deleted_at is null and public.can_view_order(order_id));

drop policy if exists files_insert on public.files;
create policy files_insert on public.files
  for insert to authenticated with check (public.is_manager());

drop policy if exists files_update on public.files;
create policy files_update on public.files
  for update to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists files_delete on public.files;
create policy files_delete on public.files
  for delete to authenticated using (public.is_manager());

-- ---------------------------------------------------------------------------
-- payments: исполнители платежи не видят
-- ---------------------------------------------------------------------------
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated using (public.is_manager() or public.owns_order(order_id));

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert to authenticated with check (public.is_manager());

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
  for update to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- status_history: запись только триггером (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
drop policy if exists status_history_select on public.status_history;
create policy status_history_select on public.status_history
  for select to authenticated using (public.can_view_order(order_id));

drop policy if exists status_history_insert on public.status_history;

-- ---------------------------------------------------------------------------
-- notifications: свои уведомления (отметка «прочитано» — update своих)
-- ---------------------------------------------------------------------------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (public.is_manager() or user_id = auth.uid());

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated with check (public.is_manager());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (public.is_manager() or user_id = auth.uid())
  with check (public.is_manager() or user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated using (public.is_manager());

-- ---------------------------------------------------------------------------
-- translators: профиль нагрузки
-- ---------------------------------------------------------------------------
drop policy if exists translators_select on public.translators;
create policy translators_select on public.translators
  for select to authenticated using (public.is_manager() or user_id = auth.uid());

drop policy if exists translators_insert on public.translators;
create policy translators_insert on public.translators
  for insert to authenticated with check (public.is_manager());

drop policy if exists translators_update on public.translators;
create policy translators_update on public.translators
  for update to authenticated
  using (public.is_manager() or user_id = auth.uid())
  with check (public.is_manager() or user_id = auth.uid());

drop policy if exists translators_delete on public.translators;
create policy translators_delete on public.translators
  for delete to authenticated using (public.is_manager());

-- ---------------------------------------------------------------------------
-- order_assignments: исполнитель видит и обновляет (только статус — см. триггер) свои
-- ---------------------------------------------------------------------------
drop policy if exists assignments_select on public.order_assignments;
create policy assignments_select on public.order_assignments
  for select to authenticated using (public.is_manager() or user_id = auth.uid());

drop policy if exists assignments_insert on public.order_assignments;
create policy assignments_insert on public.order_assignments
  for insert to authenticated with check (public.is_manager());

drop policy if exists assignments_update on public.order_assignments;
create policy assignments_update on public.order_assignments
  for update to authenticated
  using (public.is_manager() or user_id = auth.uid())
  with check (public.is_manager() or user_id = auth.uid());

drop policy if exists assignments_delete on public.order_assignments;
create policy assignments_delete on public.order_assignments
  for delete to authenticated using (public.is_manager());

-- ---------------------------------------------------------------------------
-- audit_log — только чтение администратором
-- ---------------------------------------------------------------------------
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- consents (152-ФЗ): создаёт сервер при оформлении заказа
-- ---------------------------------------------------------------------------
drop policy if exists consents_select on public.consents;
create policy consents_select on public.consents
  for select to authenticated using (public.is_manager() or user_id = auth.uid());

drop policy if exists consents_insert on public.consents;
create policy consents_insert on public.consents
  for insert to authenticated with check (user_id = auth.uid() or public.is_manager());

-- ---------------------------------------------------------------------------
-- chat_messages: клиент заказа и менеджеры (исполнители — читают по назначению)
-- ---------------------------------------------------------------------------
drop policy if exists chat_select on public.chat_messages;
create policy chat_select on public.chat_messages
  for select to authenticated using (
    public.is_manager() or sender_id = auth.uid() or public.can_view_order(order_id)
  );

drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert on public.chat_messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and (public.is_manager() or public.owns_order(order_id))
  );

drop policy if exists chat_update on public.chat_messages;
create policy chat_update on public.chat_messages
  for update to authenticated
  using (public.is_manager() or public.owns_order(order_id))
  with check (public.is_manager() or public.owns_order(order_id));

drop policy if exists chat_delete on public.chat_messages;
create policy chat_delete on public.chat_messages
  for delete to authenticated using (public.is_manager());

-- ---------------------------------------------------------------------------
-- settings: публичные — всем, остальные — менеджерам
-- ---------------------------------------------------------------------------
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select using (is_public or public.is_manager());

drop policy if exists settings_insert on public.settings;
create policy settings_insert on public.settings
  for insert to authenticated with check (public.is_admin());

drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings
  for update to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists settings_delete on public.settings;
create policy settings_delete on public.settings
  for delete to authenticated using (public.is_admin());

-- rate_limits — без политик: доступ только service_role (через rate_limit_hit).

-- ---------------------------------------------------------------------------
-- Гранты. RLS ограничивает фактические строки; anon получает только чтение.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
revoke all on all tables in schema public from anon;
grant select on public.services, public.price_rules, public.languages, public.settings to anon;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
revoke insert, update, delete on public.audit_log from authenticated;
revoke all on public.rate_limits from authenticated;
grant usage, select on all sequences in schema public to authenticated, service_role;
