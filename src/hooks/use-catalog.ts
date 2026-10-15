"use client";

import { useQuery } from "@tanstack/react-query";
import type { LanguageRow, ServiceRow } from "@/types/database.types";
import { settingsToPricing } from "@/lib/services/pricing";
import type { UrgencyKey } from "@/types/domain";

export interface CatalogResponse {
  services: ServiceRow[];
  languages: LanguageRow[];
  settings: Record<string, unknown>;
}

async function fetchCatalog(): Promise<CatalogResponse> {
  const res = await fetch("/api/services", { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Не удалось загрузить каталог");
  return res.json();
}

/** Каталог услуг, языков и публичных настроек (кэшируется React Query). */
export function useCatalog() {
  return useQuery<CatalogResponse>({
    queryKey: ["catalog"],
    queryFn: fetchCatalog,
    staleTime: 5 * 60_000,
  });
}

/** Преобразует публичные настройки в PricingSettings для движка расчёта. */
export function toPricingSettings(settings: Record<string, unknown> | undefined) {
  return settingsToPricing(settings);
}

/** Человекочитаемые подписи срочности. */
export const URGENCY_LABELS: Record<UrgencyKey, string> = {
  standard: "Обычный срок (1–2 дня)",
  "1d": "Срочно (1 день, +50%)",
  same_day: "Экспресс (в день обращения, ×2)",
};
