import { z } from "zod";
import { uuidSchema } from "./common";

/** Создание платежа. */
export const createPaymentSchema = z.object({
  orderId: uuidSchema,
  method: z.enum(["card", "sbp", "qr"]).default("sbp"),
  /** Ссылка на оплату из CRM (остаток или доплата); сумма берётся из запроса на сервере. */
  requestId: uuidSchema.optional(),
  // Сумму клиент не передаёт: она считается на сервере (политика предоплаты или запрос из CRM).
});

/** Ручная отметка оплаты менеджером. */
export const manualPaymentSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  method: z.enum(["cash", "invoice", "card", "sbp"]),
});

export type ManualPaymentInput = z.infer<typeof manualPaymentSchema>;

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

/** Выставление ссылки на оплату из CRM. */
export const paymentRequestSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  reason: z.string().trim().max(200).optional().nullable(),
  /** true — доплата: сумма добавляется к стоимости заказа; false — ссылка на остаток. */
  isExtra: z.boolean().default(false),
});

/** Возврат по платежу. */
export const refundSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  reason: z.string().trim().max(300).optional().nullable(),
});

export type PaymentRequestInput = z.infer<typeof paymentRequestSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
