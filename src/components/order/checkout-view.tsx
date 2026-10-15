"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCart } from "@/components/cart/cart-provider";
import { PriceLines } from "@/components/cart/order-summary";
import { OrderForm, OrderSubmitButton } from "@/components/order/order-form";
import { useCatalog } from "@/hooks/use-catalog";
import { useAuth } from "@/hooks/use-auth";
import { useServiceName } from "@/i18n/names";
import { usePricing } from "@/hooks/use-pricing";
import { PromoField } from "@/components/cart/promo-field";
import { formatMoney } from "@/lib/format/money";

/** Оформление: форма слева, итог к оплате справа. */
export function CheckoutView() {
  const t = useTranslations("checkout");
  const tu = useTranslations("urgency");
  const to = useTranslations("offices");
  const serviceName = useServiceName();
  const { items, options, hydrated } = useCart();
  const { data } = useCatalog();
  const { profile, user } = useAuth();
  const pricing = usePricing();
  const office = data?.offices?.find((o) => o.id === options.officeId);

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
          <h2 className="text-xl font-bold text-brand-800">{t("totalTitle")}</h2>
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
          <div className="space-y-1 border-t pt-3 text-sm text-slate-700">
            <div className="flex justify-between gap-3">
              <span>{tu("legend")}</span>
              <span className="text-right">{tu(options.urgency)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>{to("officeLabel")}</span>
              <span className="text-right">{office?.address ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>{t("receiving")}</span>
              <span>{options.deliveryType === "pickup" ? t("pickup") : t("delivery")}</span>
            </div>
          </div>
          <PromoField />
          <PriceLines pricing={pricing} />
          <OrderSubmitButton />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("serverPriceNote")}{" "}
            <Link href="/calculator" className="text-brand-500 underline">
              {t("changeItems")}
            </Link>
          </p>
        </aside>
      )}
    </div>
  );
}
