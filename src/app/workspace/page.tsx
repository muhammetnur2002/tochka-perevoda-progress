import Link from "next/link";
import type { Metadata } from "next";
import { FileList } from "@/components/order/file-list";
import { TaskActions } from "@/components/workspace/task-actions";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Задачи" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, [string, string]> = {
  assigned: ["Назначена", "bg-gold-50 text-gold-900"],
  accepted: ["Принята", "bg-brand-50 text-brand-700"],
  in_progress: ["В работе", "bg-brand-50 text-brand-700"],
  done: ["Сдана", "bg-emerald-50 text-emerald-800"],
  rejected: ["Отклонена", "bg-slate-100 text-slate-600"],
};
const ROLE_TASK: Record<string, string> = { translator: "Перевод", notary: "Нотариальное заверение", printer: "Печать", manager: "Ведение заказа" };

export default async function WorkspacePage({ searchParams }: { searchParams: { tab?: string; task?: string } }) {
  const profile = await requireUser("/workspace");
  const supabase = createClient();
  const tab = searchParams.tab === "done" ? "done" : "active";

  const { data: tasks } = await supabase
    .from("order_assignments")
    .select("id, role, status, due_at, assigned_at, completed_at, order:orders(id, public_number, deadline, comment, language_from, language_to, items:order_items(name_snapshot, quantity))")
    .eq("user_id", profile.id)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);
  const { data: languages } = await supabase.from("languages").select("id, name");
  const lang = (id: string | null) => (languages ?? []).find((l) => l.id === id)?.name ?? "—";

  const list = (tasks ?? []).filter((t) => (tab === "done" ? ["done", "rejected"].includes(t.status) : !["done", "rejected"].includes(t.status)));
  const activeCount = (tasks ?? []).filter((t) => !["done", "rejected"].includes(t.status)).length;
  const selected = list.find((t) => t.id === searchParams.task) ?? list[0];

  const { data: files } = selected?.order
    ? await supabase.from("files").select("id, original_name, kind, size_bytes").eq("order_id", selected.order.id).order("created_at")
    : { data: [] };
  const { data: translator } = await supabase.from("translators").select("capacity_per_day").eq("user_id", profile.id).maybeSingle();
  const now = Date.now();

  return (
    <div className="flex flex-wrap items-start gap-5">
      <section aria-label="Задачи" className="min-w-0 flex-[1_1_340px] space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {(["active", "done"] as const).map((t) => (
            <Link
              key={t}
              href={`/workspace?tab=${t}`}
              className={cn(
                "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-bold",
                tab === t ? "border-brand-800 bg-brand-800 text-white" : "border-input bg-white text-brand-800",
              )}
            >
              {t === "active" ? "Активные" : "Сданные"}
            </Link>
          ))}
          <span className="ml-auto text-sm text-muted-foreground">
            Загрузка: <strong className="text-brand-800">{activeCount}</strong>
            {translator ? ` из ${translator.capacity_per_day}` : ""}
          </span>
        </div>
        {list.length === 0 && <p className="rounded-2xl border bg-white p-5 text-sm text-muted-foreground">Задач нет.</p>}
        {list.map((t) => {
          const due = t.due_at ?? t.order?.deadline ?? null;
          const hot = due && !["done", "rejected"].includes(t.status) && new Date(due).getTime() - now < 86_400_000;
          const [label, cls] = STATUS[t.status] ?? [t.status, ""];
          return (
            <Link
              key={t.id}
              href={`/workspace?tab=${tab}&task=${t.id}`}
              className={cn(
                "block space-y-1.5 rounded-2xl bg-white p-3.5",
                selected?.id === t.id ? "border-2 border-gold-400" : "border border-slate-200 hover:border-brand-800",
              )}
            >
              <span className="flex justify-between gap-2">
                <strong className="text-brand-800">{t.order?.public_number}</strong>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${cls}`}>{label}</span>
              </span>
              <span className="block text-sm">{(t.order?.items ?? []).map((i) => i.name_snapshot).join(", ")}</span>
              <span className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {ROLE_TASK[t.role]} · {lang(t.order?.language_from ?? null)} → {lang(t.order?.language_to ?? null)}
                </span>
                <span className={cn("font-bold", hot ? "text-red-700" : "text-slate-600")}>{due ? formatDateTime(due) : "без срока"}</span>
              </span>
            </Link>
          );
        })}
      </section>

      {selected?.order && (
        <section aria-label="Задача" className="min-w-0 flex-[999_1_560px] space-y-4 rounded-2xl border bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground">{ROLE_TASK[selected.role]} по заказу</div>
              <h1 className="text-2xl font-extrabold text-brand-800">{selected.order.public_number}</h1>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Сдать до</div>
              <strong className="text-lg text-brand-800">
                {selected.due_at ?? selected.order.deadline ? formatDateTime((selected.due_at ?? selected.order.deadline)!) : "—"}
              </strong>
            </div>
          </div>
          <div className="grid gap-2.5 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-muted p-3">
              <div className="text-xs text-muted-foreground">Услуга</div>
              <strong>{(selected.order.items ?? []).map((i) => `${i.name_snapshot} × ${i.quantity}`).join(", ")}</strong>
            </div>
            <div className="rounded-xl bg-muted p-3">
              <div className="text-xs text-muted-foreground">Направление</div>
              <strong>
                {lang(selected.order.language_from)} → {lang(selected.order.language_to)}
              </strong>
            </div>
            <div className="rounded-xl bg-muted p-3">
              <div className="text-xs text-muted-foreground">Назначена</div>
              <strong>{formatDateTime(selected.assigned_at)}</strong>
            </div>
          </div>
          {selected.order.comment && (
            <p className="whitespace-pre-wrap rounded-xl bg-gold-50 p-3.5 text-sm text-gold-900">
              <strong>Комментарий клиента:</strong> {selected.order.comment}
            </p>
          )}
          <div>
            <h2 className="mb-2 font-bold text-brand-800">Файлы заказа</h2>
            <FileList files={files ?? []} />
            <p className="mt-1.5 text-xs text-muted-foreground">Ссылки на скачивание действуют 5 минут и выдаются только по назначенным задачам.</p>
          </div>
          <TaskActions assignmentId={selected.id} orderId={selected.order.id} status={selected.status} role={selected.role} />
        </section>
      )}
    </div>
  );
}
