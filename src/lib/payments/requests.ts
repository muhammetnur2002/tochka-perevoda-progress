import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { notifyPaymentRequest } from "@/lib/notifications";
import type { PaymentRequestInput } from "@/lib/validation/payment";
import type { PaymentRequestRow } from "@/types/database.types";

/**
 * Запросы на оплату из CRM: «ссылка на остаток» или «доплата» (срочность,
 * дополнительные страницы). Доплата сразу увеличивает стоимость заказа
 * (orders.extra_charge, итог пересчитывает БД). Клиент получает ссылку по
 * Telegram → SMS → email и платит по ней картой, СБП или QR.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CreatedPaymentRequest {
  id: string;
  url: string;
  delivered: boolean;
}

export async function createPaymentRequest(
  orderId: string,
  input: PaymentRequestInput,
  actorId: string,
): Promise<CreatedPaymentRequest> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, status, total_price, paid_amount, extra_charge")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw notFound("Заказ не найден");
  if (order.status === "cancelled") throw conflict("Заказ отменён");

  const amount = round2(input.amount);
  if (amount < 1) throw badRequest("Сумма слишком мала");
  const remaining = round2(Number(order.total_price) - Number(order.paid_amount));

  if (input.isExtra) {
    // Доплата увеличивает стоимость заказа
    const { error } = await admin
      .from("orders")
      .update({ extra_charge: round2(Number(order.extra_charge) + amount) })
      .eq("id", orderId);
    if (error) throw error;
  } else if (amount > remaining + 0.009) {
    throw badRequest(`К оплате осталось ${remaining.toFixed(2)} ₽ — выставить больше нельзя`);
  }

  const { data: request, error } = await admin
    .from("payment_requests")
    .insert({
      order_id: orderId,
      amount,
      reason: input.reason?.trim() || null,
      is_extra: input.isExtra,
      created_by: actorId,
    })
    .select("id")
    .single();
  if (error) {
    // не оставляем доплату без запроса
    if (input.isExtra) await admin.from("orders").update({ extra_charge: Number(order.extra_charge) }).eq("id", orderId);
    throw error;
  }

  const sent = await notifyPaymentRequest(orderId, request.id);
  return { id: request.id, url: sent.url, delivered: sent.delivered };
}

/** Отзывает открытый запрос; неоплаченная доплата снимается со стоимости заказа. */
export async function cancelPaymentRequest(requestId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("payment_requests")
    .select("id, order_id, amount, is_extra, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) throw notFound("Запрос не найден");
  if (request.status !== "open") throw conflict("Запрос уже оплачен или отозван");

  const { data: updated } = await admin
    .from("payment_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();
  if (!updated) throw conflict("Запрос уже обработан");

  if (request.is_extra) {
    const { data: order } = await admin.from("orders").select("extra_charge").eq("id", request.order_id).maybeSingle();
    if (order) {
      await admin
        .from("orders")
        .update({ extra_charge: Math.max(0, round2(Number(order.extra_charge) - Number(request.amount))) })
        .eq("id", request.order_id);
    }
  }
}

export interface PaymentRequestInfo {
  request: Pick<PaymentRequestRow, "id" | "amount" | "reason" | "is_extra" | "status">;
  order: { id: string; publicNumber: string; remaining: number };
}

/** Данные для страницы оплаты по ссылке (без лишнего: только сумма, причина, остаток). */
export async function getPaymentRequestInfo(requestId: string): Promise<PaymentRequestInfo & { orderId: string }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("payment_requests")
    .select("id, order_id, amount, reason, is_extra, status, order:orders(id, public_number, total_price, paid_amount)")
    .eq("id", requestId)
    .maybeSingle();
  if (!data || !data.order) throw notFound("Ссылка на оплату не найдена");
  return {
    orderId: data.order_id,
    request: { id: data.id, amount: data.amount, reason: data.reason, is_extra: data.is_extra, status: data.status },
    order: {
      id: data.order.id,
      publicNumber: data.order.public_number,
      remaining: Math.max(0, round2(Number(data.order.total_price) - Number(data.order.paid_amount))),
    },
  };
}
