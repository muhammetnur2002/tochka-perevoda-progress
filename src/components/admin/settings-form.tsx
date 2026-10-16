"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveSettingAction } from "@/app/admin/actions";
import type { Json } from "@/types/database.types";

type Settings = Record<string, Json | undefined>;

const num = (v: Json | undefined, d: number) => (typeof v === "number" ? v : Number(v ?? d) || d);

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Настройки платформы (таблица settings). Каждая группа сохраняется отдельно. */
export function SettingsForm({ initial }: { initial: Settings }) {
  const t = useTranslations("admin.settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const urgency = (initial.urgency ?? {}) as Record<string, number>;
  const notif = (initial.notifications ?? {}) as Record<string, Json>;

  const [u1d, setU1d] = React.useState(String(urgency["1d"] ?? 1.5));
  const [uSame, setUSame] = React.useState(String(urgency.same_day ?? 2));
  const [notary, setNotary] = React.useState(String(num(initial.notary_fee, 0)));
  const [delivery, setDelivery] = React.useState(String(num(initial.delivery_price, 0)));
  const [prepay, setPrepay] = React.useState(String(num(initial.prepayment_percent, 100)));
  const [prepayThreshold, setPrepayThreshold] = React.useState(String(num(initial.prepayment_threshold, 3000)));
  const [payInOffice, setPayInOffice] = React.useState(initial.pay_in_office_enabled !== false && initial.pay_in_office_enabled !== "false");
  const [retention, setRetention] = React.useState(String(num(initial.file_retention_days, 90)));
  const [holidays, setHolidays] = React.useState(((initial.holidays as string[] | undefined) ?? []).join("\n"));
  const [notifyStatus, setNotifyStatus] = React.useState(notif.client_status_change !== false);
  const [notifyReady, setNotifyReady] = React.useState(notif.client_ready !== false);

  const saveMany = (entries: [string, Json][]) =>
    start(async () => {
      for (const [key, value] of entries) {
        const r = await saveSettingAction(key, value);
        if (!r.ok) {
          toast.error(`${key}: ${r.error}`);
          return;
        }
      }
      toast.success(tCommon("saved"));
      router.refresh();
    });

  const positive = (s: string) => Number.isFinite(Number(s)) && Number(s) >= 0;

  return (
    <div className="grid max-w-4xl gap-5">
      <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
        <h2 className="text-lg font-bold text-brand-800 sm:col-span-2">{t("tariffs")}</h2>
        <Field id="u1d" label={t("urgency1d")}>
          <Input id="u1d" type="number" step="0.05" min="1" value={u1d} onChange={(e) => setU1d(e.target.value)} />
        </Field>
        <Field id="usame" label={t("urgencySameDay")}>
          <Input id="usame" type="number" step="0.05" min="1" value={uSame} onChange={(e) => setUSame(e.target.value)} />
        </Field>
        <Field id="notary" label={t("notaryFee")} hint={t("notaryFeeHint")}>
          <Input id="notary" type="number" min="0" value={notary} onChange={(e) => setNotary(e.target.value)} />
        </Field>
        <Field id="delivery" label={t("delivery")} hint={t("deliveryHint")}>
          <Input id="delivery" type="number" min="0" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
        </Field>
        <Field id="prepay" label={t("prepayment")} hint={t("prepaymentHint")}>
          <Input id="prepay" type="number" min="1" max="100" value={prepay} onChange={(e) => setPrepay(e.target.value)} />
        </Field>
        <Field id="prepay-threshold" label={t("prepaymentThreshold")} hint={t("prepaymentThresholdHint")}>
          <Input id="prepay-threshold" type="number" min="0" value={prepayThreshold} onChange={(e) => setPrepayThreshold(e.target.value)} />
        </Field>
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <Switch id="pay-in-office" checked={payInOffice} onCheckedChange={setPayInOffice} />
            <Label htmlFor="pay-in-office">{t("payInOffice")}</Label>
          </div>
          <p className="text-xs text-muted-foreground">{t("payInOfficeHint")}</p>
        </div>
        <div className="flex items-end">
          <Button
            disabled={pending}
            onClick={() => {
              if (![u1d, uSame, notary, delivery, prepay, prepayThreshold].every(positive) || Number(u1d) < 1 || Number(uSame) < 1) {
                toast.error(t("invalidValues"));
                return;
              }
              saveMany([
                ["urgency", { "1d": Number(u1d), same_day: Number(uSame) }],
                ["notary_fee", Number(notary)],
                ["delivery_price", Number(delivery)],
                ["prepayment_percent", Math.min(100, Math.max(1, Number(prepay)))],
                ["prepayment_threshold", Number(prepayThreshold)],
                ["pay_in_office_enabled", payInOffice],
              ]);
            }}
          >
            {t("saveTariffs")}
          </Button>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-bold text-brand-800">{t("calendar")}</h2>
        <Field id="holidays" label={t("holidays")} hint={t("holidaysHint")}>
          <Textarea id="holidays" rows={8} className="font-mono text-sm" value={holidays} onChange={(e) => setHolidays(e.target.value)} />
        </Field>
        <Button
          className="justify-self-start"
          disabled={pending}
          onClick={() => {
            const days = holidays
              .split(/[\s,;]+/)
              .map((d) => d.trim())
              .filter(Boolean);
            const bad = days.find((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d));
            if (bad) return toast.error(t("invalidDate", { date: bad }));
            saveMany([["holidays", [...new Set(days)].sort()]]);
          }}
        >
          {t("saveCalendar")}
        </Button>
      </section>

      <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
        <h2 className="text-lg font-bold text-brand-800 sm:col-span-2">{t("notifications")}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={notifyStatus} onChange={(e) => setNotifyStatus(e.target.checked)} />
          {t("notifyStatus")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={notifyReady} onChange={(e) => setNotifyReady(e.target.checked)} />
          {t("notifyReady")}
        </label>
        <Field id="retention" label={t("retention")} hint={t("retentionHint")}>
          <Input id="retention" type="number" min="7" value={retention} onChange={(e) => setRetention(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button
            disabled={pending}
            onClick={() =>
              saveMany([
                ["notifications", { ...notif, client_status_change: notifyStatus, client_ready: notifyReady }],
                ["file_retention_days", Math.max(7, Number(retention) || 90)],
              ])
            }
          >
            {tCommon("save")}
          </Button>
        </div>
      </section>
    </div>
  );
}
