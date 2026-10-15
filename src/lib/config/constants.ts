/**
 * Константы компании и общие параметры платформы.
 * Реквизиты телефона/email — плейсхолдеры: замените на реальные перед продакшеном.
 */
export const COMPANY = {
  name: "Точка Перевода Прогресс",
  shortName: "Точка Перевода",
  legalName: "Бюро переводов «Точка Перевода Прогресс»",
  city: "Казань",
  address: "г. Казань, ул. Сибирский Тракт, 7/6",
  addressShort: "ул. Сибирский Тракт, 7/6",
  /** TODO: заменить на реальный телефон. */
  phone: "8 (843) 000-00-00",
  phoneHref: "+78430000000",
  /** TODO: заменить на реальный email. */
  email: "info@tochka-perevoda.ru",
  workHours: "Пн–Пт 9:00–19:00, Сб 10:00–16:00",
  /** Координаты для карты и JSON-LD. */
  geo: { lat: 55.7887, lng: 49.1221 },
} as const;

export const APP = {
  name: "tochka-perevoda-progress",
  version: "1.0.0",
} as const;

/** Статусы заказа (единый источник для статус-бара и SQL). */
export const ORDER_STATUSES = [
  "new",
  "confirmed",
  "in_progress",
  "ready",
  "issued",
  "completed",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number] | "cancelled";

/** Type guard для статуса заказа из строки (query-параметры и т.п.). */
export function isOrderStatus(value: string): value is OrderStatus {
  return value === "cancelled" || (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Человекочитаемые подписи статусов. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  in_progress: "В работе",
  ready: "Готов",
  issued: "Выдан",
  completed: "Завершён",
  cancelled: "Отменён",
};

/** Порядок статусов для канбана и timeline. */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "new",
  "confirmed",
  "in_progress",
  "ready",
  "issued",
  "completed",
];

/** Категории услуг. */
export const SERVICE_CATEGORIES = ["translation", "printing", "insurance", "additional"] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  translation: "Переводы",
  printing: "Полиграфия",
  insurance: "Страхование",
  additional: "Дополнительно",
};

/** Версия документа согласия на обработку ПД (152-ФЗ). */
export const CONSENT_VERSION = "1.0";
