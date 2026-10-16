"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { canTransition } from "@/lib/auth/roles";
import type { OrderStatus } from "@/lib/config/constants";
import { uploadOrderFile } from "@/lib/client/api";
import type { OrderProofStatus, PaymentMode, UserRole } from "@/types/database.types";
import { cn } from "@/lib/utils";

const STATUSES: OrderStatus[] = ["new", "confirmed", "in_progress", "ready", "issued", "completed", "cancelled"];
const ROLES = ["guest", "client", "manager", "translator", "notary", "printer", "admin"];
const ASSIGNMENT_STATUSES = ["assigned", "accepted", "in_progress", "done", "rejected"];
/** Статусы, в которых перевод уже печатают/выдают — клиент должен был подтвердить его раньше. */
const PROOF_GUARDED_STATUSES: OrderStatus[] = ["ready", "issued", "completed"];

interface OrderControlsProps {
  orderId: string;
  status: OrderStatus;
  /** Сверка перевода клиентом: мягкое предупреждение при выдаче без подтверждения. */
  proofStatus?: OrderProofStatus;
  deadline: string | null;
  due: number;
  /** «office» — клиент оплачивает в точке: сотрудник отмечает наличные/терминал. */
  paymentMode?: PaymentMode;
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
export function OrderControls({ orderId, status, proofStatus = "none", deadline, due, paymentMode = "online", assignments, staff }: OrderControlsProps) {
  const t = useTranslations("admin.controls");
  const tProof = useTranslations("admin.proof");
  const tAdmin = useTranslations("admin");
  const tStatus = useTranslations("orderStatus");
  const tRoles = useTranslations("roles");
  const roleName = (r: string) => (ROLES.includes(r) ? tRoles(r) : r);
  const assignmentStatus = (s: string) => (ASSIGNMENT_STATUSES.includes(s) ? tAdmin(`assignmentStatus.${s}`) : s);
  const router = useRouter();
  const { pending, exec } = useAction();
  const [comment, setComment] = React.useState("");
  const [deadlineValue, setDeadlineValue] = React.useState(toLocalInput(deadline));
  const [executor, setExecutor] = React.useState("");
  const [payAmount, setPayAmount] = React.useState(due > 0 ? String(due) : "");
  // После обновления страницы подставляем актуальный остаток
  React.useEffect(() => {
    setPayAmount(due > 0 ? String(due) : "");
  }, [due]);
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
      toast.success(t("fileUploaded"));
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
        <h2 className="font-bold text-brand-800">{t("status")}</h2>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => {
            const allowed = canTransition(status, s);
            return (
              <button
                key={s}
                type="button"
                disabled={!allowed || pending}
                onClick={() => {
                  // Мягкая защита: предупреждаем, но не блокируем
                  const unconfirmed = proofStatus === "awaiting_client" || proofStatus === "changes_requested";
                  if (unconfirmed && PROOF_GUARDED_STATUSES.includes(s) && !window.confirm(tProof("guardWarning"))) return;
                  exec(
                    () => setOrderStatusAction(orderId, s, comment || undefined),
                    () => setComment(""),
                  );
                }}
                className={cn(
                  "min-h-9 rounded-full border px-3 text-xs font-extrabold",
                  s === status
                    ? "border-brand-800 bg-brand-800 text-white"
                    : s === "cancelled"
                      ? "border-red-200 text-red-700 disabled:opacity-40"
                      : "border-input bg-white text-brand-800 disabled:opacity-40",
                )}
              >
                {tStatus(s)}
              </button>
            );
          })}
        </div>
        <Label htmlFor="status-comment" className="text-xs">
          {t("statusComment")}
        </Label>
        <Textarea id="status-comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("statusCommentPlaceholder")} />
      </section>

      <section className="space-y-2 rounded-2xl border bg-card p-4">
        <Label htmlFor="deadline" className="font-bold text-brand-800">
          {t("deadline")}
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
        <h2 className="font-bold text-brand-800">{t("executors")}</h2>
        {assignments.filter((a) => a.status !== "rejected").length === 0 && (
          <p className="text-sm text-muted-foreground">{t("nobodyAssigned")}</p>
        )}
        <ul className="space-y-1 text-sm">
          {assignments
            .filter((a) => a.status !== "rejected")
            .map((a) => (
              <li key={a.id}>
                {roleName(a.role)}: <strong>{a.userName}</strong> · {assignmentStatus(a.status)}
              </li>
            ))}
        </ul>
        <label className="sr-only" htmlFor="executor">
          {t("executor")}
        </label>
        <select id="executor" value={executor} onChange={(e) => setExecutor(e.target.value)} className="h-10 w-full rounded-md border bg-white px-2 text-sm">
          <option value="">{t("chooseExecutor")}</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {roleName(s.role).toLowerCase()}
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
              if (!r.ok && r.code === "OVERLOADED" && window.confirm(`${r.error}\n${t("assignAnyway")}`)) {
                return assignExecutorAction({ orderId, userId: executor, role, force: true });
              }
              return r;
            });
          }}
        >
          {t("assign")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("loadHint")}</p>
      </section>

      <section className="space-y-2 rounded-2xl border bg-card p-4">
        <h2 className="font-bold text-brand-800">{t("recordPayment")}</h2>
        {paymentMode === "office" && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">{t("officeHint")}</p>}
        <div className="flex gap-2">
          <Input type="number" min="1" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} aria-label={t("amount")} />
          <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} aria-label={t("method")} className="h-10 rounded-md border bg-white px-2 text-sm">
            <option value="cash">{t("methods.cash")}</option>
            <option value="card">{t("methods.card")}</option>
            <option value="sbp">{t("methods.sbp")}</option>
            <option value="invoice">{t("methods.invoice")}</option>
          </select>
        </div>
        <Button
          variant="outline"
          className="w-full"
          disabled={!Number(payAmount) || pending}
          onClick={() => exec(() => recordPaymentAction(orderId, { amount: Number(payAmount.replace(",", ".")), method: payMethod }))}
        >
          {pending ? <Loader2 className="animate-spin" /> : t("savePayment")}
        </Button>
      </section>

      <section className="space-y-2 rounded-2xl border bg-card p-4">
        <h2 className="font-bold text-brand-800">{t("uploadFile")}</h2>
        <select value={uploadKind} onChange={(e) => setUploadKind(e.target.value)} aria-label={t("fileType")} className="h-10 w-full rounded-md border bg-white px-2 text-sm">
          <option value="translation">{t("fileKinds.translation")}</option>
          <option value="receipt">{t("fileKinds.receipt")}</option>
          <option value="source">{t("fileKinds.source")}</option>
        </select>
        <input ref={fileRef} type="file" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
        <Button variant="outline" className="w-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />} {t("chooseFile")}
        </Button>
      </section>
    </aside>
  );
}
