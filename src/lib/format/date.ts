/** Форматирование дат и времени (ru-RU). */

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** «15 октября 2026 г.» */
export function formatDate(date: Date | string | number): string {
  return dateFormatter.format(new Date(date));
}

/** «15.10.2026» */
export function formatDateShort(date: Date | string | number): string {
  return shortDateFormatter.format(new Date(date));
}

/** «15.10.2026, 14:30» */
export function formatDateTime(date: Date | string | number): string {
  return dateTimeFormatter.format(new Date(date));
}

/** Относительное время «2 часа назад». */
export function timeAgo(date: Date | string | number): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн. назад`;
  return formatDateShort(date);
}

/** Идентичны ли даты (без времени). */
export function isSameDay(a: Date | string, b: Date | string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}
