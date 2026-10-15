import { NextResponse, type NextRequest } from "next/server";
import { requestMeta } from "@/lib/auth/session";
import { requireOrderAccess } from "@/lib/services/order-access";
import { officeApprove, proofOrderId } from "@/lib/services/proof-service";
import { errorResponse } from "@/lib/api";
import { badRequest, forbidden } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** Подтверждение в офисе: клиент проверил перевод при посещении и расписался — отмечает менеджер. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw badRequest("Некорректная версия");
    const access = await requireOrderAccess(req, await proofOrderId(params.id));
    if (access.mode !== "manager") throw forbidden("Подтверждать в офисе может менеджер");
    await officeApprove(params.id, { actorId: access.actor!.id, actorRole: access.actor!.role, ...requestMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
