"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useCart } from "@/components/cart/cart-provider";
import { canRequestNotary, notaryUnits, type PricingSettings } from "@/lib/services/pricing";
import { formatMoney } from "@/lib/format/money";
import type { PriceBreakdown, UrgencyKey } from "@/types/domain";
import { cn } from "@/lib/utils";

export const URGENCY_OPTIONS: { key: UrgencyKey; label: string; short: string }[] = [
  { key: "standard", label: "Стандартно, 1–2 рабочих дня", short: "×1" },
  { key: "1d", label: "Срочно — за 1 день", short: "×1,5" },
  { key: "same_day", label: "В день обращения", short: "×2" },
];

/** Переключатель срочности (крупные тач-цели). */
export function UrgencySwitch({ settings }: { settings: PricingSettings }) {
  const { options, setUrgency } = useCart();
  const coef: Record<UrgencyKey, number> = { standard: 1, "1d": settings.urgency["1d"], same_day: settings.urgency.same_day };
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-slate-700">Срочность</legend>
      {URGENCY_OPTIONS.map((u) => {
        const on = options.urgency === u.key;
        return (
          <button
            key={u.key}
            type="button"
            aria-pressed={on}
            onClick={() => setUrgency(u.key)}
            className={cn(
              "flex min-h-11 w-full items-center justify-between rounded-xl px-4 text-left text-sm text-brand-800 transition-colors",
              on ? "border-2 border-gold-400 bg-gold-50 font-semibold" : "border border-input bg-background",
            )}
          >
            <span>{u.label}</span>
            <span className="font-bold">×{String(coef[u.key]).replace(".", ",")}</span>
          </button>
        );
      })}
    </fieldset>
  );
}

/** Выбор способа получения. */
export function DeliveryPicker({ settings }: { settings: PricingSettings }) {
  const { options, setDeliveryType } = useCart();
  const opts = [
    { key: "pickup" as const, label: "Самовывоз — Сибирский Тракт, 7/6" },
    {
      key: "delivery" as const,
      label: settings.deliveryPrice > 0 ? `Доставка (+${formatMoney(settings.deliveryPrice)})` : "Доставка курьером",
    },
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-slate-700">Получение</legend>
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
        Нотариальное заверение для переводов без заверения{" "}
        <strong className="text-brand-800">
          {settings.notaryFee > 0
            ? `+${formatMoney(settings.notaryFee)} × ${units} док.`
            : "(стоимость уточнит менеджер)"}
        </strong>
      </Label>
    </div>
  );
}

/** Итоговая разбивка цены и срок готовности. */
export function PriceLines({ pricing }: { pricing: PriceBreakdown }) {
  return (
    <div className="space-y-1.5 text-sm text-slate-700">
      <div className="flex justify-between">
        <span>Услуги</span>
        <span>{formatMoney(pricing.subtotal)}</span>
      </div>
      {pricing.discount > 0 && (
        <div className="flex justify-between text-emerald-700">
          <span>Скидка за объём</span>
          <span>−{formatMoney(pricing.discount)}</span>
        </div>
      )}
      {pricing.urgencySurcharge > 0 && (
        <div className="flex justify-between">
          <span>Надбавка за срочность</span>
          <span>+{formatMoney(pricing.urgencySurcharge)}</span>
        </div>
      )}
      {pricing.notaryFee > 0 && (
        <div className="flex justify-between">
          <span>Заверение</span>
          <span>+{formatMoney(pricing.notaryFee)}</span>
        </div>
      )}
      {pricing.deliveryFee > 0 && (
        <div className="flex justify-between">
          <span>Доставка</span>
          <span>+{formatMoney(pricing.deliveryFee)}</span>
        </div>
      )}
      <div className="flex items-baseline justify-between pt-2">
        <strong className="text-base text-brand-800">Итого</strong>
        <strong className="text-3xl text-brand-800">{formatMoney(pricing.total)}</strong>
      </div>
      {pricing.deadline && (
        <div className="flex justify-between rounded-lg bg-gold-50 px-3 py-2.5 text-gold-900">
          <span>Готовность</span>
          <strong>{formatDeadline(pricing.deadline, pricing.urgencyKey)}</strong>
        </div>
      )}
    </div>
  );
}

export function formatDeadline(deadline: Date, urgency: UrgencyKey): string {
  const today = new Date().toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
  const day = deadline.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
  if (urgency === "same_day" && day === today) return "сегодня до 19:00";
  return deadline.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Moscow",
  });
}
