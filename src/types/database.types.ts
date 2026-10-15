/**
 * Типы базы данных Supabase.
 *
 * Сгенерированы вручную по supabase/migrations (см. docs/DATA-MODEL.md).
 * Для перегенерации официальных типов из облачного проекта выполните:
 *   pnpm db:types   (требует Supabase CLI и привязанного проекта)
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// Перечисления (соответствуют SQL-типам из 0001_extensions_enums.sql)
// ---------------------------------------------------------------------------
export type UserRole =
  | "guest"
  | "client"
  | "manager"
  | "translator"
  | "notary"
  | "printer"
  | "admin";

export type ClientType = "individual" | "company";
export type ServiceCategory = "translation" | "printing" | "insurance" | "additional";
export type ServiceUnit = "page" | "document" | "item";
export type PriceRuleType = "fixed" | "per_page" | "urgent" | "notary" | "delivery" | "volume";
export type OrderStatus =
  | "new"
  | "confirmed"
  | "in_progress"
  | "ready"
  | "issued"
  | "completed"
  | "cancelled";
export type DeliveryType = "pickup" | "delivery";
export type OrderSource = "web" | "mini_app" | "bot" | "admin" | "walkin";
export type FileKind = "source" | "translation" | "receipt" | "photo" | "other";
export type PaymentMethod = "card" | "sbp" | "qr" | "cash" | "invoice";
export type PaymentStatus =
  | "pending"
  | "waiting_for_capture"
  | "succeeded"
  | "canceled"
  | "refunded";
export type NotificationChannel = "telegram" | "sms" | "email" | "inapp";
export type NotificationStatus = "queued" | "sent" | "failed";
export type AssignmentRole = "translator" | "notary" | "printer" | "manager";
export type AssignmentStatus = "assigned" | "accepted" | "in_progress" | "done" | "rejected";

// ---------------------------------------------------------------------------
// Строки таблиц
// ---------------------------------------------------------------------------
export type UserRow = {
  id: string;
  role: UserRole;
  name: string | null;
  phone: string | null;
  email: string | null;
  telegram_id: number | null;
  telegram_username: string | null;
  is_active: boolean;
  phone_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientRow = {
  id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  inn: string | null;
  type: ClientType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceRow = {
  id: string;
  slug: string;
  category: ServiceCategory;
  name: string;
  description: string | null;
  price: number;
  unit: ServiceUnit;
  duration_days: number;
  is_active: boolean;
  is_notarial: boolean;
  sort_order: number;
  meta: Json;
  created_at: string;
  updated_at: string;
};

export type PriceRuleRow = {
  id: string;
  service_id: string;
  rule_type: PriceRuleType;
  value: number;
  min_qty: number | null;
  max_qty: number | null;
  priority: number;
  is_active: boolean;
  created_at: string;
};

export type LanguageRow = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

export type OrderRow = {
  id: string;
  public_number: string;
  client_id: string;
  user_id: string | null;
  status: OrderStatus;
  language_from: string | null;
  language_to: string | null;
  subtotal: number;
  urgency_coefficient: number;
  notary_fee: number;
  delivery_fee: number;
  discount: number;
  total_price: number;
  paid_amount: number;
  deadline: string | null;
  delivery_type: DeliveryType;
  delivery_address: string | null;
  comment: string | null;
  source: OrderSource;
  promo_code: string | null;
  issued_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  service_id: string | null;
  name_snapshot: string;
  quantity: number;
  unit_price: number;
  price: number;
  meta: Json;
  created_at: string;
};

export type FileRow = {
  id: string;
  order_id: string | null;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  kind: FileKind;
  uploaded_by: string | null;
  checksum: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  provider: string;
  provider_payment_id: string | null;
  idempotence_key: string | null;
  confirmation_url: string | null;
  paid_at: string | null;
  raw: Json;
  created_at: string;
  updated_at: string;
};

export type StatusHistoryRow = {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string | null;
  comment: string | null;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string | null;
  order_id: string | null;
  channel: NotificationChannel;
  recipient: string | null;
  subject: string | null;
  message: string;
  status: NotificationStatus;
  provider_id: string | null;
  attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
};

export type TranslatorRow = {
  id: string;
  user_id: string;
  languages: string[];
  specialization: string | null;
  capacity_per_day: number;
  current_load: number;
  is_available: boolean;
  created_at: string;
};

export type OrderAssignmentRow = {
  id: string;
  order_id: string;
  order_item_id: string | null;
  user_id: string;
  role: AssignmentRole;
  status: AssignmentStatus;
  assigned_by: string | null;
  assigned_at: string;
  due_at: string | null;
  completed_at: string | null;
};

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  actor_role: UserRole | null;
  entity: string;
  entity_id: string | null;
  action: string;
  before: Json;
  after: Json;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type ConsentRow = {
  id: string;
  user_id: string | null;
  order_id: string | null;
  phone: string | null;
  doc_type: string;
  doc_version: string;
  accepted_at: string;
  ip: string | null;
  user_agent: string | null;
};

export type ChatMessageRow = {
  id: string;
  order_id: string | null;
  sender_id: string | null;
  sender_role: UserRole;
  body: string;
  attachments: Json;
  read_at: string | null;
  created_at: string;
};

export type RateLimitRow = {
  bucket: string;
  identifier: string;
  count: number;
  reset_at: string;
};

export type PhoneVerificationRow = {
  id: string;
  user_id: string;
  phone: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  verified_at: string | null;
  created_at: string;
};

export type SettingRow = {
  key: string;
  value: Json;
  is_public: boolean;
  updated_by: string | null;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Составной тип Database (формат `supabase gen types typescript`)
// ---------------------------------------------------------------------------
type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

/** Связь «многие к одному» по внешнему ключу. */
type Fk<Name extends string, Col extends string, Ref extends string> = {
  foreignKeyName: Name;
  columns: [Col];
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

type Table<Row, Insert, Relationships extends Rel[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: Relationships;
};

type View<Row> = { Row: Row; Relationships: [] };

/** Обязательные поля вставки + остальные необязательные. */
type Ins<Row, Req extends keyof Row> = Pick<Row, Req> & Partial<Omit<Row, Req>>;

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      users: Table<UserRow, Ins<UserRow, "id">>;
      clients: Table<
        ClientRow,
        Ins<ClientRow, "name">,
        [
          Fk<"clients_user_id_fkey", "user_id", "users">,
          Fk<"clients_created_by_fkey", "created_by", "users">,
        ]
      >;
      services: Table<ServiceRow, Ins<ServiceRow, "slug" | "category" | "name">>;
      price_rules: Table<
        PriceRuleRow,
        Ins<PriceRuleRow, "service_id" | "rule_type" | "value">,
        [Fk<"price_rules_service_id_fkey", "service_id", "services">]
      >;
      languages: Table<LanguageRow, Ins<LanguageRow, "code" | "name">>;
      orders: Table<
        OrderRow,
        Ins<OrderRow, "client_id">,
        [
          Fk<"orders_client_id_fkey", "client_id", "clients">,
          Fk<"orders_user_id_fkey", "user_id", "users">,
          Fk<"orders_language_from_fkey", "language_from", "languages">,
          Fk<"orders_language_to_fkey", "language_to", "languages">,
        ]
      >;
      order_items: Table<
        OrderItemRow,
        Ins<OrderItemRow, "order_id" | "name_snapshot" | "unit_price" | "price">,
        [
          Fk<"order_items_order_id_fkey", "order_id", "orders">,
          Fk<"order_items_service_id_fkey", "service_id", "services">,
        ]
      >;
      files: Table<
        FileRow,
        Ins<FileRow, "storage_path" | "original_name" | "mime_type">,
        [Fk<"files_order_id_fkey", "order_id", "orders">]
      >;
      payments: Table<
        PaymentRow,
        Ins<PaymentRow, "order_id" | "amount">,
        [Fk<"payments_order_id_fkey", "order_id", "orders">]
      >;
      status_history: Table<
        StatusHistoryRow,
        Ins<StatusHistoryRow, "order_id" | "to_status">,
        [
          Fk<"status_history_order_id_fkey", "order_id", "orders">,
          Fk<"status_history_changed_by_fkey", "changed_by", "users">,
        ]
      >;
      notifications: Table<
        NotificationRow,
        Ins<NotificationRow, "channel" | "message">,
        [Fk<"notifications_order_id_fkey", "order_id", "orders">]
      >;
      translators: Table<
        TranslatorRow,
        Ins<TranslatorRow, "user_id">,
        [Fk<"translators_user_id_fkey", "user_id", "users">]
      >;
      order_assignments: Table<
        OrderAssignmentRow,
        Ins<OrderAssignmentRow, "order_id" | "user_id" | "role">,
        [
          Fk<"order_assignments_order_id_fkey", "order_id", "orders">,
          Fk<"order_assignments_order_item_id_fkey", "order_item_id", "order_items">,
          Fk<"order_assignments_user_id_fkey", "user_id", "users">,
          Fk<"order_assignments_assigned_by_fkey", "assigned_by", "users">,
        ]
      >;
      audit_log: Table<AuditLogRow, Ins<AuditLogRow, "entity" | "action">>;
      consents: Table<
        ConsentRow,
        Partial<ConsentRow>,
        [Fk<"consents_order_id_fkey", "order_id", "orders">]
      >;
      chat_messages: Table<
        ChatMessageRow,
        Ins<ChatMessageRow, "body">,
        [
          Fk<"chat_messages_order_id_fkey", "order_id", "orders">,
          Fk<"chat_messages_sender_id_fkey", "sender_id", "users">,
        ]
      >;
      settings: Table<SettingRow, Ins<SettingRow, "key" | "value">>;
      rate_limits: Table<RateLimitRow, Ins<RateLimitRow, "bucket" | "identifier">>;
      phone_verifications: Table<
        PhoneVerificationRow,
        Ins<PhoneVerificationRow, "user_id" | "phone" | "code_hash" | "expires_at">,
        [Fk<"phone_verifications_user_id_fkey", "user_id", "users">]
      >;
    };
    Views: {
      v_revenue_daily: View<{ day: string; orders_count: number; revenue: number; paid: number }>;
      v_service_popularity: View<{
        service_id: string | null;
        service_name: string | null;
        category: ServiceCategory | null;
        orders_count: number;
        units_sold: number;
        revenue: number;
      }>;
      v_language_popularity: View<{ code: string | null; name: string | null; orders_count: number }>;
      v_translator_load: View<{
        user_id: string;
        name: string | null;
        active_tasks: number;
        completed_tasks: number;
      }>;
      v_deadline_approaching: View<{
        id: string;
        public_number: string;
        status: OrderStatus;
        deadline: string | null;
        client_name: string;
        phone: string | null;
      }>;
      v_unclaimed_orders: View<{
        id: string;
        public_number: string;
        deadline: string | null;
        updated_at: string;
        client_name: string;
        phone: string | null;
      }>;
    };
    Functions: {
      get_user_role: { Args: Record<string, never>; Returns: UserRole };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_manager: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_assigned_to_order: { Args: { p_order_id: string }; Returns: boolean };
      can_view_order: { Args: { p_order_id: string }; Returns: boolean };
      owns_order: { Args: { p_order_id: string }; Returns: boolean };
      normalize_phone: { Args: { p_phone: string }; Returns: string | null };
      claim_guest_orders: { Args: { p_user_id: string }; Returns: number };
      change_order_status: {
        Args: { p_order_id: string; p_status: OrderStatus; p_comment?: string; p_cancel_reason?: string };
        Returns: OrderRow;
      };
      rate_limit_hit: {
        Args: { p_bucket: string; p_identifier: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      client_type: ClientType;
      service_category: ServiceCategory;
      service_unit: ServiceUnit;
      price_rule_type: PriceRuleType;
      order_status: OrderStatus;
      delivery_type: DeliveryType;
      order_source: OrderSource;
      file_kind: FileKind;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      notification_channel: NotificationChannel;
      notification_status: NotificationStatus;
      assignment_role: AssignmentRole;
      assignment_status: AssignmentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

/** Строка таблицы по имени: Tables<"orders">. */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
