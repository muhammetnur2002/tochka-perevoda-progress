import { z } from "zod";
import { optionalEmailSchema } from "./common";

/** Вход по email + паролю. */
export const loginSchema = z.object({
  email: z.string().email("Введите email"),
  password: z.string().min(6, "Минимум 6 символов"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Регистрация клиента. */
export const registerSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(120),
  email: z.string().email("Введите email"),
  phone: z.string().trim().min(6, "Укажите телефон"),
  password: z.string().min(8, "Минимум 8 символов").max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/** Сброс пароля. */
export const resetPasswordSchema = z.object({
  email: z.string().email("Введите email"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Обновление пароля (callback-страница). */
export const updatePasswordSchema = z.object({
  password: z.string().min(8, "Минимум 8 символов").max(72),
});

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

/** Обновление профиля. */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(6).optional(),
  email: optionalEmailSchema,
  telegram_username: z.string().trim().max(64).optional().nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
