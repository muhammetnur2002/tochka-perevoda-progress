import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { ServicesEditor } from "@/components/admin/services-editor";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Услуги и цены" };
export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const supabase = createClient();
  const [{ data: services }, { data: rules }] = await Promise.all([
    supabase.from("services").select("*").order("sort_order"),
    supabase.from("price_rules").select("service_id, rule_type, value, min_qty, priority").eq("is_active", true),
  ]);
  return (
    <>
      <PageHeader
        title="Услуги и цены"
        description="Изменения применяются к новым заказам сразу. Оформленные заказы хранят цену на момент заказа; правки пишутся в аудит."
      />
      <ServicesEditor services={services ?? []} rules={rules ?? []} />
    </>
  );
}
