"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useTelegram } from "@/hooks/use-telegram";
import { apiFetch } from "@/lib/client/api";

interface OrderOption {
  id: string;
  public_number: string;
}

/** Чат с менеджером по выбранному заказу (Realtime). */
export default function TgChatPage() {
  const { auth } = useTelegram();
  const { data, isLoading, error } = useQuery({
    queryKey: ["tg-orders"],
    queryFn: () => apiFetch<{ orders: OrderOption[] }>("/api/orders?limit=30"),
    enabled: auth !== "pending",
  });
  const orders = data?.orders ?? [];
  const [orderId, setOrderId] = React.useState<string>("");
  const selected = orderId || orders[0]?.id || "";

  if (auth === "pending" || isLoading) return <Skeleton className="m-3 h-96 rounded-2xl" />;

  if (error || orders.length === 0) {
    return (
      <p className="m-3 rounded-2xl bg-white p-5 text-center text-sm text-slate-700">
        Чат доступен по оформленному заказу. Вопрос до заказа можно задать боту обычным сообщением.
      </p>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2.5 p-3">
      <label className="sr-only" htmlFor="tg-chat-order">
        Заказ
      </label>
      <select
        id="tg-chat-order"
        value={selected}
        onChange={(e) => setOrderId(e.target.value)}
        className="h-11 rounded-xl border bg-white px-3 text-sm font-semibold"
      >
        {orders.map((o) => (
          <option key={o.id} value={o.id}>
            Чат по заказу {o.public_number}
          </option>
        ))}
      </select>
      {selected && <ChatPanel key={selected} orderId={selected} className="h-[calc(100vh-190px)] min-h-[360px]" />}
    </div>
  );
}
