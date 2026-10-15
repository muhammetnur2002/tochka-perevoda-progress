-- =============================================================================
-- 0009_phone_verification.sql
-- Подтверждение телефона SMS-кодом. Нужен, чтобы безопасно привязывать к
-- аккаунту гостевые заказы по номеру (иначе любой указал бы чужой телефон).
-- Доступ только у сервера (service_role): политик RLS нет.
-- =============================================================================

create table if not exists public.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  phone text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_phone_verifications_user
  on public.phone_verifications (user_id, created_at desc);

alter table public.phone_verifications enable row level security;
revoke all on public.phone_verifications from anon, authenticated;
grant select, insert, update, delete on public.phone_verifications to service_role;

-- Отметка о подтверждённом телефоне в профиле
alter table public.users add column if not exists phone_verified_at timestamptz;

-- Защита профиля: роль, Telegram-привязку, активность и отметку о подтверждении
-- телефона меняет только администратор/сервер. Смена телефона пользователем
-- сбрасывает подтверждение.
create or replace function public.users_prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  privileged boolean := public.is_admin() or coalesce(auth.role(), 'service_role') = 'service_role';
begin
  if not privileged then
    if new.role is distinct from old.role
       or new.telegram_id is distinct from old.telegram_id
       or new.is_active is distinct from old.is_active
       or (new.phone_verified_at is distinct from old.phone_verified_at
           and new.phone is not distinct from old.phone) then
      raise exception 'Роль, Telegram-привязку, активность и подтверждение телефона меняет только администратор';
    end if;
    if new.phone is distinct from old.phone then
      new.phone_verified_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_users_role_escalation on public.users;
create trigger trg_users_role_escalation
  before update of role, telegram_id, is_active, phone, phone_verified_at on public.users
  for each row execute function public.users_prevent_role_escalation();
