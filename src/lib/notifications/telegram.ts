import "server-only";
import { logger } from "@/lib/logger";

/** Отправка сообщения в Telegram через Bot API. Без токена — заглушка в лог. */
export async function sendTelegram(chatId: number | string, text: string): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === "production") throw new Error("Telegram не настроен");
    logger.info("[telegram:mock]", { chatId, text });
    return null;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    logger.error("Ошибка Telegram sendMessage", { status: res.status, data });
    throw new Error(`Telegram: ${data?.description ?? res.status}`);
  }
  return data?.result?.message_id ? String(data.result.message_id) : null;
}
