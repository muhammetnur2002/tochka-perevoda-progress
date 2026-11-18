"use client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/utils";
interface LogoProps {
  className?: string;
  variant?: "full" | "mark";
  size?: number;
  inverted?: boolean;
}
/** Пустое место для будущего логотипа; исходные файлы сохранены. */
export function Logo({ className, size = 44 }: LogoProps) {
  const t = useTranslations("common");
  return (
    <Link
      href="/"
      aria-label={t("toHome")}
      className={cn("inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
