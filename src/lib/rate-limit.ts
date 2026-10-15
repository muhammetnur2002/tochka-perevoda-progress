/**
 * Рейт-лимитер.
 *  - rateLimit()       — in-memory окно (одна инстанция, без сети, для тестов/dev);
 *  - checkRateLimit()  — общий для всех инстансов лимит в БД (rate_limit_hit),
 *                        с фолбэком на память, если БД недоступна.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Максимум запросов в окне. */
  limit: number;
  /** Окно в миллисекундах. */
  windowMs: number;
  /** Ключ (например, IP или телефон). */
  identifier: string;
  /** Пространство (эндпоинт). */
  bucket: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/** Проверяет и учитывает запрос. Потокобезопасно в пределах одного процесса. */
export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const key = `${opts.bucket}:${opts.identifier}`;
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.limit - 1, retryAfterMs: 0 };
  }

  if (current.count >= opts.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: current.resetAt - now,
    };
  }

  current.count += 1;
  return { allowed: true, remaining: opts.limit - current.count, retryAfterMs: 0 };
}

/** Получает IP клиента из заголовков (с учётом прокси). */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Периодическая очистка устаревших бакетов. */
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (value.resetAt <= now) store.delete(key);
    }
  },
  60_000,
).unref?.();

/**
 * Лимит в БД (общий для нескольких контейнеров). Требует SUPABASE_SERVICE_ROLE_KEY;
 * без него или при ошибке БД — in-memory лимит.
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<boolean> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
        p_bucket: opts.bucket,
        p_identifier: opts.identifier,
        p_limit: opts.limit,
        p_window_seconds: Math.ceil(opts.windowMs / 1000),
      });
      if (!error && typeof data === "boolean") return data;
    } catch {
      // упали на БД — используем память ниже
    }
  }
  return rateLimit(opts).allowed;
}
