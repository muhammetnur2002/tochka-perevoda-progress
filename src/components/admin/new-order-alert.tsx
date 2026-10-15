"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format/money";

/** Короткий сигнал через WebAudio (без внешних файлов). */
function beep() {
  try {
    const ctx = new AudioContext();
    const play = (freq: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.25);
    };
    play(880, 0);
    play(1175, 0.18);
  } catch {
    /* звук заблокирован браузером до первого клика */
  }
}

/**
 * Realtime-алерт о новом заказе для менеджеров: тост + звук + обновление канбана.
 * Подписка на INSERT в orders (RLS: событие получают только менеджеры).
 */
export function NewOrderAlert() {
  const router = useRouter();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-new-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const row = payload.new as { id: string; public_number?: string; total_price?: number };
        beep();
        toast(`Новый заказ ${row.public_number ?? ""}`, {
          description: row.total_price ? formatMoney(Number(row.total_price)) : undefined,
          action: { label: "Открыть", onClick: () => router.push(`/admin/orders/${row.id}`) },
          duration: 15_000,
        });
        void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, queryClient]);

  return null;
}
