"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, MapPin } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { useCatalog } from "@/hooks/use-catalog";
import { useLanguageName } from "@/i18n/names";
import { cn } from "@/lib/utils";

/**
 * Выбор точки приёма: клиент выбирает ближайший пункт в Казани, куда принесёт
 * документы и где заберёт готовый заказ. Если точка одна — выбирается сама.
 */
export function OfficePicker({ compact = false, error }: { compact?: boolean; error?: string }) {
  const t = useTranslations("offices");
  const { data } = useCatalog();
  const { options, setOfficeId } = useCart();
  const offices = React.useMemo(() => data?.offices ?? [], [data?.offices]);

  // Сбрасываем выбор, если точка закрыта; единственную точку выбираем сами
  React.useEffect(() => {
    // Меняем состояние только при реальной разнице — иначе новый объект корзины
    // перезапускает эффект и он бесконечно затирает выбор клиента
    if (!offices.length) return;
    if (offices.length === 1) {
      if (options.officeId !== offices[0]!.id) setOfficeId(offices[0]!.id);
      return;
    }
    if (options.officeId && !offices.some((o) => o.id === options.officeId)) setOfficeId(null);
  }, [offices, options.officeId, setOfficeId]);

  return (
    <fieldset className="space-y-2" aria-invalid={!!error}>
      <legend className="mb-1 text-sm font-semibold text-slate-700">{t("choose")}</legend>
      {!compact && <p className="mb-2 text-xs text-muted-foreground">{t("hint")}</p>}
      <div className="grid gap-2">
        {offices.map((o) => {
          const on = options.officeId === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => setOfficeId(o.id)}
              className={cn(
                "flex min-h-14 w-full items-start gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors",
                on ? "border-2 border-gold-400 bg-gold-50" : "border border-input bg-background hover:border-brand-800",
              )}
            >
              <MapPin className={cn("mt-0.5 h-5 w-5 shrink-0", on ? "text-gold-800" : "text-brand-500")} aria-hidden />
              <span className="min-w-0">
                <span className="block font-bold text-brand-800">{o.address}</span>
                <span className="block text-xs text-muted-foreground">
                  {[o.hours ?? t("hoursTbd"), o.phone].filter(Boolean).join(" · ")}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Пара языков: язык документа (14 исходных) → русский (фиксированно). */
export function LanguagePairPicker({ error }: { error?: string }) {
  const t = useTranslations("languagePair");
  const langName = useLanguageName();
  const { data } = useCatalog();
  const { options, setLanguageFrom } = useCart();
  const sources = (data?.languages ?? []).filter((l) => l.is_source);
  const ru = (data?.languages ?? []).find((l) => l.code === "ru");

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-semibold text-slate-700">{t("title")}</legend>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-44 space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">{t("from")}</span>
          <select
            value={options.languageFrom ?? ""}
            onChange={(e) => setLanguageFrom(e.target.value || null)}
            aria-invalid={!!error}
            className={cn(
              "flex h-11 w-full rounded-md border bg-background px-3 text-sm font-semibold",
              error ? "border-destructive" : "border-input",
            )}
          >
            <option value="">{t("choose")}</option>
            {sources.map((l) => (
              <option key={l.id} value={l.id}>
                {langName(l.code, l.name)}
              </option>
            ))}
          </select>
        </label>
        <ArrowRight className="mb-3 h-5 w-5 shrink-0 text-brand-500" aria-hidden />
        <label className="min-w-0 flex-1 basis-32 space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">{t("to")}</span>
          <span className="flex h-11 items-center rounded-md border border-input bg-muted px-3 text-sm font-bold text-brand-800">
            {langName("ru", ru?.name ?? "Русский")}
          </span>
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      )}
    </fieldset>
  );
}
