import { NextResponse, type NextRequest } from "next/server";
import { requireOrderAccess } from "@/lib/services/order-access";
import { proofOrderId, renderProofPage } from "@/lib/services/proof-service";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { errorResponse, tooManyRequests } from "@/lib/api";
import { badRequest } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/proofs/{id}/pages/{n} — страница перевода с водяным знаком (JPEG).
 * Оригинал клиенту не отдаётся никогда; ответ не кэшируется.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string; n: string } }) {
  try {
    const n = Number(params.n);
    if (!/^[0-9a-f-]{36}$/i.test(params.id) || !Number.isInteger(n) || n < 1) throw badRequest("Некорректная страница");
    if (!(await checkRateLimit({ bucket: "proof-page", identifier: clientIp(req.headers), limit: 400, windowMs: 10 * 60_000 }))) {
      return tooManyRequests();
    }
    const orderId = await proofOrderId(params.id);
    const access = await requireOrderAccess(req, orderId);
    const kind = access.mode === "owner" || access.mode === "guest" ? "client" : "staff";
    const image = await renderProofPage(params.id, n, { kind });
    return new NextResponse(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
