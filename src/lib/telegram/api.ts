import "server-only";
import { logger } from "@/lib/logger";

/** Базовый вызов Bot API. */
export async function callTelegram<T = unknown>(
  method: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN не задан");

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    logger.error("Telegram API error", { method, status: res.status, data });
    throw new Error(`Telegram ${method}: ${data?.description ?? res.status}`);
  }
  return data as T;
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: object,
): Promise<void> {
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function answerCallback(callbackQueryId: string, text?: string): Promise<void> {
  await callTelegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

/** Устанавливает кнопку меню бота (открывает Mini App). */
export async function setMenuButton(webAppUrl: string): Promise<void> {
  await callTelegram("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Заказать", web_app: { url: webAppUrl } },
  });
}
