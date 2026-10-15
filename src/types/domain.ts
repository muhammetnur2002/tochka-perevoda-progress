import type {
  DeliveryType,
  OrderSource,
  OrderStatus,
  ServiceCategory,
  ServiceUnit,
} from "./database.types";

/** Уровень срочности. Коэффициенты хранятся в settings.urgency. */
export type UrgencyKey = "standard" | "1d" | "same_day";

export const URGENCY_KEYS: UrgencyKey[] = ["standard", "1d", "same_day"];

/** Позиция корзины/калькулятора. */
export interface CartItem {
  /** Уникальный ключ позиции (slug + опции). */
  key: string;
  serviceId: string;
  slug: string;
  name: string;
  category: ServiceCategory;
  unit: ServiceUnit;
  unitPrice: number;
  /** Количество: страниц (для unit=page) или штук/документов. */
  quantity: number;
  /** Услуга уже включает нотариальное заверение. */
  isNotarial: boolean;
  /** Срок выполнения услуги в рабочих днях (для расчёта дедлайна). */
  durationDays: number;
  /** Метаданные для заказа (язык, формат и пр.). */
  meta: Record<string, unknown>;
}

/** Разбивка цены от движка расчёта. */
export interface PriceBreakdown {
  lines: {
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  urgencyKey: UrgencyKey;
  urgencyCoefficient: number;
  urgencySurcharge: number;
  notaryFee: number;
  deliveryFee: number;
  discount: number;
  /** Скидка по промокоду / автоскидке (уже вычтена из total). */
  promoDiscount: number;
  total: number;
  durationDays: number;
  deadline: Date | null;
}

/** Черновик заказа (клиентская форма). */
export interface OrderDraft {
  items: CartItem[];
  urgency: UrgencyKey;
  languageFrom: string | null;
  languageTo: string | null;
  deliveryType: DeliveryType;
  deliveryAddress: string | null;
  comment: string | null;
  /** Доп. нотариальное заверение для не-нотариальных переводов. */
  notaryRequested: boolean;
  /** Согласие на обработку ПД (152-ФЗ) — обязательно. */
  consent: boolean;
}

/** Поля клиента при оформлении заказа. */
export interface CustomerInfo {
  name: string;
  phone: string;
  email: string | null;
  telegram: string | null;
  inn: string | null;
  type: "individual" | "company";
}

/** Тело POST /api/orders. */
export interface CreateOrderPayload extends CustomerInfo {
  items: CartItem[];
  urgency: UrgencyKey;
  languageFrom: string | null;
  languageTo: string | null;
  deliveryType: DeliveryType;
  deliveryAddress: string | null;
  comment: string | null;
  notaryRequested: boolean;
  consent: boolean;
  source: OrderSource;
  /** Согласие пришло из Telegram Mini App (initData прикладывается отдельно). */
}

/** Расширенный заказ с вложенными данными (для карточки/статуса). */
export interface OrderWithDetails {
  id: string;
  public_number: string;
  status: OrderStatus;
  total_price: number;
  paid_amount: number;
  deadline: string | null;
  delivery_type: DeliveryType;
  delivery_address: string | null;
  comment: string | null;
  source: OrderSource;
  created_at: string;
  updated_at: string;
  client: { name: string; phone: string | null; email: string | null } | null;
  items: {
    id: string;
    name: string;
    quantity: number;
    unit_price: number;
    price: number;
  }[];
  files: {
    id: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    kind: string;
  }[];
  payments: {
    id: string;
    amount: number;
    method: string;
    status: string;
    confirmation_url: string | null;
    paid_at: string | null;
  }[];
  history: {
    id: string;
    from_status: OrderStatus | null;
    to_status: OrderStatus;
    created_at: string;
    comment: string | null;
  }[];
}
