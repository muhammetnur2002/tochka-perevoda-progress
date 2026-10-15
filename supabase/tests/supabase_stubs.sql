-- =============================================================================
-- supabase/tests/supabase_stubs.sql
-- Минимальные заглушки объектов Supabase для проверки миграций на «голом»
-- PostgreSQL (CI, локальный pg без Supabase CLI). НЕ применять к проекту Supabase:
-- там эти объекты уже есть.
--
--   psql "$PG_URL" -f supabase/tests/supabase_stubs.sql
--   for f in supabase/migrations/*.sql; do psql "$PG_URL" -v ON_ERROR_STOP=1 -f "$f"; done
--   psql "$PG_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_check.sql
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
grant usage on schema auth, storage to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''),
    case when current_user in ('anon', 'authenticated', 'service_role') then current_user::text end
  );
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  owner_id text,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

grant select, insert, update, delete on storage.objects, storage.buckets to authenticated, service_role;
grant select on storage.buckets to anon;
