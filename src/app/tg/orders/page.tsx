"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge } from "@/components/order/order-status-badge";
import { useTelegram } from "@/hooks/use-telegram";
import { apiFetch } from "@/lib/client/api";
import { formatMoney } from "@/lib/format/money";
import { formatDateTime } from "@/lib/format/date";
import { ORDER_STATUS_FLOW, type OrderStatus } from "@/lib/config/constants";
import { cn } from "@/lib/utils";

interface OrderItem {
  id: string;
  public_number: string;
  status: OrderStatus;
  total_price: number;
  paid_amount: number;
  deadline: string | null;
  items: { name_snapshot: string; quantity: number }[];
}

const STEP_TEXT: Partial<Record<OrderStatus, string>> = {
  new: "Ожидает оплаты/подтверждения",
  confirmed: "Оплачен, передан переводчику",
  in_progress: "Переводчик работает",
  ready: "Можно забирать: Сибирский Тракт, 7/6",
  issued: "Выдан",
  completed: "Завершён",
  cancelled: "Отменён",
};

function OrdersList() {
  const { auth } = useTelegram();
  const highlight = useSearchParams().get("id");
  const { data, isLoading, error } = useQuery({
    queryKey: ["tg-orders"],
    queryFn: () => apiFetch<{ orders: OrderItem[] }>("/api/orders?limit=30"),
    enabled: auth !== "pending",
    refetchInterval: 30_000,
  });

  if (auth === "pending" || isLoading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="rounded-2xl bg-white p-5 text-center text-sm text-slate-700">
        Откройте приложение из бота в Telegram, чтобы увидеть свои заказы. На сайте — по номеру на странице{" "}
        <Link className="text-brand-500 underline" href="/status">
          «Статус заказа»
        </Link>
        .
      </p>
    );
  }

  if (data.orders.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-5 text-center text-sm text-slate-700">
        Заказов пока нет.{" "}
        <Link href="/tg" className="font-bold text-brand-500">
          Оформить первый
        </Link>
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {data.orders.map((o) => {
        const step = o.status === "cancelled" ? 0 : ORDER_STATUS_FLOW.indexOf(o.status) + 1;
        const unpaid = Number(o.paid_amount) < Number(o.total_price) && o.status !== "cancelled";
        return (
          <li
            key={o.id}
            className={cn("space-y-2.5 rounded-2xl bg-white p-3.5", highlight === o.id && "ring-2 ring-gold-400")}
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="text-brand-800">{o.public_number}</strong>
              <OrderStatusBadge status={o.status} />
            </div>
            <div className="text-sm text-slate-700">{o.items.map((i) => `${i.name_snapshot} × ${i.quantity}`).join(", ")}</div>
            <div className="grid grid-cols-6 gap-1" aria-hidden>
              {ORDER_STATUS_FLOW.map((s, i) => (
                <span
                  key={s}
                  className={cn("h-1.5 rounded-full", i < step - 1 ? "bg-brand-800" : i === step - 1 ? "bg-gold-400" : "bg-slate-200")}
                />
              ))}
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>{STEP_TEXT[o.status]}</span>
              <span>{o.deadline && step < 4 ? `готов ${formatDateTime(o.deadline)}` : formatMoney(Number(o.total_price))}</span>
            </div>
            {unpaid && (
              <Link
                href={`/checkout/pay/${o.id}`}
                className="flex min-h-10 items-center justify-center rounded-xl bg-gold-400 text-sm font-extrabold text-brand-800"
              >
                Оплатить {formatMoney(Number(o.total_price) - Number(o.paid_amount))}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function TgOrdersPage() {
  return (
    <div className="p-3">
      <React.Suspense fallback={<Skeleton className="h-28 rounded-2xl" />}>
        <OrdersList />
      </React.Suspense>
    </div>
  );
}
