import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Валидация initData Telegram WebApp (HMAC-SHA256 с bot token).
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

export interface TelegramInitUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface InitDataResult {
  valid: boolean;
  user?: TelegramInitUser;
  raw: Record<string, string>;
}

/**
 * @param maxAgeSeconds — максимальный возраст auth_date (защита от повторного
 *   использования перехваченного initData). 0 — не проверять.
 */
export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 24 * 60 * 60,
  now = Date.now(),
): InitDataResult {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") ?? "";
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest();

  let valid = false;
  try {
    const expected = Buffer.from(hash, "hex");
    valid = expected.length === computed.length && timingSafeEqual(computed, expected);
  } catch {
    valid = false;
  }

  if (valid && maxAgeSeconds > 0) {
    const authDate = Number(params.get("auth_date"));
    if (!Number.isFinite(authDate) || now / 1000 - authDate > maxAgeSeconds) valid = false;
  }

  const userRaw = params.get("user");
  let user: TelegramInitUser | undefined;
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as TelegramInitUser;
    } catch {
      user = undefined;
    }
  }

  return { valid, user, raw: Object.fromEntries(params.entries()) };
}
