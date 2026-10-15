import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const PERIODS = [
  { days: 7, key: "week" },
  { days: 30, key: "month" },
  { days: 90, key: "quarter" },
  { days: 365, key: "year" },
];

/** Переключатель периода отчёта (через ?days=). */
export function PeriodSwitch({ path, days }: { path: string; days: number }) {
  const t = useTranslations("admin.period");
  return (
    <div className="flex flex-wrap gap-1.5">
      {PERIODS.map((p) => (
        <Link
          key={p.days}
          href={`${path}?days=${p.days}`}
          className={cn(
            "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-bold",
            days === p.days ? "border-brand-800 bg-brand-800 text-white" : "border-input bg-white text-brand-800",
          )}
        >
          {t(p.key)}
        </Link>
      ))}
    </div>
  );
}

export function parseDays(raw: string | undefined): number {
  const n = Number(raw);
  return [7, 30, 90, 365].includes(n) ? n : 30;
}
