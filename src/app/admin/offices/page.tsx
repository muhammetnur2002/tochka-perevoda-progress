import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { OfficesEditor } from "@/components/admin/offices-editor";
import { getCurrentProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Точки приёма" };
export const dynamic = "force-dynamic";

export default async function AdminOfficesPage() {
  const t = await getTranslations("admin.offices");
  const supabase = createClient();
  const [{ data: offices }, profile] = await Promise.all([
    supabase.from("offices").select("*").order("sort_order").order("name"),
    getCurrentProfile(),
  ]);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <OfficesEditor offices={offices ?? []} canCreate={profile?.role === "admin"} />
    </>
  );
}
