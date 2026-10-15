"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PaymentPanel, type PayMethod } from "@/components/payments/payment-panel";
import { apiFetch, getOrderNumber, getOrderToken } from "@/lib/client/api";

/** Экран оплаты: гость — по токену из localStorage, клиент — по своей сессии. */
export function PayView({ orderId, method }: { orderId: string; method: PayMethod }) {
  const t = useTranslations("payment");
  const router = useRouter();
  const [token, setToken] = React.useState<string | null>(null);
  const [number, setNumber] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const savedToken = getOrderToken(orderId);
    const n = getOrderNumber(orderId);
    setToken(savedToken);
    setNumber(n);
    if (n) {
      setReady(true);
      return;
    }
    // вошедший клиент без токена (оплата из личного кабинета)
    apiFetch<{ order: { public_number: string } }>(`/api/orders/${orderId}`)
      .then((d) => setNumber(d.order.public_number))
      .catch(() => setNumber(null))
      .finally(() => setReady(true));
  }, [orderId]);

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

  return (
    <>
      <h1 className="mb-6 text-3xl font-extrabold text-brand-800">{t("title", { number })}</h1>
      <PaymentPanel orderId={orderId} publicNumber={number} token={token} initialMethod={method} onPaid={onPaid} />
    </>
  );
}
