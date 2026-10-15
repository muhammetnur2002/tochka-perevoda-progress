"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  assignExecutorAction,
  recordPaymentAction,
  setOrderDeadlineAction,
  setOrderStatusAction,
  type ActionResult,
} from "@/app/admin/actions";
import { canTransition, ROLE_LABELS } from "@/lib/auth/roles";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/config/constants";
import { uploadOrderFile } from "@/lib/client/api";
import type { UserRole } from "@/types/database.types";
import { cn } from "@/lib/utils";

const STATUSES: OrderStatus[] = ["new", "confirmed", "in_progress", "ready", "issued", "completed", "cancelled"];

interface OrderControlsProps {
  orderId: string;
  status: OrderStatus;
  deadline: string | null;
  due: number;
  assignments: { id: string; role: string; status: string; userName: string }[];
  staff: { id: string; name: string; role: UserRole; load: string | null }[];
}

function useAction() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const exec = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.message) toast.success(r.message);
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });
  return { pending, exec };
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 3 * 3600_000); // МСК
  return d.toISOString().slice(0, 16);
}

/** Правая колонка карточки заказа: статус, срок, исполнитель, оплата, загрузка файлов. */
export function OrderControls({ orderId, status, deadline, due, assignments, staff }: OrderControlsProps) {
  const router = useRouter();
  const { pending, exec } = useAction();
  const [comment, setComment] = React.useState("");
  const [deadlineValue, setDeadlineValue] = React.useState(toLocalInput(deadline));
  const [executor, setExecutor] = React.useState("");
  const [payAmount, setPayAmount] = React.useState(due > 0 ? String(due) : "");
  const [payMethod, setPayMethod] = React.useState("cash");
  const [uploadKind, setUploadKind] = React.useState("translation");
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const executorUser = staff.find((s) => s.id === executor);
  const roleForAssignment = (r: UserRole | undefined) =>
    r === "translator" || r === "notary" || r === "printer" ? r : "manager";

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) await uploadOrderFile(orderId, f, { kind: uploadKind });
      toast.success("Файл загружен");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-bold text-brand-800">Статус</h2>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => {
            const allowed = canTransition(status, s);
            return (
              <button
                key={s}
                type="button"
                disabled={!allowed || pending}
                onClick={() =>
                  exec(
                    () => setOrderStatusAction(orderId, s, comment || undefined),
                    () => setComment(""),
                  )
                }
                className={cn(
                  "min-h-9 rounded-full border px-3 text-xs font-extrabold",
                  s === status
                    ? "border-brand-800 bg-brand-800 text-white"
                    : s === "cancelled"
                      ? "border-red-200 text-red-700 disabled:opacity-40"
                      : "border-input bg-white text-brand-800 disabled:opacity-40",
                )}
              >
                {ORDER_STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
        <Label htmlFor="status-comment" className="text-xs">
          Комментарий к смене статуса (попадёт в историю)
        </Label>
        <Textarea id="status-comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например: причина отмены" />
      </section>

      <section className="space-y-2 rounded-2xl border bg-card p-4">
        <Label htmlFor="deadline" className="font-bold text-brand-800">
          Срок (МСК)
        </Label>
        <div className="flex gap-2">
          <Input id="deadline" type="datetime-local" value={deadlineValue} onChange={(e) => setDeadlineValue(e.target.value)} />
          <Button
            variant="outline"
            disabled={!deadlineValue || pending}
            onClick={() => exec(() => setOrderDeadlineAction(orderId, `${deadlineValue}:00+03:00`))}
          >
            OK
          </Button>
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border bg-card p-4">
        <h2 className="font-bold text-brand-800">Исполнители</h2>
        {assignments.filter((a) => a.status !== "rejected").length === 0 && (
          <p className="text-sm text-muted-foreground">Никто не назначен.</p>
        )}
        <ul className="space-y-1 text-sm">
          {assignments
            .filter((a) => a.status !== "rejected")
            .map((a) => (
              <li key={a.id}>
                {ROLE_LABELS[a.role as UserRole] ?? a.role}: <strong>{a.userName}</strong> · {a.status}
              </li>
            ))}
        </ul>
        <label className="sr-only" htmlFor="executor">
          Исполнитель
        </label>
        <select id="executor" value={executor} onChange={(e) => setExecutor(e.target.value)} className="h-10 w-full rounded-md border bg-white px-2 text-sm">
          <option value="">Выберите исполнителя…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {ROLE_LABELS[s.role].toLowerCase()}
              {s.load ? ` (${s.load})` : ""}
            </option>
          ))}
        </select>
        <Button
          className="w-full"
          disabled={!executor || pending}
          onClick={() => {
            const role = roleForAssignment(executorUser?.role);
            exec(async () => {
              const r = await assignExecutorAction({ orderId, userId: executor, role });
              if (!r.ok && r.error.includes("перегружен") && window.confirm(`${r.error}\nНазначить всё равно?`)) {
                return assignExecutorAction({ orderId, userId: executor, role, force: true });
              }
              return r;
            });
          }}
        >
          Назначить
        </Button>
        <p className="text-xs text-muted-foreground">В скобках — активные задачи / лимит в день.</p>
      </section>

      <section className="space-y-2 rounded-2xl border bg-card p-4">
        <h2 className="font-bold text-brand-800">Отметить оплату</h2>
        <div className="flex gap-2">
          <Input type="number" min="1" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} aria-label="Сумма" />
          <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} aria-label="Способ" className="h-10 rounded-md border bg-white px-2 text-sm">
            <option value="cash">Наличные</option>
            <option value="card">Карта (терминал)</option>
            <option value="sbp">СБП (вручную)</option>
            <option value="invoice">Счёт юрлицу</option>
          </select>
        </div>
        <Button
          variant="outline"
          className="w-full"
          disabled={!Number(payAmount) || pending}
          onClick={() => exec(() => recordPaymentAction(orderId, { amount: Number(payAmount), method: payMethod }))}
        >
          {pending ? <Loader2 className="animate-spin" /> : "Записать платёж"}
        </Button>
      </section>

      <section className="space-y-2 rounded-2xl border bg-card p-4">
        <h2 className="font-bold text-brand-800">Загрузить файл</h2>
        <select value={uploadKind} onChange={(e) => setUploadKind(e.target.value)} aria-label="Тип файла" className="h-10 w-full rounded-md border bg-white px-2 text-sm">
          <option value="translation">Готовый перевод</option>
          <option value="receipt">Чек / акт</option>
          <option value="source">Исходник от клиента</option>
        </select>
        <input ref={fileRef} type="file" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
        <Button variant="outline" className="w-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Выбрать файл
        </Button>
      </section>
    </aside>
  );
}
