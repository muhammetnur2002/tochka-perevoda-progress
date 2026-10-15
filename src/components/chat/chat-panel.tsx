"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/client/api";
import { formatDateTime } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import type { ChatMessageRow } from "@/types/database.types";

type Message = Pick<ChatMessageRow, "id" | "sender_id" | "sender_role" | "body" | "created_at" | "read_at">;

const STAFF_LABEL: Record<string, string> = { manager: "Менеджер", admin: "Менеджер" };

/**
 * Чат по заказу (клиент ↔ менеджер). Новые сообщения приходят через Supabase
 * Realtime (RLS: только участники заказа), плюс редкий поллинг на случай обрыва.
 */
export function ChatPanel({ orderId, className }: { orderId: string; className?: string }) {
  const queryClient = useQueryClient();
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const key = React.useMemo(() => ["chat", orderId], [orderId]);

  const { data } = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<{ messages: Message[]; me: string }>(`/api/chat?orderId=${encodeURIComponent(orderId)}`),
    refetchInterval: 30_000,
  });
  const messages = data?.messages ?? [];

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `order_id=eq.${orderId}` },
        () => queryClient.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, queryClient, key]);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      await apiFetch("/api/chat", { method: "POST", body: JSON.stringify({ orderId, body }) });
      setText("");
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn("flex h-[28rem] flex-col overflow-hidden rounded-xl border bg-slate-50", className)}>
      <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <p className="pt-10 text-center text-sm text-muted-foreground">Напишите менеджеру — ответим в рабочее время.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === data?.me;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] px-3.5 py-2 text-sm leading-relaxed",
                  mine ? "rounded-2xl rounded-br-md bg-[#DCF3C8]" : "rounded-2xl rounded-bl-md bg-white shadow-sm",
                )}
              >
                {!mine && STAFF_LABEL[m.sender_role] && (
                  <div className="text-xs font-bold text-brand-500">{STAFF_LABEL[m.sender_role]}</div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className="mt-0.5 text-right text-[11px] text-muted-foreground">{formatDateTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t bg-white p-3">
        <label className="sr-only" htmlFor={`chat-${orderId}`}>
          Сообщение
        </label>
        <Input
          id={`chat-${orderId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Сообщение…"
          maxLength={2000}
          className="h-11 rounded-full"
        />
        <Button type="submit" size="icon" className="h-11 w-11 rounded-full" disabled={sending || !text.trim()} aria-label="Отправить">
          <Send />
        </Button>
      </form>
    </div>
  );
}
