"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Banknote, CreditCard } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { usePaymentInfo } from "@/hooks/use-pricing";
import { formatMoney } from "@/lib/format/money";
import { cn } from "@/lib/utils";

/**
 * Как платить: онлайн сейчас (предоплата или полностью — по политике из настроек)
 * или в точке при сдаче документов (наличные/карта; для клиентов без российской карты).
 */
export function PaymentModePicker() {
  const t = useTranslations("payment");
  const { options, setPaymentMode } = useCart();
  const { policy, due, total } = usePaymentInfo();

  // Если оплату в точке отключили — возвращаем онлайн
  React.useEffect(() => {
    if (!policy.payInOffice && options.paymentMode === "office") setPaymentMode("online");
  }, [policy.payInOffice, options.paymentMode, setPaymentMode]);

  const modes = [
    {
      id: "online" as const,
      icon: CreditCard,
      title: t("modeOnline"),
      hint: due.isPrepayment
        ? t("modeOnlinePrepay", { amount: formatMoney(due.amount), percent: Math.round(due.percent), rest: formatMoney(due.rest) })
        : t("modeOnlineFull", { amount: formatMoney(total) }),
    },
    ...(policy.payInOffice
      ? [{ id: "office" as const, icon: Banknote, title: t("modeOffice"), hint: t("modeOfficeHint") }]
      : []),
  ];

  return (
    <div role="radiogroup" aria-label={t("modeTitle")} className={cn("grid gap-2.5", modes.length > 1 && "sm:grid-cols-2")}>
      {modes.map((m) => {
        const on = options.paymentMode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setPaymentMode(m.id)}
            className={cn(
              "flex min-h-20 items-start gap-3 rounded-xl p-3.5 text-left",
              on ? "border-2 border-gold-400 bg-gold-50" : "border border-input bg-background hover:border-brand-800",
            )}
          >
            <m.icon className={cn("mt-0.5 h-6 w-6 shrink-0", on ? "text-gold-800" : "text-brand-500")} aria-hidden />
            <span className="min-w-0">
              <strong className="block text-brand-800">{m.title}</strong>
              <span className="block text-sm text-muted-foreground">{m.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
