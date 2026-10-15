import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmMockPayment } from "@/lib/payments";
import { requireOrderAccess } from "@/lib/services/order-access";
import { errorResponse } from "@/lib/api";
import { notFound } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments/[id]/mock-confirm — «Я оплатил(а)» в тестовом режиме.
 * Работает только с mock-провайдером (без ключей ЮKassa) и вне продакшена
 * (или с ALLOW_MOCK_PAYMENTS=true для демо-стенда).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = createAdminClient();
    const { data: payment } = await admin.from("payments").select("order_id").eq("id", params.id).maybeSingle();
    if (!payment) throw notFound("Платёж не найден");
    await requireOrderAccess(req, payment.order_id);
    await confirmMockPayment(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
