import { COMPANY, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/config/constants";

/**
 * Шаблоны уведомлений. Тексты короткие (SMS — до 2 сегментов), без HTML
 * для SMS/email; для Telegram допускается <b>.
 */

export interface Message {
  subject: string;
  text: string;
}

const STATUS_TEXT: Partial<Record<OrderStatus, string>> = {
  confirmed: "принят в работу",
  in_progress: "переводится",
  ready: "готов",
  issued: "выдан",
  completed: "завершён — спасибо, что выбрали нас!",
  cancelled: "отменён",
};

/** Нужно ли сообщать клиенту об этом статусе. */
export function isClientNotifiableStatus(status: OrderStatus): boolean {
  return status in STATUS_TEXT && status !== "issued";
}

export function statusChangedMessage(number: string, status: OrderStatus): Message {
  return {
    subject: `Заказ ${number}: ${ORDER_STATUS_LABELS[status]}`,
    text: `Заказ ${number} ${STATUS_TEXT[status] ?? `— статус «${ORDER_STATUS_LABELS[status]}»`}.`,
  };
}

/** Точка приёма заказа (для адреса в сообщениях). */
export interface OfficeInfo {
  address: string;
  hours: string | null;
}

export function officeLabel(office: OfficeInfo | null | undefined): string {
  if (!office) return `г. ${COMPANY.city}`;
  return `г. ${COMPANY.city}, ${office.address}${office.hours ? ` (${office.hours})` : ""}`;
}

export function readyMessage(number: string, deliveryType: string, office?: OfficeInfo | null): Message {
  const how =
    deliveryType === "delivery"
      ? "Курьер свяжется с вами для доставки."
      : `Забрать: ${officeLabel(office)}.`;
  return { subject: `Заказ ${number} готов`, text: `Ваш заказ ${number} готов! ${how}` };
}

export function paymentReceivedMessage(number: string, amountLabel: string): Message {
  return {
    subject: `Оплата заказа ${number} получена`,
    text: `Оплата ${amountLabel} по заказу ${number} получена. Мы начали работу.`,
  };
}

export function pickupReminder(number: string, office?: OfficeInfo | null): Message {
  return {
    subject: `Заказ ${number} ждёт вас`,
    text: `Напоминаем: заказ ${number} готов и ждёт вас по адресу ${officeLabel(office)}.`,
  };
}

export function deadlineWarning(number: string, deadlineLabel: string): Message {
  return {
    subject: `Дедлайн ${number}`,
    text: `⏰ По заказу ${number} срок истекает ${deadlineLabel}.`,
  };
}

export function unclaimedManagerWarning(number: string, days: number): Message {
  return {
    subject: `Не забран ${number}`,
    text: `📦 Заказ ${number} готов, но не забран уже ${days} дн.`,
  };
}

export function newOrderMessage(number: string, totalLabel: string, source: string, summary: string): Message {
  return {
    subject: `Новый заказ ${number}`,
    text: `🔔 Новый заказ <b>${number}</b> (${source}) на ${totalLabel}\n${summary}`,
  };
}

export function chatMessageToManager(number: string, body: string): Message {
  return { subject: `Сообщение по ${number}`, text: `💬 ${number}: ${body.slice(0, 500)}` };
}

export function proofRequestMessage(number: string, url: string, reminder = false): Message {
  return {
    subject: `Проверьте перевод заказа ${number}`,
    text:
      `${reminder ? "Напоминаем: перевод" : "Перевод"} заказа ${number} готов к проверке. ` +
      `Пожалуйста, проверьте написание имён, дат и номеров документов до печати: ${url}
` +
      `Если всё верно — подтвердите, если нет — отметьте, что исправить.`,
  };
}

export function proofDecisionToManager(number: string, kind: "approved" | "changes", count = 0): Message {
  return kind === "approved"
    ? { subject: `Перевод ${number} подтверждён`, text: `✅ Клиент подтвердил перевод ${number} — можно печатать.` }
    : {
        subject: `Замечания по переводу ${number}`,
        text: `✏️ Клиент оставил замечания по переводу ${number} (${count}). Откройте заказ в CRM.`,
      };
}

export function paymentRequestMessage(number: string, amountLabel: string, reason: string | null, url: string): Message {
  return {
    subject: `Оплата по заказу ${number}`,
    text:
      `По заказу ${number} нужно оплатить ${amountLabel}${reason ? ` — ${reason}` : ""}. ` +
      `Оплатить можно по ссылке (СБП, QR или карта): ${url}`,
  };
}

export function refundMessage(number: string, amountLabel: string): Message {
  return {
    subject: `Возврат по заказу ${number}`,
    text: `Возврат ${amountLabel} по заказу ${number} оформлен. Деньги вернутся тем же способом, обычно в течение 1–5 рабочих дней.`,
  };
}

/** Удаляет HTML-разметку (для SMS/email). */
export function plain(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}
