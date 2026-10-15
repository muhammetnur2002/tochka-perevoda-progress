import { z } from "zod";

/**
 * Валидация переменных окружения (Zod).
 * Значения читаются лениво и кэшируются: статические страницы (SSG) не
 * вызывают этот модуль, поэтому сборка проходит без реальных ключей.
 */

const envSchema = z.object({
  // Supabase (обязательно для работы с данными)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  // Базовые
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  CRON_SECRET: z.string().optional(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_MANAGER_CHAT_IDS: z.string().optional(),

  // Платежи
  PAYMENT_PROVIDER: z.enum(["yookassa", "mock"]).default("mock"),
  YOOKASSA_SHOP_ID: z.string().optional(),
  YOOKASSA_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_PAYMENT_RETURN_URL: z.string().url().optional(),

  // SMS
  SMSRU_API_ID: z.string().optional(),
  SMSRU_SENDER_NAME: z.string().optional(),

  // SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Хранилище
  STORAGE_DRIVER: z.enum(["supabase", "yandex"]).default("supabase"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),

  // AI
  AI_PROVIDER: z.enum(["off", "yandexgpt", "gigachat"]).default("off"),
  YANDEXGPT_API_KEY: z.string().optional(),
  YANDEXGPT_FOLDER_ID: z.string().optional(),
  GIGACHAT_CLIENT_ID: z.string().optional(),
  GIGACHAT_CLIENT_SECRET: z.string().optional(),

  // Аналитика
  NEXT_PUBLIC_YANDEX_METRIKA_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Возвращает валидированные переменные окружения (кэшируется). */
export function env(): Env {
  if (cached) return cached;
  cached = envSchema.parse(process.env);
  return cached;
}

/** Демо-режим (интерфейс без Supabase, данные из памяти). */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

/** Проверка обязательных Supabase-переменных; бросает понятную ошибку. */
export function assertSupabaseConfigured(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Скопируйте .env.example в .env.local и заполните значения из Supabase Dashboard.",
    );
  }
}
