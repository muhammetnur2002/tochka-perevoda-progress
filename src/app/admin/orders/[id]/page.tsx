import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OrderStatusBadge } from "@/components/order/order-status-badge";
import { OrderTimeline } from "@/components/order/order-timeline";
import { FileList } from "@/components/order/file-list";
import { ChatPanel } from "@/components/chat/chat-panel";
import { OrderControls } from "@/components/admin/order-controls";
import { ProofPanel } from "@/components/admin/proof-panel";
import { isManagerRole } from "@/lib/auth/roles";
import { loadProofPanelData } from "@/lib/proof/panel-data";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format/money";
import { formatDateTime } from "@/lib/format/date";
import type { OrderStatus } from "@/lib/config/constants";

export const metadata: Metadata = { title: "Заказ" };
export const dynamic = "force-dynamic";

const SOURCES = ["web", "mini_app", "bot", "admin", "walkin"];
const PAY_STATUSES = ["pending", "waiting_for_capture", "succeeded", "canceled", "refunded"];
const ASSIGNMENT_STATUSES = ["assigned", "accepted", "in_progress", "done", "rejected"];
const ROLES = ["guest", "client", "manager", "translator", "notary", "printer", "admin"];

export default async function AdminOrderPage({ params }: { params: { id: string } }) {
  const [t, tAdmin, tStatus, tRoles, tLang] = await Promise.all([
    getTranslations("admin.order"),
    getTranslations("admin"),
    getTranslations("orderStatus"),
    getTranslations("roles"),
    getTranslations("languages"),
  ]);
  const supabase = createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*, client:clients(id, name, phone, email, type, inn)")
    .eq("id", params.id)
    .maybeSingle();
  if (!order) notFound();

  const [items, files, payments, history, assignments, staff, translators, languages, me, officeRes] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", order.id).order("created_at"),
    supabase.from("files").select("id, original_name, kind, size_bytes, created_at").eq("order_id", order.id).order("created_at"),
    supabase.from("payments").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
    supabase.from("status_history").select("*, user:users(name)").eq("order_id", order.id).order("created_at"),
    supabase.from("order_assignments").select("*, user:users!order_assignments_user_id_fkey(name)").eq("order_id", order.id).order("assigned_at"),
    supabase.from("users").select("id, name, role").in("role", ["translator", "notary", "printer", "manager", "admin"]).eq("is_active", true).order("name"),
    supabase.from("translators").select("user_id, capacity_per_day, current_load, is_available, languages"),
    supabase.from("languages").select("id, code, name"),
    supabase.auth.getUser(),
    supabase.from("orders").select("office:offices(name, address, hours, phone)").eq("id", order.id).maybeSingle(),
  ]);
  const office = officeRes.data?.office ?? null;
  const promoDiscount = Number(order.promo_discount ?? 0);
  // У автоскидки кода нет — показываем её название
  const promoName =
    promoDiscount > 0 && !order.promo_code && order.promo_code_id
      ? (await supabase.from("promo_codes").select("name").eq("id", order.promo_code_id).maybeSingle()).data?.name ?? null
      : null;

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

  const isManager = isManagerRole(myProfile?.role);
  const proofData = await loadProofPanelData(supabase, order.id, isManager);

  const langName = (id: string | null) => {
    const l = (languages.data ?? []).find((x) => x.id === id);
    if (!l) return "—";
    return tLang.has(l.code) ? tLang(l.code) : l.name;
  };
  const roleName = (r: string) => (ROLES.includes(r) ? tRoles(r) : r);
  const assignmentStatus = (s: string) => (ASSIGNMENT_STATUSES.includes(s) ? tAdmin(`assignmentStatus.${s}`) : s);
  const statusName = (s: string) => tStatus(s as OrderStatus);
  const load = new Map((translators.data ?? []).map((t) => [t.user_id, t]));
  const due = Math.max(0, Number(order.total_price) - Number(order.paid_amount));

  return (
    <div className="space-y-5">
      <Link href="/admin/orders" className="inline-flex min-h-10 items-center text-sm font-bold text-brand-500">
        ← {t("backToKanban")}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">
            {t("order")} · {SOURCES.includes(order.source) ? tAdmin(`sources.${order.source}`) : order.source} ·{" "}
            {formatDateTime(order.created_at)}
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
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            <section className="rounded-2xl border bg-card p-4 text-sm">
              <div className="text-xs text-muted-foreground">{t("client")}</div>
              {order.client ? (
                <Link href={`/admin/clients/${order.client.id}`} className="text-base font-bold text-brand-800 hover:underline">
                  {order.client.name}
                </Link>
              ) : (
                "—"
              )}
              <div>{order.client?.phone ? `+${order.client.phone}` : "—"}</div>
              <div>{order.client?.email ?? ""}</div>
              {order.client?.type === "company" && (
                <div>
                  {t("inn")} {order.client.inn ?? "—"}
                </div>
              )}
            </section>
            <section className="rounded-2xl border bg-card p-4 text-sm">
              <div className="text-xs text-muted-foreground">{t("deadlineAndDirection")}</div>
              <div className="text-base font-bold text-brand-800">{order.deadline ? formatDateTime(order.deadline) : t("deadlineNotSet")}</div>
              <div>
                {langName(order.language_from)} → {langName(order.language_to)}
              </div>
              <div>
                {order.delivery_type === "delivery" ? t("delivery", { address: order.delivery_address ?? "—" }) : t("pickup")}
              </div>
            </section>
            <section className="rounded-2xl border bg-card p-4 text-sm">
              <div className="text-xs text-muted-foreground">{t("office")}</div>
              {office ? (
                <>
                  <div className="text-base font-bold text-brand-800">{office.name}</div>
                  <div>{office.address}</div>
                  {office.hours && <div className="text-muted-foreground">{office.hours}</div>}
                  {office.phone && <div className="text-muted-foreground">{office.phone}</div>}
                </>
              ) : (
                <div className="text-base font-bold text-brand-800">{t("noOffice")}</div>
              )}
            </section>
          </div>

          {order.comment && (
            <section className="whitespace-pre-wrap rounded-2xl bg-gold-50 p-4 text-sm text-gold-900">
              <strong>{t("clientComment")}</strong> {order.comment}
            </section>
          )}

          <section className="rounded-2xl border bg-card p-4">
            <h2 className="mb-2 font-bold text-brand-800">{t("items")}</h2>
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
              <span>{t("subtotal", { amount: formatMoney(Number(order.subtotal)) })}</span>
              <span>{t("discount", { amount: formatMoney(Number(order.discount)) })}</span>
              <span>{t("urgency", { k: String(Number(order.urgency_coefficient)) })}</span>
              {promoDiscount > 0 && (
                <span>
                  {order.promo_code
                    ? t("promoLine", { code: order.promo_code, amount: formatMoney(promoDiscount) })
                    : t("promoAutoLine", { name: promoName ?? "—", amount: formatMoney(promoDiscount) })}
                </span>
              )}
              <span>{t("notaryFee", { amount: formatMoney(Number(order.notary_fee)) })}</span>
              <span>{t("deliveryFee", { amount: formatMoney(Number(order.delivery_fee)) })}</span>
              <span className="font-bold text-brand-800">{t("total", { amount: formatMoney(Number(order.total_price)) })}</span>
              <span className={due > 0 ? "font-bold text-red-700" : "font-bold text-emerald-700"}>
                {due > 0 ? t("due", { amount: formatMoney(due) }) : t("paidInFull")}
              </span>
            </div>
            {(payments.data ?? []).length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {(payments.data ?? []).map((p) => (
                  <li key={p.id}>
                    {formatDateTime(p.paid_at ?? p.created_at)} · {p.method.toUpperCase()} · {p.provider} · {formatMoney(Number(p.amount))} ·{" "}
                    {PAY_STATUSES.includes(p.status) ? tAdmin(`paymentStatus.${p.status}`) : p.status}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 font-bold text-brand-800">{t("files")}</h2>
            <FileList files={files.data ?? []} />
          </section>

          <ProofPanel
            orderId={order.id}
            orderProofStatus={order.proof_status}
            proofs={proofData.proofs}
            events={isManager ? proofData.events : undefined}
            canOfficeApprove={isManager}
          />

          <section className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 font-bold text-brand-800">{t("chat")}</h2>
            <ChatPanel orderId={order.id} />
          </section>

          <section className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 font-bold text-brand-800">{t("history")}</h2>
            <ul className="space-y-1.5 text-sm">
              {(history.data ?? []).map((h) => (
                <li key={h.id} className="flex flex-wrap gap-x-3">
                  <span className="text-muted-foreground">{formatDateTime(h.created_at)}</span>
                  <span>
                    {h.from_status ? `${statusName(h.from_status)} → ` : ""}
                    <strong>{statusName(h.to_status)}</strong>
                    {` · ${h.user?.name ?? t("system")}`}
                    {h.comment ? ` — ${h.comment}` : ""}
                  </span>
                </li>
              ))}
              {(assignments.data ?? []).map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-3">
                  <span className="text-muted-foreground">{formatDateTime(a.assigned_at)}</span>
                  <span>
                    {t("assigned", { role: roleName(a.role).toLowerCase() })} <strong>{a.user?.name ?? "—"}</strong> (
                    {assignmentStatus(a.status)})
                  </span>
                </li>
              ))}
            </ul>
            {audit.length > 0 && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer font-bold text-brand-500">{t("auditLog", { n: audit.length })}</summary>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {audit.map((a) => (
                    <li key={a.id}>
                      {formatDateTime(a.created_at)} · {a.entity} · {a.action} · {a.actor_role ? roleName(a.actor_role) : t("system")}
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
          proofStatus={order.proof_status}
          deadline={order.deadline}
          due={due}
          assignments={(assignments.data ?? []).map((a) => ({ id: a.id, role: a.role, status: a.status, userName: a.user?.name ?? "—" }))}
          staff={(staff.data ?? []).map((u) => {
            const tr = load.get(u.id);
            return {
              id: u.id,
              name: u.name ?? t("noName"),
              role: u.role,
              load: tr ? `${tr.current_load}/${tr.capacity_per_day}${tr.is_available ? "" : `, ${t("unavailable")}`}` : null,
            };
          })}
        />
      </div>
    </div>
  );
}
