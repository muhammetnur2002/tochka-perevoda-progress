"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { grantRoleByEmailAction, setUserRoleAction, updateTranslatorAction, type ActionResult } from "@/app/admin/actions";
import type { UserRole } from "@/types/database.types";
import { cn } from "@/lib/utils";

interface Staff {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  telegram: boolean;
  active: number;
  translator: { capacity_per_day: number; is_available: boolean; specialization: string | null; languages: string[] } | null;
}

const GRANTABLE: UserRole[] = ["translator", "notary", "printer", "manager", "admin", "client"];

function TranslatorRow({ s, languages }: { s: Staff; languages: { id: string; name: string }[] }) {
  const tx = useTranslations("admin.executors");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [t, setT] = React.useState(s.translator!);
  const [pending, start] = React.useTransition();
  const ratio = t.capacity_per_day ? s.active / t.capacity_per_day : 0;

  const save = () =>
    start(async () => {
      const r = await updateTranslatorAction(s.id, t);
      if (r.ok) {
        toast.success(r.message ?? tCommon("saved"));
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="w-28 text-muted-foreground">{tx("load", { active: s.active, capacity: t.capacity_per_day })}</span>
        <div className="h-2 flex-1 rounded-full bg-slate-100">
          <div
            className={cn("h-2 rounded-full", ratio >= 0.8 ? "bg-gold-400" : "bg-brand-800")}
            style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs" htmlFor={`cap-${s.id}`}>
            {tx("capacity")}
          </Label>
          <Input
            id={`cap-${s.id}`}
            type="number"
            min={1}
            max={100}
            className="h-9 w-20"
            value={t.capacity_per_day}
            onChange={(e) => setT({ ...t, capacity_per_day: Number(e.target.value) })}
          />
        </div>
        <div className="min-w-40 flex-1 space-y-1">
          <Label className="text-xs" htmlFor={`spec-${s.id}`}>
            {tx("specialization")}
          </Label>
          <Input
            id={`spec-${s.id}`}
            className="h-9"
            value={t.specialization ?? ""}
            onChange={(e) => setT({ ...t, specialization: e.target.value || null })}
            placeholder={tx("specializationPlaceholder")}
          />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={t.is_available} onChange={(e) => setT({ ...t, is_available: e.target.checked })} />
          {tx("available")}
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {languages.map((l) => {
          const on = t.languages.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setT({ ...t, languages: on ? t.languages.filter((x) => x !== l.id) : [...t.languages, l.id] })}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-bold",
                on ? "border-brand-800 bg-brand-800 text-white" : "border-input bg-white text-slate-600",
              )}
            >
              {l.name}
            </button>
          );
        })}
      </div>
      <Button size="sm" variant="outline" onClick={save} disabled={pending}>
        {tx("saveProfile")}
      </Button>
    </div>
  );
}

/** Список исполнителей с загрузкой; администратор выдаёт и меняет роли. */
export function ExecutorsPanel({ staff, languages, isAdmin }: { staff: Staff[]; languages: { id: string; name: string }[]; isAdmin: boolean }) {
  const t = useTranslations("admin.executors");
  const tRoles = useTranslations("roles");
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("translator");
  const [pending, start] = React.useTransition();

  const exec = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? t("done"));
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <div className="space-y-5">
      {isAdmin && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-2xl border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => grantRoleByEmailAction(email, role));
          }}
        >
          <div className="min-w-56 flex-1 space-y-1">
            <Label htmlFor="grant-email">{t("grantEmail")}</Label>
            <Input id="grant-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="grant-role">{t("role")}</Label>
            <select id="grant-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="h-10 rounded-md border bg-white px-2 text-sm">
              {GRANTABLE.map((r) => (
                <option key={r} value={r}>
                  {tRoles(r)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={pending}>
            {t("grantRole")}
          </Button>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {staff.map((s) => (
          <section key={s.id} className="space-y-2 rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-bold text-brand-800">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {s.email ?? "—"} · {s.telegram ? t("telegramLinked") : t("telegramNotLinked")}
                </div>
              </div>
              {isAdmin ? (
                <select
                  aria-label={t("roleOf", { name: s.name })}
                  value={s.role}
                  onChange={(e) => exec(() => setUserRoleAction(s.id, e.target.value as UserRole))}
                  className="h-9 rounded-md border bg-white px-2 text-sm"
                >
                  {GRANTABLE.map((r) => (
                    <option key={r} value={r}>
                      {tRoles(r)}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{tRoles(s.role)}</span>
              )}
            </div>
            {s.role === "translator" && s.translator ? (
              <TranslatorRow s={s} languages={languages} />
            ) : (
              <div className="text-sm text-muted-foreground">{t("activeTasks", { n: s.active })}</div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
