"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { COMPANY } from "@/lib/config/constants";

interface LogoProps {
  className?: string;
  /** full — эмблема + надпись (шапка), mark — только эмблема. */
  variant?: "full" | "mark";
  /** Высота эмблемы, px. */
  size?: number;
  /** Светлая надпись для тёмного фона. */
  inverted?: boolean;
}

/**
 * Логотип: растровая эмблема (public/brand/logo-mark.png, из исходного JPG) и
 * надпись «ТОЧКА ПЕРЕВОДА / ПРОГРЕСС» текстом — чёткая на любом размере.
 */
export function Logo({ className, variant = "full", size = 44, inverted = false }: LogoProps) {
  const t = useTranslations("common");
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)} aria-label={`${COMPANY.name} — ${t("toHome")}`}>
      <Image src="/brand/logo-mark.png" alt="" width={size} height={size} priority className="shrink-0 object-contain" style={{ width: size, height: size }} />
      {variant === "full" && (
        <span className="flex flex-col leading-[1.05]">
          <span className={cn("text-base font-extrabold tracking-wide", inverted ? "text-white" : "text-brand-800")}>ТОЧКА ПЕРЕВОДА</span>
          <span className={cn("text-[11px] font-bold tracking-[0.32em]", inverted ? "text-gold-200" : "text-gold-800")}>ПРОГРЕСС</span>
        </span>
      )}
    </Link>
  );
}
