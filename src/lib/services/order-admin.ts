import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssignmentRole, Database, OrderStatus } from "@/types/database.types";
import { canTransition } from "@/lib/auth/roles";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { notifyOrderStatusChange } from "@/lib/notifications";
import { logger } from "@/lib/logger";

type Db = SupabaseClient<Database>;

/**
 * Операции менеджера над заказом. Все вызовы идут через клиент Supabase с
 * сессией менеджера — RLS дополнительно гарантирует права.
 */

/** Смена статуса с проверкой перехода, комментарием в историю и уведомлением клиента. */
export async function changeOrderStatus(
  db: Db,
  orderId: string,
  to: OrderStatus,
  comment?: string | null,
): Promise<{ from: OrderStatus; to: OrderStatus }> {
  const { data: order } = await db.from("orders").select("status").eq("id", orderId).maybeSingle();
  if (!order) throw notFound("Заказ не найден");
  if (!canTransition(order.status, to)) {
    throw conflict(`Нельзя перевести заказ из «${order.status}» в «${to}»`);
  }

  const { error } = await db.rpc("change_order_status", {
    p_order_id: orderId,
    p_status: to,
    p_comment: comment ?? undefined,
  });
  if (error) throw error;

  notifyOrderStatusChange(orderId).catch((e: unknown) =>
    logger.error("Не удалось уведомить клиента о статусе", { orderId, error: (e as Error).message }),
  );
  return { from: order.status, to };
}

/** Назначение исполнителя с проверкой его загрузки. */
export async function assignExecutor(
  db: Db,
  params: {
    orderId: string;
    userId: string;
    role: AssignmentRole;
    orderItemId?: string | null;
    dueAt?: string | null;
    assignedBy: string;
    force?: boolean;
  },
): Promise<{ id: string; overloaded: boolean }> {
  const { data: executor } = await db
    .from("users")
    .select("id, role, is_active")
    .eq("id", params.userId)
    .maybeSingle();
  if (!executor || !executor.is_active) throw notFound("Исполнитель не найден");
  if (params.role !== "manager" && executor.role !== params.role && executor.role !== "admin") {
    throw badRequest("Роль пользователя не совпадает с ролью назначения");
  }

  let overloaded = false;
  if (params.role === "translator") {
    const { data: t } = await db
      .from("translators")
      .select("capacity_per_day, current_load, is_available")
      .eq("user_id", params.userId)
      .maybeSingle();
    if (t) {
      overloaded = !t.is_available || t.current_load >= t.capacity_per_day;
      if (overloaded && !params.force) {
        throw conflict("Переводчик перегружен или недоступен. Подтвердите назначение.");
      }
    }
  }

  // Повторное назначение той же роли на заказ заменяет предыдущее
  await db
    .from("order_assignments")
    .update({ status: "rejected" })
    .eq("order_id", params.orderId)
    .eq("role", params.role)
    .neq("user_id", params.userId)
    .in("status", ["assigned", "accepted"]);

  const { data: existing } = await db
    .from("order_assignments")
    .select("id")
    .eq("order_id", params.orderId)
    .eq("user_id", params.userId)
    .eq("role", params.role)
    .neq("status", "rejected")
    .maybeSingle();
  if (existing) return { id: existing.id, overloaded };

  const { data: order } = await db.from("orders").select("deadline").eq("id", params.orderId).maybeSingle();
  const { data, error } = await db
    .from("order_assignments")
    .insert({
      order_id: params.orderId,
      order_item_id: params.orderItemId ?? null,
      user_id: params.userId,
      role: params.role,
      assigned_by: params.assignedBy,
      due_at: params.dueAt ?? order?.deadline ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, overloaded };
}
