import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStorage } from "@/lib/storage";
import { isCronAuthorized } from "@/lib/auth/session";
import { errorResponse } from "@/lib/api";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/retention — раз в сутки: удаляет из хранилища файлы заказов,
 * завершённых/отменённых более N дней назад (settings.file_retention_days, по
 * умолчанию 90). В БД остаётся запись с deleted_at — для аудита (152-ФЗ: срок
 * хранения ПД ограничен целью обработки).
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const admin = createAdminClient();
    const { data: setting } = await admin.from("settings").select("value").eq("key", "file_retention_days").maybeSingle();
    const days = Math.max(7, Number(setting?.value) || 90);
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data: orders } = await admin
      .from("orders")
      .select("id")
      .in("status", ["completed", "cancelled", "issued"])
      .lt("updated_at", cutoff)
      .limit(200);
    const orderIds = (orders ?? []).map((o) => o.id);
    if (orderIds.length === 0) return NextResponse.json({ ok: true, removed: 0, days });

    const { data: files } = await admin
      .from("files")
      .select("id, storage_path")
      .in("order_id", orderIds)
      .is("deleted_at", null)
      .limit(1000);

    const storage = await getStorage();
    let removed = 0;
    for (const file of files ?? []) {
      try {
        await storage.remove(file.storage_path);
        await admin.from("files").update({ deleted_at: new Date().toISOString() }).eq("id", file.id);
        removed += 1;
      } catch (err) {
        logger.warn("Retention: не удалось удалить файл", { id: file.id, error: (err as Error).message });
      }
    }

    // Страницы переводов на сверке — тоже персональные данные: удаляем из хранилища,
    // в БД остаются решение клиента, хэш и журнал (pages = [] — страницы удалены)
    const { data: proofs } = await admin
      .from("proofs")
      .select("id, pages")
      .in("order_id", orderIds)
      .filter("pages", "neq", "[]")
      .limit(200);
    let proofPages = 0;
    for (const proof of proofs ?? []) {
      try {
        for (const page of proof.pages) await storage.remove(page.path);
        await admin.from("proofs").update({ pages: [] }).eq("id", proof.id);
        proofPages += proof.pages.length;
      } catch (err) {
        logger.warn("Retention: не удалось удалить страницы сверки", { id: proof.id, error: (err as Error).message });
      }
    }

    logger.info("Cron retention", { removed, proofPages, days });
    return NextResponse.json({ ok: true, removed, proofPages, days });
  } catch (err) {
    return errorResponse(err);
  }
}
