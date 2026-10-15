import { describe, expect, it } from "vitest";
import { ipInCidr, isYookassaIp, parseNotification } from "@/lib/payments/webhook";

describe("IP-allowlist ЮKassa", () => {
  it("IPv4 в диапазонах ЮKassa", () => {
    expect(isYookassaIp("185.71.76.5", "")).toBe(true);
    expect(isYookassaIp("77.75.153.100", "")).toBe(true);
    expect(isYookassaIp("77.75.156.11", "")).toBe(true);
    expect(isYookassaIp("::ffff:185.71.77.1", "")).toBe(true);
  });

  it("чужие адреса отклоняются", () => {
    expect(isYookassaIp("185.71.76.32", "")).toBe(false); // за пределами /27
    expect(isYookassaIp("8.8.8.8", "")).toBe(false);
    expect(isYookassaIp(null, "")).toBe(false);
  });

  it("IPv6 диапазон 2a02:5180::/32", () => {
    expect(ipInCidr("2a02:5180:0:1::10", "2a02:5180::/32")).toBe(true);
    expect(ipInCidr("2a02:5181::1", "2a02:5180::/32")).toBe(false);
  });

  it("список переопределяется переменной окружения", () => {
    expect(isYookassaIp("10.0.0.5", "10.0.0.0/8")).toBe(true);
    expect(isYookassaIp("185.71.76.5", "10.0.0.0/8")).toBe(false);
  });
});

describe("разбор уведомления ЮKassa", () => {
  it("достаёт id платежа из payment.* события", () => {
    expect(
      parseNotification({ type: "notification", event: "payment.succeeded", object: { id: "2f9c41aa-000f-5000-8000-1d0e8d6b0e5e" } }),
    ).toEqual({ paymentId: "2f9c41aa-000f-5000-8000-1d0e8d6b0e5e", event: "payment.succeeded" });
  });

  it("игнорирует прочие события и подозрительные id", () => {
    expect(parseNotification({ event: "refund.succeeded", object: { id: "2f9c41aa-000f-5000-8000-1d0e8d6b0e5e" } })).toBeNull();
    expect(parseNotification({ event: "payment.succeeded", object: { id: "../../etc" } })).toBeNull();
    expect(parseNotification(null)).toBeNull();
  });
});
