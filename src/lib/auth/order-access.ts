import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Токен доступа гостя к своему заказу (загрузка файлов, оплата, страница успеха)
 * без регистрации. Это HMAC-SHA256(orderId + срок) на серверном секрете, поэтому
 * знание UUID заказа само по себе доступа не даёт. Срок жизни — 24 часа.
 */

const TTL_MS = 24 * 60 * 60 * 1000;

function secret(): string {
  const value = process.env.ORDER_ACCESS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Не задан ORDER_ACCESS_SECRET (или SUPABASE_SERVICE_ROLE_KEY)");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Выпускает токен для заказа (по умолчанию на 24 часа; ссылки в уведомлениях — дольше). */
export function issueOrderToken(orderId: string, now = Date.now(), ttlMs = TTL_MS): string {
  const exp = Math.floor((now + ttlMs) / 1000).toString(36);
  return `${exp}.${sign(`${orderId}.${exp}`)}`;
}

/** Проверяет токен для заказа (подпись + срок). */
export function verifyOrderToken(orderId: string, token: string | null | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [exp, signature] = token.split(".");
  if (!exp || !signature) return false;
  const expMs = parseInt(exp, 36) * 1000;
  if (!Number.isFinite(expMs) || expMs < now) return false;
  const expected = Buffer.from(sign(`${orderId}.${exp}`));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Имя заголовка, в котором клиент передаёт токен. */
export const ORDER_TOKEN_HEADER = "x-order-token";
