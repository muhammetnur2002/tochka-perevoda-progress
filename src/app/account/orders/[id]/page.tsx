import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/order/order-status-badge";
import { OrderTimeline } from "@/components/order/order-timeline";
import { RepeatOrderButton } from "@/components/order/repeat-order-button";
import { FileList } from "@/components/order/file-list";
import { ChatPanel } from "@/components/chat/chat-panel";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/format/money";
import { formatDateTime } from "@/lib/format/date";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("metaOrder") };
}
export const dynamic = "force-dynamic";

export default async function AccountOrderPage({ params }: { params: { id: string } }) {
  await requireUser(`/account/orders/${params.id}`);
  const t = await getTranslations("account");
  const to = await getTranslations("offices");
  const tl = await getTranslations("languages");
  const supabase = createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*, office:offices(address), from:languages!orders_language_from_fkey(code, name), to:languages!orders_language_to_fkey(code, name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!order) notFound();
  const langName = (l: { code: string; name: string } | null) => (l ? (tl.has(l.code) ? tl(l.code) : l.name) : "");

  const [items, files, payments, history] = await Promise.all([
    supabase.from("order_items").select("id, service_id, name_snapshot, quantity, price").eq("order_id", order.id).order("created_at"),
    supabase.from("files").select("id, original_name, kind, size_bytes, created_at").eq("order_id", order.id).order("created_at"),
    supabase.from("payments").select("id, amount, method, status, paid_at, created_at").eq("order_id", order.id).order("created_at", { ascending: false }),
    supabase.from("status_history").select("to_status, created_at").eq("order_id", order.id).order("created_at"),
  ]);
  const due = Math.max(0, Number(order.total_price) - Number(order.paid_amount));

  return (
    <div className="space-y-5">
      <Link href="/account" className="inline-flex min-h-11 items-center text-sm font-bold text-brand-500">
        {t("allOrders")}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold text-brand-800">{order.public_number}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          {due > 0 && order.status !== "cancelled" && (
            <Button asChild variant="outline">
              <Link href={`/checkout/pay/${order.id}`}>{t("payAmount", { amount: formatMoney(due) })}</Link>
            </Button>
          )}
          <RepeatOrderButton items={items.data ?? []} />
        </div>
      </div>

      {order.proof_status !== "none" && (
        <section
          className={
            order.proof_status === "awaiting_client"
              ? "flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-gold-400 bg-gold-50 p-5"
              : "flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-5"
          }
        >
          <div>
            <h3 className="font-bold text-brand-800">{t("proofTitle")}</h3>
            <p className="text-sm text-slate-700">
              {order.proof_status === "awaiting_client"
                ? t("proofAwaiting")
                : order.proof_status === "changes_requested"
                  ? t("proofChanges")
                  : t("proofApproved")}
            </p>
          </div>
          <Button asChild variant={order.proof_status === "awaiting_client" ? "gold" : "outline"}>
            <Link href={`/proof/${order.id}`}>{order.proof_status === "awaiting_client" ? t("proofOpen") : t("proofView")}</Link>
          </Button>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-5">
        <OrderTimeline status={order.status} history={history.data ?? []} createdAt={order.created_at} />
        <p className="mt-4 text-sm text-muted-foreground">
          {order.deadline && order.status !== "completed" ? `${t("readiness", { date: formatDateTime(order.deadline) })} · ` : ""}
          {order.delivery_type === "delivery"
            ? t("deliveryTo", { address: order.delivery_address ?? t("addressTbd") })
            : to("pickupAt", { address: order.office?.address ?? "—" })}
          {order.payment_mode === "office" && Number(order.paid_amount) === 0 && ` · ${t("payInOffice")}`}
          {order.from && ` · ${t("translationPair", { from: langName(order.from), to: langName(order.to) })}`}
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-3 font-bold text-brand-800">{t("composition")}</h3>
          <ul className="divide-y text-sm">
            {(items.data ?? []).map((i) => (
              <li key={i.id} className="flex justify-between gap-3 py-2">
                <span>
                  {i.name_snapshot} × {i.quantity}
                </span>
                <span>{formatMoney(Number(i.price))}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between font-bold text-brand-800">
              <span>{t("total")}</span>
              <span>{formatMoney(Number(order.total_price))}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("paid")}</span>
              <span>{formatMoney(Number(order.paid_amount))}</span>
            </div>
          </div>
          {(payments.data ?? []).length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {(payments.data ?? []).map((p) => (
                <li key={p.id}>
                  {formatDateTime(p.paid_at ?? p.created_at)} · {p.method.toUpperCase()} · {formatMoney(Number(p.amount))} ·{" "}
                  {t.has(`paymentStatus.${p.status}`) ? t(`paymentStatus.${p.status}`) : p.status}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-3 font-bold text-brand-800">{t("filesTitle")}</h3>
          <FileList files={files.data ?? []} />
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <h3 className="mb-3 font-bold text-brand-800">{t("chatTitle")}</h3>
        <ChatPanel orderId={order.id} />
      </section>
    </div>
  );
}
