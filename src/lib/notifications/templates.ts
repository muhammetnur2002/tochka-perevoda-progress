import tkMessages from "../../../messages/tk/site.json";
import { COMPANY, type OrderStatus } from "@/lib/config/constants";

/**
 * Шаблоны уведомлений. Тексты короткие (SMS — до 2 сегментов), без HTML
 * для SMS/email; для Telegram допускается <b>.
 */

export interface Message {
  subject: string;
  text: string;
}

const ORDER_STATUS_LABELS = tkMessages.orderStatus;

const STATUS_TEXT: Partial<Record<OrderStatus, string>> = {
  confirmed: "işe kabul edildi",
  in_progress: "terjime edilýär",
  ready: "taýýar",
  issued: "gowşuryldy",
  completed: "tamamlandy — bizi saýlanyňyz üçin sag boluň!",
  cancelled: "ýatyryldy",
};

/** Нужно ли сообщать клиенту об этом статусе. */
export function isClientNotifiableStatus(status: OrderStatus): boolean {
  return status in STATUS_TEXT && status !== "issued";
}

export function statusChangedMessage(number: string, status: OrderStatus): Message {
  return {
    subject: `Sargyt ${number}: ${ORDER_STATUS_LABELS[status]}`,
    text: `Sargyt ${number} ${STATUS_TEXT[status] ?? `— ýagdaýy «${ORDER_STATUS_LABELS[status]}»`}.`,
  };
}

/** Точка приёма заказа (для адреса в сообщениях). */
export interface OfficeInfo {
  address: string;
  hours: string | null;
}

export function officeLabel(office: OfficeInfo | null | undefined): string {
  if (!office) return `${COMPANY.city}`;
  return `${COMPANY.city}, ${office.address}${office.hours ? ` (${office.hours})` : ""}`;
}

export function readyMessage(
  number: string,
  deliveryType: string,
  office?: OfficeInfo | null,
): Message {
  const how =
    deliveryType === "delivery"
      ? "Eltip bermek üçin kurýer siziň bilen habarlaşar."
      : `Almaly ýeri: ${officeLabel(office)}.`;
  return { subject: `Sargyt ${number} taýýar`, text: `Sargydyňyz ${number} taýýar! ${how}` };
}

export function paymentReceivedMessage(number: string, amountLabel: string): Message {
  return {
    subject: `${number} sargydynyň tölegi alyndy`,
    text: `${number} sargydy üçin ${amountLabel} alyndy. Işe başladyk.`,
  };
}

export function pickupReminder(number: string, office?: OfficeInfo | null): Message {
  return {
    subject: `Sargyt ${number} size garaşýar`,
    text: `Ýatladýarys: sargyt ${number} taýýar, almaly ýeri: ${officeLabel(office)}.`,
  };
}

export function deadlineWarning(number: string, deadlineLabel: string): Message {
  return {
    subject: `${number} möhleti`,
    text: `⏰ ${number} sargydynyň möhleti ${deadlineLabel}.`,
  };
}

export function unclaimedManagerWarning(number: string, days: number): Message {
  return {
    subject: `${number} alynmady`,
    text: `📦 Sargyt ${number} taýýar, ${days} gün bäri alynmady.`,
  };
}

export function newOrderMessage(
  number: string,
  totalLabel: string,
  source: string,
  summary: string,
): Message {
  return {
    subject: `Täze sargyt ${number}`,
    text: `🔔 Täze sargyt <b>${number}</b> (${source}) — ${totalLabel}\n${summary}`,
  };
}

export function chatMessageToManager(number: string, body: string): Message {
  return { subject: `${number} boýunça habar`, text: `💬 ${number}: ${body.slice(0, 500)}` };
}

export function proofRequestMessage(number: string, url: string, reminder = false): Message {
  return {
    subject: `${number} sargydynyň terjimesini barlaň`,
    text:
      `${reminder ? "Ýatladýarys: terjime" : "Terjime"} ${number} barlag üçin taýýar. ` +
      `Çap etmezden öň atlary, seneleri we resminama belgilerini barlaň: ${url}
` +
      `Hemme zat dogry bolsa tassyklaň, ýalňyşlyk bar bolsa düzedilmeli ýerleri görkeziň.`,
  };
}

export function proofDecisionToManager(
  number: string,
  kind: "approved" | "changes",
  count = 0,
): Message {
  return kind === "approved"
    ? {
        subject: `Terjime ${number} tassyklandy`,
        text: `✅ Müşderi ${number} terjimesini tassyklady — çap edip bolýar.`,
      }
    : {
        subject: `${number} terjimesine bellikler`,
        text: `✏️ Müşderi ${number} terjimesine ${count} bellik galdyrdy. Sargydy CRM-de açyň.`,
      };
}

export function paymentRequestMessage(
  number: string,
  amountLabel: string,
  reason: string | null,
  url: string,
): Message {
  return {
    subject: `${number} sargydynyň tölegi`,
    text:
      `${number} sargydy üçin ${amountLabel} tölemeli${reason ? ` — ${reason}` : ""}. ` +
      `Töleg salgylanmasy: ${url}`,
  };
}

export function refundMessage(number: string, amountLabel: string): Message {
  return {
    subject: `${number} sargydy boýunça puly gaýtarmak`,
    text: `${number} sargydy boýunça ${amountLabel} gaýtarmak resmileşdirildi. Pul şol bir usul bilen, adatça 1–5 iş gününde gaýtarylýar.`,
  };
}

/** Удаляет HTML-разметку (для SMS/email). */
export function plain(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}
