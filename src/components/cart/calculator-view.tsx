"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/components/cart/cart-provider";
import { DeliveryPicker, NotaryCheckbox, PriceLines, UrgencySwitch } from "@/components/cart/order-summary";
import { LanguagePairPicker, OfficePicker } from "@/components/order/placement-pickers";
import { useCatalog, toPricingSettings } from "@/hooks/use-catalog";
import { useServiceName } from "@/i18n/names";
import { calculatePrice } from "@/lib/services/pricing";
import { formatMoney } from "@/lib/format/money";
import type { ServiceCategory, ServiceRow } from "@/types/database.types";
import { cn } from "@/lib/utils";

const CATEGORIES: ServiceCategory[] = ["translation", "printing", "insurance"];

/** Строка услуги со степпером количества. */
function ServiceRowStepper({ service, first }: { service: ServiceRow; first: boolean }) {
  const t = useTranslations("calculator");
  const tu = useTranslations("units");
  const serviceName = useServiceName();
  const { items, addItem, setQuantity } = useCart();
  const qty = items.find((i) => i.key === service.slug)?.quantity ?? 0;
  const price = Number(service.price);
  const name = serviceName(service.slug, service.name);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 px-5 py-3.5",
        !first && "border-t border-slate-100",
        qty > 0 && "bg-[#FFFBF0]",
      )}
    >
      <div className="min-w-0 flex-1 basis-60">
        <div className="font-semibold text-slate-900">{name}</div>
        <div className="text-sm text-muted-foreground">
          {formatMoney(price)} {tu(service.unit)}
          {service.is_notarial && <span className="font-semibold text-gold-800"> · {t("withNotary")}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10"
          onClick={() => setQuantity(service.slug, qty - 1)}
          disabled={qty === 0}
          aria-label={t("decrease", { name })}
        >
          <Minus />
        </Button>
        <span className="w-9 text-center text-base font-extrabold tabular-nums" aria-live="polite">
          {qty}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10"
          onClick={() => (qty === 0 ? addItem(service) : setQuantity(service.slug, qty + 1))}
          aria-label={t("increase", { name })}
        >
          <Plus />
        </Button>
      </div>
      <div className="w-24 text-right font-extrabold text-brand-800 tabular-nums">
        {qty ? formatMoney(qty * price) : "—"}
      </div>
    </div>
  );
}

/**
 * Калькулятор + корзина: услуги и количество, язык документа, срочность,
 * заверение, способ получения и точка приёма.
 */
export function CalculatorView({ initialCategory = "translation" }: { initialCategory?: ServiceCategory }) {
  const t = useTranslations("calculator");
  const tc = useTranslations("categories");
  const serviceName = useServiceName();
  const { data, isLoading } = useCatalog();
  const { items, options, hydrated } = useCart();
  const [category, setCategory] = React.useState<ServiceCategory>(initialCategory);

  const settings = toPricingSettings(data?.settings);
  const pricing = calculatePrice(items, {
    urgency: options.urgency,
    notaryRequested: options.notaryRequested,
    deliveryType: options.deliveryType,
    settings,
  });
  const services = (data?.services ?? []).filter((s) => s.category === category);
  const hasTranslation = items.some((i) => i.category === "translation");

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="min-w-0 flex-[999_1_560px] space-y-3.5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("categoriesAria")}>
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
              {tc(c)}
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="m-4 h-12" />)
            : services.map((s, i) => <ServiceRowStepper key={s.id} service={s} first={i === 0} />)}
        </div>
      </div>

      <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-5 rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
        <h2 className="text-xl font-bold text-brand-800">{t("yourOrder")}</h2>
        {hydrated && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.key} className="flex justify-between gap-3">
                <span className="text-slate-700">
                  {serviceName(i.slug, i.name)} × {i.quantity}
                </span>
                <strong className="whitespace-nowrap">{formatMoney(i.unitPrice * i.quantity)}</strong>
              </li>
            ))}
          </ul>
        )}
        {hasTranslation && <LanguagePairPicker />}
        <UrgencySwitch settings={settings} />
        <NotaryCheckbox settings={settings} />
        <DeliveryPicker settings={settings} />
        <OfficePicker compact />
        <div className="border-t pt-4">
          <PriceLines pricing={pricing} />
        </div>
        {items.length > 0 ? (
          <Button asChild variant="gold" size="xl" className="w-full">
            <Link href="/checkout">{t("checkout")}</Link>
          </Button>
        ) : (
          <Button variant="gold" size="xl" className="w-full" disabled>
            {t("checkout")}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
      </aside>
    </div>
  );
}
