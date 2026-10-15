import { cn } from "@/lib/utils";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/config/constants";
import { formatDateTime } from "@/lib/format/date";

interface OrderTimelineProps {
  status: OrderStatus;
  /** История смен статуса: даты под шагами. */
  history?: { to_status: OrderStatus; created_at: string }[];
  createdAt?: string;
  className?: string;
}

/** Статус-бар заказа: new → confirmed → in_progress → ready → issued → completed. */
export function OrderTimeline({ status, history = [], createdAt, className }: OrderTimelineProps) {
  if (status === "cancelled") {
    return (
      <div className={cn("rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold text-destructive", className)}>
        Заказ отменён
      </div>
    );
  }

  const current = ORDER_STATUS_FLOW.indexOf(status);
  const dateOf = (step: OrderStatus): string | null => {
    if (step === "new" && createdAt) return formatDateTime(createdAt);
    const h = [...history].reverse().find((x) => x.to_status === step);
    return h ? formatDateTime(h.created_at) : null;
  };

  return (
    <ol className={cn("grid grid-cols-3 gap-2 sm:grid-cols-6", className)} aria-label="Ход выполнения заказа">
      {ORDER_STATUS_FLOW.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex flex-col gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "h-2 rounded-full",
                active ? "bg-gold-400" : done ? "bg-brand-800" : "bg-slate-200",
              )}
            />
            <strong className={cn("text-sm", done || active ? "text-brand-800" : "text-slate-500")}>
              {ORDER_STATUS_LABELS[step]}
            </strong>
            <span className="text-xs text-muted-foreground">{dateOf(step) ?? (active ? "сейчас" : "")}</span>
          </li>
        );
      })}
    </ol>
  );
}
