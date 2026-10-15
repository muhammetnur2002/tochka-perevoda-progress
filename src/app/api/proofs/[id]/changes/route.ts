import { NextResponse, type NextRequest } from "next/server";
import { requestMeta } from "@/lib/auth/session";
import { requireOrderAccess } from "@/lib/services/order-access";
import { proofOrderId, requestChanges } from "@/lib/services/proof-service";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { errorResponse, tooManyRequests } from "@/lib/api";
import { badRequest, forbidden } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** Клиент отправляет замечания (исправления ключевых данных и метки на страницах). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw badRequest("Некорректная версия");
    if (!(await checkRateLimit({ bucket: "proof-decision", identifier: clientIp(req.headers), limit: 20, windowMs: 10 * 60_000 }))) {
      return tooManyRequests();
    }
    const access = await requireOrderAccess(req, await proofOrderId(params.id));
    if (access.mode !== "owner" && access.mode !== "guest") throw forbidden("Решение принимает клиент");
    const body: unknown = await req.json().catch(() => null);
    const count = await requestChanges(params.id, body, { actorId: access.actor?.id, actorRole: access.mode, ...requestMeta(req) });
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    return errorResponse(err);
  }
}
