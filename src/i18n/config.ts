/**
 * Языки интерфейса.
 *  - Сайт и личный кабинет клиента — 9 языков (русский + 8 для иностранных граждан).
 *  - CRM и кабинет сотрудника — 3 языка (русский, английский, туркменский).
 * Язык хранится в cookie NEXT_LOCALE (без префиксов в URL); по умолчанию —
 * из заголовка Accept-Language браузера, иначе русский.
 */
export const SITE_LOCALES = ["ru", "en", "tk", "tr", "uz", "kk", "ky", "az", "fr"] as const;
export const STAFF_LOCALES = ["ru", "en", "tk"] as const;

export type Locale = (typeof SITE_LOCALES)[number];
export type StaffLocale = (typeof STAFF_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ru";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Названия языков на самих языках — для переключателя. */
export const LOCALE_NAMES: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
  tk: "Türkmençe",
  tr: "Türkçe",
  uz: "Oʻzbekcha",
  kk: "Қазақша",
  ky: "Кыргызча",
  az: "Azərbaycanca",
  fr: "Français",
};

/** Локаль для Intl (форматирование дат); у туркменского и др. — запасные варианты. */
export const INTL_LOCALE: Record<Locale, string> = {
  ru: "ru-RU",
  en: "en-GB",
  tk: "tk-TM",
  tr: "tr-TR",
  uz: "uz-Latn-UZ",
  kk: "kk-KZ",
  ky: "ky-KG",
  az: "az-Latn-AZ",
  fr: "fr-FR",
};

/**
 * Языки, для которых в браузерах (Chromium) нет названий месяцев и дней недели:
 * там дату показываем числами «16.10.2026», иначе браузер подставит русский.
 */
export const NUMERIC_DATE_LOCALES: readonly Locale[] = ["tk"];

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (SITE_LOCALES as readonly string[]).includes(value);
}

export function isStaffLocale(value: string | undefined | null): value is StaffLocale {
  return !!value && (STAFF_LOCALES as readonly string[]).includes(value);
}

/** Выбор языка по Accept-Language: «uz-UZ,uz;q=0.9,ru;q=0.8» → uz. */
export function matchAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag = "", q] = part.trim().split(";q=");
      return { base: tag.toLowerCase().split("-")[0] ?? "", q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { base } of ranked) if (isLocale(base)) return base;
  return DEFAULT_LOCALE;
}
