/** Манат Туркменистана. Числовые цены не конвертируются по курсу. */
export const CURRENCY_CODE = "TMT";
const moneyFormatter = new Intl.NumberFormat("tk-TM", { maximumFractionDigits: 2 });
const centsFormatter = new Intl.NumberFormat("tk-TM", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export function formatMoney(value: number, currency = CURRENCY_CODE): string {
  return `${moneyFormatter.format(value)} ${currency === CURRENCY_CODE ? "manat" : currency}`;
}
export function formatMoneyCents(value: number, currency = CURRENCY_CODE): string {
  return `${centsFormatter.format(value)} ${currency === CURRENCY_CODE ? "manat" : currency}`;
}
export function formatMoneyShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${moneyFormatter.format(value / 1_000_000)} mln manat`;
  if (Math.abs(value) >= 1_000) return `${moneyFormatter.format(value / 1_000)} müň manat`;
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
