import { NextResponse, type NextRequest } from "next/server";
import { chatMessageSchema } from "@/lib/validation/chat";
import { requireActor } from "@/lib/auth/session";
import { isManagerRole } from "@/lib/auth/roles";
import { notifyChatMessage } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, parseJson, tooManyRequests } from "@/lib/api";
import { badRequest } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET  /api/chat?orderId=… — переписка по заказу (RLS: клиент заказа и менеджеры).
 * POST /api/chat — новое сообщение. Сообщение клиента уходит менеджерам в Telegram.
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor();
    const orderId = req.nextUrl.searchParams.get("orderId");
    if (!orderId) throw badRequest("Не указан заказ");
    const { data, error } = await actor.supabase
      .from("chat_messages")
      .select("id, order_id, sender_id, sender_role, body, created_at, read_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw error;

    // Отмечаем прочитанными входящие
    const incoming = (data ?? []).filter((m) => m.sender_id !== actor.id && !m.read_at).map((m) => m.id);
    if (incoming.length) {
      await actor.supabase.from("chat_messages").update({ read_at: new Date().toISOString() }).in("id", incoming);
    }
    return NextResponse.json({ messages: data ?? [], me: actor.id });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor();
    if (!(await checkRateLimit({ bucket: "chat", identifier: actor.id, limit: 30, windowMs: 60_000 }))) {
      return tooManyRequests();
    }
    const input = await parseJson(req, chatMessageSchema);
    const { data: message, error } = await actor.supabase
      .from("chat_messages")
      .insert({
        order_id: input.orderId,
        sender_id: actor.id,
        sender_role: actor.role,
        body: input.body,
      })
      .select("id, order_id, sender_id, sender_role, body, created_at, read_at")
      .single();
    if (error) throw error;

    if (!isManagerRole(actor.role)) {
      notifyChatMessage(input.orderId, input.body).catch(() => undefined);
    }
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
