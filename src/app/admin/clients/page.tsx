import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { ExportButton } from "@/components/admin/export-button";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format/money";
import { formatDateShort } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/phone";

export const metadata: Metadata = { title: "Клиенты" };
export const dynamic = "force-dynamic";

export default async function AdminClientsPage({ searchParams }: { searchParams: { q?: string } }) {
  const t = await getTranslations("admin.clients");
  const supabase = createClient();
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  let query = supabase
    .from("clients")
    .select("id, name, type, phone, email, inn, created_at, user_id, orders(total_price, paid_amount, status, created_at)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const safe = q.replace(/[%,()]/g, " ");
    query = digits.length >= 4 ? query.ilike("phone", `%${digits}%`) : query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,inn.ilike.%${safe}%`);
  }
  const { data: clients } = await query;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={<ExportButton type="clients" />} />
      <form className="mb-4 flex max-w-xl gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          {t("search")}
        </label>
        <Input id="q" name="q" defaultValue={q} placeholder={t("searchPlaceholder")} className="h-10" />
        <Button type="submit">{t("find")}</Button>
      </form>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-3">{t("colClient")}</th>
              <th className="px-4 py-3">{t("type")}</th>
              <th className="px-4 py-3">{t("phone")}</th>
              <th className="px-4 py-3">{t("email")}</th>
              <th className="px-4 py-3">{t("colOrders")}</th>
              <th className="px-4 py-3 text-right">{t("colSum")}</th>
              <th className="px-4 py-3 text-right">{t("colDebt")}</th>
              <th className="px-4 py-3">{t("colLast")}</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((c) => {
              const orders = (c.orders ?? []).filter((o) => o.status !== "cancelled");
              const sum = orders.reduce((s, o) => s + Number(o.total_price), 0);
              const debt = orders.reduce((s, o) => s + Math.max(0, Number(o.total_price) - Number(o.paid_amount)), 0);
              const last = orders.map((o) => o.created_at).sort().at(-1);
              return (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${c.id}`} className="font-bold text-brand-800 hover:underline">
                      {c.name}
                    </Link>
                    {c.user_id && <span className="ml-2 text-xs text-emerald-700">{t("hasAccount")}</span>}
                  </td>
                  <td className="px-4 py-3">{c.type === "company" ? t("company") : t("individual")}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{c.phone ? formatPhone(c.phone) : "—"}</td>
                  <td className="px-4 py-3">{c.email ?? "—"}</td>
                  <td className="px-4 py-3">{orders.length}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatMoney(sum)}</td>
                  <td className={`px-4 py-3 text-right ${debt > 0 ? "font-bold text-red-700" : ""}`}>{debt > 0 ? formatMoney(debt) : "—"}</td>
                  <td className="px-4 py-3">{last ? formatDateShort(last) : "—"}</td>
                </tr>
              );
            })}
            {(clients ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  {t("notFound")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
