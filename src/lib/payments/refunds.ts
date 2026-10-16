import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { notifyRefund } from "@/lib/notifications";
import type { RefundInput } from "@/lib/validation/payment";
import type { RefundRow } from "@/types/database.types";
import { getPaymentProvider } from "./index";
import { MockPaymentProvider } from "./mock";
import type { ProviderRefund } from "./provider";

/**
 * Возвраты. Полный или частичный; сумма возвратов по платежу не превышает сам платёж.
 *  • ЮKassa — возврат через API (статус pending → succeeded по вебхуку refund.succeeded);
 *  • mock — мгновенно;
 *  • ручные платежи (наличные/терминал в точке) — менеджер вернул деньги на месте,
 *    фиксируем возврат.
 * paid_amount заказа пересчитывает триггер (платежи − успешные возвраты).
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** После успешного возврата: платёж возвращён целиком → статус refunded; уведомляем клиента. */
async function finalizeSucceeded(refund: Pick<RefundRow, "id" | "payment_id" | "order_id" | "amount">): Promise<void> {
  const admin = createAdminClient();
  const [{ data: payment }, { data: refunds }] = await Promise.all([
    admin.from("payments").select("id, amount, status").eq("id", refund.payment_id).maybeSingle(),
    admin.from("refunds").select("amount").eq("payment_id", refund.payment_id).eq("status", "succeeded"),
  ]);
  if (payment && payment.status === "succeeded") {
    const total = (refunds ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
    if (total >= Number(payment.amount) - 0.009) {
      await admin.from("payments").update({ status: "refunded" }).eq("id", payment.id).eq("status", "succeeded");
    }
  }
  notifyRefund(refund.order_id, Number(refund.amount)).catch((e: unknown) =>
    logger.error("Уведомление о возврате не отправлено", { error: (e as Error).message }),
  );
}

/** Сколько ещё можно вернуть по платежу (учитываются и ожидающие возвраты). */
export async function refundableAmount(paymentId: string): Promise<number> {
  const admin = createAdminClient();
  const [{ data: payment }, { data: refunds }] = await Promise.all([
    admin.from("payments").select("amount").eq("id", paymentId).maybeSingle(),
    admin.from("refunds").select("amount").eq("payment_id", paymentId).in("status", ["pending", "succeeded"]),
  ]);
  if (!payment) return 0;
  return round2(Number(payment.amount) - (refunds ?? []).reduce((s, r) => s + Number(r.amount), 0));
}

/** Менеджер: возврат по платежу. */
export async function refundPayment(
  paymentId: string,
  input: RefundInput,
  actorId: string,
): Promise<{ refundId: string; status: RefundRow["status"] }> {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, order_id, amount, status, provider, provider_payment_id, order:orders(public_number)")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) throw notFound("Платёж не найден");
  if (payment.status !== "succeeded") throw conflict("Вернуть можно только успешный платёж");

  const amount = round2(input.amount);
  const refundable = await refundableAmount(paymentId);
  if (amount > refundable + 0.009) {
    throw badRequest(`Можно вернуть не больше ${refundable.toFixed(2)} ₽ по этому платежу`);
  }

  let result: ProviderRefund;
  let provider: string;
  if (payment.provider === "yookassa") {
    const yk = getPaymentProvider();
    if (yk.name !== "yookassa" || !payment.provider_payment_id) {
      throw conflict("Возврат через ЮKassa недоступен: не заданы ключи ЮKassa");
    }
    provider = "yookassa";
    result = await yk.createRefund({
      providerPaymentId: payment.provider_payment_id,
      amount,
      currency: "RUB",
      idempotenceKey: randomUUID(),
      description: `Возврат по заказу ${payment.order?.public_number ?? ""}`.trim(),
    });
  } else if (payment.provider === "mock") {
    provider = "mock";
    result = await new MockPaymentProvider().createRefund({
      providerPaymentId: payment.provider_payment_id ?? payment.id,
      amount,
      currency: "RUB",
      idempotenceKey: randomUUID(),
      description: "mock",
    });
  } else {
    // наличные / терминал / счёт: деньги вернул менеджер, провайдера нет
    provider = "manual";
    result = { providerRefundId: `manual-${randomUUID()}`, status: "succeeded", amount, raw: { manual: true } };
  }

  const { data: refund, error } = await admin
    .from("refunds")
    .insert({
      payment_id: payment.id,
      order_id: payment.order_id,
      amount,
      reason: input.reason?.trim() || null,
      status: result.status,
      provider,
      provider_refund_id: result.providerRefundId,
      created_by: actorId,
    })
    .select("id, payment_id, order_id, amount, status")
    .single();
  if (error) throw error;

  if (refund.status === "succeeded") await finalizeSucceeded(refund);
  return { refundId: refund.id, status: refund.status };
}

/** Вебхук ЮKassa refund.succeeded / refund.canceled: перезапрашиваем возврат и применяем статус. */
export async function handleRefundWebhook(providerRefundId: string): Promise<{ changed: boolean }> {
  const provider = getPaymentProvider();
  if (provider.name !== "yookassa") throw badRequest("Вебхуки принимаются только для ЮKassa");

  const admin = createAdminClient();
  const { data: refund } = await admin
    .from("refunds")
    .select("id, payment_id, order_id, amount, status")
    .eq("provider_refund_id", providerRefundId)
    .maybeSingle();
  if (!refund) throw notFound("Возврат не найден");

  const fetched = await provider.getRefund(providerRefundId);
  if (fetched.amount !== null && Math.abs(fetched.amount - Number(refund.amount)) > 0.009) {
    logger.error("Сумма возврата у провайдера не совпадает", { providerRefundId });
    throw conflict("Сумма возврата не совпадает");
  }
  if (fetched.status === refund.status || refund.status === "succeeded") return { changed: false };

  const { error } = await admin
    .from("refunds")
    .update({ status: fetched.status })
    .eq("id", refund.id)
    .eq("status", refund.status);
  if (error) throw error;
  if (fetched.status === "succeeded") await finalizeSucceeded(refund);
  return { changed: true };
}
