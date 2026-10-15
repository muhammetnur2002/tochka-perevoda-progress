import { describe, expect, it } from "vitest";
import {
  calculatePrice,
  canRequestNotary,
  DEFAULT_PRICING_SETTINGS,
  notaryUnits,
  promoDiscountAmount,
  settingsToPricing,
  urgencyDays,
  type PricingSettings,
  type PromoRule,
} from "@/lib/services/pricing";
import type { CartItem } from "@/types/domain";

function item(p: Partial<CartItem> & Pick<CartItem, "slug" | "unitPrice" | "quantity">): CartItem {
  return {
    key: p.slug,
    serviceId: p.slug,
    name: p.slug,
    category: "translation",
    unit: "document",
    isNotarial: false,
    durationDays: 2,
    meta: {},
    ...p,
  };
}

const settings: PricingSettings = { ...DEFAULT_PRICING_SETTINGS, notaryFee: 500, deliveryPrice: 300 };
// Среда 14.10.2026 10:00 МСК
const NOW = new Date("2026-10-14T07:00:00Z");

describe("движок цен", () => {
  it("стандартный срок: сумма позиций без надбавок", () => {
    const r = calculatePrice([item({ slug: "passport-all", unitPrice: 2390, quantity: 1 })], {
      urgency: "standard",
      notaryRequested: false,
      deliveryType: "pickup",
      settings,
      now: NOW,
    });
    expect(r.subtotal).toBe(2390);
    expect(r.total).toBe(2390);
    expect(r.urgencyCoefficient).toBe(1);
    expect(r.notaryFee).toBe(0);
  });

  it("срочность ×1.5 и ×2 применяется к услугам, но не к заверению и доставке", () => {
    const items = [item({ slug: "medical", unitPrice: 550, quantity: 2, unit: "page" })];
    const oneDay = calculatePrice(items, { urgency: "1d", notaryRequested: true, deliveryType: "delivery", settings, now: NOW });
    expect(oneDay.total).toBe(1100 * 1.5 + 500 + 300);
    expect(oneDay.urgencySurcharge).toBe(550);
    const sameDay = calculatePrice(items, { urgency: "same_day", notaryRequested: false, deliveryType: "pickup", settings, now: NOW });
    expect(sameDay.total).toBe(2200);
  });

  it("объёмная скидка −5% только для юридических документов от 10 страниц", () => {
    const legal = item({ slug: "legal", unitPrice: 550, quantity: 12, unit: "page" });
    const copies = item({ slug: "photocopy-a4", unitPrice: 15, quantity: 40, unit: "item", category: "printing" });
    const r = calculatePrice([legal, copies], { urgency: "standard", notaryRequested: false, deliveryType: "pickup", settings, now: NOW });
    expect(r.subtotal).toBe(6600 + 600);
    expect(r.discount).toBe(330);
    expect(r.total).toBe(6270 + 600);
  });

  it("граница скидки: 9 страниц — без скидки, 10 — со скидкой", () => {
    const at = (q: number) =>
      calculatePrice([item({ slug: "legal", unitPrice: 550, quantity: q, unit: "page" })], {
        urgency: "standard",
        notaryRequested: false,
        deliveryType: "pickup",
        settings,
        now: NOW,
      }).discount;
    expect(at(9)).toBe(0);
    expect(at(10)).toBe(275);
  });

  it("нотариальное заверение — за каждый документ без заверения в цене", () => {
    const items = [
      item({ slug: "passport-all", unitPrice: 2390, quantity: 2 }),
      item({ slug: "diploma", unitPrice: 1870, quantity: 1, isNotarial: true }),
      item({ slug: "legal", unitPrice: 550, quantity: 5, unit: "page" }),
      item({ slug: "photo", unitPrice: 300, quantity: 1, category: "printing", unit: "item" }),
    ];
    expect(notaryUnits(items)).toBe(3); // 2 паспорта + 1 юр. документ
    const r = calculatePrice(items, { urgency: "standard", notaryRequested: true, deliveryType: "pickup", settings, now: NOW });
    expect(r.notaryFee).toBe(1500);
  });

  it("заверение не предлагается, если все переводы уже нотариальные", () => {
    const items = [item({ slug: "diploma", unitPrice: 1870, quantity: 1, isNotarial: true })];
    expect(canRequestNotary(items)).toBe(false);
    const r = calculatePrice(items, { urgency: "standard", notaryRequested: true, deliveryType: "pickup", settings, now: NOW });
    expect(r.notaryFee).toBe(0);
  });

  it("пустая корзина — нулевой итог и нет дедлайна", () => {
    const r = calculatePrice([], { urgency: "standard", notaryRequested: false, deliveryType: "pickup", settings, now: NOW });
    expect(r.total).toBe(0);
    expect(r.deadline).toBeNull();
  });

  it("копейки округляются до 2 знаков", () => {
    const r = calculatePrice([item({ slug: "x", unitPrice: 33.33, quantity: 3 })], {
      urgency: "1d",
      notaryRequested: false,
      deliveryType: "pickup",
      settings,
      now: NOW,
    });
    expect(r.total).toBe(149.99);
  });

  it("срок: максимум из услуг, срочность его сокращает", () => {
    expect(urgencyDays("standard", 2)).toBe(2);
    expect(urgencyDays("standard", 0)).toBe(1);
    expect(urgencyDays("1d", 5)).toBe(1);
    expect(urgencyDays("same_day", 5)).toBe(0);
  });
});

describe("settingsToPricing", () => {
  it("читает значения из settings (в т.ч. строки) и подставляет значения по умолчанию", () => {
    const s = settingsToPricing({
      urgency: { "1d": "1.7", same_day: 2.5 },
      notary_fee: "450",
      delivery_price: -100,
      holidays: ["2026-11-04", 5],
      volume_discounts: [{ slug: "legal", minQty: 20, coefficient: 0.9 }, { slug: "bad", minQty: 0, coefficient: 2 }],
    });
    expect(s.urgency).toEqual({ "1d": 1.7, same_day: 2.5 });
    expect(s.notaryFee).toBe(450);
    expect(s.deliveryPrice).toBe(0);
    expect(s.holidays).toEqual(["2026-11-04"]);
    expect(s.volumeDiscounts).toEqual([{ slug: "legal", minQty: 20, coefficient: 0.9 }]);
  });

  it("без настроек — значения по умолчанию из ТЗ", () => {
    const s = settingsToPricing(undefined);
    expect(s.urgency).toEqual({ "1d": 1.5, same_day: 2 });
    expect(s.volumeDiscounts[0]?.slug).toBe("legal");
  });
});

describe("промокоды и автоскидки", () => {
  const percent: PromoRule = { code: "ZIMA10", name: "Зима", type: "percent", value: 10, maxDiscount: null, minOrderAmount: 0 };
  const fixed: PromoRule = { code: "MINUS500", name: "−500", type: "fixed", value: 500, maxDiscount: null, minOrderAmount: 2000 };
  const base = { urgency: "standard", notaryRequested: false, deliveryType: "pickup", settings, now: NOW } as const;
  const passport = [item({ slug: "passport-all", unitPrice: 2390, quantity: 1 })];

  it("процент считается от стоимости услуг и ограничивается потолком", () => {
    expect(promoDiscountAmount(percent, 2390)).toBe(239);
    expect(promoDiscountAmount({ ...percent, maxDiscount: 100 }, 2390)).toBe(100);
  });

  it("фиксированная скидка не больше стоимости услуг; минимальная сумма обязательна", () => {
    expect(promoDiscountAmount(fixed, 2390)).toBe(500);
    expect(promoDiscountAmount(fixed, 1999)).toBe(0);
    expect(promoDiscountAmount({ ...fixed, minOrderAmount: 0 }, 300)).toBe(300);
    expect(promoDiscountAmount(percent, 0)).toBe(0);
  });

  it("в итог вычитается, заверение и доставка скидкой не уменьшаются", () => {
    const r = calculatePrice(passport, { ...base, deliveryType: "delivery", notaryRequested: true, promo: percent });
    const plain = calculatePrice(passport, { ...base, deliveryType: "delivery", notaryRequested: true });
    expect(r.promoDiscount).toBe(239);
    expect(r.total).toBe(plain.total - 239);
    expect(r.notaryFee).toBe(plain.notaryFee);
    expect(r.deliveryFee).toBe(plain.deliveryFee);
  });

  it("скидка считается от суммы со срочностью, итог не уходит в минус", () => {
    const r = calculatePrice(passport, { ...base, urgency: "1d", promo: percent });
    expect(r.promoDiscount).toBe(358.5); // 10% от 2390 × 1,5
    expect(r.total).toBe(3226.5);
    const tiny = calculatePrice([item({ slug: "x", unitPrice: 100, quantity: 1 })], {
      ...base,
      promo: { ...fixed, minOrderAmount: 0, value: 5000 },
    });
    expect(tiny.total).toBe(0);
  });

  it("без промокода скидка равна нулю", () => {
    expect(calculatePrice(passport, base).promoDiscount).toBe(0);
  });
});
