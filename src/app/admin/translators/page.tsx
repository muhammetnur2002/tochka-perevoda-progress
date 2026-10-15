import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { ExecutorsPanel } from "@/components/admin/executors-panel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Исполнители" };
export const dynamic = "force-dynamic";

export default async function AdminTranslatorsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: staff }, { data: translators }, { data: languages }, { data: me }, { data: active }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, email, role, telegram_id, is_active")
      .in("role", ["translator", "notary", "printer", "manager", "admin"])
      .order("role"),
    supabase.from("translators").select("*"),
    supabase.from("languages").select("id, name").order("name"),
    supabase.from("users").select("role").eq("id", user?.id ?? "").maybeSingle(),
    supabase.from("order_assignments").select("user_id, status").in("status", ["assigned", "accepted", "in_progress"]),
  ]);

  const activeCount = new Map<string, number>();
  for (const a of active ?? []) activeCount.set(a.user_id, (activeCount.get(a.user_id) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title="Исполнители"
        description="Переводчики, нотариус и печать: загрузка, языки, доступность. Роли выдаёт администратор."
      />
      <ExecutorsPanel
        isAdmin={me?.role === "admin"}
        languages={languages ?? []}
        staff={(staff ?? []).map((s) => {
          const t = (translators ?? []).find((x) => x.user_id === s.id) ?? null;
          return {
            id: s.id,
            name: s.name ?? "—",
            email: s.email,
            role: s.role,
            telegram: Boolean(s.telegram_id),
            active: activeCount.get(s.id) ?? 0,
            translator: t
              ? {
                  capacity_per_day: t.capacity_per_day,
                  is_available: t.is_available,
                  specialization: t.specialization,
                  languages: t.languages,
                }
              : null,
          };
        })}
      />
    </>
  );
}
