-- =============================================================================
-- 0010_offices_languages.sql
-- 1) Точки приёма (офисы) в Казани: клиент выбирает ближайшую при заказе.
-- 2) Направления перевода: только с 14 языков на русский.
-- Идемпотентно.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Точки приёма документов
-- ---------------------------------------------------------------------------
create table if not exists public.offices (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  city text not null default 'Казань',
  address text not null,
  hours text,
  phone text,
  lat numeric(9, 6),
  lng numeric(9, 6),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_offices_updated on public.offices;
create trigger trg_offices_updated before update on public.offices
  for each row execute function public.set_updated_at();

alter table public.offices enable row level security;

drop policy if exists offices_select on public.offices;
create policy offices_select on public.offices
  for select using (is_active or public.is_manager());
drop policy if exists offices_insert on public.offices;
create policy offices_insert on public.offices
  for insert to authenticated with check (public.is_admin());
drop policy if exists offices_update on public.offices;
create policy offices_update on public.offices
  for update to authenticated using (public.is_manager()) with check (public.is_manager());
drop policy if exists offices_delete on public.offices;
create policy offices_delete on public.offices
  for delete to authenticated using (public.is_admin());

grant select on public.offices to anon;
grant select, insert, update, delete on public.offices to authenticated, service_role;

-- Часы работы и телефоны заполняются в админке (Настройки → Точки)
insert into public.offices (slug, name, address, sort_order) values
  ('sibirsky-trakt', 'Сибирский Тракт', 'ул. Сибирский Тракт, 7/6', 1),
  ('karla-marksa', 'Карла Маркса', 'ул. Карла Маркса, 65', 2),
  ('promyslovaya', 'Промысловая', 'ул. Промысловая, 5, каб. 3', 3)
on conflict (slug) do nothing;

-- Заказ привязан к точке, куда клиент приносит/где получает документы
alter table public.orders
  add column if not exists office_id uuid references public.offices (id) on delete set null;
create index if not exists idx_orders_office on public.orders (office_id, status);

-- Старые заказы без точки — на основной адрес
update public.orders
   set office_id = (select id from public.offices where slug = 'sibirsky-trakt')
 where office_id is null;

-- Аудит изменений точек
drop trigger if exists trg_audit_offices on public.offices;
create trigger trg_audit_offices
  after insert or update or delete on public.offices
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Языки: исходные языки перевода (на русский)
-- ---------------------------------------------------------------------------
alter table public.languages add column if not exists is_source boolean not null default false;

insert into public.languages (code, name) values
  ('tr', 'Турецкий'),
  ('uz', 'Узбекский'),
  ('fa', 'Персидский (Иран, фарси)'),
  ('kk', 'Казахский'),
  ('az', 'Азербайджанский'),
  ('ky', 'Киргизский'),
  ('tk', 'Туркменский'),
  ('de', 'Немецкий'),
  ('en', 'Английский'),
  ('fr', 'Французский'),
  ('es', 'Испанский'),
  ('it', 'Итальянский'),
  ('ar-IQ', 'Арабский (Ирак)'),
  ('ar-SY', 'Арабский (Сирия)'),
  ('ru', 'Русский')
on conflict (code) do update set name = excluded.name;

-- 14 исходных языков; русский — только язык перевода
update public.languages
   set is_source = code in ('tr','uz','fa','kk','az','ky','tk','de','en','fr','es','it','ar-IQ','ar-SY'),
       is_active = code in ('tr','uz','fa','kk','az','ky','tk','de','en','fr','es','it','ar-IQ','ar-SY','ru');

-- Порядок в списке выбора
alter table public.languages add column if not exists sort_order int not null default 100;
update public.languages l set sort_order = o.ord
  from (values ('tk',1),('uz',2),('tr',3),('az',4),('kk',5),('ky',6),('fa',7),
               ('ar-IQ',8),('ar-SY',9),('en',10),('de',11),('fr',12),('es',13),('it',14),('ru',0))
       as o(code, ord)
 where l.code = o.code;
