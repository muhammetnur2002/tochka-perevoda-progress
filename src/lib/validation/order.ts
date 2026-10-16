import { z } from "zod";
import { nameSchema, phoneSchema, optionalEmailSchema, uuidSchema } from "./common";

/** Позиция заказа от клиента. Цена НЕ принимается — считается на сервере. */
export const orderItemSchema = z.object({
  serviceId: uuidSchema,
  quantity: z.number().int("Количество — целое число").positive().max(10_000),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const urgencySchema = z.enum(["standard", "1d", "same_day"]);

export const deliveryTypeSchema = z.enum(["pickup", "delivery"]);

export const orderSourceSchema = z.enum(["web", "mini_app", "bot", "admin", "walkin"]);

/** Тело POST /api/orders. */
export const createOrderSchema = z
  .object({
    name: nameSchema,
    phone: phoneSchema,
    email: optionalEmailSchema,
    telegram: z.string().trim().max(120).optional().nullable(),
    inn: z.string().trim().max(20).optional().nullable(),
    type: z.enum(["individual", "company"]).default("individual"),
    items: z.array(orderItemSchema).min(1, "Добавьте хотя бы одну услугу").max(50),
    urgency: urgencySchema.default("standard"),
    /** Язык оригинала (один из 14 исходных). Язык перевода всегда русский — задаёт сервер. */
    languageFrom: uuidSchema.nullable().optional(),
    /** Точка приёма, куда клиент приносит документы / где получает заказ. */
    officeId: z.string({ required_error: "Выберите точку приёма" }).uuid("Выберите точку приёма"),
    /** Как платит клиент: онлайн сейчас (предоплата/полностью по политике) или в точке при сдаче документов. */
    paymentMode: z.enum(["online", "office"]).default("online"),
    /** Промокод; автоскидки применяются и без него. */
    promoCode: z.string().trim().max(40).optional().nullable(),
    deliveryType: deliveryTypeSchema.default("pickup"),
    deliveryAddress: z.string().trim().max(300).optional().nullable(),
    comment: z.string().trim().max(1000).optional().nullable(),
    notaryRequested: z.boolean().default(false),
    consent: z.boolean().refine((v) => v === true, {
      message: "Необходимо согласие на обработку персональных данных",
    }),
    source: orderSourceSchema.default("web"),
  })
  .superRefine((val, ctx) => {
    if (val.deliveryType === "delivery" && !val.deliveryAddress?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deliveryAddress"],
        message: "Укажите адрес доставки",
      });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Обновление статуса заказа (менеджер/админ). */
export const updateOrderStatusSchema = z.object({
  status: z.enum(["confirmed", "in_progress", "ready", "issued", "completed", "cancelled"]),
  comment: z.string().trim().max(1000).optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

/** Назначение исполнителя. */
export const createAssignmentSchema = z.object({
  orderId: uuidSchema,
  orderItemId: uuidSchema.nullable().optional(),
  userId: uuidSchema,
  role: z.enum(["translator", "notary", "printer", "manager"]),
  dueAt: z.string().datetime().optional().nullable(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
