"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveOfficeAction } from "@/app/admin/actions";
import type { OfficeRow } from "@/types/database.types";
import { cn } from "@/lib/utils";

type Draft = {
  name: string;
  address: string;
  hours: string;
  phone: string;
  is_active: boolean;
  sort_order: string;
};

const fromOffice = (o: OfficeRow): Draft => ({
  name: o.name,
  address: o.address,
  hours: o.hours ?? "",
  phone: o.phone ?? "",
  is_active: o.is_active,
  sort_order: String(o.sort_order),
});

const toPayload = (d: Draft) => ({
  name: d.name.trim(),
  address: d.address.trim(),
  hours: d.hours.trim() || null,
  phone: d.phone.trim() || null,
  is_active: d.is_active,
  sort_order: Math.max(0, Math.round(Number(d.sort_order) || 0)),
});

function OfficeFields({
  id,
  draft,
  onChange,
}: {
  id: string;
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const t = useTranslations("admin.offices");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor={`${id}-name`}>{t("name")}</Label>
        <Input id={`${id}-name`} required minLength={2} maxLength={100} value={draft.name} onChange={(e) => onChange({ name: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-address`}>{t("address")}</Label>
        <Input
          id={`${id}-address`}
          required
          minLength={5}
          maxLength={200}
          value={draft.address}
          onChange={(e) => onChange({ address: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-hours`}>{t("hours")}</Label>
        <Input
          id={`${id}-hours`}
          maxLength={200}
          value={draft.hours}
          placeholder={t("hoursPlaceholder")}
          onChange={(e) => onChange({ hours: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-phone`}>{t("phone")}</Label>
        <Input
          id={`${id}-phone`}
          maxLength={40}
          inputMode="tel"
          value={draft.phone}
          placeholder="+7 (843) ___-__-__"
          onChange={(e) => onChange({ phone: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-sort`}>{t("sortOrder")}</Label>
        <Input
          id={`${id}-sort`}
          type="number"
          min={0}
          max={1000}
          className="w-28"
          value={draft.sort_order}
          onChange={(e) => onChange({ sort_order: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input
          type="checkbox"
          className="h-5 w-5 accent-brand-800"
          checked={draft.is_active}
          onChange={(e) => onChange({ is_active: e.target.checked })}
        />
        {t("active")}
      </label>
    </div>
  );
}

/** Точки приёма документов: правка адреса, часов работы, телефона; админ добавляет новые. */
export function OfficesEditor({ offices, canCreate }: { offices: OfficeRow[]; canCreate: boolean }) {
  const t = useTranslations("admin.offices");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [creating, setCreating] = React.useState(false);
  const emptyDraft = React.useCallback(
    (): Draft & { slug: string } => ({
      slug: "",
      name: "",
      address: "",
      hours: "",
      phone: "",
      is_active: true,
      sort_order: String(offices.length + 1),
    }),
    [offices.length],
  );
  const [newDraft, setNewDraft] = React.useState(emptyDraft);
  const [pending, start] = React.useTransition();

  const draftOf = (o: OfficeRow) => drafts[o.id] ?? fromOffice(o);
  const patch = (o: OfficeRow, p: Partial<Draft>) => setDrafts((d) => ({ ...d, [o.id]: { ...draftOf(o), ...p } }));

  const save = (id: string | null, payload: unknown, after?: () => void) =>
    start(async () => {
      const r = await saveOfficeAction(id, payload);
      if (r.ok) {
        toast.success(r.message ?? tCommon("saved"));
        if (id) setDrafts(({ [id]: _, ...rest }) => rest);
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setNewDraft(emptyDraft());
              setCreating(true);
            }}
          >
            <Plus /> {t("newOffice")}
          </Button>
        </div>
      )}

      {offices.length === 0 && <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">{t("empty")}</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        {offices.map((o) => {
          const d = draftOf(o);
          const dirty = Boolean(drafts[o.id]);
          return (
            <form
              key={o.id}
              className={cn("space-y-3 rounded-2xl border bg-card p-4", !d.is_active && "opacity-70")}
              onSubmit={(e) => {
                e.preventDefault();
                save(o.id, toPayload(d));
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-bold text-brand-800">
                  <MapPin className="h-4 w-4" aria-hidden />
                  {o.name}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {o.city} · {o.slug}
                  {!o.is_active && ` · ${t("inactive")}`}
                </span>
              </div>
              <OfficeFields id={`office-${o.id}`} draft={d} onChange={(p) => patch(o, p)} />
              <div className="flex gap-2">
                <Button type="submit" size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || pending}>
                  {tCommon("save")}
                </Button>
                {dirty && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setDrafts(({ [o.id]: _, ...rest }) => rest)}
                  >
                    {tCommon("cancel")}
                  </Button>
                )}
              </div>
            </form>
          );
        })}
      </div>

      {canCreate && (
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("newOffice")}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const { slug, ...rest } = newDraft;
                save(null, { slug: slug.trim(), ...toPayload(rest) }, () => setCreating(false));
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="new-office-slug">{t("slug")}</Label>
                <Input
                  id="new-office-slug"
                  required
                  pattern="[a-z0-9-]+"
                  minLength={2}
                  maxLength={60}
                  value={newDraft.slug}
                  onChange={(e) => setNewDraft({ ...newDraft, slug: e.target.value.toLowerCase() })}
                />
                <p className="text-xs text-muted-foreground">{t("slugHint")}</p>
              </div>
              <OfficeFields id="new-office" draft={newDraft} onChange={(p) => setNewDraft({ ...newDraft, ...p })} />
              <Button type="submit" disabled={pending} className="w-full">
                {t("addOffice")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
