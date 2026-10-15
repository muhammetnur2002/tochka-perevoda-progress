import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/order/order-status-badge";
import { RepeatOrderButton } from "@/components/order/repeat-order-button";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/format/money";
import { formatDateShort } from "@/lib/format/date";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("metaOrders") };
}
export const dynamic = "force-dynamic";

export default async function AccountOrdersPage() {
  const profile = await requireUser("/account");
  const t = await getTranslations("account");
  const supabase = createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, public_number, status, proof_status, total_price, paid_amount, created_at, items:order_items(service_id, name_snapshot, quantity), files(id)")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!orders?.length) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed p-12 text-center">
        <p className="text-muted-foreground">
          {t("empty")}
        </p>
        <Button asChild variant="gold">
          <Link href="/calculator">{t("calculate")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {orders.map((o) => {
        const unpaid = Number(o.paid_amount) < Number(o.total_price) && o.status !== "cancelled";
        const filesCount = o.files?.length ?? 0;
        return (
          <li key={o.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card px-5 py-4">
            <div className="min-w-0 flex-1 basis-64">
              <Link href={`/account/orders/${o.id}`} className="text-lg font-bold text-brand-800 hover:underline">
                {o.public_number}
              </Link>
              <div className="text-sm text-slate-700">{(o.items ?? []).map((i) => i.name_snapshot).join(", ")}</div>
              <div className="text-xs text-muted-foreground">
                {t("from", { date: formatDateShort(o.created_at) })} · {t("files", { count: filesCount })}
              </div>
            </div>
            {o.proof_status === "awaiting_client" && (
              <Button asChild variant="gold">
                <Link href={`/proof/${o.id}`}>{t("proofOpen")}</Link>
              </Button>
            )}
            <OrderStatusBadge status={o.status} />
            <strong className="w-28 text-right text-lg text-brand-800">{formatMoney(Number(o.total_price))}</strong>
            <div className="flex gap-2">
              {unpaid ? (
                <Button asChild variant="outline">
                  <Link href={`/checkout/pay/${o.id}`}>{t("pay")}</Link>
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link href={`/account/orders/${o.id}`}>{t("statusBtn")}</Link>
                </Button>
              )}
              <RepeatOrderButton items={o.items ?? []} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
