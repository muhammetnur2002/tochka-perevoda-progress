"use client";

import { useState } from "react";
import type { ServiceCategory } from "@/types/database.types";
import { useCatalog } from "@/hooks/use-catalog";
import { ServiceCard } from "./service-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SERVICE_CATEGORY_LABELS } from "@/lib/config/constants";
import { cn } from "@/lib/utils";

const CATEGORIES: (ServiceCategory | "all")[] = [
  "all",
  "translation",
  "printing",
  "insurance",
];

interface CatalogSectionProps {
  /** Ограничить количество показываемых услуг (для превью на главной). */
  limit?: number;
  showTabs?: boolean;
}

/** Секция каталога услуг с фильтром по категориям (клиентская загрузка). */
export function CatalogSection({ limit, showTabs = true }: CatalogSectionProps) {
  const { data, isLoading } = useCatalog();
  const [category, setCategory] = useState<ServiceCategory | "all">("all");

  const services = (data?.services ?? []).filter(
    (s) => category === "all" || s.category === category,
  );
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
        <Tabs value={category} onValueChange={(v) => setCategory(v as ServiceCategory | "all")}>
          <TabsList className="mb-6 h-auto flex-wrap justify-start">
            {CATEGORIES.map((c) => (
              <TabsTrigger key={c} value={c} className={cn("py-2")}>
                {c === "all" ? "Все услуги" : SERVICE_CATEGORY_LABELS[c]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {visible.length === 0 ? (
        <p className="text-muted-foreground">Услуги не найдены.</p>
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
