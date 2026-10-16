"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z, ZodError } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { assignExecutor, changeOrderStatus } from "@/lib/services/order-admin";
import { recordManualPayment } from "@/lib/payments";
import { refundPayment } from "@/lib/payments/refunds";
import { cancelPaymentRequest, createPaymentRequest } from "@/lib/payments/requests";
import { serviceSchema } from "@/lib/validation/service";
import { manualPaymentSchema, paymentRequestSchema, refundSchema } from "@/lib/validation/payment";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, notFound } from "@/lib/errors";
import type { Json, OrderStatus, UserRole } from "@/types/database.types";

/**
 * Server Actions админки. Каждое действие проверяет право по матрице ролей
 * и выполняется под сессией менеджера (RLS). Возвращают {ok} | {error}
 * для показа тоста в интерфейсе. Тексты тостов — на языке интерфейса сотрудника.
 */

export type ActionResult =
  | { ok: true; message?: string; data?: Record<string, string | number | boolean | null> }
  | { ok: false; error: string; code?: string };

type Translator = Awaited<ReturnType<typeof getTranslations>>;

/** Ошибка с машинным кодом — интерфейс может отреагировать на неё (например, подтвердить перегрузку). */
class CodedError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

/** Переводит типовые ошибки; ошибки базы (кроме «нет прав») показываются как есть. */
function errorMessage(err: unknown, t: Translator): string {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return issue?.path.length ? t("errors.invalidField", { field: issue.path.join(".") }) : t("errors.invalid");
  }
  if (err instanceof ApiError) {
    if (err.code === "FORBIDDEN") return t("errors.forbidden");
    if (err.code === "UNAUTHORIZED") return t("errors.unauthorized");
    if (err.code === "NOT_FOUND") return t("errors.notFound");
    return err.message;
  }
  const e = err as { message?: string; code?: string };
  if (e?.code === "42501") return t("errors.forbidden");
  return e?.message ?? t("errors.generic");
}

type RunOutput = string | void | { message: string; data: Record<string, string | number | boolean | null> };

async function run(fn: (t: Translator) => Promise<RunOutput>): Promise<ActionResult> {
  const t = await getTranslations("admin.actions");
  try {
    const out = await fn(t);
    if (out && typeof out === "object") return { ok: true, message: out.message, data: out.data };
    return { ok: true, message: out ?? undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err, t), code: err instanceof CodedError ? err.code : undefined };
  }
}

const statusSchema = z.enum(["new", "confirmed", "in_progress", "ready", "issued", "completed", "cancelled"]);

export async function setOrderStatusAction(orderId: string, status: OrderStatus, comment?: string): Promise<ActionResult> {
  return run(async (t) => {
    const actor = await requirePermission("order.change_status");
    try {
      await changeOrderStatus(actor.supabase, z.string().uuid().parse(orderId), statusSchema.parse(status), comment);
    } catch (err) {
      // Недопустимый переход статуса
      if (err instanceof ApiError && err.code === "CONFLICT") throw new CodedError(t("errors.transition"), "TRANSITION");
      throw err;
    }
    revalidatePath(`/admin/orders/${orderId}`);
    return t("statusUpdated");
  });
}

export async function setOrderDeadlineAction(orderId: string, deadline: string): Promise<ActionResult> {
  return run(async (t) => {
    const actor = await requirePermission("order.change_status");
    const iso = new Date(deadline).toISOString();
    const { error } = await actor.supabase.from("orders").update({ deadline: iso }).eq("id", orderId);
    if (error) throw error;
    revalidatePath(`/admin/orders/${orderId}`);
    return t("deadlineSaved");
  });
}

export async function assignExecutorAction(input: {
  orderId: string;
  userId: string;
  role: "translator" | "notary" | "printer" | "manager";
  force?: boolean;
}): Promise<ActionResult> {
  return run(async (t) => {
    const actor = await requirePermission("order.assign");
    let overloaded = false;
    try {
      overloaded = (await assignExecutor(actor.supabase, { ...input, assignedBy: actor.id })).overloaded;
    } catch (err) {
      // assignExecutor бросает CONFLICT только при перегрузке переводчика (без force)
      if (err instanceof ApiError && err.code === "CONFLICT") throw new CodedError(t("errors.overloaded"), "OVERLOADED");
      if (err instanceof ApiError && err.code === "BAD_REQUEST") throw new CodedError(t("errors.roleMismatch"), "ROLE_MISMATCH");
      throw err;
    }
    revalidatePath(`/admin/orders/${input.orderId}`);
    return overloaded ? t("assignedOverloaded") : t("assigned");
  });
}

export async function recordPaymentAction(orderId: string, input: { amount: number; method: string }): Promise<ActionResult> {
  return run(async (t) => {
    await requirePermission("payment.manage");
    const parsed = manualPaymentSchema.parse(input);
    await recordManualPayment(orderId, parsed.amount, parsed.method);
    revalidatePath(`/admin/orders/${orderId}`);
    return t("paymentRecorded");
  });
}

/**
 * Ссылка на оплату: остаток (isExtra=false) или доплата (isExtra=true — увеличивает стоимость заказа).
 * Клиенту уходит уведомление; ссылка возвращается для копирования (data.url, data.delivered).
 */
export async function createPaymentRequestAction(orderId: string, input: unknown): Promise<ActionResult> {
  return run(async (t) => {
    const actor = await requirePermission("payment.manage");
    const parsed = paymentRequestSchema.parse(input);
    const created = await createPaymentRequest(z.string().uuid().parse(orderId), parsed, actor.id);
    revalidatePath(`/admin/orders/${orderId}`);
    return {
      message: created.delivered ? t("paymentRequestSent") : t("paymentRequestCreated"),
      data: { url: created.url, delivered: created.delivered },
    };
  });
}

/** Отозвать открытую ссылку на оплату (неоплаченная доплата снимается со стоимости заказа). */
export async function cancelPaymentRequestAction(orderId: string, requestId: string): Promise<ActionResult> {
  return run(async (t) => {
    await requirePermission("payment.manage");
    await cancelPaymentRequest(z.string().uuid().parse(requestId));
    revalidatePath(`/admin/orders/${orderId}`);
    return t("paymentRequestCancelled");
  });
}

/** Возврат по платежу (полный или частичный). */
export async function refundPaymentAction(orderId: string, paymentId: string, input: unknown): Promise<ActionResult> {
  return run(async (t) => {
    const actor = await requirePermission("payment.manage");
    const parsed = refundSchema.parse(input);
    const res = await refundPayment(z.string().uuid().parse(paymentId), parsed, actor.id);
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/finance");
    return res.status === "succeeded" ? t("refundDone") : t("refundPending");
  });
}

export async function saveServiceAction(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async (t) => {
    const actor = await requirePermission("service.edit");
    const data = serviceSchema.parse(input);
    const { error } = id
      ? await actor.supabase.from("services").update(data).eq("id", id)
      : await actor.supabase.from("services").insert(data);
    if (error) throw error;
    revalidatePath("/admin/services");
    return id ? t("serviceSaved") : t("serviceAdded");
  });
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null));

const officeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(200),
  hours: optionalText(200),
  phone: optionalText(40),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(1000),
});

const newOfficeSchema = officeSchema.extend({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
});

/**
 * Точка приёма: правка (менеджер и админ, право settings.edit) или
 * создание (id = null; только админ — RLS разрешает insert лишь ему).
 */
export async function saveOfficeAction(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async (t) => {
    if (id) {
      const actor = await requirePermission("settings.edit");
      const data = officeSchema.parse(input);
      const { data: row, error } = await actor.supabase
        .from("offices")
        .update(data)
        .eq("id", z.string().uuid().parse(id))
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!row) throw notFound();
    } else {
      const actor = await requirePermission("user.change_role");
      const data = newOfficeSchema.parse(input);
      const { error } = await actor.supabase.from("offices").insert(data);
      if (error) {
        if (error.code === "23505") throw new CodedError(t("errors.officeSlugTaken"), "SLUG_TAKEN");
        throw error;
      }
    }
    revalidatePath("/admin/offices");
    return id ? t("officeSaved") : t("officeAdded");
  });
}

const promoSchema = z
  .object({
    auto_apply: z.boolean(),
    code: z.string().nullable(),
    name: z.string().trim().min(1).max(100),
    description: optionalText(500),
    discount_type: z.enum(["percent", "fixed"]),
    value: z.number().positive().max(10_000_000),
    max_discount: z.number().positive().max(10_000_000).nullable(),
    min_order_amount: z.number().min(0).max(10_000_000),
    first_order_only: z.boolean(),
    valid_from: z.string().datetime({ offset: true }).nullable(),
    valid_to: z.string().datetime({ offset: true }).nullable(),
    max_uses: z.number().int().min(1).max(1_000_000).nullable(),
    max_uses_per_client: z.number().int().min(1).max(1_000_000).nullable(),
    is_active: z.boolean(),
  })
  .superRefine((p, ctx) => {
    if (p.discount_type === "percent" && p.value > 100) ctx.addIssue({ code: "custom", path: ["value"], message: "percent" });
    if (p.valid_from && p.valid_to && new Date(p.valid_to) <= new Date(p.valid_from)) {
      ctx.addIssue({ code: "custom", path: ["valid_to"], message: "dates" });
    }
    if (!p.auto_apply && !/^[^\s]{3,32}$/.test((p.code ?? "").replace(/\s+/g, ""))) {
      ctx.addIssue({ code: "custom", path: ["code"], message: "code" });
    }
  })
  .transform((p) => ({
    ...p,
    // Автоскидка применяется без кода; обычный код хранится без пробелов в верхнем регистре
    code: p.auto_apply ? null : (p.code ?? "").replace(/\s+/g, "").toUpperCase(),
    // Потолок скидки имеет смысл только для процентов
    max_discount: p.discount_type === "percent" ? p.max_discount : null,
  }));

/** Промокод или автоскидка: создание (id = null) и правка. Право promo.manage. */
export async function savePromoAction(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async (t) => {
    const actor = await requirePermission("promo.manage");
    const data = promoSchema.parse(input);
    if (id) {
      const { data: row, error } = await actor.supabase
        .from("promo_codes")
        .update(data)
        .eq("id", z.string().uuid().parse(id))
        .select("id")
        .maybeSingle();
      if (error) {
        if (error.code === "23505") throw new CodedError(t("errors.promoCodeTaken"), "CODE_TAKEN");
        throw error;
      }
      if (!row) throw notFound();
    } else {
      const { error } = await actor.supabase.from("promo_codes").insert({ ...data, created_by: actor.id });
      if (error) {
        if (error.code === "23505") throw new CodedError(t("errors.promoCodeTaken"), "CODE_TAKEN");
        throw error;
      }
    }
    revalidatePath("/admin/promo");
    return id ? t("promoSaved") : t("promoAdded");
  });
}

/** Быстрое включение/выключение промокода. */
export async function setPromoActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  return run(async (t) => {
    const actor = await requirePermission("promo.manage");
    const { data: row, error } = await actor.supabase
      .from("promo_codes")
      .update({ is_active: z.boolean().parse(isActive) })
      .eq("id", z.string().uuid().parse(id))
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!row) throw notFound();
    revalidatePath("/admin/promo");
    return isActive ? t("promoEnabled") : t("promoDisabled");
  });
}

/** Удаление промокода; если по нему уже оформлялись заказы, база не даст (FK) — тогда нужно отключить. */
export async function deletePromoAction(id: string): Promise<ActionResult> {
  return run(async (t) => {
    const actor = await requirePermission("promo.manage");
    const { data: row, error } = await actor.supabase
      .from("promo_codes")
      .delete()
      .eq("id", z.string().uuid().parse(id))
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23503") throw new CodedError(t("errors.promoInUse"), "IN_USE");
      throw error;
    }
    if (!row) throw notFound();
    revalidatePath("/admin/promo");
    return t("promoDeleted");
  });
}

export async function saveSettingAction(key: string, value: Json): Promise<ActionResult> {
  return run(async (t) => {
    const actor = await requirePermission("settings.edit");
    const allowed = new Set([
      "urgency",
      "notary_fee",
      "delivery_price",
      "prepayment_percent",
      "prepayment_threshold",
      "pay_in_office_enabled",
      "holidays",
      "notifications",
      "file_retention_days",
      "volume_discounts",
      "company",
    ]);
    if (!allowed.has(key)) throw new Error(t("errors.unknownSetting"));
    const { error } = await actor.supabase
      .from("settings")
      .update({ value, updated_by: actor.id })
      .eq("key", key);
    if (error) throw error;
    revalidatePath("/admin/settings");
    return t("settingSaved");
  });
}

export async function updateClientAction(
  clientId: string,
  input: { name: string; phone: string | null; email: string | null; inn: string | null; type: "individual" | "company" },
): Promise<ActionResult> {
  return run(async (t) => {
    const actor = await requirePermission("order.view_all");
    const { error } = await actor.supabase.from("clients").update(input).eq("id", clientId);
    if (error) throw error;
    revalidatePath(`/admin/clients/${clientId}`);
    return t("clientSaved");
  });
}

/** Админ: роль пользователя (выдача доступа переводчику/менеджеру). */
export async function setUserRoleAction(userId: string, role: UserRole): Promise<ActionResult> {
  return run(async (t) => {
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
    return t("roleChanged");
  });
}

/** Админ: выдать роль зарегистрированному пользователю по email. */
export async function grantRoleByEmailAction(email: string, role: UserRole): Promise<ActionResult> {
  return run(async (t) => {
    const actor = await requirePermission("user.change_role");
    const parsedEmail = z.string().email().safeParse(email.trim().toLowerCase());
    if (!parsedEmail.success) throw new Error(t("errors.invalidEmail"));
    const { data: user } = await actor.supabase
      .from("users")
      .select("id")
      // Supabase Auth хранит email в нижнем регистре; ilike не используем — «_» в нём шаблон
      .eq("email", parsedEmail.data)
      .maybeSingle();
    if (!user) throw new Error(t("errors.userNotFound"));
    const r = await setUserRoleAction(user.id, role);
    if (!r.ok) throw new Error(r.error);
    return t("roleGranted");
  });
}

export async function updateTranslatorAction(
  userId: string,
  input: { capacity_per_day: number; is_available: boolean; specialization: string | null; languages: string[] },
): Promise<ActionResult> {
  return run(async (t) => {
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
    return t("translatorSaved");
  });
}
