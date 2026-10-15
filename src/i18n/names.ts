"use client";

import { useTranslations } from "next-intl";

/**
 * Названия услуг и языков на языке интерфейса. Услуги, добавленные в админке
 * после релиза, могут не иметь перевода — тогда показывается название из БД.
 */
export function useServiceName(): (slug: string | null | undefined, fallback: string) => string {
  const t = useTranslations("services");
  return (slug, fallback) => (slug && t.has(`${slug}.name`) ? t(`${slug}.name`) : fallback);
}

export function useServiceDescription(): (slug: string, fallback: string | null) => string | null {
  const t = useTranslations("services");
  return (slug, fallback) => (t.has(`${slug}.description`) ? t(`${slug}.description`) : fallback);
}

export function useLanguageName(): (code: string | null | undefined, fallback?: string) => string {
  const t = useTranslations("languages");
  return (code, fallback = "") => (code && t.has(code) ? t(code) : fallback);
}
