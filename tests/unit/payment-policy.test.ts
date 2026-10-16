import { describe, expect, it } from "vitest";
import { DEFAULT_PAYMENT_POLICY, dueNow, policyFromSettings, type PaymentPolicy } from "@/lib/payments/policy";

const policy: PaymentPolicy = { prepaymentPercent: 50, prepaymentThreshold: 3000, payInOffice: true };

describe("политика оплаты", () => {
  it("мелкий заказ платится полностью онлайн", () => {
    const r = dueNow(policy, { total: 1650, paid: 0, hasNotarial: false });
    expect(r).toEqual({ amount: 1650, percent: 100, rest: 0, isPrepayment: false });
  });

  it("заказ от порога — предоплата, остаток при получении", () => {
    const r = dueNow(policy, { total: 6600, paid: 0, hasNotarial: false });
    expect(r.amount).toBe(3300);
    expect(r.rest).toBe(3300);
    expect(r.isPrepayment).toBe(true);
    expect(dueNow(policy, { total: 3000, paid: 0, hasNotarial: false }).amount).toBe(1500);
  });

  it("нотариальный заказ — предоплата даже ниже порога", () => {
    const r = dueNow(policy, { total: 1870, paid: 0, hasNotarial: true });
    expect(r.amount).toBe(935);
    expect(r.rest).toBe(935);
  });

  it("после первого платежа — остаток целиком; оплаченный заказ — ноль", () => {
    expect(dueNow(policy, { total: 6600, paid: 3300, hasNotarial: false }).amount).toBe(3300);
    expect(dueNow(policy, { total: 6600, paid: 6600, hasNotarial: false }).amount).toBe(0);
    expect(dueNow(policy, { total: 6600, paid: 7000, hasNotarial: false }).amount).toBe(0);
  });

  it("предоплата не бывает меньше 1 ₽ и не больше суммы заказа", () => {
    expect(dueNow({ ...policy, prepaymentPercent: 1 }, { total: 3000, paid: 0, hasNotarial: false }).amount).toBe(30);
    expect(dueNow({ ...policy, prepaymentPercent: 100 }, { total: 5000, paid: 0, hasNotarial: false }).isPrepayment).toBe(false);
  });

  it("настройки из БД: проценты, порог и оплата в точке", () => {
    expect(policyFromSettings({ prepayment_percent: 30, prepayment_threshold: "5000", pay_in_office_enabled: false })).toEqual({
      prepaymentPercent: 30,
      prepaymentThreshold: 5000,
      payInOffice: false,
    });
    expect(policyFromSettings({})).toEqual(DEFAULT_PAYMENT_POLICY);
    // некорректный процент — платим полностью
    expect(policyFromSettings({ prepayment_percent: 0 }).prepaymentPercent).toBe(100);
    expect(policyFromSettings({ prepayment_percent: 150 }).prepaymentPercent).toBe(100);
  });
});
