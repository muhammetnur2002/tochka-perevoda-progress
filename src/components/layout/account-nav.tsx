"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/account", key: "orders" },
  { href: "/account/profile", key: "profile" },
  { href: "/account/data", key: "data" },
] as const;

/** Вкладки личного кабинета. */
export function AccountNav() {
  const pathname = usePathname();
  const tr = useTranslations("account");
  return (
    <nav aria-label={tr("tabsAria")} className="flex flex-wrap gap-2">
      {TABS.map((t) => {
        const active = t.href === "/account" ? pathname === "/account" || pathname.startsWith("/account/orders") : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-bold",
              active ? "border-brand-800 bg-brand-800 text-white" : "border-input bg-background text-brand-800",
            )}
          >
            {tr(`tabs.${t.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
