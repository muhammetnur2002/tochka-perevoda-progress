import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { mskDateKey } from "./deadline";

type Db = SupabaseClient<Database>;

export interface DashboardStats {
  periodDays: number;
  totals: {
    orders: number;
    revenue: number;
    paid: number;
    outstanding: number;
    averageCheck: number;
    activeOrders: number;
    overdue: number;
    clients: number;
  };
  byDay: { day: string; orders: number; revenue: number }[];
  byWeekday: { weekday: string; orders: number }[];
  topServices: { name: string; count: number; revenue: number }[];
  languages: { name: string; count: number }[];
  executors: { name: string; active: number; done: number }[];
  paymentMethods: { method: string; amount: number }[];
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/**
 * Агрегаты для дашборда, финансов и отчётов. Считаются в приложении по выборке
 * за период — объёмы бюро (сотни заказов в месяц) это позволяют; при росте
 * перенести в SQL-представления 0006_views.sql.
 */
export async function getDashboardStats(db: Db, days: number): Promise<DashboardStats> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [ordersRes, clientsRes, paymentsRes, assignmentsRes, languagesRes] = await Promise.all([
    db
      .from("orders")
      .select("id, status, total_price, paid_amount, deadline, language_from, created_at, items:order_items(name_snapshot, quantity, price)")
      .gte("created_at", since)
      .limit(5000),
    db.from("clients").select("id", { count: "exact", head: true }),
    db.from("payments").select("amount, method, status").gte("created_at", since).eq("status", "succeeded"),
    db.from("order_assignments").select("status, user:users(name)").gte("assigned_at", since),
    db.from("languages").select("id, name"),
  ]);
  if (ordersRes.error) throw ordersRes.error;

  const orders = (ordersRes.data ?? []).filter((o) => o.status !== "cancelled");
  const revenue = orders.reduce((s, o) => s + Number(o.total_price), 0);
  const paid = orders.reduce((s, o) => s + Number(o.paid_amount), 0);
  const now = Date.now();
  const active = orders.filter((o) => ["new", "confirmed", "in_progress"].includes(o.status));

  // По дням (МСК)
  const dayMap = new Map<string, { orders: number; revenue: number }>();
  for (let i = days - 1; i >= 0; i--) {
    dayMap.set(mskDateKey(new Date(now - i * 86_400_000)), { orders: 0, revenue: 0 });
  }
  const weekday = WEEKDAYS.map((w) => ({ weekday: w, orders: 0 }));
  for (const o of orders) {
    const key = mskDateKey(new Date(o.created_at));
    const d = dayMap.get(key);
    if (d) {
      d.orders += 1;
      d.revenue += Number(o.total_price);
    }
    const wd = (new Date(`${key}T12:00:00+03:00`).getUTCDay() + 6) % 7;
    const slot = weekday[wd];
    if (slot) slot.orders += 1;
  }

  // Услуги
  const services = new Map<string, { count: number; revenue: number }>();
  for (const o of orders) {
    for (const i of o.items ?? []) {
      const s = services.get(i.name_snapshot) ?? { count: 0, revenue: 0 };
      s.count += i.quantity;
      s.revenue += Number(i.price);
      services.set(i.name_snapshot, s);
    }
  }

  // Языки
  const langNames = new Map((languagesRes.data ?? []).map((l) => [l.id, l.name]));
  const langs = new Map<string, number>();
  for (const o of orders) {
    if (!o.language_from) continue;
    const name = langNames.get(o.language_from) ?? "—";
    langs.set(name, (langs.get(name) ?? 0) + 1);
  }

  // Исполнители
  const execs = new Map<string, { active: number; done: number }>();
  for (const a of assignmentsRes.data ?? []) {
    const name = a.user?.name ?? "—";
    const e = execs.get(name) ?? { active: 0, done: 0 };
    if (a.status === "done") e.done += 1;
    else if (a.status !== "rejected") e.active += 1;
    execs.set(name, e);
  }

  // Способы оплаты
  const methods = new Map<string, number>();
  for (const p of paymentsRes.data ?? []) {
    methods.set(p.method, (methods.get(p.method) ?? 0) + Number(p.amount));
  }

  return {
    periodDays: days,
    totals: {
      orders: orders.length,
      revenue,
      paid,
      outstanding: Math.max(0, revenue - paid),
      averageCheck: orders.length ? Math.round(revenue / orders.length) : 0,
      activeOrders: active.length,
      overdue: active.filter((o) => o.deadline && new Date(o.deadline).getTime() < now).length,
      clients: clientsRes.count ?? 0,
    },
    byDay: [...dayMap.entries()].map(([day, v]) => ({ day, ...v })),
    byWeekday: weekday,
    topServices: [...services.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    languages: [...langs.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    executors: [...execs.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.active - a.active),
    paymentMethods: [...methods.entries()].map(([method, amount]) => ({ method, amount })),
  };
}
