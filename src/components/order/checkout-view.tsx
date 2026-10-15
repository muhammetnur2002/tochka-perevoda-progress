"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/cart-provider";
import { PriceLines, URGENCY_OPTIONS } from "@/components/cart/order-summary";
import { OrderForm, OrderSubmitButton } from "@/components/order/order-form";
import { useCatalog, toPricingSettings } from "@/hooks/use-catalog";
import { useAuth } from "@/hooks/use-auth";
import { calculatePrice } from "@/lib/services/pricing";
import { formatMoney } from "@/lib/format/money";

/** Оформление: форма слева, итог к оплате справа. */
export function CheckoutView() {
  const { items, options, hydrated } = useCart();
  const { data } = useCatalog();
  const { profile, user } = useAuth();
  const pricing = calculatePrice(items, {
    urgency: options.urgency,
    notaryRequested: options.notaryRequested,
    deliveryType: options.deliveryType,
    settings: toPricingSettings(data?.settings),
  });

  if (!hydrated) return <div className="h-96 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="min-w-0 flex-[999_1_560px]">
        <OrderForm
          key={profile?.id ?? "guest"}
          defaults={{
            name: profile?.name ?? "",
            phone: profile?.phone ?? "",
            email: profile?.email ?? user?.email ?? "",
          }}
        />
      </div>
      {items.length > 0 && (
        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-3 rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
          <h2 className="text-xl font-bold text-brand-800">Итого к оплате</h2>
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
          <div className="space-y-1 border-t pt-3 text-sm text-slate-700">
            <div className="flex justify-between">
              <span>Срочность</span>
              <span>{URGENCY_OPTIONS.find((u) => u.key === options.urgency)?.label}</span>
            </div>
            <div className="flex justify-between">
              <span>Получение</span>
              <span>{options.deliveryType === "pickup" ? "Самовывоз" : "Доставка"}</span>
            </div>
          </div>
          <PriceLines pricing={pricing} />
          <OrderSubmitButton />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Цена пересчитывается на сервере по актуальному прайсу. Номер заказа придёт по SMS и в Telegram.{" "}
            <Link href="/calculator" className="text-brand-500 underline">
              Изменить состав
            </Link>
          </p>
        </aside>
      )}
    </div>
  );
}
