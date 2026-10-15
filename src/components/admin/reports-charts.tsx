"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardStats } from "@/lib/services/reports";
import { formatMoney, formatMoneyShort } from "@/lib/format/money";

const NAVY = "#00214C";
const BLUE = "#1E5AA8";
const GOLD = "#D4A02A";

function Card({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-bold text-brand-800">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** Горизонтальные полосы (топ-списки) — без лишнего графика. */
function Bars({ rows, color }: { rows: { label: string; value: number; display?: string }[]; color: string }) {
  const t = useTranslations("admin.reports");
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("noData")}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="space-y-1">
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <strong className="tabular-nums">{r.display ?? r.value}</strong>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const shortDay = (d: string) => `${Number(d.slice(8, 10))}.${d.slice(5, 7)}`;

/** Графики отчётов (recharts). */
export function ReportsCharts({ stats }: { stats: DashboardStats }) {
  const t = useTranslations("admin.reports");
  const tAdmin = useTranslations("admin");
  const byDay = stats.byDay.map((d) => ({ ...d, label: shortDay(d.day) }));
  // Дни недели приходят по порядку пн…вс — подписи берём из словаря
  const byWeekday = stats.byWeekday.map((d, i) => ({ ...d, weekday: t(`weekdays.${i}`) }));
  const METHODS = ["card", "sbp", "qr", "cash", "invoice"];
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title={t("byDay")} hint={t("byDayHint", { n: stats.totals.orders, amount: formatMoney(stats.totals.revenue) })}>
        <div className="h-64" role="img" aria-label={t("byDayAria")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDay} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E8EF" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number, name: string) => (name === "revenue" ? [formatMoney(v), t("revenue")] : [v, t("orders")])}
                labelFormatter={(l: string) => t("date", { date: l })}
              />
              <Bar dataKey="orders" fill={BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title={t("byWeekday")}>
        <div className="h-64" role="img" aria-label={t("byWeekdayAria")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byWeekday} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E8EF" />
              <XAxis dataKey="weekday" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [v, t("orders")]} />
              <Bar dataKey="orders" fill={NAVY} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title={t("topServices")} hint={t("byCount")}>
        <Bars
          color={NAVY}
          rows={stats.topServices.map((s) => ({ label: s.name, value: s.count, display: `${s.count} · ${formatMoneyShort(s.revenue)}` }))}
        />
      </Card>

      <Card title={t("sourceLanguages")}>
        <Bars color={BLUE} rows={stats.languages.map((l) => ({ label: l.name, value: l.count }))} />
      </Card>

      <Card title={t("executorsLoad")} hint={t("executorsLoadHint")}>
        <Bars
          color={GOLD}
          rows={stats.executors.map((e) => ({ label: e.name, value: e.active + e.done, display: `${e.active} / ${e.done}` }))}
        />
      </Card>

      <Card title={t("paymentMethods")}>
        <Bars
          color={BLUE}
          rows={stats.paymentMethods.map((m) => ({ label: METHODS.includes(m.method) ? tAdmin(`paymentMethods.${m.method}`) : m.method.toUpperCase(), value: m.amount, display: formatMoney(m.amount) }))}
        />
      </Card>
    </div>
  );
}
