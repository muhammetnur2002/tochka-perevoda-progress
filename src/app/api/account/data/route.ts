import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/auth/session";
import { errorResponse } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * 152-ФЗ, ст. 14 и 21:
 * GET    /api/account/data — выгрузка всех ПД пользователя (JSON).
 * DELETE /api/account/data — отзыв согласия и удаление ПД: профиль и карточки
 *   клиента обезличиваются, файлы заказов удаляются из хранилища, учётная запись
 *   удаляется. Финансовые записи заказов сохраняются обезличенными (учёт).
 */
export async function GET() {
  try {
    const actor = await requireActor();
    const db = actor.supabase;
    const [profile, clients, orders, consents, messages, notifications] = await Promise.all([
      db.from("users").select("*").eq("id", actor.id).maybeSingle(),
      db.from("clients").select("*").eq("user_id", actor.id),
      db
        .from("orders")
        .select("*, items:order_items(*), payments(amount, method, status, paid_at), files(original_name, kind, created_at)")
        .eq("user_id", actor.id),
      db.from("consents").select("*").eq("user_id", actor.id),
      db.from("chat_messages").select("order_id, body, created_at").eq("sender_id", actor.id),
      db.from("notifications").select("channel, subject, message, created_at").eq("user_id", actor.id),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      operator: "Бюро переводов «Точка Перевода Прогресс», г. Казань, ул. Сибирский Тракт, 7/6",
      profile: profile.data,
      clients: clients.data ?? [],
      orders: orders.data ?? [],
      consents: consents.data ?? [],
      chat_messages: messages.data ?? [],
      notifications: notifications.data ?? [],
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="my-personal-data.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE() {
  try {
    const actor = await requireActor();
    const admin = createAdminClient();

    // 1. Файлы заказов пользователя
    const { data: orders } = await admin.from("orders").select("id").eq("user_id", actor.id);
    const orderIds = (orders ?? []).map((o) => o.id);
    if (orderIds.length) {
      const { data: files } = await admin
        .from("files")
        .select("id, storage_path")
        .in("order_id", orderIds)
        .is("deleted_at", null);
      const storage = await getStorage();
      for (const f of files ?? []) {
        await storage.remove(f.storage_path).catch((e: unknown) =>
          logger.warn("Не удалось удалить файл при удалении ПД", { id: f.id, error: (e as Error).message }),
        );
      }
      await admin.from("files").update({ deleted_at: new Date().toISOString() }).in("order_id", orderIds);
      await admin.from("chat_messages").delete().in("order_id", orderIds);
      await admin.from("orders").update({ delivery_address: null, comment: null, user_id: null }).in("id", orderIds);
    }

    // 2. Обезличивание карточек клиента и профиля
    await admin.from("clients").update({ name: "Удалено по запросу", phone: null, email: null, inn: null, user_id: null }).eq("user_id", actor.id);
    await admin.from("notifications").delete().eq("user_id", actor.id);
    await admin.from("consents").update({ phone: null, ip: null, user_agent: null }).eq("user_id", actor.id);

    // 3. Удаление учётной записи (профиль users удалится каскадно)
    const { error } = await admin.auth.admin.deleteUser(actor.id);
    if (error) throw error;
    await actor.supabase.auth.signOut().catch(() => undefined);

    logger.info("ПД пользователя удалены по запросу (152-ФЗ)", { userId: actor.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
