"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/components/cart/cart-provider";
import { usePromoQuote } from "@/hooks/use-pricing";
import type { DeliveryType } from "@/types/database.types";

/** Единый вид кода: без пробелов, верхний регистр — как он хранится на сервере. */
const normalize = (raw: string) => raw.replace(/\s+/g, "").toUpperCase();

/**
 * Поле «Промокод». Проверку и размер скидки определяет сервер; автоскидки
 * применяются без ввода кода — их название показываем отдельной строкой.
 */
export function PromoField({ deliveryType }: { deliveryType?: DeliveryType }) {
  const t = useTranslations("promo");
  const { options, setPromoCode, items } = useCart();
  const { rule, auto, error, loading } = usePromoQuote({ deliveryType });
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  if (items.length === 0) return null;

  const applied = options.promoCode && rule && !auto;
  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalize(draft);
    if (code) setPromoCode(code);
  };

  return (
    <div className="space-y-2 text-sm">
      {auto && rule && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 font-medium text-emerald-800">
          <Tag className="h-4 w-4 shrink-0" /> {t("autoApplied", { name: rule.name })}
        </p>
      )}

      {applied ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 font-medium text-emerald-800">
          <span className="flex min-w-0 items-center gap-2">
            <Tag className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("applied", { code: options.promoCode ?? "" })}</span>
          </span>
          <button
            type="button"
            aria-label={t("remove")}
            onClick={() => {
              setPromoCode(null);
              setDraft("");
            }}
            className="rounded p-1 hover:bg-emerald-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : open || options.promoCode ? (
        <form onSubmit={apply} className="space-y-1.5">
          <label htmlFor="promo-code" className="font-semibold text-slate-700">
            {t("label")}
          </label>
          <div className="flex gap-2">
            <Input
              id="promo-code"
              value={draft || options.promoCode || ""}
              onChange={(e) => {
                setDraft(e.target.value);
                if (options.promoCode) setPromoCode(null);
              }}
              placeholder={t("placeholder")}
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={40}
              className="h-11 uppercase"
              aria-invalid={!!error}
            />
            <Button type="submit" variant="outline" className="h-11" disabled={!normalize(draft) || loading}>
              {loading ? <Loader2 className="animate-spin" /> : t("apply")}
            </Button>
          </div>
          {error && !loading && (
            <p role="alert" className="font-medium text-destructive">
              {t(`errors.${error}`)}
            </p>
          )}
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="font-semibold text-brand-500 underline">
          {t("toggle")}
        </button>
      )}
    </div>
  );
}
