import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, isStaffLocale, type Locale } from "./config";
import type ruSite from "../../messages/ru/site.json";
import type ruStaff from "../../messages/ru/staff.json";

/**
 * Словари: messages/<locale>/site.json — сайт и кабинет клиента (9 языков),
 * messages/<locale>/staff.json — CRM и кабинет сотрудника (ru, en, tk).
 * Недостающие ключи берутся из туркменского словаря.
 */
export type Messages = typeof ruSite & typeof ruStaff;

function withFallback(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
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
  return DEFAULT_LOCALE;
}

async function load(locale: Locale): Promise<Record<string, unknown>> {
  const site = (await import(`../../messages/${locale}/site.json`)).default as Record<
    string,
    unknown
  >;
  const staff = isStaffLocale(locale)
    ? ((await import(`../../messages/${locale}/staff.json`)).default as Record<string, unknown>)
    : {};
  return { ...site, ...staff };
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Явно запрошенная локаль (getMessages({ locale })) — например, для Mini App
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : await resolveLocale();
  return {
    locale,
    messages: withFallback(await load(DEFAULT_LOCALE), await load(locale)) as Messages,
    timeZone: "Europe/Moscow",
  };
});
