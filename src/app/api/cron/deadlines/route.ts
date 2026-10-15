import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/auth/session";
import { notifyDeadlineApproaching, notifyUnclaimedOrders, retryFailedNotifications } from "@/lib/notifications";
import { errorResponse } from "@/lib/api";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/deadlines — раз в час: дедлайн < 24 ч (менеджерам),
 * «готов, не забран > 3 дней» (клиенту и менеджерам), повтор неудачных отправок.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [deadlines, unclaimed, retry] = await Promise.all([
      notifyDeadlineApproaching(),
      notifyUnclaimedOrders(),
      retryFailedNotifications(),
    ]);
    logger.info("Cron deadlines", { deadlines, unclaimed, ...retry });
    return NextResponse.json({ ok: true, deadlines, unclaimed, retry });
  } catch (err) {
    return errorResponse(err);
  }
}
