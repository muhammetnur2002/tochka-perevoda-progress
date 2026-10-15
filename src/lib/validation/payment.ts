import { z } from "zod";
import { uuidSchema } from "./common";

/** Создание платежа. */
export const createPaymentSchema = z.object({
  orderId: uuidSchema,
  method: z.enum(["card", "sbp", "qr"]).default("sbp"),
  // Сумму клиент не передаёт: она считается на сервере (остаток × % предоплаты).
});

/** Ручная отметка оплаты менеджером. */
export const manualPaymentSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  method: z.enum(["cash", "invoice", "card", "sbp"]),
});

export type ManualPaymentInput = z.infer<typeof manualPaymentSchema>;

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
