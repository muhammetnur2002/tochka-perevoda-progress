import "server-only";
import type { CartItem } from "@/types/domain";
import type { Json } from "@/types/database.types";
import type { CreateOrderInput } from "@/lib/validation/order";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicSettings } from "@/lib/services/catalog";
import { calculatePrice, settingsToPricing, type PriceOptions } from "@/lib/services/pricing";
import { normalizePhone } from "@/lib/format/phone";
import { badRequest } from "@/lib/errors";
import { CONSENT_VERSION } from "@/lib/config/constants";
import { issueOrderToken } from "@/lib/auth/order-access";
import { notifyNewOrderToManagers } from "@/lib/notifications";
import { logger } from "@/lib/logger";

export interface CreateOrderResult {
  orderId: string;
  publicNumber: string;
  totalPrice: number;
  deadline: string | null;
  /** Токен гостя для загрузки файлов и оплаты (см. lib/auth/order-access). */
  accessToken: string;
}

interface CreateOrderContext {
  actorId?: string;
  ip?: string | null;
  userAgent?: string | null;
}

/** Собирает позиции корзины по услугам из БД (цена клиента игнорируется). */
async function loadCartItems(input: Pick<CreateOrderInput, "items">): Promise<CartItem[]> {
  const admin = createAdminClient();
  const serviceIds = [...new Set(input.items.map((i) => i.serviceId))];
  const { data: services, error } = await admin
    .from("services")
    .select("*")
    .in("id", serviceIds)
    .eq("is_active", true);

  if (error) throw error;
  if (!services || services.length !== serviceIds.length) {
    throw badRequest("Одна из выбранных услуг недоступна — обновите страницу");
  }

  const byId = new Map(services.map((s) => [s.id, s]));
  return input.items.map((item) => {
    const s = byId.get(item.serviceId);
    if (!s) throw badRequest("Услуга не найдена");
    return {
      key: s.slug,
      serviceId: s.id,
      slug: s.slug,
      name: s.name,
      category: s.category,
      unit: s.unit,
      unitPrice: Number(s.price),
      quantity: item.quantity,
      isNotarial: s.is_notarial,
      durationDays: s.duration_days,
      meta: item.meta ?? {},
    };
  });
}

/** Предварительный расчёт на сервере (для /api/quote и проверки перед оплатой). */
export async function quoteOrder(
  input: Pick<CreateOrderInput, "items" | "urgency" | "notaryRequested" | "deliveryType">,
) {
  const items = await loadCartItems(input);
  const options: PriceOptions = {
    urgency: input.urgency,
    notaryRequested: input.notaryRequested,
    deliveryType: input.deliveryType,
    settings: settingsToPricing(await getPublicSettings()),
  };
  return { items, pricing: calculatePrice(items, options) };
}

/** Находит карточку клиента (по пользователю или телефону) или создаёт новую. */
async function resolveClient(input: CreateOrderInput, actorId?: string): Promise<string> {
  const admin = createAdminClient();
  const phone = normalizePhone(input.phone);

  if (actorId) {
    const { data: own } = await admin.from("clients").select("id").eq("user_id", actorId).limit(1).maybeSingle();
    if (own) return own.id;
  }

  const { data: byPhone } = await admin
    .from("clients")
    .select("id, user_id, email")
    .eq("phone", phone)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (byPhone && (!byPhone.user_id || byPhone.user_id === actorId)) {
    if (!byPhone.email && input.email) {
      await admin.from("clients").update({ email: input.email }).eq("id", byPhone.id);
    }
    return byPhone.id;
  }

  const { data: created, error } = await admin
    .from("clients")
    .insert({
      name: input.name,
      phone,
      email: input.email ?? null,
      inn: input.inn ?? null,
      type: input.type,
      user_id: actorId ?? null,
      created_by: actorId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

/**
 * Создаёт заказ целиком: клиент → заказ → позиции → согласие (152-ФЗ).
 * Цена и срок считаются на сервере по актуальному прайсу и настройкам.
 * При ошибке после вставки заказа он удаляется (компенсация вместо транзакции).
 */
export async function createOrder(
  input: CreateOrderInput,
  ctx: CreateOrderContext = {},
): Promise<CreateOrderResult> {
  const admin = createAdminClient();
  const { items, pricing } = await quoteOrder(input);

  const clientId = await resolveClient(input, ctx.actorId);

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      client_id: clientId,
      user_id: ctx.actorId ?? null,
      status: "new",
      language_from: input.languageFrom ?? null,
      language_to: input.languageTo ?? null,
      subtotal: pricing.subtotal,
      urgency_coefficient: pricing.urgencyCoefficient,
      notary_fee: pricing.notaryFee,
      delivery_fee: pricing.deliveryFee,
      discount: pricing.discount,
      total_price: pricing.total,
      deadline: pricing.deadline ? pricing.deadline.toISOString() : null,
      delivery_type: input.deliveryType,
      delivery_address: input.deliveryType === "delivery" ? input.deliveryAddress ?? null : null,
      comment: [input.comment, input.telegram ? `Telegram: ${input.telegram}` : null]
        .filter(Boolean)
        .join("\n") || null,
      source: input.source,
    })
    .select("id, public_number, total_price, deadline")
    .single();
  if (orderError) throw orderError;

  try {
    const { error: itemsError } = await admin.from("order_items").insert(
      items.map((item) => ({
        order_id: order.id,
        service_id: item.serviceId,
        name_snapshot: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        price: Math.round(item.unitPrice * item.quantity * 100) / 100,
        meta: { ...item.meta, urgency: input.urgency, notary: input.notaryRequested } as Json,
      })),
    );
    if (itemsError) throw itemsError;

    const { error: consentError } = await admin.from("consents").insert({
      user_id: ctx.actorId ?? null,
      order_id: order.id,
      phone: normalizePhone(input.phone),
      doc_type: "pd_processing",
      doc_version: CONSENT_VERSION,
      ip: ctx.ip ?? null,
      user_agent: ctx.userAgent ?? null,
    });
    if (consentError) throw consentError;
  } catch (err) {
    await admin.from("orders").delete().eq("id", order.id);
    throw err;
  }

  // Итог пересчитан триггером recalc_order_totals — читаем фактическое значение
  const { data: fresh } = await admin.from("orders").select("total_price").eq("id", order.id).single();
  const total = Number(fresh?.total_price ?? order.total_price);
  if (Math.abs(total - pricing.total) > 0.01) {
    logger.warn("Расхождение цены сервера и БД", { orderId: order.id, server: pricing.total, db: total });
  }

  notifyNewOrderToManagers(order.id).catch((e: unknown) =>
    logger.error("Не удалось уведомить менеджеров", { error: (e as Error).message }),
  );

  return {
    orderId: order.id,
    publicNumber: order.public_number,
    totalPrice: total,
    deadline: order.deadline,
    accessToken: issueOrderToken(order.id),
  };
}
