import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { issueOrderToken } from "@/lib/auth/order-access";
import { PROOF_LINK_TTL_DAYS, PROOF_REMIND_HOURS } from "@/lib/proof/constants";
import { formatMoney } from "@/lib/format/money";
import { formatDateTime } from "@/lib/format/date";
import type { NotificationChannel, OrderStatus } from "@/types/database.types";
import { sendTelegram } from "./telegram";
import { sendSms } from "./sms";
import { sendEmail } from "./email";
import {
  chatMessageToManager,
  deadlineWarning,
  isClientNotifiableStatus,
  newOrderMessage,
  paymentReceivedMessage,
  pickupReminder,
  plain,
  proofDecisionToManager,
  proofRequestMessage,
  readyMessage,
  statusChangedMessage,
  unclaimedManagerWarning,
  type Message,
} from "./templates";

/**
 * Уведомления клиентам и менеджерам.
 * Клиенту — по цепочке Telegram → SMS → email: первый успешный канал завершает
 * доставку. Каждая попытка пишется в notifications; неудачные попадают в очередь
 * повторов (status = failed, next_attempt_at) — её разбирает /api/notifications.
 */

const RETRY_DELAY_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const SOURCE_LABELS: Record<string, string> = {
  web: "сайт",
  mini_app: "Mini App",
  bot: "бот",
  admin: "админка",
  walkin: "офис",
};

interface Recipient {
  userId: string | null;
  telegramId: number | null;
  phone: string | null;
  email: string | null;
}

interface Target {
  channel: NotificationChannel;
  address: string;
}

/** Отправка в конкретный канал. Возвращает id сообщения у провайдера. */
export async function deliver(channel: NotificationChannel, address: string, msg: Message): Promise<string | null> {
  switch (channel) {
    case "telegram":
      return sendTelegram(address, msg.text);
    case "sms":
      return sendSms(address, plain(msg.text));
    case "email":
      return sendEmail(address, msg.subject, plain(msg.text));
    default:
      return null;
  }
}

async function record(
  orderId: string | null,
  userId: string | null,
  target: Target,
  msg: Message,
  result: { ok: true; providerId: string | null } | { ok: false; error: string },
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("notifications").insert({
    user_id: userId,
    order_id: orderId,
    channel: target.channel,
    recipient: target.address,
    subject: msg.subject,
    message: msg.text,
    status: result.ok ? "sent" : "failed",
    provider_id: result.ok ? result.providerId : null,
    attempts: 1,
    sent_at: result.ok ? new Date().toISOString() : null,
    last_error: result.ok ? null : result.error,
    next_attempt_at: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
  }).select("id").single();
  return data?.id ?? null;
}

/** Доставляет по цепочке каналов до первого успеха. */
async function deliverWithFallback(
  orderId: string | null,
  recipient: Recipient,
  msg: Message,
): Promise<NotificationChannel | null> {
  const targets: Target[] = [];
  if (recipient.telegramId) targets.push({ channel: "telegram", address: String(recipient.telegramId) });
  if (recipient.phone) targets.push({ channel: "sms", address: recipient.phone });
  if (recipient.email) targets.push({ channel: "email", address: recipient.email });

  const failedIds: string[] = [];
  for (const target of targets) {
    try {
      const providerId = await deliver(target.channel, target.address, msg);
      await record(orderId, recipient.userId, target, msg, { ok: true, providerId });
      if (failedIds.length) {
        // доставлено другим каналом — неудачные попытки не повторяем
        await createAdminClient().from("notifications").update({ attempts: MAX_ATTEMPTS }).in("id", failedIds);
      }
      return target.channel;
    } catch (err) {
      const error = (err as Error).message;
      logger.warn("Канал уведомления недоступен, пробуем следующий", { channel: target.channel, error });
      const id = await record(orderId, recipient.userId, target, msg, { ok: false, error });
      if (id) failedIds.push(id);
    }
  }
  return null;
}

async function orderRecipient(orderId: string) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, user_id, public_number, status, delivery_type, total_price, client:clients(phone, email), office:offices(address, hours)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;

  let telegramId: number | null = null;
  if (order.user_id) {
    const { data: u } = await admin.from("users").select("telegram_id").eq("id", order.user_id).maybeSingle();
    telegramId = u?.telegram_id ?? null;
  }
  const recipient: Recipient = {
    userId: order.user_id,
    telegramId,
    phone: order.client?.phone ?? null,
    email: order.client?.email ?? null,
  };
  return { order, recipient };
}

async function notificationSettings(): Promise<{ client_status_change: boolean; client_ready: boolean }> {
  const admin = createAdminClient();
  const { data } = await admin.from("settings").select("value").eq("key", "notifications").maybeSingle();
  const v = (data?.value ?? {}) as Record<string, unknown>;
  return {
    client_status_change: v.client_status_change !== false,
    client_ready: v.client_ready !== false,
  };
}

/** Клиенту: смена статуса заказа. */
export async function notifyOrderStatusChange(orderId: string): Promise<void> {
  const found = await orderRecipient(orderId);
  if (!found) return;
  const { order, recipient } = found;
  const status = order.status as OrderStatus;
  if (!isClientNotifiableStatus(status)) return;

  const prefs = await notificationSettings();
  if (status === "ready" ? !prefs.client_ready : !prefs.client_status_change) return;

  const msg =
    status === "ready"
      ? readyMessage(order.public_number, order.delivery_type, order.office)
      : statusChangedMessage(order.public_number, status);
  await deliverWithFallback(order.id, recipient, msg);
}

/** Клиенту: оплата получена. */
export async function notifyPaymentSucceeded(orderId: string, amount: number): Promise<void> {
  const found = await orderRecipient(orderId);
  if (!found) return;
  await deliverWithFallback(found.order.id, found.recipient, paymentReceivedMessage(found.order.public_number, formatMoney(amount)));
}

/** Telegram chat id менеджеров: из env и из профилей с ролью manager/admin. */
export async function managerChatIds(): Promise<string[]> {
  const fromEnv = (process.env.TELEGRAM_MANAGER_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("telegram_id")
    .in("role", ["manager", "admin"])
    .eq("is_active", true)
    .not("telegram_id", "is", null);
  const fromDb = (data ?? []).map((u) => String(u.telegram_id));
  return [...new Set([...fromEnv, ...fromDb])];
}

async function broadcastToManagers(orderId: string | null, msg: Message): Promise<void> {
  for (const chatId of await managerChatIds()) {
    const target: Target = { channel: "telegram", address: chatId };
    try {
      const providerId = await sendTelegram(chatId, msg.text);
      await record(orderId, null, target, msg, { ok: true, providerId });
    } catch (err) {
      await record(orderId, null, target, msg, { ok: false, error: (err as Error).message });
    }
  }
}

/** Менеджерам: новый заказ (плюс Realtime-алерт в админке — через подписку на orders). */
export async function notifyNewOrderToManagers(orderId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, public_number, total_price, source, items:order_items(name_snapshot, quantity)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;
  const summary = (order.items ?? []).map((i) => `• ${i.name_snapshot} × ${i.quantity}`).join("\n");
  await broadcastToManagers(
    order.id,
    newOrderMessage(order.public_number, formatMoney(Number(order.total_price)), SOURCE_LABELS[order.source] ?? order.source, summary),
  );
}

/** Менеджерам: сообщение клиента в чате заказа. */
export async function notifyChatMessage(orderId: string, body: string): Promise<void> {
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("public_number").eq("id", orderId).maybeSingle();
  if (!order) return;
  await broadcastToManagers(orderId, chatMessageToManager(order.public_number, body));
}

/** Клиенту: перевод готов к проверке (ссылка с токеном — работает и без входа в кабинет). */
export async function notifyProofRequested(orderId: string, reminder = false): Promise<boolean> {
  const found = await orderRecipient(orderId);
  if (!found) return false;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const token = issueOrderToken(orderId, Date.now(), PROOF_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
  const url = `${site}/proof/${orderId}?token=${token}`;
  const channel = await deliverWithFallback(orderId, found.recipient, proofRequestMessage(found.order.public_number, url, reminder));
  return channel !== null;
}

/** Менеджерам: клиент подтвердил перевод или оставил замечания. */
export async function notifyProofDecision(orderId: string, kind: "approved" | "changes", count = 0): Promise<void> {
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("public_number").eq("id", orderId).maybeSingle();
  if (!order) return;
  await broadcastToManagers(orderId, proofDecisionToManager(order.public_number, kind, count));
}

/** Cron: клиент не ответил на сверку за PROOF_REMIND_HOURS — напомнить (один раз). */
export async function notifyProofReminders(): Promise<number> {
  const admin = createAdminClient();
  const before = new Date(Date.now() - PROOF_REMIND_HOURS * 3_600_000).toISOString();
  const { data: proofs } = await admin
    .from("proofs")
    .select("id, order_id")
    .eq("status", "pending")
    .lt("created_at", before);
  let count = 0;
  for (const p of proofs ?? []) {
    const { count: sent } = await admin
      .from("proof_events")
      .select("id", { count: "exact", head: true })
      .eq("proof_id", p.id)
      .eq("event", "reminded");
    if ((sent ?? 0) > 0) continue;
    const ok = await notifyProofRequested(p.order_id, true);
    await admin.from("proof_events").insert({
      proof_id: p.id,
      order_id: p.order_id,
      event: "reminded",
      actor_role: "system",
      meta: { delivered: ok },
    });
    if (ok) count++;
  }
  return count;
}

/** Cron: дедлайн < 24 ч — менеджерам (не чаще раза в сутки на заказ). */
export async function notifyDeadlineApproaching(): Promise<number> {
  const admin = createAdminClient();
  const { data: rows } = await admin.from("v_deadline_approaching").select("*");
  let count = 0;
  for (const row of rows ?? []) {
    if (await alreadyNotified(row.id, "Дедлайн")) continue;
    await broadcastToManagers(row.id, deadlineWarning(row.public_number, row.deadline ? formatDateTime(row.deadline) : "скоро"));
    count += 1;
  }
  return count;
}

/** Cron: «готов, не забран > 3 дней» — клиенту напоминание, менеджерам сигнал. */
export async function notifyUnclaimedOrders(): Promise<number> {
  const admin = createAdminClient();
  const { data: rows } = await admin.from("v_unclaimed_orders").select("*");
  let count = 0;
  for (const row of rows ?? []) {
    if (await alreadyNotified(row.id, "ждёт вас")) continue;
    const found = await orderRecipient(row.id);
    if (found) await deliverWithFallback(row.id, found.recipient, pickupReminder(row.public_number, found.order.office));
    const days = Math.floor((Date.now() - new Date(row.updated_at).getTime()) / 86_400_000);
    await broadcastToManagers(row.id, unclaimedManagerWarning(row.public_number, days));
    count += 1;
  }
  return count;
}

/** Было ли за последние сутки уведомление по заказу с такой темой. */
async function alreadyNotified(orderId: string, subjectPart: string): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .ilike("subject", `%${subjectPart}%`)
    .gte("created_at", since);
  return (count ?? 0) > 0;
}

/** Воркер очереди: повторяет неудачные отправки (вызывается cron'ом). */
export async function retryFailedNotifications(limit = 100): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("notifications")
    .select("id, channel, recipient, subject, message, attempts")
    .eq("status", "failed")
    .lt("attempts", MAX_ATTEMPTS)
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at")
    .limit(limit);

  let sent = 0;
  let failed = 0;
  for (const n of pending ?? []) {
    if (!n.recipient) continue;
    try {
      const providerId = await deliver(n.channel, n.recipient, { subject: n.subject ?? "", text: n.message });
      await admin
        .from("notifications")
        .update({ status: "sent", provider_id: providerId, sent_at: new Date().toISOString(), attempts: n.attempts + 1 })
        .eq("id", n.id);
      sent += 1;
    } catch (err) {
      // экспоненциальная задержка: 15, 30, 60, 120 мин
      const delay = RETRY_DELAY_MS * 2 ** n.attempts;
      await admin
        .from("notifications")
        .update({
          attempts: n.attempts + 1,
          last_error: (err as Error).message,
          next_attempt_at: new Date(Date.now() + delay).toISOString(),
        })
        .eq("id", n.id);
      failed += 1;
    }
  }
  return { sent, failed };
}
