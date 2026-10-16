import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrderAccess } from "@/lib/services/order-access";
import { errorResponse } from "@/lib/api";
import { badRequest, notFound } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/{id}/pay-summary — сколько и где платить (страница «Заказ оформлен»,
 * оплата в точке). Доступ: владелец заказа, гость с токеном, сотрудник.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw badRequest("Некорректный заказ");
    await requireOrderAccess(req, params.id);
    const { data: order } = await createAdminClient()
      .from("orders")
      .select("public_number, total_price, paid_amount, payment_mode, office:offices(address, hours, phone)")
      .eq("id", params.id)
      .maybeSingle();
    if (!order) throw notFound("Заказ не найден");
    return NextResponse.json(
      {
        publicNumber: order.public_number,
        total: Number(order.total_price),
        paid: Number(order.paid_amount),
        remaining: Math.max(0, Number(order.total_price) - Number(order.paid_amount)),
        paymentMode: order.payment_mode,
        office: order.office,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
