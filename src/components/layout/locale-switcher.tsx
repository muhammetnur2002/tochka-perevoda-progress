"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { setLocaleAction } from "@/i18n/actions";
import { LOCALE_NAMES, SITE_LOCALES, STAFF_LOCALES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Переключатель языка интерфейса. variant="staff" — только 3 языка CRM
 * (русский, английский, туркменский).
 */
export function LocaleSwitcher({ variant = "site", className }: { variant?: "site" | "staff"; className?: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  const current = useLocale();
  const [pending, start] = React.useTransition();
  const locales: readonly Locale[] = variant === "staff" ? STAFF_LOCALES : SITE_LOCALES;

  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">{t("language")}</span>
      <Globe className="pointer-events-none absolute left-2.5 h-4 w-4 opacity-70" aria-hidden />
      <select
        value={locales.includes(current as Locale) ? current : "ru"}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setLocaleAction(e.target.value);
            router.refresh();
          })
        }
        className="h-10 cursor-pointer appearance-none rounded-md border border-input bg-background py-0 pl-8 pr-3 text-sm font-semibold text-inherit"
      >
        {locales.map((l) => (
          <option key={l} value={l} className="text-slate-900">
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
