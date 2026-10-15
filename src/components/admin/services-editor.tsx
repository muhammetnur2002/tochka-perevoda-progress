"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveServiceAction } from "@/app/admin/actions";
import type { ServiceCategory, ServiceRow, ServiceUnit } from "@/types/database.types";
import { cn } from "@/lib/utils";

interface Rule {
  service_id: string;
  rule_type: string;
  value: number;
  min_qty: number | null;
  priority: number;
}

const CATEGORIES: ServiceCategory[] = ["translation", "printing", "insurance", "additional"];

type RuleKey = "perPage" | "fixed" | "urgent" | "volume";

function ruleText(rules: Rule[], t: (key: RuleKey, values?: Record<string, string | number>) => string): string {
  const parts = rules.map((r) => {
    if (r.rule_type === "per_page") return t("perPage");
    if (r.rule_type === "fixed") return t("fixed");
    if (r.rule_type === "urgent") return t("urgent", { k: String(Number(r.value)) });
    if (r.rule_type === "volume") return t("volume", { pct: Math.round((1 - Number(r.value)) * 100), min: r.min_qty ?? 0 });
    return r.rule_type;
  });
  return [...new Set(parts)].join(" · ") || "—";
}

type Draft = {
  slug: string;
  category: ServiceCategory;
  name: string;
  description: string;
  price: string;
  unit: ServiceUnit;
  duration_days: string;
  is_active: boolean;
  is_notarial: boolean;
  sort_order: string;
};

function toPayload(d: Draft) {
  return {
    slug: d.slug.trim(),
    category: d.category,
    name: d.name.trim(),
    description: d.description.trim() || null,
    price: Number(d.price),
    unit: d.unit,
    duration_days: Number(d.duration_days),
    is_active: d.is_active,
    is_notarial: d.is_notarial,
    sort_order: Number(d.sort_order) || 0,
  };
}

function fromService(s: ServiceRow): Draft {
  return {
    slug: s.slug,
    category: s.category,
    name: s.name,
    description: s.description ?? "",
    price: String(Number(s.price)),
    unit: s.unit,
    duration_days: String(s.duration_days),
    is_active: s.is_active,
    is_notarial: s.is_notarial,
    sort_order: String(s.sort_order),
  };
}

/** Таблица услуг с инлайн-правкой цены/срока/активности и созданием новой услуги. */
export function ServicesEditor({ services, rules }: { services: ServiceRow[]; rules: Rule[] }) {
  const t = useTranslations("admin.services");
  const tCat = useTranslations("categories");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [category, setCategory] = React.useState<ServiceCategory>("translation");
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [creating, setCreating] = React.useState(false);
  const [newDraft, setNewDraft] = React.useState<Draft>({
    slug: "",
    category: "translation",
    name: "",
    description: "",
    price: "",
    unit: "document",
    duration_days: "2",
    is_active: true,
    is_notarial: false,
    sort_order: String(services.length + 1),
  });
  const [pending, start] = React.useTransition();

  const draftOf = (s: ServiceRow) => drafts[s.id] ?? fromService(s);
  const patch = (s: ServiceRow, p: Partial<Draft>) => setDrafts((d) => ({ ...d, [s.id]: { ...draftOf(s), ...p } }));

  const save = (id: string | null, d: Draft, after?: () => void) =>
    start(async () => {
      const r = await saveServiceAction(id, toPayload(d));
      if (r.ok) {
        toast.success(r.message ?? tCommon("saved"));
        if (id) setDrafts(({ [id]: _, ...rest }) => rest);
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });

  const list = services.filter((s) => s.category === category);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              "min-h-9 rounded-full border px-3.5 text-sm font-bold",
              category === c ? "border-brand-800 bg-brand-800 text-white" : "border-input bg-white text-brand-800",
            )}
          >
            {tCat(c)} · {services.filter((s) => s.category === c).length}
          </button>
        ))}
        <Button className="ml-auto" onClick={() => setCreating(true)}>
          <Plus /> {t("newService")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-3">{t("colService")}</th>
              <th className="px-4 py-3">{t("colUnit")}</th>
              <th className="px-4 py-3">{t("colDays")}</th>
              <th className="px-4 py-3">{t("colPrice")}</th>
              <th className="px-4 py-3">{t("colActive")}</th>
              <th className="px-4 py-3">{t("colRules")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const d = draftOf(s);
              const dirty = Boolean(drafts[s.id]);
              return (
                <tr key={s.id} className={cn("border-t", !d.is_active && "opacity-60")}>
                  <td className="px-4 py-2.5">
                    <div className="font-bold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.slug}
                      {s.is_notarial && ` · ${t("notaryIncluded")}`}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{t(`units.${s.unit}`)}</td>
                  <td className="px-4 py-2.5">
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={d.duration_days}
                      onChange={(e) => patch(s, { duration_days: e.target.value })}
                      className="h-9 w-20"
                      aria-label={t("daysOf", { name: s.name })}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      value={d.price}
                      onChange={(e) => patch(s, { price: e.target.value })}
                      className="h-9 w-28"
                      aria-label={t("priceOf", { name: s.name })}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={d.is_active}
                      onChange={(e) => patch(s, { is_active: e.target.checked })}
                      className="h-5 w-5 accent-brand-800"
                      aria-label={t("activeOf", { name: s.name })}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{ruleText(rules.filter((r) => r.service_id === s.id), (k, v) => t(`rules.${k}`, v))}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || pending} onClick={() => save(s.id, d)}>
                      {tCommon("save")}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("newService")}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save(null, newDraft, () => setCreating(false));
            }}
          >
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="n-name">{t("name")}</Label>
              <Input id="n-name" required value={newDraft.name} onChange={(e) => setNewDraft({ ...newDraft, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="n-slug">{t("slug")}</Label>
              <Input
                id="n-slug"
                required
                pattern="[a-z0-9-]+"
                value={newDraft.slug}
                onChange={(e) => setNewDraft({ ...newDraft, slug: e.target.value.toLowerCase() })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="n-cat">{t("category")}</Label>
              <select
                id="n-cat"
                value={newDraft.category}
                onChange={(e) => setNewDraft({ ...newDraft, category: e.target.value as ServiceCategory })}
                className="h-10 w-full rounded-md border bg-white px-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {tCat(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="n-price">{t("colPrice")}</Label>
              <Input id="n-price" type="number" min={0} required value={newDraft.price} onChange={(e) => setNewDraft({ ...newDraft, price: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="n-unit">{t("colUnit")}</Label>
              <select
                id="n-unit"
                value={newDraft.unit}
                onChange={(e) => setNewDraft({ ...newDraft, unit: e.target.value as ServiceUnit })}
                className="h-10 w-full rounded-md border bg-white px-2 text-sm"
              >
                <option value="page">{t("units.page")}</option>
                <option value="document">{t("units.document")}</option>
                <option value="item">{t("units.item")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="n-days">{t("workingDays")}</Label>
              <Input id="n-days" type="number" min={1} max={30} value={newDraft.duration_days} onChange={(e) => setNewDraft({ ...newDraft, duration_days: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={newDraft.is_notarial} onChange={(e) => setNewDraft({ ...newDraft, is_notarial: e.target.checked })} />
              {t("notaryInPrice")}
            </label>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="n-desc">{t("descriptionLabel")}</Label>
              <Input id="n-desc" value={newDraft.description} onChange={(e) => setNewDraft({ ...newDraft, description: e.target.value })} />
            </div>
            <Button type="submit" disabled={pending} className="sm:col-span-2">
              {t("addService")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
