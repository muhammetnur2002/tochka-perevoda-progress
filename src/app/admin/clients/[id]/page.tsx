import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { OrderStatusBadge } from "@/components/order/order-status-badge";
import { ClientEditForm } from "@/components/admin/client-edit-form";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format/money";
import { formatDateShort } from "@/lib/format/date";

export const metadata: Metadata = { title: "Клиент" };
export const dynamic = "force-dynamic";

export default async function AdminClientPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: client } = await supabase.from("clients").select("*").eq("id", params.id).maybeSingle();
  if (!client) notFound();
  const [{ data: orders }, { data: consents }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, public_number, status, total_price, paid_amount, created_at, items:order_items(name_snapshot)")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false }),
    supabase.from("consents").select("doc_version, accepted_at, ip").eq("phone", client.phone ?? "—").order("accepted_at", { ascending: false }).limit(5),
  ]);
  const total = (orders ?? []).filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total_price), 0);

  return (
    <>
      <Link href="/admin/clients" className="inline-flex min-h-10 items-center text-sm font-bold text-brand-500">
        ← Все клиенты
      </Link>
      <PageHeader title={client.name} description={`Заказов: ${(orders ?? []).length} · на сумму ${formatMoney(total)}`} />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-bold text-brand-800">Заказы</h2>
          <ul className="divide-y">
            {(orders ?? []).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <Link href={`/admin/orders/${o.id}`} className="font-bold text-brand-800 hover:underline">
                  {o.public_number}
                </Link>
                <span className="min-w-0 flex-1 truncate text-slate-600">{(o.items ?? []).map((i) => i.name_snapshot).join(", ")}</span>
                <span className="text-muted-foreground">{formatDateShort(o.created_at)}</span>
                <OrderStatusBadge status={o.status} />
                <strong>{formatMoney(Number(o.total_price))}</strong>
              </li>
            ))}
          </ul>
        </section>
        <div className="space-y-4">
          <ClientEditForm
            clientId={client.id}
            initial={{ name: client.name, phone: client.phone, email: client.email, inn: client.inn, type: client.type }}
          />
          <section className="rounded-2xl border bg-card p-4 text-sm">
            <h2 className="mb-2 font-bold text-brand-800">Согласия 152-ФЗ</h2>
            {(consents ?? []).length === 0 && <p className="text-muted-foreground">Нет записей</p>}
            <ul className="space-y-1 text-muted-foreground">
              {(consents ?? []).map((c, i) => (
                <li key={i}>
                  v{c.doc_version} · {formatDateShort(c.accepted_at)} · IP {c.ip ?? "—"}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
