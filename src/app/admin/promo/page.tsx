import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { PromoEditor } from "@/components/admin/promo-editor";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.promo");
  return { title: t("title") };
}

export default async function AdminPromoPage() {
  const t = await getTranslations("admin.promo");
  const supabase = createClient();
  const [{ data: promos }, { data: usage }] = await Promise.all([
    supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
    supabase.from("v_promo_usage").select("promo_code_id, uses, discount_total"),
  ]);
  const usageById: Record<string, { uses: number; discountTotal: number }> = {};
  for (const u of usage ?? []) {
    usageById[u.promo_code_id] = { uses: Number(u.uses), discountTotal: Number(u.discount_total) };
  }
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <PromoEditor promos={promos ?? []} usage={usageById} />
    </>
  );
}
