/**
 * Расчёт рабочих дней по производственному календарю (выходные + праздники из
 * settings.holidays в формате 'YYYY-MM-DD'). Все календарные даты считаются по
 * московскому времени (UTC+3, без перехода на летнее время) — независимо от
 * часового пояса сервера.
 */

/** Смещение Москвы относительно UTC, мс. */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

/** Час окончания рабочего дня (дедлайн выдачи), МСК. */
export const CLOSING_HOUR_MSK = 19;

/** Календарная дата МСК как 'YYYY-MM-DD'. */
export function mskDateKey(date: Date): string {
  return new Date(date.getTime() + MSK_OFFSET_MS).toISOString().slice(0, 10);
}

/** День недели по МСК: 0 — воскресенье … 6 — суббота. */
function mskWeekday(date: Date): number {
  return new Date(date.getTime() + MSK_OFFSET_MS).getUTCDay();
}

export function isWeekend(date: Date): boolean {
  const day = mskWeekday(date);
  return day === 0 || day === 6;
}

export function isHoliday(date: Date, holidays: string[]): boolean {
  return holidays.includes(mskDateKey(date));
}

export function isBusinessDay(date: Date, holidays: string[]): boolean {
  return !isWeekend(date) && !isHoliday(date, holidays);
}

/** Момент закрытия (19:00 МСК) в календарный день МСК, которому принадлежит date. */
function closingTime(date: Date): Date {
  const key = mskDateKey(date);
  return new Date(`${key}T${String(CLOSING_HOUR_MSK).padStart(2, "0")}:00:00+03:00`);
}

/**
 * Дедлайн: start + businessDays рабочих дней, к 19:00 МСК.
 * businessDays = 0 — «в день обращения»: сегодня, если сегодня рабочий день,
 * иначе ближайший рабочий.
 */
export function addBusinessDays(start: Date, businessDays: number, holidays: string[]): Date {
  let cursor = closingTime(start);

  if (businessDays <= 0) {
    while (!isBusinessDay(cursor, holidays)) {
      cursor = new Date(cursor.getTime() + MS_IN_DAY);
    }
    return cursor;
  }

  let added = 0;
  while (added < businessDays) {
    cursor = new Date(cursor.getTime() + MS_IN_DAY);
    if (isBusinessDay(cursor, holidays)) added += 1;
  }
  return cursor;
}
