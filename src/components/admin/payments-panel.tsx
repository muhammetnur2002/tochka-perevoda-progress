"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Link2, Loader2, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cancelPaymentRequestAction, createPaymentRequestAction, refundPaymentAction } from "@/app/admin/actions";
import { formatMoney, round2 } from "@/lib/format/money";
import { formatDateTime } from "@/lib/format/date";
import type { PaymentMode, PaymentRequestRow, PaymentRow, RefundRow } from "@/types/database.types";
import { cn } from "@/lib/utils";

const PAY_STATUSES = ["pending", "waiting_for_capture", "succeeded", "canceled", "refunded"];
const PAY_METHODS = ["card", "sbp", "qr", "cash", "invoice"];

export interface PaymentsPanelProps {
  orderId: string;
  paymentMode: PaymentMode;
  /** Итоговая стоимость заказа (с доплатой и за вычетом промо). */
  totalPrice: number;
  /** Доплата, уже включённая в стоимость. */
  extraCharge: number;
  promoDiscount: number;
  /** Оплачено с учётом возвратов. */
  paidAmount: number;
  payments: PaymentRow[];
  refunds: RefundRow[];
  requests: PaymentRequestRow[];
}

const REQUEST_VARIANT = { open: "warning", paid: "success", cancelled: "secondary" } as const;
const REFUND_VARIANT = { pending: "warning", succeeded: "success", canceled: "secondary" } as const;

/** Деньги в поле ввода: «1500.5» → число, запятая допускается. */
const parseAmount = (v: string): number => Number(v.trim().replace(",", "."));

function SummaryRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "good" | "bad" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn(strong && "font-bold", tone === "good" && "text-emerald-700", tone === "bad" && "text-red-700")}>{value}</dd>
    </div>
  );
}

/** Платежи заказа: сводка, платежи, возвраты, ссылки на оплату (остаток / доплата). */
export function PaymentsPanel({
  orderId,
  paymentMode,
  totalPrice,
  extraCharge,
  promoDiscount,
  paidAmount,
  payments,
  refunds,
  requests,
}: PaymentsPanelProps) {
  const t = useTranslations("admin.payments");
  const tAdmin = useTranslations("admin");
  const router = useRouter();
  const [pending, start] = React.useTransition();

  const remaining = Math.max(0, round2(totalPrice - paidAmount));
  const officeUnpaid = paymentMode === "office" && remaining > 0;
  const openRequests = requests.filter((r) => r.status === "open").length;

  const methodName = (m: string) => (PAY_METHODS.includes(m) ? tAdmin(`paymentMethods.${m}`) : m.toUpperCase());
  const payStatusName = (s: string) => (PAY_STATUSES.includes(s) ? tAdmin(`paymentStatus.${s}`) : s);

  /** Сколько ещё можно вернуть по платежу (ожидающие возвраты тоже занимают сумму). */
  const refundable = (p: PaymentRow): number =>
    Math.max(
      0,
      round2(
        Number(p.amount) -
          refunds
            .filter((r) => r.payment_id === p.id && (r.status === "pending" || r.status === "succeeded"))
            .reduce((sum, r) => sum + Number(r.amount), 0),
      ),
    );

  // ---- Возврат ----
  const [refundFor, setRefundFor] = React.useState<PaymentRow | null>(null);
  const [refundAmount, setRefundAmount] = React.useState("");
  const [refundReason, setRefundReason] = React.useState("");
  const [refundError, setRefundError] = React.useState<string | null>(null);

  const openRefund = (p: PaymentRow) => {
    setRefundFor(p);
    setRefundAmount(String(refundable(p)));
    setRefundReason("");
    setRefundError(null);
  };

  const submitRefund = () => {
    if (!refundFor) return;
    const max = refundable(refundFor);
    const amount = parseAmount(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > max + 0.009) {
      setRefundError(t("refundDialog.invalid", { max: formatMoney(max) }));
      return;
    }
    setRefundError(null);
    start(async () => {
      const r = await refundPaymentAction(orderId, refundFor.id, { amount: round2(amount), reason: refundReason.trim() || null });
      if (r.ok) {
        if (r.message) toast.success(r.message);
        setRefundFor(null);
        router.refresh();
      } else toast.error(r.error);
    });
  };

  // ---- Ссылка на оплату ----
  const [reqOpen, setReqOpen] = React.useState(false);
  const [reqExtra, setReqExtra] = React.useState(false);
  const [reqAmount, setReqAmount] = React.useState("");
  const [reqReason, setReqReason] = React.useState("");
  const [reqError, setReqError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{ url: string; delivered: boolean } | null>(null);

  const openRequestDialog = () => {
    setReqExtra(remaining <= 0);
    setReqAmount(remaining > 0 ? String(remaining) : "");
    setReqReason("");
    setReqError(null);
    setCreated(null);
    setReqOpen(true);
  };

  const changeType = (extra: boolean) => {
    setReqExtra(extra);
    setReqAmount(extra ? "" : remaining > 0 ? String(remaining) : "");
    setReqError(null);
  };

  const submitRequest = () => {
    const amount = parseAmount(reqAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      setReqError(t("requestDialog.errorAmount"));
      return;
    }
    if (!reqExtra && amount > remaining + 0.009) {
      setReqError(t("requestDialog.errorOver", { max: formatMoney(remaining) }));
      return;
    }
    setReqError(null);
    start(async () => {
      const r = await createPaymentRequestAction(orderId, { amount: round2(amount), reason: reqReason.trim() || null, isExtra: reqExtra });
      if (r.ok) {
        if (r.message) toast.success(r.message);
        const url = typeof r.data?.url === "string" ? r.data.url : "";
        if (url) setCreated({ url, delivered: r.data?.delivered === true });
        else setReqOpen(false);
        router.refresh();
      } else toast.error(r.error);
    });
  };

  const copyLink = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      toast.success(t("requestDialog.copied"));
    } catch {
      toast.error(t("requestDialog.copyFailed"));
    }
  };

  const cancelRequest = (r: PaymentRequestRow) => {
    const text = r.is_extra
      ? t("cancelConfirmExtra", { amount: formatMoney(Number(r.amount)) })
      : t("cancelConfirm", { amount: formatMoney(Number(r.amount)) });
    if (!window.confirm(text)) return;
    start(async () => {
      const res = await cancelPaymentRequestAction(orderId, r.id);
      if (res.ok) {
        if (res.message) toast.success(res.message);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const refundProviderHint = (p: PaymentRow) => (p.provider === "yookassa" ? t("refundDialog.onlineHint") : t("refundDialog.manualHint"));

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex flex-wrap items-center gap-2 font-bold text-brand-800">
          {t("title")}
          {officeUnpaid && <Badge variant="warning">{t("officeBadge")}</Badge>}
        </h2>
        <Button size="sm" variant="outline" onClick={openRequestDialog} disabled={pending}>
          <Link2 className="h-4 w-4" aria-hidden /> {t("newRequest")}
        </Button>
      </div>

      {officeUnpaid && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{t("officeHint")}</p>}

      <dl className="grid gap-1 text-sm sm:max-w-sm">
        <SummaryRow label={t("summary.total")} value={formatMoney(totalPrice)} strong />
        {extraCharge > 0 && <SummaryRow label={t("summary.extra")} value={`+${formatMoney(extraCharge)}`} />}
        {promoDiscount > 0 && <SummaryRow label={t("summary.promo")} value={`−${formatMoney(promoDiscount)}`} />}
        <SummaryRow label={t("summary.paid")} value={formatMoney(paidAmount)} />
        <SummaryRow
          label={remaining > 0 ? t("summary.remaining") : t("summary.settled")}
          value={formatMoney(remaining)}
          strong
          tone={remaining > 0 ? "bad" : "good"}
        />
      </dl>

      <div className="space-y-1.5">
        <h3 className="text-sm font-bold text-brand-800">{t("paymentsTitle")}</h3>
        {payments.length === 0 && <p className="text-sm text-muted-foreground">{t("noPayments")}</p>}
        <ul className="space-y-2">
          {payments.map((p) => {
            const canRefund = p.status === "succeeded" && refundable(p) > 0;
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div>
                    <strong>{formatMoney(Number(p.amount))}</strong> · {methodName(p.method)} ·{" "}
                    <span className="text-muted-foreground">{payStatusName(p.status)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(p.paid_at ?? p.created_at)} · {p.provider}
                  </div>
                </div>
                {canRefund && (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => openRefund(p)}>
                    <Undo2 className="h-4 w-4" aria-hidden /> {t("refund")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {refunds.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-brand-800">{t("refundsTitle")}</h3>
          <ul className="space-y-2">
            {refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div>
                    <strong>−{formatMoney(Number(r.amount))}</strong>
                    {r.reason ? <span className="text-muted-foreground"> · {r.reason}</span> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</div>
                </div>
                <Badge variant={REFUND_VARIANT[r.status]}>{t(`refundStatus.${r.status}`)}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {requests.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-brand-800">
            {t("requestsTitle")}
            {openRequests > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{t("openCount", { n: openRequests })}</span>}
          </h3>
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div>
                    <strong>{formatMoney(Number(r.amount))}</strong> · {r.is_extra ? t("kind.extra") : t("kind.remainder")}
                    {r.reason ? <span className="text-muted-foreground"> · {r.reason}</span> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(r.paid_at ?? r.created_at)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={REQUEST_VARIANT[r.status]}>{t(`requestStatus.${r.status}`)}</Badge>
                  {r.status === "open" && (
                    <Button size="sm" variant="ghost" className="text-red-700 hover:text-red-800" disabled={pending} onClick={() => cancelRequest(r)}>
                      {t("cancel")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Возврат */}
      <Dialog open={refundFor !== null} onOpenChange={(open) => !open && setRefundFor(null)}>
        <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("refundDialog.title")}</DialogTitle>
            {refundFor && (
              <DialogDescription>
                {t("refundDialog.description", { amount: formatMoney(Number(refundFor.amount)), method: methodName(refundFor.method) })}
              </DialogDescription>
            )}
          </DialogHeader>
          {refundFor && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="refund-amount">{t("refundDialog.amount")}</Label>
                <Input
                  id="refund-amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t("refundDialog.available", { amount: formatMoney(refundable(refundFor)) })}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="refund-reason">{t("refundDialog.reason")}</Label>
                <Textarea
                  id="refund-reason"
                  rows={2}
                  maxLength={300}
                  value={refundReason}
                  placeholder={t("refundDialog.reasonPlaceholder")}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">{refundProviderHint(refundFor)}</p>
              {refundError && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {refundError}
                </p>
              )}
              <Button className="w-full" disabled={pending} onClick={submitRefund}>
                {pending ? <Loader2 className="animate-spin" /> : t("refundDialog.confirm")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ссылка на оплату */}
      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("requestDialog.title")}</DialogTitle>
            <DialogDescription>{t("requestDialog.description")}</DialogDescription>
          </DialogHeader>
          {created ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="request-link">{t("requestDialog.linkReady")}</Label>
                <div className="flex gap-2">
                  <Input id="request-link" readOnly value={created.url} onFocus={(e) => e.currentTarget.select()} />
                  <Button type="button" variant="outline" className="shrink-0" onClick={copyLink}>
                    <Copy className="h-4 w-4" aria-hidden /> {t("requestDialog.copy")}
                  </Button>
                </div>
              </div>
              <p className={cn("text-sm", created.delivered ? "text-emerald-700" : "text-amber-800")}>
                {created.delivered ? t("requestDialog.delivered") : t("requestDialog.notDelivered")}
              </p>
              <Button className="w-full" onClick={() => setReqOpen(false)}>
                {t("requestDialog.done")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{t("requestDialog.type")}</Label>
                <div className="grid gap-2" role="radiogroup" aria-label={t("requestDialog.type")}>
                  {([false, true] as const).map((extra) => {
                    const disabled = !extra && remaining <= 0;
                    return (
                      <button
                        key={String(extra)}
                        type="button"
                        role="radio"
                        aria-checked={reqExtra === extra}
                        disabled={disabled}
                        onClick={() => changeType(extra)}
                        className={cn(
                          "min-h-11 rounded-md border px-3 text-left text-sm font-bold disabled:opacity-40",
                          reqExtra === extra ? "border-brand-800 bg-brand-800 text-white" : "border-input bg-white text-brand-800",
                        )}
                      >
                        {extra ? t("requestDialog.extra") : t("requestDialog.remainder")}
                      </button>
                    );
                  })}
                </div>
                {remaining <= 0 && <p className="text-xs text-muted-foreground">{t("requestDialog.noRemaining")}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="request-amount">{t("requestDialog.amount")}</Label>
                <Input
                  id="request-amount"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="0.01"
                  value={reqAmount}
                  onChange={(e) => setReqAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {reqExtra ? t("requestDialog.amountHintExtra") : t("requestDialog.amountHintRemainder", { max: formatMoney(remaining) })}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="request-reason">{t("requestDialog.reason")}</Label>
                <Input
                  id="request-reason"
                  maxLength={200}
                  value={reqReason}
                  placeholder={t("requestDialog.reasonPlaceholder")}
                  onChange={(e) => setReqReason(e.target.value)}
                />
              </div>
              {reqError && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {reqError}
                </p>
              )}
              <Button className="w-full" disabled={pending} onClick={submitRequest}>
                {pending ? <Loader2 className="animate-spin" /> : t("requestDialog.create")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
