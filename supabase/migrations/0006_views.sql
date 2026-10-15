-- =============================================================================
-- 0006_views.sql
-- Представления для отчётов и аналитики. security_invoker = true: RLS базовых
-- таблиц применяется к тому, кто читает view (иначе view обходило бы RLS).
-- =============================================================================

-- Выручка по дням
create or replace view public.v_revenue_daily
  with (security_invoker = true) as
select
  (o.created_at at time zone 'Europe/Moscow')::date as day,
  count(*) as orders_count,
  coalesce(sum(o.total_price), 0) as revenue,
  coalesce(sum(o.paid_amount), 0) as paid
from public.orders o
where o.status <> 'cancelled'
group by 1;

-- Популярность услуг
create or replace view public.v_service_popularity
  with (security_invoker = true) as
select
  oi.service_id,
  s.name as service_name,
  s.category,
  count(*) as orders_count,
  coalesce(sum(oi.quantity), 0) as units_sold,
  coalesce(sum(oi.price), 0) as revenue
from public.order_items oi
join public.services s on s.id = oi.service_id
join public.orders o on o.id = oi.order_id
where o.status <> 'cancelled'
group by 1, 2, 3;

-- Популярность языков (язык оригинала)
create or replace view public.v_language_popularity
  with (security_invoker = true) as
select
  l.code,
  l.name,
  count(*) as orders_count
from public.orders o
join public.languages l on l.id = o.language_from
where o.status <> 'cancelled'
group by 1, 2;

-- Загрузка переводчиков
create or replace view public.v_translator_load
  with (security_invoker = true) as
select
  a.user_id,
  u.name,
  count(*) filter (where a.status in ('assigned','accepted','in_progress')) as active_tasks,
  count(*) filter (where a.status = 'done') as completed_tasks
from public.order_assignments a
join public.users u on u.id = a.user_id
where a.role = 'translator'
group by 1, 2;

-- Заказы с приближающимся дедлайном (< 24 ч)
create or replace view public.v_deadline_approaching
  with (security_invoker = true) as
select
  o.id,
  o.public_number,
  o.status,
  o.deadline,
  c.name as client_name,
  c.phone
from public.orders o
join public.clients c on c.id = o.client_id
where o.status in ('new','confirmed','in_progress')
  and o.deadline is not null
  and o.deadline <= now() + interval '24 hours';

-- Заказы, которые клиент не забрал (готовы > 3 дней)
create or replace view public.v_unclaimed_orders
  with (security_invoker = true) as
select
  o.id,
  o.public_number,
  o.deadline,
  o.updated_at,
  c.name as client_name,
  c.phone
from public.orders o
join public.clients c on c.id = o.client_id
where o.status = 'ready'
  and o.updated_at <= now() - interval '3 days';

revoke all on public.v_revenue_daily, public.v_service_popularity, public.v_language_popularity,
  public.v_translator_load, public.v_deadline_approaching, public.v_unclaimed_orders from anon;
grant select on public.v_revenue_daily, public.v_service_popularity, public.v_language_popularity,
  public.v_translator_load, public.v_deadline_approaching, public.v_unclaimed_orders
  to authenticated, service_role;
