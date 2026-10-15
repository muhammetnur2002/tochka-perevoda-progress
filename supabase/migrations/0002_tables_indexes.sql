-- =============================================================================
-- 0002_tables_indexes.sql
-- Таблицы и индексы. Схема соответствует модели данных ТЗ + служебные таблицы.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Пользователи (профиль, связан с auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'client',
  name text,
  phone text,
  email text,
  telegram_id bigint unique,
  telegram_username text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Клиенты (юр. лица и физ. лица)
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  name text not null,
  phone text,
  email text,
  inn text,
  type public.client_type not null default 'individual',
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_clients_phone on public.clients (phone);
create index if not exists idx_clients_user on public.clients (user_id);

-- ---------------------------------------------------------------------------
-- Услуги (каталог с ценами)
-- ---------------------------------------------------------------------------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  category public.service_category not null,
  name text not null,
  description text,
  price numeric(12, 2) not null default 0,
  unit public.service_unit not null default 'document',
  duration_days int not null default 2,
  is_active boolean not null default true,
  -- услуга уже включает нотариальное заверение (название с «нотариальный»)
  is_notarial boolean not null default false,
  sort_order int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_services_category_active on public.services (category, is_active);

-- ---------------------------------------------------------------------------
-- Правила ценообразования (за страницу / объём / срочность)
-- ---------------------------------------------------------------------------
create table if not exists public.price_rules (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  rule_type public.price_rule_type not null,
  value numeric(12, 4) not null,
  min_qty int,
  max_qty int,
  priority int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_price_rules_service on public.price_rules (service_id, rule_type);

-- ---------------------------------------------------------------------------
-- Языки перевода
-- ---------------------------------------------------------------------------
create table if not exists public.languages (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Заказы
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  public_number text unique not null,
  client_id uuid not null references public.clients (id) on delete restrict,
  user_id uuid references public.users (id) on delete set null,
  status public.order_status not null default 'new',
  language_from uuid references public.languages (id) on delete set null,
  language_to uuid references public.languages (id) on delete set null,
  subtotal numeric(12, 2) not null default 0,
  urgency_coefficient numeric(4, 2) not null default 1,
  notary_fee numeric(12, 2) not null default 0,
  delivery_fee numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  total_price numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  deadline timestamptz,
  delivery_type public.delivery_type not null default 'pickup',
  delivery_address text,
  comment text,
  source public.order_source not null default 'web',
  promo_code text,
  issued_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orders_status_created on public.orders (status, created_at desc);
create index if not exists idx_orders_client on public.orders (client_id);
create index if not exists idx_orders_user on public.orders (user_id);
create index if not exists idx_orders_deadline_active
  on public.orders (deadline)
  where status in ('new', 'confirmed', 'in_progress');
create index if not exists idx_orders_created on public.orders (created_at desc);

-- ---------------------------------------------------------------------------
-- Позиции заказа
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  name_snapshot text not null,
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null,
  price numeric(12, 2) not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_order_items_order on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Файлы
-- ---------------------------------------------------------------------------
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  kind public.file_kind not null default 'source',
  uploaded_by uuid references public.users (id) on delete set null,
  checksum text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_files_order on public.files (order_id);

-- ---------------------------------------------------------------------------
-- Платежи
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null default 'RUB',
  method public.payment_method not null default 'card',
  status public.payment_status not null default 'pending',
  provider text not null default 'mock',
  provider_payment_id text unique,
  idempotence_key text unique,
  confirmation_url text,
  paid_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payments_order on public.payments (order_id);
create index if not exists idx_payments_provider_id on public.payments (provider_payment_id);

-- ---------------------------------------------------------------------------
-- История смены статусов
-- ---------------------------------------------------------------------------
create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references public.users (id) on delete set null,
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists idx_status_history_order on public.status_history (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Уведомления (одновременно очередь доставки)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  order_id uuid references public.orders (id) on delete cascade,
  channel public.notification_channel not null,
  recipient text,
  subject text,
  message text not null,
  status public.notification_status not null default 'queued',
  provider_id text,
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_queue on public.notifications (status, next_attempt_at);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Переводчики (профиль нагрузки)
-- ---------------------------------------------------------------------------
create table if not exists public.translators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  languages uuid[] not null default '{}',
  specialization text,
  capacity_per_day int not null default 5,
  current_load int not null default 0,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Назначения исполнителей (переводчик / нотариус / печатник)
-- ---------------------------------------------------------------------------
create table if not exists public.order_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  order_item_id uuid references public.order_items (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.assignment_role not null,
  status public.assignment_status not null default 'assigned',
  assigned_by uuid references public.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz
);
create index if not exists idx_assignments_user on public.order_assignments (user_id, status);
create index if not exists idx_assignments_order on public.order_assignments (order_id);

-- ---------------------------------------------------------------------------
-- Аудит действий
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role public.user_role,
  entity text not null,
  entity_id text,
  action text not null,
  before jsonb,
  after jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_entity on public.audit_log (entity, entity_id, created_at desc);
create index if not exists idx_audit_created on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Согласия на обработку ПД (152-ФЗ)
-- ---------------------------------------------------------------------------
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  order_id uuid references public.orders (id) on delete cascade,
  phone text,
  doc_type text not null default 'pd_processing',
  doc_version text not null default '1.0',
  accepted_at timestamptz not null default now(),
  ip inet,
  user_agent text
);
create index if not exists idx_consents_order on public.consents (order_id);

-- ---------------------------------------------------------------------------
-- Чат клиента с менеджером (Mini App)
-- ---------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete cascade,
  sender_id uuid references public.users (id) on delete set null,
  sender_role public.user_role not null default 'client',
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_order on public.chat_messages (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Настройки (key/value), в т.ч. публичные для каталога
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Рейт-лимиты (антифрод, серверная запись через service role)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  bucket text not null,
  identifier text not null,
  count int not null default 1,
  reset_at timestamptz not null default now(),
  primary key (bucket, identifier)
);
