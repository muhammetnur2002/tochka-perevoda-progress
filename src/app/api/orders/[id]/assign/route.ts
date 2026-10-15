import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { assignExecutor } from "@/lib/services/order-admin";
import { errorResponse, parseJson } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["translator", "notary", "printer", "manager"]),
  orderItemId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  force: z.boolean().optional(),
});

/** POST /api/orders/[id]/assign — назначение исполнителя (менеджер). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission("order.assign");
    const input = await parseJson(req, schema);
    const result = await assignExecutor(actor.supabase, {
      orderId: params.id,
      assignedBy: actor.id,
      ...input,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
