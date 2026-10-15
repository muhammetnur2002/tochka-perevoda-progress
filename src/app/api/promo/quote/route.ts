import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { deliveryTypeSchema, orderItemSchema, urgencySchema } from "@/lib/validation/order";
import { quoteOrder } from "@/lib/services/order-service";
import { normalizePromoCode, resolvePromo } from "@/lib/services/promo-service";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { errorResponse, parseJson, tooManyRequests } from "@/lib/api";
import { isDemoMode } from "@/lib/config/env";

export const dynamic = "force-dynamic";

const quoteSchema = z.object({
  code: z.string().trim().max(40).optional().nullable(),
  items: z.array(orderItemSchema).min(1).max(50),
  urgency: urgencySchema.default("standard"),
  notaryRequested: z.boolean().default(false),
  deliveryType: deliveryTypeSchema.default("pickup"),
});

/**
 * POST /api/promo/quote — какая скидка полагается на корзину: введённый код и/или
 * автоскидка. Ответ содержит публичные условия (для расчёта на клиенте тем же
 * движком цен) и причину отказа, если код не подошёл.
 * Подбор кодов ограничен: 10 попыток с кодом за 10 минут с одного IP.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req.headers);
    const { code, ...order } = await parseJson(req, quoteSchema);
    const withCode = Boolean(code?.trim());
    const allowed = await checkRateLimit({
      bucket: withCode ? "promo-code" : "promo-auto",
      identifier: ip,
      limit: withCode ? 10 : 120,
      windowMs: 10 * 60_000,
    });
    if (!allowed) return tooManyRequests();

    // Без БД (демо-режим) скидок нет
    const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    if (isDemoMode() || !configured) return NextResponse.json({ promo: null, auto: false, error: null });

    const quote = await quoteOrder(order);
    const { promo, codeError } = await resolvePromo({ code, items: quote.items, options: quote.options });
    const byCode = Boolean(promo && code && promo.row.code === normalizePromoCode(code));
    return NextResponse.json({ promo: promo?.rule ?? null, auto: Boolean(promo) && !byCode, error: codeError });
  } catch (err) {
    return errorResponse(err);
  }
}
