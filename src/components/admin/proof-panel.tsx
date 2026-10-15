"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BellRing, CheckCircle2, ExternalLink, FileCheck2, Loader2, Send, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProofUploadDialog } from "@/components/admin/proof-upload-dialog";
import { apiFetch } from "@/lib/client/api";
import { formatDateTime } from "@/lib/format/date";
import { PROOF_WAIT_HOURS } from "@/lib/proof/constants";
import type { ProofPanelComment, ProofPanelEvent, ProofPanelProof } from "@/lib/proof/panel-data";
import type { OrderProofStatus, ProofEventName, ProofStatus } from "@/types/database.types";
import { cn } from "@/lib/utils";

export interface ProofPanelProps {
  orderId: string;
  /** Состояние сверки на заказе (orders.proof_status). */
  orderProofStatus: OrderProofStatus;
  /** Версии перевода, новые первыми, с замечаниями клиента. */
  proofs: ProofPanelProof[];
  /** Журнал событий — только для менеджеров (исполнителям RLS его не отдаёт). */
  events?: ProofPanelEvent[];
  /** Кнопка «Подтверждено в офисе» — только менеджеры. */
  canOfficeApprove: boolean;
}

const STATUS_VARIANT: Record<ProofStatus, "info" | "success" | "warning" | "secondary"> = {
  pending: "info",
  approved: "success",
  changes_requested: "warning",
  superseded: "secondary",
};

const STATE_CLASS: Record<OrderProofStatus, string> = {
  none: "bg-slate-50 text-slate-700",
  awaiting_client: "bg-sky-50 text-sky-900",
  changes_requested: "bg-amber-50 text-amber-900",
  approved: "bg-emerald-50 text-emerald-900",
};

const EVENT_NAMES: readonly ProofEventName[] = [
  "created",
  "sent",
  "opened",
  "approved",
  "changes_requested",
  "office_approved",
  "superseded",
  "reminded",
];
const ROLES = ["guest", "client", "manager", "translator", "notary", "printer", "admin"];

/** Коротко: «Chrome · Windows» из строки User-Agent. */
function describeDevice(ua: string): string {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /YaBrowser/.test(ua)
        ? "Yandex"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : null;
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return [browser, os].filter(Boolean).join(" · ") || ua.slice(0, 40);
}

/** Карточка «Проверка перевода клиентом»: отправка версии, замечания, подтверждение, журнал. */
export function ProofPanel({ orderId, orderProofStatus, proofs, events, canOfficeApprove }: ProofPanelProps) {
  const t = useTranslations("admin.proof");
  const tRoles = useTranslations("roles");
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  // Текущее время берём после монтирования, чтобы не расходился серверный и клиентский рендер
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => setNow(Date.now()), []);

  const latest = proofs[0] ?? null;
  const approved = proofs.find((p) => p.status === "approved") ?? null;
  const waitingHours =
    now !== null && latest && latest.status === "pending"
      ? Math.max(0, Math.floor((now - new Date(latest.created_at).getTime()) / 3_600_000))
      : null;
  const lateWait = waitingHours !== null && waitingHours >= PROOF_WAIT_HOURS;
  const canRemind = latest?.status === "pending";
  const canApproveOffice = canOfficeApprove && latest !== null && (latest.status === "pending" || latest.status === "changes_requested");

  const run = (fn: () => Promise<string | null>) =>
    start(async () => {
      try {
        const message = await fn();
        if (message) toast.success(message);
        router.refresh();
      } catch (err) {
        toast.error((err as Error).message);
      }
    });

  const remind = () =>
    run(async () => {
      if (!latest) return null;
      const res = await apiFetch<{ ok: boolean; delivered: boolean }>(`/api/proofs/${latest.id}/remind`, { method: "POST" });
      return res.delivered ? t("reminded") : t("remindedNotDelivered");
    });

  const officeApprove = () => {
    if (!latest || !window.confirm(t("officeConfirm", { n: latest.version }))) return;
    run(async () => {
      await apiFetch(`/api/proofs/${latest.id}/office-approve`, { method: "POST" });
      return t("officeApproved");
    });
  };

  const decisionMethod = (p: ProofPanelProof | null): "online" | "office" | null => {
    const m = (p?.decision as { method?: string } | null)?.method;
    return m === "office" ? "office" : m === "online" ? "online" : null;
  };

  let stateText: string;
  if (orderProofStatus === "awaiting_client") {
    stateText = waitingHours !== null ? t("stateAwaitingHours", { n: waitingHours }) : t("stateAwaiting");
  } else if (orderProofStatus === "changes_requested") {
    stateText = t("stateChanges");
  } else if (orderProofStatus === "approved") {
    const method = decisionMethod(approved);
    const time = approved?.decided_at ? formatDateTime(approved.decided_at) : "—";
    stateText = method === "office" ? t("stateApprovedOffice", { time }) : t("stateApprovedOnline", { time });
  } else {
    stateText = t("stateNone");
  }

  const roleLabel = (r: string | null) => {
    if (!r) return null;
    if (r === "owner") return tRoles("client");
    return ROLES.includes(r) ? tRoles(r) : null;
  };

  const fieldLabel = (proof: ProofPanelProof, fieldId: string) => proof.key_fields.find((f) => f.id === fieldId);

  const renderComments = (proof: ProofPanelProof) => {
    const fieldComments = proof.comments.filter((c) => c.field_id);
    const pageComments = proof.comments.filter((c) => c.page != null).sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
    if (fieldComments.length === 0 && pageComments.length === 0) return null;
    const fieldText = (c: ProofPanelComment) => {
      const f = c.field_id ? fieldLabel(proof, c.field_id) : undefined;
      if (!f) return c.body;
      if (c.proposed_value) {
        const base = t("fieldChange", { label: f.label, from: f.value, to: c.proposed_value });
        // автотекст «исправить» не повторяем, живой комментарий клиента показываем
        return c.body && c.body !== `«${f.label}»: исправить` ? `${base} — ${c.body}` : base;
      }
      return t("fieldNote", { label: f.label, body: c.body });
    };
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-brand-800">{t("commentsTitle", { n: proof.version })}</h3>
        {fieldComments.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("fieldChanges")}</div>
            <ul className="space-y-1 text-sm">
              {fieldComments.map((c) => (
                <li key={c.id} className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-900">
                  {fieldText(c)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {pageComments.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("pageComments")}</div>
            <ul className="space-y-1 text-sm">
              {pageComments.map((c) => (
                <li key={c.id} className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-900">
                  {t("pageComment", { page: c.page ?? 0, body: c.body })}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t("commentsHint")}</p>
      </div>
    );
  };

  const eventLine = (e: ProofPanelEvent) => {
    const name = (EVENT_NAMES as readonly string[]).includes(e.event) ? t(`events.${e.event}`) : e.event;
    const proofVersion = proofs.find((p) => p.id === e.proof_id)?.version;
    const meta = (e.meta ?? {}) as { delivered?: boolean };
    const parts = [
      roleLabel(e.actor_role),
      e.ip ? `IP ${e.ip}` : null,
      e.user_agent ? describeDevice(e.user_agent) : null,
      (e.event === "sent" || e.event === "reminded") && meta.delivered === false ? t("notDelivered") : null,
    ].filter(Boolean);
    return (
      <li key={e.id} className="flex flex-wrap gap-x-3 gap-y-0.5">
        <span className="shrink-0 text-muted-foreground">{formatDateTime(e.created_at)}</span>
        <span>
          <strong>{name}</strong>
          {proofVersion ? ` · v${proofVersion}` : ""}
          {parts.length > 0 && <span className="text-muted-foreground">{` · ${parts.join(" · ")}`}</span>}
        </span>
      </li>
    );
  };

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4" aria-label={t("title")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold text-brand-800">
          <FileCheck2 className="h-5 w-5" aria-hidden /> {t("title")}
        </h2>
        <Button size="sm" onClick={() => setDialogOpen(true)} disabled={pending}>
          {latest ? <Upload aria-hidden /> : <Send aria-hidden />} {latest ? t("sendNew") : t("send")}
        </Button>
      </div>

      <div className={cn("flex items-start gap-2 rounded-xl p-3 text-sm font-semibold", STATE_CLASS[orderProofStatus])} role="status">
        {orderProofStatus === "approved" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
        <div className="space-y-1">
          <div>{stateText}</div>
          {lateWait && orderProofStatus === "awaiting_client" && (
            <div className="font-normal">{t("lateNote", { hours: PROOF_WAIT_HOURS })}</div>
          )}
        </div>
      </div>

      {latest && (
        <div className="flex flex-wrap gap-2">
          {canRemind && (
            <Button size="sm" variant="outline" disabled={pending} onClick={remind}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <BellRing aria-hidden />} {t("remind")}
            </Button>
          )}
          {canApproveOffice && (
            <Button size="sm" variant="outline" disabled={pending} onClick={officeApprove}>
              <ShieldCheck aria-hidden /> {t("officeApprove")}
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <a href={`/proof/${orderId}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden /> {t("openAsClient")}
            </a>
          </Button>
        </div>
      )}

      {latest && latest.note && (
        <p className="whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm">
          <strong>{t("yourNote")}</strong> {latest.note}
        </p>
      )}

      {latest && renderComments(latest)}

      {proofs.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-bold text-brand-800">{t("versions")}</h3>
          <ul className="divide-y rounded-xl border text-sm">
            {proofs.map((p) => {
              const method = decisionMethod(p);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <strong className="text-brand-800">v{p.version}</strong>
                    <span className="text-muted-foreground">
                      {` · ${t("pagesCount", { n: p.page_count })} · ${t("sentAt", { time: formatDateTime(p.created_at) })}`}
                      {p.decided_at && p.status !== "superseded" ? ` · ${t("decidedAt", { time: formatDateTime(p.decided_at) })}` : ""}
                      {p.status === "approved" && method ? ` · ${t(`method.${method}`)}` : ""}
                    </span>
                  </span>
                  <Badge variant={STATUS_VARIANT[p.status]}>{t(`status.${p.status}`)}</Badge>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {events && events.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-sm font-bold text-brand-500">{t("eventLog", { n: events.length })}</summary>
          <ul className="mt-2 space-y-1.5 text-sm">{events.map(eventLine)}</ul>
        </details>
      )}

      <ProofUploadDialog
        orderId={orderId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        nextVersion={(latest?.version ?? 0) + 1}
        initialFields={(latest?.key_fields ?? []).map((f) => ({ label: f.label, value: f.value }))}
        onSent={(version) => {
          setDialogOpen(false);
          toast.success(t("sent", { n: version }));
          router.refresh();
        }}
      />
    </section>
  );
}
