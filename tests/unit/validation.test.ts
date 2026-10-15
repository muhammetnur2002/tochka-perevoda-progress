import { describe, expect, it } from "vitest";
import { createOrderSchema, updateOrderStatusSchema } from "@/lib/validation/order";
import { createPaymentSchema } from "@/lib/validation/payment";
import { serviceSchema } from "@/lib/validation/service";
import { chatMessageSchema } from "@/lib/validation/chat";

const UUID = "3f1c0b7e-8d0a-4a51-9a40-1f6f4d8f2b11";

const base = {
  name: "Айгуль",
  phone: "8 (917) 123-45-67",
  consent: true,
  items: [{ serviceId: UUID, quantity: 2 }],
};

describe("createOrderSchema", () => {
  it("нормализует телефон и подставляет значения по умолчанию", () => {
    const r = createOrderSchema.parse(base);
    expect(r.phone).toBe("79171234567");
    expect(r.urgency).toBe("standard");
    expect(r.deliveryType).toBe("pickup");
    expect(r.source).toBe("web");
    expect(r.email).toBeNull();
  });

  it("без согласия на обработку ПД заказ не принимается (152-ФЗ)", () => {
    const r = createOrderSchema.safeParse({ ...base, consent: false });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/согласие/i);
  });

  it("для доставки обязателен адрес", () => {
    expect(createOrderSchema.safeParse({ ...base, deliveryType: "delivery" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, deliveryType: "delivery", deliveryAddress: "Казань, Баумана 1" }).success).toBe(true);
  });

  it("цену клиент передать не может — поле игнорируется", () => {
    const r = createOrderSchema.parse({ ...base, items: [{ serviceId: UUID, quantity: 1, price: 1 }], totalPrice: 1 });
    expect(r.items[0]).not.toHaveProperty("price");
    expect(r).not.toHaveProperty("totalPrice");
  });

  it("отклоняет иностранный/битый телефон, дробное и нулевое количество", () => {
    expect(createOrderSchema.safeParse({ ...base, phone: "+1 202 555 0100" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, items: [{ serviceId: UUID, quantity: 1.5 }] }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, items: [{ serviceId: UUID, quantity: 0 }] }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });
});

describe("прочие схемы", () => {
  it("статус: нельзя вернуть в «new» через API", () => {
    expect(updateOrderStatusSchema.safeParse({ status: "new" }).success).toBe(false);
    expect(updateOrderStatusSchema.safeParse({ status: "ready", comment: "ok" }).success).toBe(true);
  });

  it("платёж: только card/sbp/qr, сумма с клиента не принимается", () => {
    expect(createPaymentSchema.parse({ orderId: UUID }).method).toBe("sbp");
    expect(createPaymentSchema.safeParse({ orderId: UUID, method: "cash" }).success).toBe(false);
    expect(createPaymentSchema.parse({ orderId: UUID, amount: 1 })).not.toHaveProperty("amount");
  });

  it("услуга: slug только латиница", () => {
    const svc = { slug: "Перевод", category: "translation", name: "Тест", price: 1, unit: "page", duration_days: 2 };
    expect(serviceSchema.safeParse(svc).success).toBe(false);
    expect(serviceSchema.safeParse({ ...svc, slug: "test-1" }).success).toBe(true);
  });

  it("сообщение чата: не пустое и не длиннее 2000", () => {
    expect(chatMessageSchema.safeParse({ orderId: UUID, body: "  " }).success).toBe(false);
    expect(chatMessageSchema.safeParse({ orderId: UUID, body: "x".repeat(2001) }).success).toBe(false);
  });
});
