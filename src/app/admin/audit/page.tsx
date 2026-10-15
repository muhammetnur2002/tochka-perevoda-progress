import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format/date";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { Json, UserRole } from "@/types/database.types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Аудит" };
export const dynamic = "force-dynamic";

const ENTITIES = ["orders", "order_items", "payments", "services", "users"];
const ENTITY_LABEL: Record<string, string> = {
  orders: "Заказ",
  order_items: "Позиция",
  payments: "Платёж",
  services: "Услуга",
  users: "Пользователь",
};
const SKIP = new Set(["updated_at", "created_at", "raw"]);

/** Краткий дифф before/after: только изменившиеся поля. */
function diff(before: Json, after: Json): string {
  const b = (before ?? {}) as Record<string, Json>;
  const a = (after ?? {}) as Record<string, Json>;
  if (!before) return "создано";
  if (!after) return "удалено";
  const changed = Object.keys(a).filter((k) => !SKIP.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  return changed
    .slice(0, 6)
    .map((k) => `${k}: ${JSON.stringify(b[k])} → ${JSON.stringify(a[k])}`)
    .join("; ") || "без изменений";
}

export default async function AdminAuditPage({ searchParams }: { searchParams: { entity?: string } }) {
  await requireRole(["admin"], "/admin/audit");
  const entity = ENTITIES.includes(searchParams.entity ?? "") ? searchParams.entity! : null;
  const supabase = createClient();
  let query = supabase
    .from("audit_log")
    .select("id, actor_id, actor_role, entity, entity_id, action, before, after, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (entity) query = query.eq("entity", entity);
  const { data: rows } = await query;

  const actorIds = [...new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("users").select("id, name").in("id", actorIds)
    : { data: [] as { id: string; name: string | null }[] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.name]));

  return (
    <>
      <PageHeader title="Журнал аудита" description="Все изменения заказов, платежей, услуг и пользователей (последние 200)" />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[null, ...ENTITIES].map((e) => (
          <Link
            key={e ?? "all"}
            href={e ? `/admin/audit?entity=${e}` : "/admin/audit"}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-bold",
              entity === e ? "border-brand-800 bg-brand-800 text-white" : "border-input bg-white text-brand-800",
            )}
          >
            {e ? ENTITY_LABEL[e] : "Все"}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-3">Время</th>
              <th className="px-4 py-3">Кто</th>
              <th className="px-4 py-3">Объект</th>
              <th className="px-4 py-3">Действие</th>
              <th className="px-4 py-3">Изменение</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="whitespace-nowrap px-4 py-2.5">{formatDateTime(r.created_at)}</td>
                <td className="px-4 py-2.5">
                  {r.actor_id ? actorName.get(r.actor_id) ?? "—" : "Система"}
                  {r.actor_role && <div className="text-xs text-muted-foreground">{ROLE_LABELS[r.actor_role as UserRole]}</div>}
                </td>
                <td className="px-4 py-2.5">
                  {ENTITY_LABEL[r.entity] ?? r.entity}
                  {r.entity === "orders" && r.entity_id && (
                    <Link href={`/admin/orders/${r.entity_id}`} className="block text-xs text-brand-500 underline">
                      открыть
                    </Link>
                  )}
                </td>
                <td className="px-4 py-2.5 font-bold">{r.action}</td>
                <td className="max-w-[480px] break-words px-4 py-2.5 font-mono text-xs text-slate-600">{diff(r.before, r.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
