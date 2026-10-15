import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStorage, SIGNED_URL_TTL } from "@/lib/storage";
import { requireOrderAccess } from "@/lib/services/order-access";
import { errorResponse } from "@/lib/api";
import { notFound } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/files/[id]/url — подписанная ссылка на скачивание (TTL 5 минут).
 * Права — как на заказ: владелец, гость с токеном, менеджер, назначенный исполнитель.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = createAdminClient();
    const { data: file } = await admin
      .from("files")
      .select("id, order_id, storage_path, original_name, deleted_at")
      .eq("id", params.id)
      .maybeSingle();
    if (!file || !file.order_id || file.deleted_at) throw notFound("Файл не найден");

    await requireOrderAccess(req, file.order_id);

    const storage = await getStorage();
    const url = await storage.getSignedUrl(file.storage_path, SIGNED_URL_TTL, file.original_name);
    return NextResponse.json(
      { url, expiresIn: SIGNED_URL_TTL, name: file.original_name },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
