import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { PageHeader, StatTile } from "@/components/common/page-header";
import { OrderStatusBadge } from "@/components/order/order-status-badge";
import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/services/reports";
import { formatMoney } from "@/lib/format/money";
import { formatDateTime } from "@/lib/format/date";

export const metadata: Metadata = { title: "Дашборд" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = createClient();
  const [stats, deadlines, unclaimed, fresh] = await Promise.all([
    getDashboardStats(supabase, 30),
    supabase.from("v_deadline_approaching").select("*").order("deadline").limit(8),
    supabase.from("v_unclaimed_orders").select("*").order("updated_at").limit(8),
    supabase
      .from("orders")
      .select("id, public_number, status, total_price, created_at, source, client:clients(name)")
      .eq("status", "new")
      .order("created_at")
      .limit(8),
  ]);
  const t = stats.totals;

  return (
    <>
      <PageHeader
        title="Дашборд"
        description="За последние 30 дней"
        actions={
          <Button asChild variant="gold">
            <Link href="/admin/orders">Открыть канбан</Link>
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Выручка" value={formatMoney(t.revenue)} hint={`${t.orders} заказов`} />
        <StatTile label="Оплачено" value={formatMoney(t.paid)} hint={`долг ${formatMoney(t.outstanding)}`} />
        <StatTile label="В работе" value={String(t.activeOrders)} hint={`просрочено: ${t.overdue}`} />
        <StatTile label="Средний чек" value={formatMoney(t.averageCheck)} hint={`клиентов в базе: ${t.clients}`} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-bold text-brand-800">Новые заказы</h2>
          {(fresh.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Нет необработанных заказов.</p>}
          <ul className="space-y-2">
            {(fresh.data ?? []).map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm hover:border-brand-800">
                  <span>
                    <strong className="text-brand-800">{o.public_number}</strong> · {o.client?.name}
                  </span>
                  <span className="font-bold">{formatMoney(Number(o.total_price))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-bold text-brand-800">Срок &lt; 24 часов</h2>
          {(deadlines.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Горящих сроков нет.</p>}
          <ul className="space-y-2">
            {(deadlines.data ?? []).map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm hover:border-red-400">
                  <span>
                    <strong className="text-brand-800">{o.public_number}</strong> · {o.client_name}
                  </span>
                  <span className="font-bold text-red-700">{o.deadline ? formatDateTime(o.deadline) : "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-bold text-brand-800">Не забрали &gt; 3 дней</h2>
          {(unclaimed.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Всё выдано.</p>}
          <ul className="space-y-2">
            {(unclaimed.data ?? []).map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm hover:border-brand-800">
                  <span>
                    <strong className="text-brand-800">{o.public_number}</strong> · {o.client_name}
                  </span>
                  <OrderStatusBadge status="ready" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
