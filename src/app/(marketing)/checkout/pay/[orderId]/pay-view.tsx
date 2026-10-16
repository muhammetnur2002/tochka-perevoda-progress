"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PaymentPanel, type PayMethod } from "@/components/payments/payment-panel";
import { apiFetch, getOrderNumber, getOrderToken, saveOrderToken } from "@/lib/client/api";
import { formatMoney } from "@/lib/format/money";

interface RequestInfo {
  request: { id: string; amount: number; reason: string | null; is_extra: boolean; status: "open" | "paid" | "cancelled" };
  order: { publicNumber: string; remaining: number };
}

interface PayViewProps {
  orderId: string;
  method: PayMethod;
  /** Ссылка на оплату из CRM (остаток или доплата). */
  requestId?: string | null;
  /** Токен гостя из такой ссылки (или из localStorage после оформления заказа). */
  linkToken?: string | null;
}

/** Экран оплаты: гость — по токену (из ссылки или localStorage), клиент — по своей сессии. */
export function PayView({ orderId, method, requestId = null, linkToken = null }: PayViewProps) {
  const t = useTranslations("payment");
  const router = useRouter();
  const [token, setToken] = React.useState<string | null>(null);
  const [number, setNumber] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<RequestInfo | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const activeToken = linkToken ?? getOrderToken(orderId);
    setToken(activeToken);

    const load = async () => {
      if (requestId) {
        try {
          const data = await apiFetch<RequestInfo>(`/api/payments/requests/${requestId}`, { orderToken: activeToken });
          if (cancelled) return;
          setInfo(data);
          setNumber(data.order.publicNumber);
          // запоминаем токен, чтобы страница успеха и статус открывались без ссылки
          if (linkToken) saveOrderToken(orderId, linkToken, data.order.publicNumber);
        } catch {
          if (!cancelled) setNumber(null);
        }
        return;
      }
      const saved = getOrderNumber(orderId);
      if (saved) {
        setNumber(saved);
        return;
      }
      // вошедший клиент без токена (оплата остатка из личного кабинета)
      try {
        const d = await apiFetch<{ order: { public_number: string } }>(`/api/orders/${orderId}`);
        if (!cancelled) setNumber(d.order.public_number);
      } catch {
        if (!cancelled) setNumber(null);
      }
    };
    void load().finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [orderId, requestId, linkToken]);

  const onPaid = React.useCallback(() => {
    router.replace(`/checkout/success/${encodeURIComponent(number ?? "")}?order=${orderId}&paid=1`);
  }, [router, number, orderId]);

  if (!ready) return <div className="h-80 animate-pulse rounded-2xl bg-muted" />;

  if (!number) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-brand-800">{t("noAccessTitle")}</h1>
        <p className="text-muted-foreground">{t("noAccessText")}</p>
      </div>
    );
  }

  if (info && info.request.status !== "open") {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-brand-800">{t("title", { number })}</h1>
        <p className="text-muted-foreground">{info.request.status === "paid" ? t("requestPaid") : t("requestCancelled")}</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-6 text-3xl font-extrabold text-brand-800">{t("title", { number })}</h1>
      {info && (
        <section className="mb-5 space-y-1 rounded-2xl border-2 border-gold-400 bg-gold-50 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <strong className="text-brand-800">{info.request.is_extra ? t("requestExtra") : t("requestBalance")}</strong>
            <strong className="text-2xl text-brand-800">{formatMoney(Math.min(info.request.amount, info.order.remaining))}</strong>
          </div>
          {info.request.reason && <p className="text-sm text-slate-700">{info.request.reason}</p>}
        </section>
      )}
      <PaymentPanel
        orderId={orderId}
        publicNumber={number}
        token={token}
        initialMethod={method}
        requestId={requestId}
        onPaid={onPaid}
      />
    </>
  );
}
