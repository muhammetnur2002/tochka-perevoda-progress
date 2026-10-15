import { NextResponse, type NextRequest } from "next/server";
import { handlePaymentWebhook } from "@/lib/payments";
import { isYookassaIp, parseNotification } from "@/lib/payments/webhook";
import { clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { ApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/payment — HTTP-уведомления ЮKassa.
 * 1) IP-allowlist ЮKassa (за прокси нужен корректный X-Forwarded-For);
 * 2) телу не доверяем — статус и сумма перезапрашиваются у API ЮKassa;
 * 3) идемпотентно по provider_payment_id (повторы безопасны).
 * Отвечаем 200 на всё обработанное, иначе ЮKassa будет повторять 24 часа.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  if (process.env.YOOKASSA_SKIP_IP_CHECK !== "true" && !isYookassaIp(ip)) {
    logger.warn("Вебхук платежа с недоверенного IP", { ip });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = parseNotification(body);
  if (!parsed) return NextResponse.json({ ok: true, ignored: true });

  try {
    const result = await handlePaymentWebhook(parsed.paymentId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      // платёж не из нашей БД (например, другой магазин) — не просим повторять
      return NextResponse.json({ ok: true, ignored: true });
    }
    logger.error("Ошибка обработки вебхука платежа", { error: (err as Error).message });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
