import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMPANY, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/config/constants";
import { formatMoney } from "@/lib/format/money";
import { formatDateTime } from "@/lib/format/date";
import { isValidRuPhone, normalizePhone } from "@/lib/format/phone";
import { canTransition } from "@/lib/auth/roles";
import { logger } from "@/lib/logger";
import { answerCallback, sendTelegramMessage } from "./api";
import {
  adminOrderButton,
  mainMenu,
  orderButton,
  orderStatusButton,
  removeKeyboard,
  shareContactKeyboard,
} from "./keyboards";
import type { TelegramCallbackQuery, TelegramMessage, TelegramUpdate, TelegramUser } from "./types";

/**
 * Бот «Точки Перевода». Работает через вебхук /api/webhooks/telegram.
 * Клиенты: /start, /order, /status [номер], /help, «поделиться номером».
 * Менеджеры (роль manager/admin с привязанным Telegram или из
 * TELEGRAM_MANAGER_CHAT_IDS): /new, /deadline, /take <номер>.
 */

const ORDER_NUMBER_RE = /ТП-\d{4}-\d{5,7}/i;

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  if (update.message) await handleMessage(update.message);
  else if (update.callback_query) await handleCallback(update.callback_query);
}

// ---------------------------------------------------------------------------
// Контекст отправителя
// ---------------------------------------------------------------------------
interface Sender {
  telegramId: number;
  userId: string | null;
  phone: string | null;
  isManager: boolean;
}

async function resolveSender(from: TelegramUser | undefined, chatId: number): Promise<Sender> {
  const telegramId = from?.id ?? chatId;
  const admin = createAdminClient();
  const { data: user } = await admin
    .from("users")
    .select("id, role, phone, is_active")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  const envManagers = (process.env.TELEGRAM_MANAGER_CHAT_IDS ?? "").split(",").map((s) => s.trim());
  const isManager =
    (user?.is_active && (user.role === "manager" || user.role === "admin")) ||
    envManagers.includes(String(telegramId));
  return { telegramId, userId: user?.id ?? null, phone: user?.phone ?? null, isManager: Boolean(isManager) };
}

// ---------------------------------------------------------------------------
// Сообщения
// ---------------------------------------------------------------------------
async function handleMessage(msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id;
  const sender = await resolveSender(msg.from, chatId);

  if (msg.contact) {
    await handleContact(msg, sender);
    return;
  }

  const text = (msg.text ?? "").trim();
  const [rawCommand = "", ...args] = text.split(/\s+/);
  const command = rawCommand.toLowerCase().replace(/@\w+$/, "");

  switch (command) {
    case "/start":
      return cmdStart(chatId, args[0]);
    case "/order":
      return sendTelegramMessage(chatId, "Нажмите кнопку — откроется форма заказа 👇", orderButton());
    case "/status":
      return cmdStatus(chatId, sender, args.join(" "));
    case "/help":
      return cmdHelp(chatId, sender.isManager);
    case "/new":
      return sender.isManager ? cmdNewOrders(chatId) : denied(chatId);
    case "/deadline":
      return sender.isManager ? cmdDeadlines(chatId) : denied(chatId);
    case "/take":
      return sender.isManager ? cmdTake(chatId, sender, args[0]) : denied(chatId);
    default:
      break;
  }

  // Номер заказа без команды — показываем статус
  const number = text.match(ORDER_NUMBER_RE)?.[0];
  if (number) return cmdStatus(chatId, sender, number);

  await sendTelegramMessage(
    chatId,
    "Я помогу оформить заказ и узнать статус. Для вопросов менеджеру откройте «Чат с менеджером».",
    mainMenu(),
  );
}

async function cmdStart(chatId: number, payload?: string): Promise<void> {
  if (payload === "order") {
    await sendTelegramMessage(chatId, "Оформим заказ — нажмите кнопку 👇", orderButton());
    return;
  }
  await sendTelegramMessage(
    chatId,
    [
      `Здравствуйте! Это бот бюро переводов <b>${COMPANY.name}</b>.`,
      "",
      "• рассчитать стоимость и оформить заказ;",
      "• прислать фото документа и оплатить по СБП;",
      "• узнать статус: /status ТП-2026-000123.",
      "",
      `📍 ${COMPANY.address}`,
      `🕘 ${COMPANY.workHours}`,
    ].join("\n"),
    mainMenu(),
  );
  await sendTelegramMessage(
    chatId,
    "Поделитесь номером телефона — мы покажем ваши заказы и будем присылать уведомления о готовности.",
    shareContactKeyboard(),
  );
}

async function cmdHelp(chatId: number, isManager: boolean): Promise<void> {
  const lines = [
    "Команды:",
    "/order — оформить заказ",
    "/status [номер] — статус заказа",
    "/help — справка",
  ];
  if (isManager) {
    lines.push("", "Для менеджеров:", "/new — новые заказы", "/deadline — срок < 24 ч", "/take ТП-… — взять заказ в работу");
  }
  await sendTelegramMessage(chatId, lines.join("\n"));
}

async function denied(chatId: number): Promise<void> {
  await sendTelegramMessage(chatId, "Команда доступна только менеджерам.");
}

/** Привязка телефона: только собственный контакт пользователя. */
async function handleContact(msg: TelegramMessage, sender: Sender): Promise<void> {
  const chatId = msg.chat.id;
  const contact = msg.contact!;
  if (contact.user_id && msg.from && contact.user_id !== msg.from.id) {
    await sendTelegramMessage(chatId, "Можно привязать только свой номер.", removeKeyboard());
    return;
  }
  if (!isValidRuPhone(contact.phone_number)) {
    await sendTelegramMessage(chatId, "Поддерживаются номера РФ (+7).", removeKeyboard());
    return;
  }
  const phone = normalizePhone(contact.phone_number);
  const admin = createAdminClient();

  if (sender.userId) {
    // Контакт подтверждён Telegram (contact.user_id === from.id) — считаем телефон верифицированным
    await admin.from("users").update({ phone, phone_verified_at: new Date().toISOString() }).eq("id", sender.userId);
    await admin.rpc("claim_guest_orders", { p_user_id: sender.userId });
  }
  const { count } = await admin
    .from("orders")
    .select("id, client:clients!inner(phone)", { count: "exact", head: true })
    .eq("client.phone", phone);

  await sendTelegramMessage(
    chatId,
    sender.userId
      ? `Номер сохранён ✅ Найдено заказов: ${count ?? 0}. Уведомления о статусе будут приходить сюда.`
      : "Номер получен ✅ Откройте приложение кнопкой ниже — заказы привяжутся автоматически.",
    removeKeyboard(),
  );
  await sendTelegramMessage(chatId, "Меню:", mainMenu());
}

/** Статус заказа: по номеру (только свои — по телефону/аккаунту) или последний заказ. */
async function cmdStatus(chatId: number, sender: Sender, arg: string): Promise<void> {
  const admin = createAdminClient();
  const number = arg.match(ORDER_NUMBER_RE)?.[0]?.toUpperCase();

  let query = admin
    .from("orders")
    .select("id, public_number, status, total_price, paid_amount, deadline, user_id, client:clients(phone)")
    .order("created_at", { ascending: false })
    .limit(1);
  if (number) query = query.eq("public_number", number);
  else if (sender.userId) query = query.eq("user_id", sender.userId);
  else {
    await sendTelegramMessage(chatId, "Укажите номер: /status ТП-2026-000123", shareContactKeyboard());
    return;
  }

  const { data } = await query;
  const order = data?.[0];
  const owns =
    order &&
    (sender.isManager ||
      (sender.userId && order.user_id === sender.userId) ||
      (sender.phone && order.client?.phone === sender.phone));

  if (!order || !owns) {
    await sendTelegramMessage(
      chatId,
      "Заказ не найден. Проверьте номер или поделитесь телефоном, указанным при заказе.",
      shareContactKeyboard(),
    );
    return;
  }

  const lines = [
    `Заказ <b>${order.public_number}</b>`,
    `Статус: <b>${ORDER_STATUS_LABELS[order.status as OrderStatus]}</b>`,
    `Сумма: ${formatMoney(Number(order.total_price))}${Number(order.paid_amount) >= Number(order.total_price) ? " (оплачен)" : ""}`,
  ];
  if (order.deadline && !["issued", "completed", "cancelled"].includes(order.status)) {
    lines.push(`Готовность: ${formatDateTime(order.deadline)}`);
  }
  await sendTelegramMessage(chatId, lines.join("\n"), orderStatusButton(order.id));
}

// ---------------------------------------------------------------------------
// Команды менеджеров
// ---------------------------------------------------------------------------
async function cmdNewOrders(chatId: number): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("id, public_number, total_price, created_at, client:clients(name)")
    .eq("status", "new")
    .order("created_at", { ascending: true })
    .limit(10);
  if (!data?.length) {
    await sendTelegramMessage(chatId, "Новых заказов нет 👌");
    return;
  }
  for (const o of data) {
    await sendTelegramMessage(
      chatId,
      `🆕 <b>${o.public_number}</b> · ${o.client?.name ?? "—"} · ${formatMoney(Number(o.total_price))}\n${formatDateTime(o.created_at)}`,
      adminOrderButton(o.id, o.public_number),
    );
  }
}

async function cmdDeadlines(chatId: number): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("v_deadline_approaching").select("*").order("deadline").limit(20);
  if (!data?.length) {
    await sendTelegramMessage(chatId, "Горящих сроков нет 👌");
    return;
  }
  const lines = data.map(
    (o) => `⏰ <b>${o.public_number}</b> — ${o.deadline ? formatDateTime(o.deadline) : "—"} · ${ORDER_STATUS_LABELS[o.status as OrderStatus]} · ${o.client_name}`,
  );
  await sendTelegramMessage(chatId, lines.join("\n"));
}

async function takeOrder(sender: Sender, number: string | undefined): Promise<string> {
  const normalized = number?.match(ORDER_NUMBER_RE)?.[0]?.toUpperCase();
  if (!normalized) return "Укажите номер: /take ТП-2026-000123";
  if (!sender.userId) return "Привяжите Telegram к профилю менеджера в админке.";

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, status").eq("public_number", normalized).maybeSingle();
  if (!order) return `Заказ ${normalized} не найден.`;

  const { data: existing } = await admin
    .from("order_assignments")
    .select("id, user_id")
    .eq("order_id", order.id)
    .eq("role", "manager")
    .neq("status", "rejected")
    .maybeSingle();
  if (existing && existing.user_id !== sender.userId) return `Заказ ${normalized} уже ведёт другой менеджер.`;
  if (!existing) {
    await admin.from("order_assignments").insert({
      order_id: order.id,
      user_id: sender.userId,
      role: "manager",
      assigned_by: sender.userId,
      status: "accepted",
    });
  }
  if (order.status === "new" && canTransition("new", "confirmed")) {
    await admin.rpc("change_order_status", {
      p_order_id: order.id,
      p_status: "confirmed",
      p_comment: "Взят в работу через Telegram",
    });
  }
  return `✅ Заказ ${normalized} закреплён за вами.`;
}

async function cmdTake(chatId: number, sender: Sender, number: string | undefined): Promise<void> {
  await sendTelegramMessage(chatId, await takeOrder(sender, number));
}

// ---------------------------------------------------------------------------
// Callback-кнопки
// ---------------------------------------------------------------------------
async function handleCallback(cb: TelegramCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat.id ?? cb.from.id;
  const sender = await resolveSender(cb.from, chatId);
  const [action, arg] = (cb.data ?? "").split(":");

  try {
    if (action === "take") {
      if (!sender.isManager) {
        await answerCallback(cb.id, "Только для менеджеров");
        return;
      }
      const result = await takeOrder(sender, arg);
      await answerCallback(cb.id, result.slice(0, 190));
      return;
    }
    await answerCallback(cb.id);
  } catch (err) {
    logger.error("Ошибка callback бота", { error: (err as Error).message });
    await answerCallback(cb.id, "Ошибка, попробуйте позже").catch(() => undefined);
  }
}
