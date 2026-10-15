import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrderAccess } from "@/lib/services/order-access";
import { errorResponse } from "@/lib/api";
import { notFound } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** GET /api/payments/[id] — статус платежа и заказа (поллинг страницы оплаты СБП/QR). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = createAdminClient();
    const { data: payment } = await admin
      .from("payments")
      .select("id, order_id, amount, status, method, paid_at, order:orders(public_number, status)")
      .eq("id", params.id)
      .maybeSingle();
    if (!payment) throw notFound("Платёж не найден");

    await requireOrderAccess(req, payment.order_id);
    return NextResponse.json(
      {
        payment: {
          id: payment.id,
          amount: payment.amount,
          status: payment.status,
          method: payment.method,
          paidAt: payment.paid_at,
        },
        order: payment.order,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
