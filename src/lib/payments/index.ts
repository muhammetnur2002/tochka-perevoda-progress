import "server-only";
import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CreatePaymentInput } from "@/lib/validation/payment";
import type { Json, PaymentStatus } from "@/types/database.types";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { notifyPaymentSucceeded } from "@/lib/notifications";
import { dueNow, policyFromSettings, type PaymentPolicy } from "./policy";
import type { PaymentProvider } from "./provider";
import { YookassaProvider } from "./yookassa";
import { MockPaymentProvider } from "./mock";

/**
 * Платежи: создание (карта / СБП / QR), обработка вебхука, mock-подтверждение.
 * Статус заказа и paid_amount обновляет триггер payments_after_change в БД.
 */

/** Провайдер по PAYMENT_PROVIDER; без ключей ЮKassa — всегда mock. */
export function getPaymentProvider(): PaymentProvider {
  const wantsYookassa = process.env.PAYMENT_PROVIDER === "yookassa";
  const hasKeys = Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY);
  if (wantsYookassa && hasKeys) return new YookassaProvider();
  if (wantsYookassa && !hasKeys) {
    logger.warn("PAYMENT_PROVIDER=yookassa, но ключи не заданы — используется mock-провайдер");
  }
  return new MockPaymentProvider();
}

export interface PaymentCreateResult {
  paymentId: string;
  status: PaymentStatus;
  amount: number;
  confirmationUrl: string | null;
  /** SVG QR-кода для СБП/QR (если провайдер вернул confirmation_data). */
  qrSvg: string | null;
  qrPayload: string | null;
  provider: "yookassa" | "mock";
}

/** Политика оплаты из настроек (предоплата, порог, оплата в точке). */
export async function loadPaymentPolicy(): Promise<PaymentPolicy> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("settings")
    .select("key, value")
    .in("key", ["prepayment_percent", "prepayment_threshold", "pay_in_office_enabled"]);
  return policyFromSettings(Object.fromEntries((data ?? []).map((r) => [r.key, r.value])));
}

/** Создаёт платёж по заказу: сумма по политике оплаты либо по запросу из CRM (requestId). */
export async function createOrderPayment(input: CreatePaymentInput): Promise<PaymentCreateResult> {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, public_number, status, total_price, paid_amount, notary_fee, client:clients(phone, email), items:order_items(name_snapshot, quantity, price, service:services(is_notarial))")
    .eq("id", input.orderId)
    .maybeSingle();
  if (!order) throw notFound("Заказ не найден");
  if (order.status === "cancelled") throw conflict("Заказ отменён");

  const total = Number(order.total_price);
  const remaining = Math.max(0, Math.round((total - Number(order.paid_amount)) * 100) / 100);
  if (remaining <= 0) throw conflict("Заказ уже оплачен");

  let amount: number;
  if (input.requestId) {
    // Ссылка из CRM: платим ровно запрошенную сумму (но не больше остатка)
    const { data: request } = await admin
      .from("payment_requests")
      .select("id, amount, status")
      .eq("id", input.requestId)
      .eq("order_id", order.id)
      .maybeSingle();
    if (!request) throw notFound("Запрос на оплату не найден");
    if (request.status !== "open") throw conflict("Эта ссылка на оплату уже недействительна");
    amount = Math.min(Number(request.amount), remaining);
  } else {
    const hasNotarial = Number(order.notary_fee) > 0 || (order.items ?? []).some((i) => i.service?.is_notarial);
    const policy = await loadPaymentPolicy();
    amount = dueNow(policy, { total, paid: Number(order.paid_amount), hasNotarial }).amount;
  }
  if (amount < 1) throw badRequest("Сумма платежа слишком мала");

  const provider = getPaymentProvider();
  const idempotenceKey = randomUUID();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const returnUrl = `${siteUrl}/checkout/success/${encodeURIComponent(order.public_number)}?order=${order.id}`;

  const result = await provider.createPayment({
    amount,
    currency: "RUB",
    method: input.method,
    idempotenceKey,
    returnUrl,
    description: `Заказ ${order.public_number} — «Точка Перевода Прогресс»`,
    metadata: { order_id: order.id, public_number: order.public_number },
    receipt: {
      customer: {
        phone: order.client?.phone ?? undefined,
        email: order.client?.email ?? undefined,
      },
      items: (order.items ?? []).map((i) => ({
        description: i.name_snapshot,
        quantity: i.quantity,
        // пропорционально доле предоплаты
        amount: Math.round((Number(i.price) / i.quantity) * (amount / total) * 100) / 100,
      })),
    },
  });

  const { data: payment, error } = await admin
    .from("payments")
    .insert({
      order_id: order.id,
      amount,
      currency: "RUB",
      method: input.method,
      status: result.status,
      provider: provider.name,
      provider_payment_id: result.providerPaymentId,
      idempotence_key: idempotenceKey,
      confirmation_url: result.confirmationUrl,
      request_id: input.requestId ?? null,
      raw: result.raw,
    })
    .select("id")
    .single();
  if (error) throw error;

  const qrSvg = result.confirmationData
    ? await QRCode.toString(result.confirmationData, { type: "svg", margin: 1, color: { dark: "#00214C" } })
    : null;

  return {
    paymentId: payment.id,
    status: result.status,
    amount,
    confirmationUrl: result.confirmationUrl,
    qrSvg,
    qrPayload: result.confirmationData,
    provider: provider.name,
  };
}

/**
 * Применяет фактический статус платежа (идемпотентно по provider_payment_id).
 * При переходе в succeeded уведомляет клиента.
 */
async function applyPaymentStatus(
  providerPaymentId: string,
  status: PaymentStatus,
  raw: Json,
): Promise<{ changed: boolean }> {
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("payments")
    .select("id, order_id, amount, status, request_id")
    .eq("provider_payment_id", providerPaymentId)
    .maybeSingle();
  if (!current) throw notFound("Платёж не найден");
  if (current.status === status) return { changed: false };
  // succeeded/refunded — финальные; не откатываем назад повторными уведомлениями
  if (current.status === "succeeded" && status !== "refunded") return { changed: false };

  const { error } = await admin
    .from("payments")
    .update({
      status,
      raw,
      paid_at: status === "succeeded" ? new Date().toISOString() : null,
    })
    .eq("id", current.id)
    .eq("status", current.status); // оптимистичная блокировка от гонки вебхуков
  if (error) throw error;

  if (status === "succeeded" && current.request_id) {
    await admin
      .from("payment_requests")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", current.request_id)
      .eq("status", "open");
  }

  if (status === "succeeded") {
    notifyPaymentSucceeded(current.order_id, Number(current.amount)).catch((e: unknown) =>
      logger.error("Уведомление об оплате не отправлено", { error: (e as Error).message }),
    );
  }
  return { changed: true };
}

/**
 * Вебхук ЮKassa: телу НЕ доверяем — перезапрашиваем платёж у API и сверяем сумму.
 */
export async function handlePaymentWebhook(providerPaymentId: string): Promise<{ changed: boolean }> {
  const provider = getPaymentProvider();
  if (provider.name !== "yookassa") throw badRequest("Вебхуки принимаются только для ЮKassa");

  const fetched = await provider.getPayment(providerPaymentId);
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("amount")
    .eq("provider_payment_id", providerPaymentId)
    .maybeSingle();
  if (!payment) throw notFound("Платёж не найден");
  if (fetched.amount !== null && Math.abs(fetched.amount - Number(payment.amount)) > 0.009) {
    logger.error("Сумма платежа у провайдера не совпадает", { providerPaymentId });
    throw conflict("Сумма платежа не совпадает");
  }

  const result = await applyPaymentStatus(providerPaymentId, fetched.status, fetched.raw);
  logger.info("Вебхук платежа обработан", { providerPaymentId, status: fetched.status, ...result });
  return result;
}

/** Разрешено ли mock-подтверждение (только mock-провайдер и не в проде без флага). */
export function mockPaymentsEnabled(): boolean {
  if (getPaymentProvider().name !== "mock") return false;
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENTS === "true";
}

/** Mock: имитация успешной оплаты. */
export async function confirmMockPayment(paymentId: string): Promise<void> {
  if (!mockPaymentsEnabled()) throw badRequest("Тестовая оплата отключена");
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("provider, provider_payment_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.provider !== "mock" || !payment.provider_payment_id) {
    throw notFound("Тестовый платёж не найден");
  }
  await applyPaymentStatus(payment.provider_payment_id, "succeeded", { mock: true, confirmed_at: new Date().toISOString() });
}

/** Менеджер: ручная отметка оплаты (наличные / терминал в точке / счёт). */
export async function recordManualPayment(
  orderId: string,
  amount: number,
  method: "cash" | "invoice" | "card" | "sbp",
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("payments").insert({
    order_id: orderId,
    amount,
    method,
    status: "succeeded",
    provider: "manual",
    idempotence_key: randomUUID(),
    paid_at: new Date().toISOString(),
  });
  if (error) throw error;
}
