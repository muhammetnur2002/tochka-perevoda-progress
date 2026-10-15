"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ServiceCategory } from "@/types/database.types";
import { useCatalog } from "@/hooks/use-catalog";
import { ServiceCard } from "./service-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CATEGORIES: (ServiceCategory | "all")[] = ["all", "translation", "printing", "insurance"];

interface CatalogSectionProps {
  /** Ограничить количество услуг (превью на главной). */
  limit?: number;
  showTabs?: boolean;
}

/** Каталог услуг с фильтром по категориям. */
export function CatalogSection({ limit, showTabs = true }: CatalogSectionProps) {
  const t = useTranslations("catalog");
  const tc = useTranslations("categories");
  const { data, isLoading } = useCatalog();
  const [category, setCategory] = useState<ServiceCategory | "all">("all");

  const services = (data?.services ?? []).filter((s) => category === "all" || s.category === category);
  const visible = limit ? services.slice(0, limit) : services;

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: limit ?? 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {showTabs && (
        <div className="mb-6 flex flex-wrap gap-2" role="tablist">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm font-bold",
                category === c ? "border-brand-800 bg-brand-800 text-white" : "border-input bg-background text-brand-800",
              )}
            >
              {c === "all" ? t("all") : tc(c)}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}
