import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Настройки" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const t = await getTranslations("admin.settings");
  const { data } = await createClient().from("settings").select("key, value");
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <SettingsForm initial={map} />
    </>
  );
}
