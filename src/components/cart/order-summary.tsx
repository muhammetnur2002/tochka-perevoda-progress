"use client";

import { useLocale, useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useCart } from "@/components/cart/cart-provider";
import { canRequestNotary, notaryUnits, type PricingSettings } from "@/lib/services/pricing";
import { formatMoney } from "@/lib/format/money";
import { INTL_LOCALE, NUMERIC_DATE_LOCALES, isLocale } from "@/i18n/config";
import type { PriceBreakdown, UrgencyKey } from "@/types/domain";
import { cn } from "@/lib/utils";

export const URGENCY_KEYS: UrgencyKey[] = ["standard", "1d", "same_day"];

/** Переключатель срочности (крупные тач-цели). */
export function UrgencySwitch({ settings }: { settings: PricingSettings }) {
  const t = useTranslations("urgency");
  const { options, setUrgency } = useCart();
  const coef: Record<UrgencyKey, number> = { standard: 1, "1d": settings.urgency["1d"], same_day: settings.urgency.same_day };
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-slate-700">{t("legend")}</legend>
      {URGENCY_KEYS.map((key) => {
        const on = options.urgency === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => setUrgency(key)}
            className={cn(
              "flex min-h-11 w-full items-center justify-between rounded-xl px-4 text-left text-sm text-brand-800 transition-colors",
              on ? "border-2 border-gold-400 bg-gold-50 font-semibold" : "border border-input bg-background",
            )}
          >
            <span>{t(key)}</span>
            <span className="font-bold">×{String(coef[key]).replace(".", ",")}</span>
          </button>
        );
      })}
    </fieldset>
  );
}

/** Выбор способа получения: самовывоз в пункте приёма или курьер. */
export function DeliveryPicker({ settings }: { settings: PricingSettings }) {
  const t = useTranslations("calculator");
  const { options, setDeliveryType } = useCart();
  const opts = [
    { key: "pickup" as const, label: t("pickup") },
    {
      key: "delivery" as const,
      label: settings.deliveryPrice > 0 ? t("courierPrice", { price: formatMoney(settings.deliveryPrice) }) : t("courier"),
    },
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-slate-700">{t("receiving")}</legend>
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => {
          const on = options.deliveryType === o.key;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={on}
              onClick={() => setDeliveryType(o.key)}
              className={cn(
                "min-h-11 flex-1 basis-40 rounded-xl px-4 text-sm text-brand-800",
                on ? "border-2 border-brand-800 bg-brand-50 font-semibold" : "border border-input bg-background",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Галочка нотариального заверения — только если есть переводы без заверения в цене. */
export function NotaryCheckbox({ settings }: { settings: PricingSettings }) {
  const t = useTranslations("calculator");
  const { items, options, setNotaryRequested } = useCart();
  if (!canRequestNotary(items)) return null;
  const units = notaryUnits(items);
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id="notary"
        checked={options.notaryRequested}
        onCheckedChange={(v) => setNotaryRequested(v === true)}
        className="mt-0.5 h-5 w-5"
      />
      <Label htmlFor="notary" className="cursor-pointer text-sm font-normal leading-snug text-slate-700">
        {t("notaryLabel")}{" "}
        <strong className="text-brand-800">
          {settings.notaryFee > 0 ? t("notaryPrice", { price: formatMoney(settings.notaryFee), count: units }) : t("notaryTbd")}
        </strong>
      </Label>
    </div>
  );
}

/** Итоговая разбивка цены и срок готовности. */
export function PriceLines({ pricing }: { pricing: PriceBreakdown }) {
  const t = useTranslations("calculator");
  const formatDeadline = useDeadlineFormatter();
  return (
    <div className="space-y-1.5 text-sm text-slate-700">
      <div className="flex justify-between">
        <span>{t("services")}</span>
        <span>{formatMoney(pricing.subtotal)}</span>
      </div>
      {pricing.discount > 0 && (
        <div className="flex justify-between text-emerald-700">
          <span>{t("discount")}</span>
          <span>−{formatMoney(pricing.discount)}</span>
        </div>
      )}
      {pricing.urgencySurcharge > 0 && (
        <div className="flex justify-between">
          <span>{t("urgencySurcharge")}</span>
          <span>+{formatMoney(pricing.urgencySurcharge)}</span>
        </div>
      )}
      {pricing.notaryFee > 0 && (
        <div className="flex justify-between">
          <span>{t("notary")}</span>
          <span>+{formatMoney(pricing.notaryFee)}</span>
        </div>
      )}
      {pricing.deliveryFee > 0 && (
        <div className="flex justify-between">
          <span>{t("delivery")}</span>
          <span>+{formatMoney(pricing.deliveryFee)}</span>
        </div>
      )}
      <div className="flex items-baseline justify-between pt-2">
        <strong className="text-base text-brand-800">{t("total")}</strong>
        <strong className="text-3xl text-brand-800">{formatMoney(pricing.total)}</strong>
      </div>
      {pricing.deadline && (
        <div className="flex justify-between rounded-lg bg-gold-50 px-3 py-2.5 text-gold-900">
          <span>{t("ready")}</span>
          <strong>{formatDeadline(pricing.deadline, pricing.urgencyKey)}</strong>
        </div>
      )}
    </div>
  );
}

/** Дата готовности на языке интерфейса (по московскому времени). */
export function useDeadlineFormatter(): (deadline: Date, urgency: UrgencyKey) => string {
  const t = useTranslations("calculator");
  const locale = useLocale();
  const intl = isLocale(locale) ? INTL_LOCALE[locale] : "ru-RU";
  return (deadline, urgency) => {
    const opts = { timeZone: "Europe/Moscow" } as const;
    if (urgency === "same_day" && deadline.toLocaleDateString("ru-RU", opts) === new Date().toLocaleDateString("ru-RU", opts)) {
      return t("sameDay");
    }
    if (isLocale(locale) && NUMERIC_DATE_LOCALES.includes(locale)) {
      return deadline.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", ...opts });
    }
    try {
      return deadline.toLocaleDateString(intl, { weekday: "short", day: "numeric", month: "long", ...opts });
    } catch {
      return deadline.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long", ...opts });
    }
  };
}
