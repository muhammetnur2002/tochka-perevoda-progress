"use client";

import * as React from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/components/cart/cart-provider";
import { DeliveryPicker, NotaryCheckbox, PriceLines, UrgencySwitch } from "@/components/cart/order-summary";
import { useCatalog, toPricingSettings } from "@/hooks/use-catalog";
import { calculatePrice } from "@/lib/services/pricing";
import { formatMoney } from "@/lib/format/money";
import { SERVICE_CATEGORY_LABELS } from "@/lib/config/constants";
import type { ServiceCategory, ServiceRow } from "@/types/database.types";
import { cn } from "@/lib/utils";

const UNIT: Record<string, string> = { page: "за страницу", document: "за документ", item: "за шт." };
const CATEGORIES: ServiceCategory[] = ["translation", "printing", "insurance"];

/** Строка услуги со степпером количества. */
function ServiceRowStepper({ service, first }: { service: ServiceRow; first: boolean }) {
  const { items, addItem, setQuantity } = useCart();
  const qty = items.find((i) => i.key === service.slug)?.quantity ?? 0;
  const price = Number(service.price);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 px-5 py-3.5",
        !first && "border-t border-slate-100",
        qty > 0 && "bg-[#FFFBF0]",
      )}
    >
      <div className="min-w-0 flex-1 basis-60">
        <div className="font-semibold text-slate-900">{service.name}</div>
        <div className="text-sm text-muted-foreground">
          {formatMoney(price)} {UNIT[service.unit]}
          {service.is_notarial && <span className="font-semibold text-gold-800"> · с заверением</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10"
          onClick={() => setQuantity(service.slug, qty - 1)}
          disabled={qty === 0}
          aria-label={`Уменьшить: ${service.name}`}
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
          aria-label={`Увеличить: ${service.name}`}
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

/** Калькулятор + корзина: выбор услуг и количества, срочность, заверение, доставка. */
export function CalculatorView({ initialCategory = "translation" }: { initialCategory?: ServiceCategory }) {
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

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="min-w-0 flex-[999_1_560px] space-y-3.5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Категории услуг">
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
              {SERVICE_CATEGORY_LABELS[c]}
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
        <h2 className="text-xl font-bold text-brand-800">Ваш заказ</h2>
        {hydrated && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Корзина пуста. Добавьте услугу кнопкой «+».</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.key} className="flex justify-between gap-3">
                <span className="text-slate-700">
                  {i.name} × {i.quantity}
                </span>
                <strong className="whitespace-nowrap">{formatMoney(i.unitPrice * i.quantity)}</strong>
              </li>
            ))}
          </ul>
        )}
        <UrgencySwitch settings={settings} />
        <NotaryCheckbox settings={settings} />
        <DeliveryPicker settings={settings} />
        <div className="border-t pt-4">
          <PriceLines pricing={pricing} />
        </div>
        {items.length > 0 ? (
          <Button asChild variant="gold" size="xl" className="w-full">
            <Link href="/checkout">Оформить заказ</Link>
          </Button>
        ) : (
          <Button variant="gold" size="xl" className="w-full" disabled>
            Оформить заказ
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          Предварительный расчёт. Итоговая цена фиксируется на сервере по действующему прайсу при оформлении.
        </p>
      </aside>
    </div>
  );
}
