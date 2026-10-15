import "server-only";
import { logger } from "@/lib/logger";

/** Отправка SMS через SMS.ru. Без API-ключа — заглушка в лог. */
export async function sendSms(phone: string, text: string): Promise<string | null> {
  const apiId = process.env.SMSRU_API_ID;
  if (!apiId) {
    if (process.env.NODE_ENV === "production") throw new Error("SMS.ru не настроен");
    logger.info("[sms:mock]", { phone, text });
    return null;
  }

  const params = new URLSearchParams({
    api_id: apiId,
    to: phone,
    msg: text,
    json: "1",
  });
  if (process.env.SMSRU_SENDER_NAME) params.set("from", process.env.SMSRU_SENDER_NAME);

  const res = await fetch(`https://sms.ru/sms/send?${params.toString()}`);
  const data = await res.json();

  if (data.status !== "OK") {
    logger.error("Ошибка SMS.ru", { data });
    throw new Error(`SMS.ru: ${data.status_text ?? data.status}`);
  }
  return String(data.sms?.[phone]?.sms_id ?? null);
}
