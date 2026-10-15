import "server-only";
import type { NextRequest } from "next/server";
import { getActor, type Actor } from "@/lib/auth/session";
import { ORDER_TOKEN_HEADER, verifyOrderToken } from "@/lib/auth/order-access";
import { isExecutorRole, isManagerRole } from "@/lib/auth/roles";
import { forbidden } from "@/lib/errors";

export type OrderAccessMode = "manager" | "owner" | "executor" | "guest";

export interface OrderAccess {
  mode: OrderAccessMode;
  actor: Actor | null;
}

/** Токен гостя из заголовка x-order-token или параметра ?token=. */
export function orderTokenFrom(req: NextRequest): string | null {
  return req.headers.get(ORDER_TOKEN_HEADER) ?? req.nextUrl.searchParams.get("token");
}

/**
 * Проверяет доступ к заказу для API: вошедший пользователь — через RLS
 * (если заказ ему виден, значит доступ есть), гость — по подписанному токену.
 */
export async function requireOrderAccess(req: NextRequest, orderId: string): Promise<OrderAccess> {
  const actor = await getActor();

  if (actor) {
    const { data: order } = await actor.supabase
      .from("orders")
      .select("id, user_id")
      .eq("id", orderId)
      .maybeSingle();
    if (order) {
      if (isManagerRole(actor.role)) return { mode: "manager", actor };
      if (order.user_id === actor.id) return { mode: "owner", actor };
      if (isExecutorRole(actor.role)) return { mode: "executor", actor };
    }
  }

  if (verifyOrderToken(orderId, orderTokenFrom(req))) return { mode: "guest", actor };
  throw forbidden("Нет доступа к этому заказу");
}
