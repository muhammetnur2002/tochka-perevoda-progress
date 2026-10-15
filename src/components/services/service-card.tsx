"use client";

import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { ServiceRow } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/components/cart/cart-provider";
import { SERVICE_CATEGORY_LABELS } from "@/lib/config/constants";
import { formatMoney } from "@/lib/format/money";

function unitLabel(unit: string): string {
  switch (unit) {
    case "page":
      return "за страницу";
    case "document":
      return "за документ";
    default:
      return "за шт.";
  }
}

/** Карточка услуги в каталоге. */
export function ServiceCard({ service }: { service: ServiceRow }) {
  const { addItem } = useCart();

  const handleAdd = () => {
    addItem(service);
    toast.success(`Добавлено: ${service.name}`);
  };

  return (
    <Card className="flex flex-col transition-shadow hover:shadow-card">
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">{SERVICE_CATEGORY_LABELS[service.category]}</Badge>
          {service.is_notarial && <Badge variant="gold">нотариально</Badge>}
        </div>
        <h3 className="font-semibold leading-snug text-brand-900">{service.name}</h3>
        {service.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div>
            <span className="text-xl font-bold text-brand-900">{formatMoney(service.price)}</span>
            <span className="ml-1 text-xs text-muted-foreground">{unitLabel(service.unit)}</span>
          </div>
          <Button size="sm" variant="gold" onClick={handleAdd} aria-label={`Добавить ${service.name}`}>
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
