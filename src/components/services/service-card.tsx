"use client";

import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { ServiceRow } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/components/cart/cart-provider";
import { useServiceDescription, useServiceName } from "@/i18n/names";
import { formatMoney } from "@/lib/format/money";

/** Карточка услуги в каталоге. */
export function ServiceCard({ service }: { service: ServiceRow }) {
  const t = useTranslations("catalog");
  const tc = useTranslations("categories");
  const tu = useTranslations("units");
  const serviceName = useServiceName();
  const serviceDescription = useServiceDescription();
  const { addItem } = useCart();
  const name = serviceName(service.slug, service.name);
  const description = serviceDescription(service.slug, service.description);

  const handleAdd = () => {
    addItem(service);
    toast.success(t("added", { name }));
  };

  return (
    <Card className="flex flex-col transition-shadow hover:shadow-card">
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">{tc(service.category)}</Badge>
          {service.is_notarial && <Badge variant="gold">{t("notarial")}</Badge>}
        </div>
        <h3 className="font-semibold leading-snug text-brand-900">{name}</h3>
        {description && <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div>
            <span className="text-xl font-bold text-brand-900">{formatMoney(Number(service.price))}</span>
            <span className="ml-1 text-xs text-muted-foreground">{tu(service.unit)}</span>
          </div>
          <Button size="sm" variant="gold" onClick={handleAdd} aria-label={t("addAria", { name })}>
            <Plus />
            {t("add")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
