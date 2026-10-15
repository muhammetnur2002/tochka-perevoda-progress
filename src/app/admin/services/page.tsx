import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { ServicesEditor } from "@/components/admin/services-editor";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Услуги и цены" };
export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const t = await getTranslations("admin.services");
  const supabase = createClient();
  const [{ data: services }, { data: rules }] = await Promise.all([
    supabase.from("services").select("*").order("sort_order"),
    supabase.from("price_rules").select("service_id, rule_type, value, min_qty, priority").eq("is_active", true),
  ]);
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <ServicesEditor services={services ?? []} rules={rules ?? []} />
    </>
  );
}
