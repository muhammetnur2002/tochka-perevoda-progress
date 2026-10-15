import { z } from "zod";
import { isValidRuPhone, normalizePhone } from "@/lib/format/phone";

/** Имя: 2–120 символов. */
export const nameSchema = z
  .string()
  .trim()
  .min(2, "Укажите имя")
  .max(120, "Имя слишком длинное");

/** Телефон РФ с нормализацией в E.164. */
export const phoneSchema = z
  .string()
  .trim()
  .min(6, "Укажите телефон")
  .refine(isValidRuPhone, "Введите корректный номер телефона РФ")
  .transform(normalizePhone);

/** Email (необязательный). */
export const optionalEmailSchema = z
  .union([z.string().email("Некорректный email"), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

/** UUID. */
export const uuidSchema = z.string().uuid();

/** Идентификатор (число/строка) для поиска. */
export const nonEmptyString = z.string().trim().min(1).max(500);
