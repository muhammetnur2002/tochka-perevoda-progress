"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { assignExecutor, changeOrderStatus } from "@/lib/services/order-admin";
import { recordManualPayment } from "@/lib/payments";
import { serviceSchema } from "@/lib/validation/service";
import { manualPaymentSchema } from "@/lib/validation/payment";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, OrderStatus, UserRole } from "@/types/database.types";

/**
 * Server Actions админки. Каждое действие проверяет право по матрице ролей
 * и выполняется под сессией менеджера (RLS). Возвращают {ok} | {error}
 * для показа тоста в интерфейсе.
 */

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const message = await fn();
    return { ok: true, message: message ?? undefined };
  } catch (err) {
    const e = err as { message?: string };
    return { ok: false, error: e.message ?? "Ошибка" };
  }
}

const statusSchema = z.enum(["new", "confirmed", "in_progress", "ready", "issued", "completed", "cancelled"]);

export async function setOrderStatusAction(orderId: string, status: OrderStatus, comment?: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermission("order.change_status");
    await changeOrderStatus(actor.supabase, z.string().uuid().parse(orderId), statusSchema.parse(status), comment);
    revalidatePath(`/admin/orders/${orderId}`);
    return "Статус обновлён, клиент уведомлён";
  });
}

export async function setOrderDeadlineAction(orderId: string, deadline: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermission("order.change_status");
    const iso = new Date(deadline).toISOString();
    const { error } = await actor.supabase.from("orders").update({ deadline: iso }).eq("id", orderId);
    if (error) throw error;
    revalidatePath(`/admin/orders/${orderId}`);
  });
}

export async function assignExecutorAction(input: {
  orderId: string;
  userId: string;
  role: "translator" | "notary" | "printer" | "manager";
  force?: boolean;
}): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermission("order.assign");
    const r = await assignExecutor(actor.supabase, { ...input, assignedBy: actor.id });
    revalidatePath(`/admin/orders/${input.orderId}`);
    return r.overloaded ? "Назначено (исполнитель перегружен)" : "Исполнитель назначен";
  });
}

export async function recordPaymentAction(orderId: string, input: { amount: number; method: string }): Promise<ActionResult> {
  return run(async () => {
    await requirePermission("order.view_payments");
    const parsed = manualPaymentSchema.parse(input);
    await recordManualPayment(orderId, parsed.amount, parsed.method);
    revalidatePath(`/admin/orders/${orderId}`);
    return "Оплата отмечена";
  });
}

export async function saveServiceAction(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermission("service.edit");
    const data = serviceSchema.parse(input);
    const { error } = id
      ? await actor.supabase.from("services").update(data).eq("id", id)
      : await actor.supabase.from("services").insert(data);
    if (error) throw error;
    revalidatePath("/admin/services");
    return id ? "Услуга сохранена" : "Услуга добавлена";
  });
}

export async function saveSettingAction(key: string, value: Json): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermission("settings.edit");
    const allowed = new Set([
      "urgency",
      "notary_fee",
      "delivery_price",
      "prepayment_percent",
      "holidays",
      "notifications",
      "file_retention_days",
      "volume_discounts",
      "company",
    ]);
    if (!allowed.has(key)) throw new Error("Неизвестная настройка");
    const { error } = await actor.supabase
      .from("settings")
      .update({ value, updated_by: actor.id })
      .eq("key", key);
    if (error) throw error;
    revalidatePath("/admin/settings");
    return "Настройка сохранена";
  });
}

export async function updateClientAction(
  clientId: string,
  input: { name: string; phone: string | null; email: string | null; inn: string | null; type: "individual" | "company" },
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermission("order.view_all");
    const { error } = await actor.supabase.from("clients").update(input).eq("id", clientId);
    if (error) throw error;
    revalidatePath(`/admin/clients/${clientId}`);
    return "Клиент сохранён";
  });
}

/** Админ: роль пользователя (выдача доступа переводчику/менеджеру). */
export async function setUserRoleAction(userId: string, role: UserRole): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermission("user.change_role");
    const parsed = z.enum(["client", "manager", "translator", "notary", "printer", "admin"]).parse(role);
    const { error } = await actor.supabase.from("users").update({ role: parsed }).eq("id", userId);
    if (error) throw error;
    // Роль хранится и в app_metadata — для JWT-claims (на случай использования в политиках)
    await createAdminClient().auth.admin.updateUserById(userId, { app_metadata: { role: parsed } });
    if (parsed === "translator") {
      await actor.supabase.from("translators").upsert({ user_id: userId }, { onConflict: "user_id" });
    }
    revalidatePath("/admin/translators");
    return "Роль изменена";
  });
}

/** Админ: выдать роль зарегистрированному пользователю по email. */
export async function grantRoleByEmailAction(email: string, role: UserRole): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermission("user.change_role");
    const { data: user } = await actor.supabase
      .from("users")
      .select("id")
      // Supabase Auth хранит email в нижнем регистре; ilike не используем — «_» в нём шаблон
      .eq("email", z.string().email("Некорректный email").parse(email.trim().toLowerCase()))
      .maybeSingle();
    if (!user) throw new Error("Пользователь не найден — он должен сначала зарегистрироваться на сайте");
    const r = await setUserRoleAction(user.id, role);
    if (!r.ok) throw new Error(r.error);
    return "Роль выдана";
  });
}

export async function updateTranslatorAction(
  userId: string,
  input: { capacity_per_day: number; is_available: boolean; specialization: string | null; languages: string[] },
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermission("order.assign");
    const data = z
      .object({
        capacity_per_day: z.number().int().min(1).max(100),
        is_available: z.boolean(),
        specialization: z.string().max(200).nullable(),
        languages: z.array(z.string().uuid()).max(30),
      })
      .parse(input);
    const { error } = await actor.supabase.from("translators").update(data).eq("user_id", userId);
    if (error) throw error;
    revalidatePath("/admin/translators");
    return "Профиль исполнителя сохранён";
  });
}
