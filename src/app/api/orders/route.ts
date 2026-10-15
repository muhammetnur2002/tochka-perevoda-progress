import { NextResponse, type NextRequest } from "next/server";
import { createOrder } from "@/lib/services/order-service";
import { createOrderSchema } from "@/lib/validation/order";
import { getActor, requestMeta, requireActor } from "@/lib/auth/session";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { errorResponse, parseJson, tooManyRequests } from "@/lib/api";
import { isOrderStatus } from "@/lib/config/constants";
import { isManagerRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders — создание заказа (гость или клиент). Цена — только на сервере.
 * Ответ содержит accessToken: им гость подтверждает доступ к загрузке и оплате.
 * GET  /api/orders — список заказов (клиент — свои, менеджер — все; по RLS).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req.headers);
    if (!(await checkRateLimit({ bucket: "order-create", identifier: ip, limit: 5, windowMs: 10 * 60_000 }))) {
      return tooManyRequests();
    }
    const input = await parseJson(req, createOrderSchema);
    const actor = await getActor();
    const meta = requestMeta(req);
    const result = await createOrder(input, { actorId: actor?.id, ip: meta.ip, userAgent: meta.userAgent });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor();
    const status = req.nextUrl.searchParams.get("status");
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50, 500);
    const includeClosed = req.nextUrl.searchParams.get("closed") === "1";

    let query = actor.supabase
      .from("orders")
      .select(
        "id, public_number, status, total_price, paid_amount, deadline, delivery_type, source, language_from, created_at, updated_at, client:clients(name, phone), items:order_items(service_id, name_snapshot, quantity), assignments:order_assignments(role, status, user_id, user:users(name))",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status && isOrderStatus(status)) query = query.eq("status", status);
    // Для канбана: закрытые заказы — только за последние 14 дней
    if (!includeClosed && isManagerRole(actor.role)) {
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
      query = query.or(`status.in.(new,confirmed,in_progress,ready),updated_at.gte.${since}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ orders: data ?? [], isManager: isManagerRole(actor.role) });
  } catch (err) {
    return errorResponse(err);
  }
}
