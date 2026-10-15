import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/order/order-status-badge";
import { RepeatOrderButton } from "@/components/order/repeat-order-button";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/format/money";
import { formatDateShort } from "@/lib/format/date";

export const metadata: Metadata = { title: "Мои заказы" };
export const dynamic = "force-dynamic";

function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}

export default async function AccountOrdersPage() {
  const profile = await requireUser("/account");
  const supabase = createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, public_number, status, total_price, paid_amount, created_at, items:order_items(service_id, name_snapshot, quantity), files(id)")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!orders?.length) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed p-12 text-center">
        <p className="text-muted-foreground">
          Заказов пока нет. Заказы, оформленные без входа на ваш телефон, появятся здесь автоматически.
        </p>
        <Button asChild variant="gold">
          <Link href="/calculator">Рассчитать стоимость</Link>
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
                от {formatDateShort(o.created_at)} · {filesCount} {plural(filesCount, ["файл", "файла", "файлов"])}
              </div>
            </div>
            <OrderStatusBadge status={o.status} />
            <strong className="w-28 text-right text-lg text-brand-800">{formatMoney(Number(o.total_price))}</strong>
            <div className="flex gap-2">
              {unpaid ? (
                <Button asChild variant="outline">
                  <Link href={`/checkout/pay/${o.id}`}>Оплатить</Link>
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link href={`/account/orders/${o.id}`}>Статус</Link>
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
