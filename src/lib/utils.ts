import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Утилита объединения классов Tailwind (стандарт shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Форматирует байты в человекочитаемый размер. */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes) return "0 Б";
  const k = 1024;
  const sizes = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/** Безопасная проверка, что значение не null/undefined (type guard). */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/** Возвращает только определённые элементы массива. */
export function compact<T>(items: (T | null | undefined)[]): T[] {
  return items.filter(isDefined);
}
