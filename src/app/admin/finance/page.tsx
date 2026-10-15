import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader, StatTile } from "@/components/common/page-header";
import { ExportButton } from "@/components/admin/export-button";
import { PeriodSwitch, parseDays } from "@/components/admin/period-switch";
import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/services/reports";
import { formatMoney } from "@/lib/format/money";
import { formatDateTime } from "@/lib/format/date";
import { mskDateKey } from "@/lib/services/deadline";

export const metadata: Metadata = { title: "Финансы" };
export const dynamic = "force-dynamic";

const METHOD: Record<string, string> = { card: "Карта", sbp: "СБП", qr: "QR", cash: "Наличные", invoice: "Счёт" };
const STATUS: Record<string, [string, string]> = {
  succeeded: ["Успешно", "bg-emerald-50 text-emerald-800"],
  pending: ["Ожидает", "bg-gold-50 text-gold-900"],
  waiting_for_capture: ["Обработка", "bg-gold-50 text-gold-900"],
  canceled: ["Отменён", "bg-red-50 text-red-700"],
  refunded: ["Возврат", "bg-slate-100 text-slate-700"],
};

export default async function AdminFinancePage({ searchParams }: { searchParams: { days?: string } }) {
  const days = parseDays(searchParams.days);
  const supabase = createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [stats, { data: payments }, { data: debtors }] = await Promise.all([
    getDashboardStats(supabase, days),
    supabase
      .from("payments")
      .select("id, amount, method, status, provider, provider_payment_id, paid_at, created_at, order:orders(id, public_number)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("orders")
      .select("id, public_number, total_price, paid_amount, status, client:clients(name)")
      .not("status", "in", "(cancelled)")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const owing = (debtors ?? []).filter((o) => Number(o.paid_amount) < Number(o.total_price));
  const methodTotal = stats.paymentMethods.reduce((s, m) => s + m.amount, 0) || 1;
  const from = mskDateKey(new Date(since));
  const to = mskDateKey(new Date());

  return (
    <>
      <PageHeader
        title="Финансы"
        description="Выручка, оплаты и долги клиентов"
        actions={
          <>
            <PeriodSwitch path="/admin/finance" days={days} />
            <ExportButton type="payments" from={from} to={to} />
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Выручка за период" value={formatMoney(stats.totals.revenue)} hint={`${stats.totals.orders} заказов`} />
        <StatTile
          label="Оплачено"
          value={formatMoney(stats.totals.paid)}
          hint={stats.paymentMethods.map((m) => `${METHOD[m.method] ?? m.method} ${Math.round((m.amount / methodTotal) * 100)}%`).join(" · ") || "—"}
        />
        <StatTile label="Долги клиентов" value={formatMoney(owing.reduce((s, o) => s + Number(o.total_price) - Number(o.paid_amount), 0))} hint={`${owing.length} заказов без полной оплаты`} />
        <StatTile label="Средний чек" value={formatMoney(stats.totals.averageCheck)} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Заказ</th>
                <th className="px-4 py-3">Способ</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3 text-right">Сумма</th>
                <th className="px-4 py-3">ID платежа</th>
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).map((p) => {
                const [label, cls] = STATUS[p.status] ?? [p.status, ""];
                return (
                  <tr key={p.id} className="border-t">
                    <td className="whitespace-nowrap px-4 py-2.5">{formatDateTime(p.paid_at ?? p.created_at)}</td>
                    <td className="px-4 py-2.5">
                      {p.order ? (
                        <Link href={`/admin/orders/${p.order.id}`} className="font-bold text-brand-800 hover:underline">
                          {p.order.public_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5">{METHOD[p.method] ?? p.method}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold">{formatMoney(Number(p.amount))}</td>
                    <td className="max-w-40 truncate px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.provider_payment_id ?? p.provider}</td>
                  </tr>
                );
              })}
              {(payments ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Платежей за период нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-bold text-brand-800">Должники</h2>
          {owing.length === 0 && <p className="text-sm text-muted-foreground">Все заказы оплачены.</p>}
          <ul className="space-y-2">
            {owing.slice(0, 30).map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm hover:border-brand-800">
                  <span>
                    <strong className="text-brand-800">{o.public_number}</strong> · {o.client?.name}
                  </span>
                  <span className="font-bold text-red-700">{formatMoney(Number(o.total_price) - Number(o.paid_amount))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
