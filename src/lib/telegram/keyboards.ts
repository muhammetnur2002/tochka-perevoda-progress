import type { InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove } from "./types";

/** Клавиатуры бота. Кнопки web_app открывают Mini App внутри Telegram. */

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function mainMenu(): InlineKeyboardMarkup {
  const base = siteUrl();
  return {
    inline_keyboard: [
      [{ text: "📝 Заказать перевод", web_app: { url: `${base}/tg?start=order` } }],
      [
        { text: "📋 Мои заказы", web_app: { url: `${base}/tg/orders` } },
        { text: "💬 Чат с менеджером", web_app: { url: `${base}/tg/chat` } },
      ],
    ],
  };
}

export function orderButton(): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: "📝 Оформить заказ", web_app: { url: `${siteUrl()}/tg?start=order` } }]] };
}

export function orderStatusButton(orderId: string): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: "Открыть заказ", web_app: { url: `${siteUrl()}/tg/orders?id=${orderId}` } }]] };
}

export function adminOrderButton(orderId: string, publicNumber: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: `Открыть ${publicNumber}`, url: `${siteUrl()}/admin/orders/${orderId}` },
        { text: "Взять", callback_data: `take:${publicNumber}` },
      ],
    ],
  };
}

export function shareContactKeyboard(): ReplyKeyboardMarkup {
  return {
    keyboard: [[{ text: "📱 Поделиться номером", request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function removeKeyboard(): ReplyKeyboardRemove {
  return { remove_keyboard: true };
}
