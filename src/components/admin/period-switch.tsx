import Link from "next/link";
import { cn } from "@/lib/utils";

const PERIODS = [
  { days: 7, label: "Неделя" },
  { days: 30, label: "Месяц" },
  { days: 90, label: "Квартал" },
  { days: 365, label: "Год" },
];

/** Переключатель периода отчёта (через ?days=). */
export function PeriodSwitch({ path, days }: { path: string; days: number }) {
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
          {p.label}
        </Link>
      ))}
    </div>
  );
}

export function parseDays(raw: string | undefined): number {
  const n = Number(raw);
  return [7, 30, 90, 365].includes(n) ? n : 30;
}
