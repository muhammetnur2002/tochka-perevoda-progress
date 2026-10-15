import { NextResponse, type NextRequest } from "next/server";
import { updateOrderStatusSchema } from "@/lib/validation/order";
import { requireActor, requirePermission } from "@/lib/auth/session";
import { changeOrderStatus } from "@/lib/services/order-admin";
import { errorResponse, parseJson } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { isManagerRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/**
 * GET   /api/orders/[id] — карточка заказа (всё, что разрешает RLS текущему пользователю).
 * PATCH /api/orders/[id] — смена статуса/срока менеджером (+ история и уведомление клиента).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireActor();
    const db = actor.supabase;
    const { data: order, error } = await db
      .from("orders")
      .select("*, client:clients(name, phone, email, type, inn)")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw notFound("Заказ не найден");

    const [items, files, payments, history, assignments] = await Promise.all([
      db.from("order_items").select("*").eq("order_id", order.id).order("created_at"),
      db.from("files").select("id, original_name, mime_type, size_bytes, kind, created_at").eq("order_id", order.id).order("created_at"),
      db.from("payments").select("id, amount, method, status, provider, paid_at, created_at").eq("order_id", order.id).order("created_at", { ascending: false }),
      db.from("status_history").select("*").eq("order_id", order.id).order("created_at"),
      db.from("order_assignments").select("*, user:users!order_assignments_user_id_fkey(name)").eq("order_id", order.id),
    ]);

    return NextResponse.json({
      order,
      items: items.data ?? [],
      files: files.data ?? [],
      payments: payments.data ?? [],
      history: history.data ?? [],
      assignments: isManagerRole(actor.role) ? assignments.data ?? [] : [],
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission("order.change_status");
    const input = await parseJson(req, updateOrderStatusSchema);

    if (input.deadline !== undefined) {
      const { error } = await actor.supabase.from("orders").update({ deadline: input.deadline }).eq("id", params.id);
      if (error) throw error;
    }
    const result = await changeOrderStatus(actor.supabase, params.id, input.status, input.comment);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
