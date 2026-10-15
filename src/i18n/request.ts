import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  isStaffLocale,
  matchAcceptLanguage,
  type Locale,
} from "./config";
import ruSite from "../../messages/ru/site.json";
import ruStaff from "../../messages/ru/staff.json";

/**
 * Словари: messages/<locale>/site.json — сайт и кабинет клиента (9 языков),
 * messages/<locale>/staff.json — CRM и кабинет сотрудника (ru, en, tk).
 * Недостающие ключи берутся из русского словаря.
 */
const RU = { ...ruSite, ...ruStaff };
export type Messages = typeof RU;

function withFallback(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const b = base[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object"
        ? withFallback(b as Record<string, unknown>, v as Record<string, unknown>)
        : v;
  }
  return out;
}

export async function resolveLocale(): Promise<Locale> {
  const fromCookie = cookies().get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return matchAcceptLanguage(headers().get("accept-language"));
}

async function load(locale: Locale): Promise<Record<string, unknown>> {
  const site = (await import(`../../messages/${locale}/site.json`)).default as Record<string, unknown>;
  const staff = isStaffLocale(locale)
    ? ((await import(`../../messages/${locale}/staff.json`)).default as Record<string, unknown>)
    : {};
  return { ...site, ...staff };
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Явно запрошенная локаль (getMessages({ locale })) — например, русская для Mini App
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : await resolveLocale();
  if (locale === DEFAULT_LOCALE) return { locale, messages: RU, timeZone: "Europe/Moscow" };
  return {
    locale,
    messages: withFallback(RU, await load(locale)) as Messages,
    timeZone: "Europe/Moscow",
  };
});
