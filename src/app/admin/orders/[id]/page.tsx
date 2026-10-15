import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { OrderStatusBadge } from "@/components/order/order-status-badge";
import { OrderTimeline } from "@/components/order/order-timeline";
import { FileList } from "@/components/order/file-list";
import { ChatPanel } from "@/components/chat/chat-panel";
import { OrderControls } from "@/components/admin/order-controls";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format/money";
import { formatDateTime } from "@/lib/format/date";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/config/constants";
import { ROLE_LABELS } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Заказ" };
export const dynamic = "force-dynamic";

const SOURCE: Record<string, string> = { web: "сайт", mini_app: "Telegram Mini App", bot: "бот", admin: "админка", walkin: "офис" };
const PAY: Record<string, string> = { pending: "ожидает", waiting_for_capture: "обрабатывается", succeeded: "успешно", canceled: "отменён", refunded: "возврат" };

export default async function AdminOrderPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*, client:clients(id, name, phone, email, type, inn)")
    .eq("id", params.id)
    .maybeSingle();
  if (!order) notFound();

  const [items, files, payments, history, assignments, staff, translators, languages, me] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", order.id).order("created_at"),
    supabase.from("files").select("id, original_name, kind, size_bytes, created_at").eq("order_id", order.id).order("created_at"),
    supabase.from("payments").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
    supabase.from("status_history").select("*, user:users(name)").eq("order_id", order.id).order("created_at"),
    supabase.from("order_assignments").select("*, user:users!order_assignments_user_id_fkey(name)").eq("order_id", order.id).order("assigned_at"),
    supabase.from("users").select("id, name, role").in("role", ["translator", "notary", "printer", "manager", "admin"]).eq("is_active", true).order("name"),
    supabase.from("translators").select("user_id, capacity_per_day, current_load, is_available, languages"),
    supabase.from("languages").select("id, name"),
    supabase.auth.getUser(),
  ]);

  const { data: myProfile } = me.data.user
    ? await supabase.from("users").select("role").eq("id", me.data.user.id).maybeSingle()
    : { data: null };
  const audit =
    myProfile?.role === "admin"
      ? (
          await supabase
            .from("audit_log")
            .select("id, actor_role, action, entity, created_at, after")
            .eq("entity_id", order.id)
            .order("created_at", { ascending: false })
            .limit(30)
        ).data ?? []
      : [];

  const langName = (id: string | null) => (languages.data ?? []).find((l) => l.id === id)?.name ?? "—";
  const load = new Map((translators.data ?? []).map((t) => [t.user_id, t]));
  const due = Math.max(0, Number(order.total_price) - Number(order.paid_amount));

  return (
    <div className="space-y-5">
      <Link href="/admin/orders" className="inline-flex min-h-10 items-center text-sm font-bold text-brand-500">
        ← К канбану
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">
            Заказ · {SOURCE[order.source] ?? order.source} · {formatDateTime(order.created_at)}
          </div>
          <h1 className="text-3xl font-extrabold text-brand-800">{order.public_number}</h1>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <OrderTimeline status={order.status} history={history.data ?? []} createdAt={order.created_at} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-2xl border bg-card p-4 text-sm">
              <div className="text-xs text-muted-foreground">Клиент</div>
              {order.client ? (
                <Link href={`/admin/clients/${order.client.id}`} className="text-base font-bold text-brand-800 hover:underline">
                  {order.client.name}
                </Link>
              ) : (
                "—"
              )}
              <div>{order.client?.phone ? `+${order.client.phone}` : "—"}</div>
              <div>{order.client?.email ?? ""}</div>
              {order.client?.type === "company" && <div>ИНН {order.client.inn ?? "—"}</div>}
            </section>
            <section className="rounded-2xl border bg-card p-4 text-sm">
              <div className="text-xs text-muted-foreground">Срок и направление</div>
              <div className="text-base font-bold text-brand-800">{order.deadline ? formatDateTime(order.deadline) : "не задан"}</div>
              <div>
                {langName(order.language_from)} → {langName(order.language_to)}
              </div>
              <div>
                {order.delivery_type === "delivery" ? `Доставка: ${order.delivery_address ?? "—"}` : "Самовывоз"}
              </div>
            </section>
          </div>

          {order.comment && (
            <section className="whitespace-pre-wrap rounded-2xl bg-gold-50 p-4 text-sm text-gold-900">
              <strong>Комментарий клиента:</strong> {order.comment}
            </section>
          )}

          <section className="rounded-2xl border bg-card p-4">
            <h2 className="mb-2 font-bold text-brand-800">Позиции</h2>
            <table className="w-full text-sm">
              <tbody>
                {(items.data ?? []).map((i) => (
                  <tr key={i.id} className="border-t first:border-t-0">
                    <td className="py-2">{i.name_snapshot}</td>
                    <td className="py-2 text-right">
                      {i.quantity} × {formatMoney(Number(i.unit_price))}
                    </td>
                    <td className="py-2 text-right font-bold">{formatMoney(Number(i.price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 grid gap-1 border-t pt-3 text-sm sm:grid-cols-2">
              <span>Услуги: {formatMoney(Number(order.subtotal))}</span>
              <span>Скидка: −{formatMoney(Number(order.discount))}</span>
              <span>Срочность: ×{Number(order.urgency_coefficient)}</span>
              <span>Заверение: {formatMoney(Number(order.notary_fee))}</span>
              <span>Доставка: {formatMoney(Number(order.delivery_fee))}</span>
              <span className="font-bold text-brand-800">Итого: {formatMoney(Number(order.total_price))}</span>
              <span className={due > 0 ? "font-bold text-red-700" : "font-bold text-emerald-700"}>
                {due > 0 ? `К оплате: ${formatMoney(due)}` : "Оплачен полностью"}
              </span>
            </div>
            {(payments.data ?? []).length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {(payments.data ?? []).map((p) => (
                  <li key={p.id}>
                    {formatDateTime(p.paid_at ?? p.created_at)} · {p.method.toUpperCase()} · {p.provider} · {formatMoney(Number(p.amount))} ·{" "}
                    {PAY[p.status] ?? p.status}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 font-bold text-brand-800">Файлы</h2>
            <FileList files={files.data ?? []} />
          </section>

          <section className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 font-bold text-brand-800">Чат с клиентом</h2>
            <ChatPanel orderId={order.id} />
          </section>

          <section className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 font-bold text-brand-800">История</h2>
            <ul className="space-y-1.5 text-sm">
              {(history.data ?? []).map((h) => (
                <li key={h.id} className="flex flex-wrap gap-x-3">
                  <span className="text-muted-foreground">{formatDateTime(h.created_at)}</span>
                  <span>
                    {h.from_status ? `${ORDER_STATUS_LABELS[h.from_status as OrderStatus]} → ` : ""}
                    <strong>{ORDER_STATUS_LABELS[h.to_status as OrderStatus]}</strong>
                    {h.user?.name ? ` · ${h.user.name}` : " · система"}
                    {h.comment ? ` — ${h.comment}` : ""}
                  </span>
                </li>
              ))}
              {(assignments.data ?? []).map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-3">
                  <span className="text-muted-foreground">{formatDateTime(a.assigned_at)}</span>
                  <span>
                    Назначен {ROLE_LABELS[a.role as keyof typeof ROLE_LABELS]?.toLowerCase() ?? a.role}: <strong>{a.user?.name ?? "—"}</strong> ({a.status})
                  </span>
                </li>
              ))}
            </ul>
            {audit.length > 0 && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer font-bold text-brand-500">Журнал аудита ({audit.length})</summary>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {audit.map((a) => (
                    <li key={a.id}>
                      {formatDateTime(a.created_at)} · {a.entity} · {a.action} · {a.actor_role ?? "система"}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>

        <OrderControls
          orderId={order.id}
          status={order.status}
          deadline={order.deadline}
          due={due}
          assignments={(assignments.data ?? []).map((a) => ({ id: a.id, role: a.role, status: a.status, userName: a.user?.name ?? "—" }))}
          staff={(staff.data ?? []).map((u) => {
            const t = load.get(u.id);
            return {
              id: u.id,
              name: u.name ?? "Без имени",
              role: u.role,
              load: t ? `${t.current_load}/${t.capacity_per_day}${t.is_available ? "" : ", недоступен"}` : null,
            };
          })}
        />
      </div>
    </div>
  );
}
