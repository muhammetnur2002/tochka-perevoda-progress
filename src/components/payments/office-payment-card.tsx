"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Banknote, Clock, MapPin } from "lucide-react";
import { apiFetch, getOrderToken } from "@/lib/client/api";
import { formatMoney } from "@/lib/format/money";

interface PaySummary {
  total: number;
  remaining: number;
  office: { address: string; hours: string | null; phone: string | null } | null;
}

/** «Оплата в точке»: сколько и куда принести (гость — по токену из localStorage, клиент — по сессии). */
export function OfficePaymentCard({ orderId }: { orderId: string }) {
  const t = useTranslations("payment");
  const to = useTranslations("offices");
  const [data, setData] = React.useState<PaySummary | null>(null);

  React.useEffect(() => {
    apiFetch<PaySummary>(`/api/orders/${orderId}/pay-summary`, { orderToken: getOrderToken(orderId) })
      .then(setData)
      .catch(() => setData(null));
  }, [orderId]);

  if (!data) return null;
  return (
    <section className="mt-8 w-full max-w-lg space-y-3 rounded-2xl border-2 border-gold-400 bg-gold-50 p-5 text-left">
      <h2 className="flex items-center gap-2 text-lg font-bold text-brand-800">
        <Banknote className="h-5 w-5 text-gold-800" aria-hidden /> {t("officeCardTitle", { amount: formatMoney(data.remaining) })}
      </h2>
      <p className="text-sm text-slate-700">{t("officeCardText")}</p>
      {data.office && (
        <ul className="space-y-1.5 text-sm text-slate-800">
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-800" aria-hidden /> {data.office.address}
          </li>
          <li className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-800" aria-hidden /> {data.office.hours ?? to("hoursTbd")}
          </li>
        </ul>
      )}
    </section>
  );
}
