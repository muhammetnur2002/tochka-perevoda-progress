"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Power, Sparkles, Ticket, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deletePromoAction, savePromoAction, setPromoActiveAction } from "@/app/admin/actions";
import { formatMoney } from "@/lib/format/money";
import type { PromoCodeRow } from "@/types/database.types";
import { cn } from "@/lib/utils";

type Usage = { uses: number; discountTotal: number };
type Status = "active" | "disabled" | "expired" | "limit" | "scheduled";

/** Московское время (UTC+3, без перехода на летнее) — в нём сотрудники задают период действия. */
const MSK_OFFSET_MS = 3 * 3_600_000;

const toMskInput = (iso: string | null): string =>
  iso ? new Date(new Date(iso).getTime() + MSK_OFFSET_MS).toISOString().slice(0, 16) : "";

const fromMskInput = (local: string): string | null => {
  if (!local) return null;
  const d = new Date(`${local}:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const mskFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const normalizeCode = (v: string) => v.replace(/\s+/g, "").toUpperCase();

function randomCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

type Draft = {
  auto_apply: boolean;
  code: string;
  name: string;
  description: string;
  discount_type: "percent" | "fixed";
  value: string;
  max_discount: string;
  min_order_amount: string;
  first_order_only: boolean;
  valid_from: string;
  valid_to: string;
  max_uses: string;
  max_uses_per_client: string;
  is_active: boolean;
};

const emptyDraft = (): Draft => ({
  auto_apply: false,
  code: "",
  name: "",
  description: "",
  discount_type: "percent",
  value: "",
  max_discount: "",
  min_order_amount: "",
  first_order_only: false,
  valid_from: "",
  valid_to: "",
  max_uses: "",
  max_uses_per_client: "",
  is_active: true,
});

const fromPromo = (p: PromoCodeRow): Draft => ({
  auto_apply: p.auto_apply,
  code: p.code ?? "",
  name: p.name,
  description: p.description ?? "",
  discount_type: p.discount_type,
  value: String(Number(p.value)),
  max_discount: p.max_discount == null ? "" : String(Number(p.max_discount)),
  min_order_amount: Number(p.min_order_amount) > 0 ? String(Number(p.min_order_amount)) : "",
  first_order_only: p.first_order_only,
  valid_from: toMskInput(p.valid_from),
  valid_to: toMskInput(p.valid_to),
  max_uses: p.max_uses == null ? "" : String(p.max_uses),
  max_uses_per_client: p.max_uses_per_client == null ? "" : String(p.max_uses_per_client),
  is_active: p.is_active,
});

const numOrNull = (v: string): number | null => (v.trim() === "" ? null : Number(v.replace(",", ".")));

function toPayload(d: Draft) {
  const code = normalizeCode(d.code);
  return {
    auto_apply: d.auto_apply,
    code: d.auto_apply ? null : code,
    // Для обычного кода название необязательно — подставляем сам код
    name: d.name.trim() || (d.auto_apply ? "" : code),
    description: d.description.trim() || null,
    discount_type: d.discount_type,
    value: Number(d.value.replace(",", ".")),
    max_discount: d.discount_type === "percent" ? numOrNull(d.max_discount) : null,
    min_order_amount: numOrNull(d.min_order_amount) ?? 0,
    first_order_only: d.first_order_only,
    valid_from: fromMskInput(d.valid_from),
    valid_to: fromMskInput(d.valid_to),
    max_uses: numOrNull(d.max_uses),
    max_uses_per_client: numOrNull(d.max_uses_per_client),
    is_active: d.is_active,
  };
}

function PromoForm({
  initial,
  pending,
  onSubmit,
}: {
  initial: Draft;
  pending: boolean;
  onSubmit: (payload: ReturnType<typeof toPayload>) => void;
}) {
  const t = useTranslations("admin.promo");
  const tCommon = useTranslations("common");
  const [d, setD] = React.useState<Draft>(initial);
  const [error, setError] = React.useState<string | null>(null);
  const patch = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }));

  const validate = (payload: ReturnType<typeof toPayload>): string | null => {
    if (!payload.auto_apply && !/^[^\s]{3,32}$/.test(payload.code ?? "")) return t("errors.code");
    if (!payload.name) return t("errors.name");
    if (!Number.isFinite(payload.value) || payload.value <= 0) return t("errors.value");
    if (payload.discount_type === "percent" && payload.value > 100) return t("errors.percent");
    if (payload.max_discount != null && !(payload.max_discount > 0)) return t("errors.maxDiscount");
    if (!(payload.min_order_amount >= 0)) return t("errors.minOrder");
    if (d.valid_from && !payload.valid_from) return t("errors.dates");
    if (d.valid_to && !payload.valid_to) return t("errors.dates");
    if (payload.valid_from && payload.valid_to && new Date(payload.valid_to) <= new Date(payload.valid_from)) {
      return t("errors.dates");
    }
    for (const limit of [payload.max_uses, payload.max_uses_per_client]) {
      if (limit != null && (!Number.isInteger(limit) || limit < 1)) return t("errors.limit");
    }
    return null;
  };

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const payload = toPayload(d);
        const problem = validate(payload);
        setError(problem);
        if (!problem) onSubmit(payload);
      }}
    >
      <div className="space-y-1">
        <Label>{t("kind")}</Label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("kind")}>
          {([false, true] as const).map((auto) => (
            <button
              key={String(auto)}
              type="button"
              role="radio"
              aria-checked={d.auto_apply === auto}
              onClick={() => patch({ auto_apply: auto })}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold",
                d.auto_apply === auto ? "border-brand-800 bg-brand-800 text-white" : "border-input bg-white text-brand-800",
              )}
            >
              {auto ? <Sparkles className="h-4 w-4" aria-hidden /> : <Ticket className="h-4 w-4" aria-hidden />}
              {auto ? t("kindAuto") : t("kindCode")}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{d.auto_apply ? t("kindAutoHint") : t("kindCodeHint")}</p>
      </div>

      {!d.auto_apply && (
        <div className="space-y-1">
          <Label htmlFor="promo-code">{t("code")}</Label>
          <div className="flex gap-2">
            <Input
              id="promo-code"
              value={d.code}
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase"
              placeholder="SPRING10"
              onChange={(e) => patch({ code: normalizeCode(e.target.value) })}
            />
            <Button type="button" variant="outline" className="shrink-0" onClick={() => patch({ code: randomCode() })}>
              <Wand2 className="h-4 w-4" aria-hidden /> {t("generate")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("codeHint")}</p>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="promo-name">{d.auto_apply ? t("nameAuto") : t("name")}</Label>
        <Input id="promo-name" value={d.name} maxLength={100} onChange={(e) => patch({ name: e.target.value })} />
        <p className="text-xs text-muted-foreground">{d.auto_apply ? t("nameAutoHint") : t("nameHint")}</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="promo-description">{t("descriptionLabel")}</Label>
        <Textarea
          id="promo-description"
          rows={2}
          maxLength={500}
          value={d.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="promo-type">{t("discountType")}</Label>
          <select
            id="promo-type"
            value={d.discount_type}
            onChange={(e) => patch({ discount_type: e.target.value as Draft["discount_type"] })}
            className="h-11 w-full rounded-md border bg-white px-2 text-sm"
          >
            <option value="percent">{t("typePercent")}</option>
            <option value="fixed">{t("typeFixed")}</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="promo-value">{d.discount_type === "percent" ? t("valuePercent") : t("valueFixed")}</Label>
          <Input
            id="promo-value"
            type="number"
            inputMode="decimal"
            min={0.01}
            max={d.discount_type === "percent" ? 100 : undefined}
            step="0.01"
            value={d.value}
            onChange={(e) => patch({ value: e.target.value })}
          />
        </div>
        {d.discount_type === "percent" && (
          <div className="space-y-1">
            <Label htmlFor="promo-max">{t("maxDiscount")}</Label>
            <Input
              id="promo-max"
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              value={d.max_discount}
              onChange={(e) => patch({ max_discount: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">{t("maxDiscountHint")}</p>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="promo-min">{t("minOrder")}</Label>
          <Input
            id="promo-min"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={d.min_order_amount}
            placeholder="0"
            onChange={(e) => patch({ min_order_amount: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{t("minOrderHint")}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="promo-from">{t("validFrom")}</Label>
          <Input id="promo-from" type="datetime-local" value={d.valid_from} onChange={(e) => patch({ valid_from: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="promo-to">{t("validTo")}</Label>
          <Input id="promo-to" type="datetime-local" value={d.valid_to} onChange={(e) => patch({ valid_to: e.target.value })} />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">{t("validHint")}</p>
        <div className="space-y-1">
          <Label htmlFor="promo-uses">{t("maxUses")}</Label>
          <Input
            id="promo-uses"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={d.max_uses}
            placeholder="∞"
            onChange={(e) => patch({ max_uses: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="promo-per-client">{t("maxUsesPerClient")}</Label>
          <Input
            id="promo-per-client"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={d.max_uses_per_client}
            placeholder="∞"
            onChange={(e) => patch({ max_uses_per_client: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5 accent-brand-800"
            checked={d.first_order_only}
            onChange={(e) => patch({ first_order_only: e.target.checked })}
          />
          {t("firstOrderOnly")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5 accent-brand-800"
            checked={d.is_active}
            onChange={(e) => patch({ is_active: e.target.checked })}
          />
          {t("active")}
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {tCommon("save")}
      </Button>
    </form>
  );
}

const STATUS_VARIANT: Record<Status, "success" | "secondary" | "destructive" | "warning" | "info"> = {
  active: "success",
  disabled: "secondary",
  expired: "destructive",
  limit: "warning",
  scheduled: "info",
};

/** Промокоды и автоскидки: создание, условия, лимиты, включение/выключение, удаление. */
export function PromoEditor({ promos, usage }: { promos: PromoCodeRow[]; usage: Record<string, Usage> }) {
  const t = useTranslations("admin.promo");
  const router = useRouter();
  const [editing, setEditing] = React.useState<PromoCodeRow | "new" | null>(null);
  const [pending, start] = React.useTransition();
  const [now] = React.useState(() => Date.now());

  const statusOf = (p: PromoCodeRow): Status => {
    const uses = usage[p.id]?.uses ?? 0;
    if (!p.is_active) return "disabled";
    if (p.valid_to && new Date(p.valid_to).getTime() < now) return "expired";
    if (p.max_uses != null && uses >= p.max_uses) return "limit";
    if (p.valid_from && new Date(p.valid_from).getTime() > now) return "scheduled";
    return "active";
  };

  const discountLabel = (p: PromoCodeRow) =>
    p.discount_type === "percent"
      ? t("discountPercent", { value: Number(p.value) })
      : t("discountFixed", { amount: formatMoney(Number(p.value)) });

  const conditions = (p: PromoCodeRow): string[] => {
    const out: string[] = [];
    if (p.discount_type === "percent" && p.max_discount != null) out.push(t("condMax", { amount: formatMoney(Number(p.max_discount)) }));
    if (Number(p.min_order_amount) > 0) out.push(t("condMin", { amount: formatMoney(Number(p.min_order_amount)) }));
    if (p.first_order_only) out.push(t("condFirst"));
    if (p.max_uses_per_client != null) out.push(t("condPerClient", { n: p.max_uses_per_client }));
    return out;
  };

  const period = (p: PromoCodeRow) => {
    const from = p.valid_from ? mskFormatter.format(new Date(p.valid_from)) : null;
    const to = p.valid_to ? mskFormatter.format(new Date(p.valid_to)) : null;
    if (from && to) return t("periodFromTo", { from, to });
    if (from) return t("periodFrom", { date: from });
    if (to) return t("periodTo", { date: to });
    return t("periodAlways");
  };

  const act = (fn: () => ReturnType<typeof savePromoAction>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.message) toast.success(r.message);
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus /> {t("newPromo")}
        </Button>
      </div>

      {promos.length === 0 && <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">{t("empty")}</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        {promos.map((p) => {
          const status = statusOf(p);
          const u = usage[p.id] ?? { uses: 0, discountTotal: 0 };
          const conds = conditions(p);
          return (
            <article key={p.id} className={cn("space-y-3 rounded-2xl border bg-card p-4", status === "disabled" && "opacity-70")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 font-bold text-brand-800">
                    {p.auto_apply ? (
                      <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <Ticket className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    {p.code ? <span className="break-all font-mono">{p.code}</span> : <span>{t("autoLabel")}</span>}
                    <span className="rounded-md bg-gold-100 px-2 py-0.5 text-sm text-gold-900">{discountLabel(p)}</span>
                  </h2>
                  <div className="mt-1 text-sm">{p.name}</div>
                  {p.description && <div className="mt-0.5 text-xs text-muted-foreground">{p.description}</div>}
                </div>
                <Badge variant={STATUS_VARIANT[status]}>{t(`status.${status}`)}</Badge>
              </div>

              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="sr-only">{t("conditions")}</dt>
                  <dd className="text-muted-foreground">{conds.length ? conds.join(" · ") : t("noConditions")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("period")}</dt>
                  <dd>{period(p)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("uses")}</dt>
                  <dd className="font-bold">{p.max_uses != null ? `${u.uses} / ${p.max_uses}` : `${u.uses} / ∞`}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("discountGiven")}</dt>
                  <dd className="font-bold">{formatMoney(u.discountTotal)}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => act(() => setPromoActiveAction(p.id, !p.is_active))}
                >
                  <Power className="h-4 w-4" aria-hidden /> {p.is_active ? t("disable") : t("enable")}
                </Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(p)}>
                  <Pencil className="h-4 w-4" aria-hidden /> {t("edit")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-700 hover:text-red-800"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(t("deleteConfirm", { name: p.code ?? p.name }))) act(() => deletePromoAction(p.id));
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> {t("delete")}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" || editing === null ? t("newPromo") : t("editPromo")}</DialogTitle>
          </DialogHeader>
          {editing !== null && (
            <PromoForm
              key={editing === "new" ? "new" : editing.id}
              initial={editing === "new" ? emptyDraft() : fromPromo(editing)}
              pending={pending}
              onSubmit={(payload) =>
                act(
                  () => savePromoAction(editing === "new" ? null : editing.id, payload),
                  () => setEditing(null),
                )
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
