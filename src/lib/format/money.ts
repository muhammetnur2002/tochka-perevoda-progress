/** Форматирование денежных сумм в рублях (ru-RU). */
const rubFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const rubFormatterCents = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** «1 500 ₽». */
export function formatMoney(value: number): string {
  return rubFormatter.format(value);
}

/** «1 500,00 ₽» (для сумм с копейками). */
export function formatMoneyCents(value: number): string {
  return rubFormatterCents.format(value);
}

/** Компактная сумма «1,5 тыс. ₽» для графиков. */
export function formatMoneyShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} млн ₽`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)} тыс. ₽`;
  return formatMoney(value);
}

/**
 * Округление до копеек как у numeric в PostgreSQL (половина — от нуля).
 * toPrecision(15) убирает «хвост» двоичной арифметики: 99.99 × 1.5 =
 * 149.98499999999998 → 149.99, как и round(149.985, 2) в триггере БД.
 */
export function round2(value: number): number {
  const cents = Number((Math.abs(value) * 100).toPrecision(15));
  return (Math.sign(value) * Math.round(cents)) / 100;
}
