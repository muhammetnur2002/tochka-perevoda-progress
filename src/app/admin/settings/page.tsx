import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Настройки" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const { data } = await createClient().from("settings").select("key, value");
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return (
    <>
      <PageHeader title="Настройки" description="Тарифы, производственный календарь, уведомления и хранение файлов" />
      <SettingsForm initial={map} />
    </>
  );
}
