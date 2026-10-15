import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/auth/session";
import { retryFailedNotifications } from "@/lib/notifications";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications — воркер очереди уведомлений: повторяет неудачные
 * отправки с экспоненциальной задержкой (до 5 попыток). Вызывается по cron.
 * Авторизация: Authorization: Bearer <CRON_SECRET>.
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await retryFailedNotifications()) });
  } catch (err) {
    return errorResponse(err);
  }
}
