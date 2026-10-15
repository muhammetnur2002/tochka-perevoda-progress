"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrderStatusBadge } from "@/components/order/order-status-badge";
import { OrderTimeline } from "@/components/order/order-timeline";
import { apiFetch } from "@/lib/client/api";
import { phoneMask } from "@/lib/format/phone";
import { formatMoney } from "@/lib/format/money";
import { formatDateTime } from "@/lib/format/date";
import type { OrderStatus } from "@/lib/config/constants";

interface LookupOrder {
  public_number: string;
  status: OrderStatus;
  total_price: number;
  paid: boolean;
  deadline: string | null;
  delivery_type: string;
  office: { address: string; hours: string | null; phone: string | null } | null;
  created_at: string;
  items: { name_snapshot: string; quantity: number }[];
  history: { to_status: OrderStatus; created_at: string }[];
}

/** Публичная проверка статуса: номер заказа + телефон из заказа. */
export function StatusLookup({ initialNumber = "" }: { initialNumber?: string }) {
  const t = useTranslations("statusPage");
  const to = useTranslations("offices");
  const [number, setNumber] = React.useState(initialNumber);
  const [phone, setPhone] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [order, setOrder] = React.useState<LookupOrder | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ order: LookupOrder | null }>("/api/orders/lookup", {
        method: "POST",
        body: JSON.stringify({ number: number.trim(), phone }),
      });
      setOrder(data.order);
      if (!data.order) setError(t("notFound"));
    } catch (err) {
      setOrder(null);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-5">
        <div className="min-w-0 flex-1 basis-56 space-y-1.5">
          <Label htmlFor="number">{t("number")}</Label>
          <Input
            id="number"
            className="h-11"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="ТП-2026-000124"
            required
          />
        </div>
        <div className="min-w-0 flex-1 basis-56 space-y-1.5">
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input
            id="phone"
            className="h-11"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(phoneMask(e.target.value))}
            placeholder="+7 (___) ___-__-__"
            required
          />
        </div>
        <Button type="submit" size="lg" className="h-11" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : t("check")}
        </Button>
      </form>

      {error && (
        <p role="alert" className="rounded-xl bg-muted p-4 text-sm text-slate-700">
          {error}
        </p>
      )}

      {order && (
        <section className="space-y-6 rounded-2xl border bg-card p-6" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground">{t("order")}</div>
              <strong className="text-2xl text-brand-800">{order.public_number}</strong>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>
          <OrderTimeline status={order.status} history={order.history} createdAt={order.created_at} />
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-muted p-3.5">
              <div className="text-muted-foreground">{t("services")}</div>
              <strong>{order.items.map((i) => `${i.name_snapshot} × ${i.quantity}`).join(", ")}</strong>
            </div>
            <div className="rounded-xl bg-muted p-3.5">
              <div className="text-muted-foreground">{t("readiness")}</div>
              <strong>{order.deadline ? formatDateTime(order.deadline) : t("tbd")}</strong>
            </div>
            <div className="rounded-xl bg-muted p-3.5">
              <div className="text-muted-foreground">{t("sum")}</div>
              <strong>
                {formatMoney(order.total_price)} · {order.paid ? t("paid") : t("unpaid")}
              </strong>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("receiving")}:{" "}
            {order.delivery_type === "delivery"
              ? t("courier")
              : to("pickupAt", {
                  address: [order.office?.address, order.office?.hours].filter(Boolean).join(", ") || "—",
                })}
          </p>
        </section>
      )}
    </div>
  );
}
