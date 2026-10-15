-- =============================================================================
-- 0012_proofing.sql
-- Проверка перевода клиентом перед печатью («сверка»).
--  * сотрудник загружает страницы перевода (версия) + короткий список ключевых
--    данных (ФИО, даты, номера) и отправляет клиенту;
--  * клиент смотрит страницы только через сервер (с водяным знаком), сверяет
--    ключевые данные, оставляет замечания по местам на страницах или подтверждает;
--  * каждое решение фиксируется: время, IP, устройство, версия и хэш содержимого.
-- Страницы лежат в закрытом бакете под путём proofs/..., политики Storage на него
-- не распространяются — читает только сервер (service_role).
-- Запись во все таблицы — только через сервер; сотрудникам доступно чтение.
-- Идемпотентно.
-- =============================================================================

-- Состояние сверки на заказе (для канбана и фильтров)
alter table public.orders
  add column if not exists proof_status text not null default 'none'
  check (proof_status in ('none', 'awaiting_client', 'changes_requested', 'approved'));

-- ---------------------------------------------------------------------------
-- Версии перевода на проверке
-- ---------------------------------------------------------------------------
create table if not exists public.proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  version int not null check (version > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'changes_requested', 'superseded')),
  -- Сообщение сотрудника клиенту (что обратить внимание)
  note text,
  -- Ключевые данные для сверки: [{ "id": "f1", "label": "ФИО", "value": "..." }]
  key_fields jsonb not null default '[]'::jsonb,
  -- Страницы: [{ "n": 1, "path": "proofs/<order>/<proof>/1.jpg", "width": 1240, "height": 1754 }]
  pages jsonb not null default '[]'::jsonb,
  page_count int not null check (page_count > 0),
  -- SHA-256 содержимого страниц: доказывает, ЧТО именно подтвердил клиент
  content_hash text not null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  -- Решение: способ (online/office), галочки, ответы по ключевым данным, ip, ua
  decision jsonb,
  unique (order_id, version)
);
create index if not exists idx_proofs_order on public.proofs (order_id, version desc);

-- ---------------------------------------------------------------------------
-- Замечания клиента: к месту на странице и/или к ключевому полю
-- ---------------------------------------------------------------------------
create table if not exists public.proof_comments (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references public.proofs (id) on delete cascade,
  page int check (page is null or page > 0),
  -- Положение метки на странице в долях 0..1
  x numeric(5, 4) check (x is null or (x >= 0 and x <= 1)),
  y numeric(5, 4) check (y is null or (y >= 0 and y <= 1)),
  -- Если замечание к ключевому полю — его id; proposed_value — как должно быть
  field_id text,
  proposed_value text,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists idx_proof_comments_proof on public.proof_comments (proof_id);

-- ---------------------------------------------------------------------------
-- Журнал событий сверки (кто, когда, откуда)
-- ---------------------------------------------------------------------------
create table if not exists public.proof_events (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references public.proofs (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  event text not null
    check (event in ('created', 'sent', 'opened', 'approved', 'changes_requested', 'office_approved', 'superseded', 'reminded')),
  actor_id uuid references public.users (id) on delete set null,
  actor_role text,
  ip text,
  user_agent text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_proof_events_order on public.proof_events (order_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: чтение — тем, кто видит заказ (клиент-владелец, назначенный исполнитель,
-- менеджеры); журнал с IP — только менеджерам. Запись — только сервер.
-- ---------------------------------------------------------------------------
alter table public.proofs enable row level security;
alter table public.proof_comments enable row level security;
alter table public.proof_events enable row level security;

drop policy if exists proofs_select on public.proofs;
create policy proofs_select on public.proofs
  for select to authenticated using (public.can_view_order(order_id));

drop policy if exists proof_comments_select on public.proof_comments;
create policy proof_comments_select on public.proof_comments
  for select to authenticated using (
    exists (select 1 from public.proofs p where p.id = proof_id and public.can_view_order(p.order_id))
  );

drop policy if exists proof_events_select on public.proof_events;
create policy proof_events_select on public.proof_events
  for select to authenticated using (public.is_manager());

revoke all on public.proofs, public.proof_comments, public.proof_events from anon;
grant select on public.proofs, public.proof_comments, public.proof_events to authenticated;
grant select, insert, update, delete on public.proofs, public.proof_comments, public.proof_events to service_role;
