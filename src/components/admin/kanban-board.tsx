"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/client/api";
import { canTransition } from "@/lib/auth/roles";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/config/constants";
import { formatMoney } from "@/lib/format/money";
import { formatDateTime } from "@/lib/format/date";
import { cn } from "@/lib/utils";

export interface KanbanOrder {
  id: string;
  public_number: string;
  status: OrderStatus;
  total_price: number;
  paid_amount: number;
  deadline: string | null;
  source: string;
  language_from: string | null;
  created_at: string;
  client: { name: string; phone: string | null } | null;
  items: { service_id: string | null; name_snapshot: string; quantity: number }[];
  assignments: { role: string; status: string; user_id: string; user: { name: string | null } | null }[];
}

const COLUMNS: OrderStatus[] = ["new", "confirmed", "in_progress", "ready", "issued", "completed"];
const SOURCE: Record<string, string> = { web: "Сайт", mini_app: "Mini App", bot: "Бот", admin: "Админка", walkin: "Офис" };
const QUICK = [
  { id: "all", label: "Все" },
  { id: "hot", label: "Срок < 24 ч" },
  { id: "overdue", label: "Просрочены" },
  { id: "unpaid", label: "Не оплачены" },
  { id: "tg", label: "Из Telegram" },
] as const;
type Quick = (typeof QUICK)[number]["id"];

const DAY = 86_400_000;
const isOpen = (o: KanbanOrder) => ["new", "confirmed", "in_progress"].includes(o.status);
const isHot = (o: KanbanOrder) =>
  isOpen(o) && !!o.deadline && new Date(o.deadline).getTime() - Date.now() < DAY && new Date(o.deadline).getTime() > Date.now();
const isOverdue = (o: KanbanOrder) => isOpen(o) && !!o.deadline && new Date(o.deadline).getTime() < Date.now();
const executorOf = (o: KanbanOrder) => o.assignments.find((a) => a.role !== "manager" && a.status !== "rejected");

function OrderCard({ order, onNext }: { order: KanbanOrder; onNext?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: order.id, data: { order } });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const executor = executorOf(order);
  const paid = Number(order.paid_amount) >= Number(order.total_price);
  const hot = isHot(order) || isOverdue(order);
  const initials = executor?.user?.name
    ? executor.user.name
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
    : "?";

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex touch-none flex-col gap-2 rounded-xl border bg-white p-3 text-sm shadow-sm",
        hot ? "border-red-300" : "border-slate-200",
        isDragging && "z-50 rotate-1 cursor-grabbing shadow-card",
      )}
    >
      <div {...listeners} {...attributes} className="cursor-grab space-y-1.5" aria-label={`Перетащить заказ ${order.public_number}`}>
        <div className="flex items-center justify-between gap-1.5">
          <strong className="text-brand-800">{order.public_number}</strong>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{SOURCE[order.source] ?? order.source}</span>
        </div>
        <div className="text-slate-600">{order.client?.name ?? "—"}</div>
        <div className="leading-snug">{order.items.map((i) => `${i.name_snapshot}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`).join(", ")}</div>
        <div className="flex items-center justify-between">
          <strong>{formatMoney(Number(order.total_price))}</strong>
          <span className={cn("text-xs font-extrabold", paid ? "text-emerald-700" : "text-red-700")}>{paid ? "оплачен" : "не оплачен"}</span>
        </div>
        <div className="flex items-center justify-between gap-1.5">
          <span className={cn("text-xs font-bold", hot ? "text-red-700" : "text-slate-500")}>
            {order.deadline ? (isOverdue(order) ? "просрочен · " : "") + formatDateTime(order.deadline) : "без срока"}
          </span>
          <span
            title={executor?.user?.name ?? "Исполнитель не назначен"}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-[11px] font-extrabold text-brand-700"
          >
            {initials}
          </span>
        </div>
      </div>
      <div className="flex gap-1.5">
        <Link
          href={`/admin/orders/${order.id}`}
          className="flex min-h-9 flex-1 items-center justify-center rounded-lg border text-xs font-bold text-brand-800 hover:border-brand-800"
        >
          Открыть
        </Link>
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Следующий статус"
            className="flex min-h-9 w-10 items-center justify-center rounded-lg bg-brand-800 text-white hover:bg-brand-700"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
}

function Column({ status, orders, onMove }: { status: OrderStatus; orders: KanbanOrder[]; onMove: (o: KanbanOrder, to: OrderStatus) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const next = COLUMNS[COLUMNS.indexOf(status) + 1];
  return (
    <section
      ref={setNodeRef}
      aria-label={ORDER_STATUS_LABELS[status]}
      className={cn("flex min-h-[520px] flex-col gap-2 rounded-2xl p-2 transition-colors", isOver ? "bg-gold-50 ring-2 ring-gold-300" : "bg-[#EBEFF5]")}
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <strong className="text-sm text-brand-800">{ORDER_STATUS_LABELS[status]}</strong>
        <span className="rounded-full bg-white px-2 text-xs font-extrabold text-slate-600">{orders.length}</span>
      </div>
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} onNext={next ? () => onMove(o, next) : undefined} />
      ))}
    </section>
  );
}

/** Канбан заказов: перетаскивание между статусами, оптимистичное обновление, Realtime. */
export function KanbanBoard() {
  const queryClient = useQueryClient();
  const queryKey = React.useMemo(() => ["admin-orders"], []);
  const [quick, setQuick] = React.useState<Quick>("all");
  const [search, setSearch] = React.useState("");
  const [service, setService] = React.useState("");
  const [executor, setExecutor] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => apiFetch<{ orders: KanbanOrder[] }>("/api/orders?limit=500"),
    refetchInterval: 60_000,
  });
  const orders = data?.orders ?? [];

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-kanban")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () =>
        queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, queryKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const move = async (order: KanbanOrder, to: OrderStatus) => {
    if (order.status === to) return;
    if (!canTransition(order.status, to)) {
      toast.error(`Нельзя: «${ORDER_STATUS_LABELS[order.status]}» → «${ORDER_STATUS_LABELS[to]}»`);
      return;
    }
    const previous = queryClient.getQueryData<{ orders: KanbanOrder[] }>(queryKey);
    queryClient.setQueryData<{ orders: KanbanOrder[] }>(queryKey, (d) =>
      d ? { orders: d.orders.map((o) => (o.id === order.id ? { ...o, status: to } : o)) } : d,
    );
    try {
      await apiFetch(`/api/orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ status: to }) });
      toast.success(`${order.public_number}: ${ORDER_STATUS_LABELS[to]}`);
    } catch (err) {
      queryClient.setQueryData(queryKey, previous);
      toast.error((err as Error).message);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    const order = e.active.data.current?.order as KanbanOrder | undefined;
    const to = e.over?.id as OrderStatus | undefined;
    if (order && to) void move(order, to);
  };

  const services = [...new Map(orders.flatMap((o) => o.items).map((i) => [i.name_snapshot, i.name_snapshot])).values()].sort();
  const executors = [
    ...new Map(
      orders.flatMap((o) => o.assignments.filter((a) => a.user?.name).map((a) => [a.user_id, a.user?.name ?? ""] as const)),
    ).entries(),
  ];

  const q = search.trim().toLowerCase();
  const visible = orders.filter((o) => {
    if (quick === "hot" && !isHot(o)) return false;
    if (quick === "overdue" && !isOverdue(o)) return false;
    if (quick === "unpaid" && Number(o.paid_amount) >= Number(o.total_price)) return false;
    if (quick === "tg" && !["mini_app", "bot"].includes(o.source)) return false;
    if (service && !o.items.some((i) => i.name_snapshot === service)) return false;
    if (executor && !o.assignments.some((a) => a.user_id === executor && a.status !== "rejected")) return false;
    if (q && !`${o.public_number} ${o.client?.name ?? ""} ${o.client?.phone ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {QUICK.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setQuick(f.id)}
            aria-pressed={quick === f.id}
            className={cn(
              "min-h-9 rounded-full border px-3.5 text-sm font-bold",
              quick === f.id ? "border-brand-800 bg-brand-800 text-white" : "border-input bg-white text-brand-800",
            )}
          >
            {f.label}
          </button>
        ))}
        <label className="sr-only" htmlFor="kanban-search">
          Поиск
        </label>
        <Input
          id="kanban-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Номер, клиент, телефон"
          className="h-9 w-56"
        />
        <select aria-label="Услуга" value={service} onChange={(e) => setService(e.target.value)} className="h-9 max-w-56 rounded-md border bg-white px-2 text-sm">
          <option value="">Все услуги</option>
          {services.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Исполнитель" value={executor} onChange={(e) => setExecutor(e.target.value)} className="h-9 rounded-md border bg-white px-2 text-sm">
          <option value="">Все исполнители</option>
          {executors.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {COLUMNS.map((c) => (
            <Skeleton key={c} className="h-96 rounded-2xl" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[1400px] grid-cols-6 gap-3">
              {COLUMNS.map((c) => (
                <Column key={c} status={c} orders={visible.filter((o) => o.status === c)} onMove={move} />
              ))}
            </div>
          </div>
        </DndContext>
      )}
      <p className="text-xs text-muted-foreground">
        Перетащите карточку в другую колонку или нажмите «→». Отменённые заказы — в карточке заказа и в выгрузке.
      </p>
    </div>
  );
}
