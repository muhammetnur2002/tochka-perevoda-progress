import { NextResponse, type NextRequest } from "next/server";
import { createPaymentSchema } from "@/lib/validation/payment";
import { createOrderPayment, mockPaymentsEnabled } from "@/lib/payments";
import { requireOrderAccess } from "@/lib/services/order-access";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { errorResponse, parseJson, tooManyRequests } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments — создание платежа по заказу (СБП / QR / карта).
 * Доступ: владелец, гость с токеном заказа или менеджер. Сумма — только с сервера.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await checkRateLimit({ bucket: "payment-create", identifier: clientIp(req.headers), limit: 10, windowMs: 10 * 60_000 }))) {
      return tooManyRequests();
    }
    const input = await parseJson(req, createPaymentSchema);
    await requireOrderAccess(req, input.orderId);
    const result = await createOrderPayment(input);
    return NextResponse.json({ ...result, mock: mockPaymentsEnabled() }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
