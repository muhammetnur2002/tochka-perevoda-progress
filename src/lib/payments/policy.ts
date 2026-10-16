/**
 * Схема оплаты (общая для сервера и сайта; единственный источник правил).
 *
 *  • Заказ от порога (по умолчанию 3000 ₽) и любой нотариальный — предоплата
 *    `prepaymentPercent` % при оформлении, остаток — при получении (в точке или по ссылке).
 *  • Остальные (мелкие) заказы — 100% онлайн.
 *  • Если уже что-то оплачено — следующий платёж равен остатку.
 *  • Оплата в точке (наличные/терминал) — для клиентов без российской карты.
 */

export interface PaymentPolicy {
  /** Доля предоплаты, % (1–100). */
  prepaymentPercent: number;
  /** С какой суммы заказа действует предоплата вместо полной оплаты, ₽. */
  prepaymentThreshold: number;
  /** Можно ли выбрать «оплата в точке». */
  payInOffice: boolean;
}

export const DEFAULT_PAYMENT_POLICY: PaymentPolicy = {
  prepaymentPercent: 50,
  prepaymentThreshold: 3000,
  payInOffice: true,
};

function num(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

/** Преобразует настройки из БД (settings) в политику оплаты. */
export function policyFromSettings(raw?: Record<string, unknown>): PaymentPolicy {
  const percent = num(raw?.prepayment_percent, DEFAULT_PAYMENT_POLICY.prepaymentPercent);
  return {
    prepaymentPercent: percent > 0 && percent <= 100 ? percent : 100,
    prepaymentThreshold: Math.max(0, num(raw?.prepayment_threshold, DEFAULT_PAYMENT_POLICY.prepaymentThreshold)),
    payInOffice: raw?.pay_in_office_enabled === undefined ? true : raw.pay_in_office_enabled !== false && raw.pay_in_office_enabled !== "false",
  };
}

export interface DueInput {
  /** Стоимость заказа. */
  total: number;
  /** Уже оплачено (за вычетом возвратов). */
  paid: number;
  /** Есть нотариальные услуги или заверение. */
  hasNotarial: boolean;
}

export interface DueNow {
  /** Сколько платить сейчас. */
  amount: number;
  /** Какая доля от стоимости заказа. */
  percent: number;
  /** Что останется оплатить позже. */
  rest: number;
  /** Это предоплата (а не полная оплата)? */
  isPrepayment: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Сколько клиент платит прямо сейчас по политике. */
export function dueNow(policy: PaymentPolicy, input: DueInput): DueNow {
  const total = round2(Math.max(0, input.total));
  const remaining = round2(Math.max(0, total - Math.max(0, input.paid)));
  if (remaining <= 0) return { amount: 0, percent: 100, rest: 0, isPrepayment: false };

  // Уже платил — остаток целиком
  if (input.paid > 0) return { amount: remaining, percent: 100, rest: 0, isPrepayment: false };

  const qualifies = total >= policy.prepaymentThreshold || input.hasNotarial;
  const percent = qualifies ? policy.prepaymentPercent : 100;
  const amount = percent >= 100 ? remaining : Math.min(remaining, Math.max(1, round2((remaining * percent) / 100)));
  return { amount, percent, rest: round2(remaining - amount), isPrepayment: amount < remaining };
}
