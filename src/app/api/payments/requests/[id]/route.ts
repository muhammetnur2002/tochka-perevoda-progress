import { NextResponse, type NextRequest } from "next/server";
import { requireOrderAccess } from "@/lib/services/order-access";
import { getPaymentRequestInfo } from "@/lib/payments/requests";
import { errorResponse } from "@/lib/api";
import { badRequest } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/payments/requests/{id} — сумма и причина ссылки на оплату из CRM для страницы оплаты.
 * Доступ: владелец заказа или гость с токеном из ссылки.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw badRequest("Некорректная ссылка");
    const info = await getPaymentRequestInfo(params.id);
    await requireOrderAccess(req, info.orderId);
    return NextResponse.json(
      { request: info.request, order: info.order },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
