import type { CartItem, PriceBreakdown, UrgencyKey } from "@/types/domain";
import { round2 } from "@/lib/format/money";
import { addBusinessDays } from "./deadline";

/**
 * Движок расчёта стоимости и срока. Единственный источник правды по цене:
 * клиент показывает предварительный итог этим же модулем, но в заказ пишется
 * только результат серверного расчёта по ценам из БД.
 *
 * Формула (совпадает с триггером recalc_order_totals в БД):
 *   total = (Σ quantity × unit_price − скидка за объём) × коэффициент срочности
 *           + нотариальное заверение + доставка
 */

export interface UrgencySettings {
  "1d": number;
  same_day: number;
}

/** Объёмная скидка для конкретной услуги (settings.volume_discounts). */
export interface VolumeDiscount {
  slug: string;
  minQty: number;
  /** Множитель цены позиции, например 0.95 = −5%. */
  coefficient: number;
}

export interface PricingSettings {
  urgency: UrgencySettings;
  /** Цена заверения одного документа (для переводов без заверения в цене). */
  notaryFee: number;
  deliveryPrice: number;
  holidays: string[];
  volumeDiscounts: VolumeDiscount[];
}

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  urgency: { "1d": 1.5, same_day: 2.0 },
  notaryFee: 0,
  deliveryPrice: 0,
  holidays: [],
  volumeDiscounts: [{ slug: "legal", minQty: 10, coefficient: 0.95 }],
};

function num(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function parseVolumeDiscounts(raw: unknown): VolumeDiscount[] {
  if (!Array.isArray(raw)) return DEFAULT_PRICING_SETTINGS.volumeDiscounts;
  return raw.flatMap((r): VolumeDiscount[] => {
    if (!r || typeof r !== "object") return [];
    const rec = r as Record<string, unknown>;
    if (typeof rec.slug !== "string") return [];
    const coefficient = num(rec.coefficient, 1);
    const minQty = num(rec.minQty, 0);
    if (coefficient <= 0 || coefficient > 1 || minQty < 1) return [];
    return [{ slug: rec.slug, minQty, coefficient }];
  });
}

/** Преобразует публичные настройки из БД (settings) в PricingSettings. */
export function settingsToPricing(raw?: Record<string, unknown>): PricingSettings {
  const urgency = (raw?.urgency ?? {}) as Record<string, unknown>;
  return {
    urgency: {
      "1d": num(urgency["1d"], 1.5),
      same_day: num(urgency.same_day, 2.0),
    },
    notaryFee: Math.max(0, num(raw?.notary_fee, 0)),
    deliveryPrice: Math.max(0, num(raw?.delivery_price, 0)),
    holidays: Array.isArray(raw?.holidays)
      ? (raw.holidays as unknown[]).filter((d): d is string => typeof d === "string")
      : [],
    volumeDiscounts: parseVolumeDiscounts(raw?.volume_discounts),
  };
}

export interface PriceOptions {
  urgency: UrgencyKey;
  notaryRequested: boolean;
  deliveryType: "pickup" | "delivery";
  settings: PricingSettings;
  now?: Date;
}

/** Коэффициент срочности по ключу. */
export function urgencyCoefficient(key: UrgencyKey, settings: PricingSettings): number {
  switch (key) {
    case "1d":
      return settings.urgency["1d"];
    case "same_day":
      return settings.urgency.same_day;
    default:
      return 1;
  }
}

/** Срок в рабочих днях с учётом срочности (0 = в день обращения). */
export function urgencyDays(key: UrgencyKey, serviceDurationDays: number): number {
  switch (key) {
    case "1d":
      return 1;
    case "same_day":
      return 0;
    default:
      return Math.max(1, serviceDurationDays);
  }
}

/**
 * Сколько документов требуют отдельного нотариального заверения: переводы без
 * заверения в цене. Для «постраничных» услуг одна позиция = один документ.
 */
export function notaryUnits(items: CartItem[]): number {
  return items
    .filter((i) => i.category === "translation" && !i.isNotarial)
    .reduce((sum, i) => sum + (i.unit === "page" ? 1 : i.quantity), 0);
}

/** Можно ли предложить клиенту доп. заверение. */
export function canRequestNotary(items: CartItem[]): boolean {
  return notaryUnits(items) > 0;
}

function volumeCoefficient(item: CartItem, discounts: VolumeDiscount[]): number {
  const rule = discounts
    .filter((d) => d.slug === item.slug && item.quantity >= d.minQty)
    .sort((a, b) => b.minQty - a.minQty)[0];
  return rule?.coefficient ?? 1;
}

/**
 * Полный расчёт заказа: разбивка по позициям, скидки, надбавка за срочность,
 * нотариальное заверение, доставка и дедлайн по производственному календарю.
 */
export function calculatePrice(items: CartItem[], options: PriceOptions): PriceBreakdown {
  const settings = options.settings ?? DEFAULT_PRICING_SETTINGS;
  const now = options.now ?? new Date();

  const lines = items.map((item) => {
    const base = round2(item.unitPrice * item.quantity);
    const lineTotal = round2(base * volumeCoefficient(item, settings.volumeDiscounts));
    return {
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      base,
      lineTotal,
    };
  });

  const subtotal = round2(lines.reduce((sum, l) => sum + l.base, 0));
  const itemsAfterDiscount = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const discount = round2(subtotal - itemsAfterDiscount);

  const coefficient = urgencyCoefficient(options.urgency, settings);
  const urgencySurcharge = round2(itemsAfterDiscount * (coefficient - 1));

  const notaryFee =
    options.notaryRequested && canRequestNotary(items)
      ? round2(settings.notaryFee * notaryUnits(items))
      : 0;
  const deliveryFee = options.deliveryType === "delivery" ? settings.deliveryPrice : 0;

  const total = round2(itemsAfterDiscount * coefficient + notaryFee + deliveryFee);

  // Срок: максимум среди услуг с учётом срочности
  const maxServiceDays = items.length ? Math.max(...items.map((i) => i.durationDays)) : 1;
  const businessDays = urgencyDays(options.urgency, maxServiceDays);
  const deadline = items.length ? addBusinessDays(now, businessDays, settings.holidays) : null;

  return {
    lines: lines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    subtotal,
    urgencyKey: options.urgency,
    urgencyCoefficient: coefficient,
    urgencySurcharge,
    notaryFee,
    deliveryFee,
    discount,
    total,
    durationDays: businessDays,
    deadline,
  };
}

/** Итоговая стоимость (быстрый вызов для корзины). */
export function calculateTotal(items: CartItem[], options: PriceOptions): number {
  return calculatePrice(items, options).total;
}
