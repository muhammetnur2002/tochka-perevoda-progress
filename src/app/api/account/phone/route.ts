import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/auth/session";
import { sendSms } from "@/lib/notifications/sms";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, parseJson, tooManyRequests } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { isValidRuPhone, normalizePhone } from "@/lib/format/phone";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(userId: string, code: string): string {
  const pepper = process.env.ORDER_ACCESS_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`${userId}:${code}:${pepper}`).digest("hex");
}

/**
 * POST /api/account/phone { phone } — отправить SMS-код подтверждения.
 * PUT  /api/account/phone { code }  — подтвердить: телефон сохраняется в профиле,
 *   и к аккаунту привязываются гостевые заказы с этим номером.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor();
    if (!(await checkRateLimit({ bucket: "phone-code", identifier: actor.id, limit: 3, windowMs: 15 * 60_000 }))) {
      return tooManyRequests();
    }
    const { phone } = await parseJson(
      req,
      z.object({ phone: z.string().refine(isValidRuPhone, "Введите номер телефона РФ") }),
    );
    const normalized = normalizePhone(phone);
    const code = String(randomInt(100000, 1000000));

    const admin = createAdminClient();
    const { error } = await admin.from("phone_verifications").insert({
      user_id: actor.id,
      phone: normalized,
      code_hash: hashCode(actor.id, code),
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });
    if (error) throw error;

    await sendSms(normalized, `Код подтверждения «Точка Перевода»: ${code}`);
    if (!process.env.SMSRU_API_ID) logger.info("[dev] код подтверждения телефона", { phone: normalized, code });
    return NextResponse.json({ ok: true, expiresIn: CODE_TTL_MS / 1000 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = await requireActor();
    const { code } = await parseJson(req, z.object({ code: z.string().regex(/^\d{6}$/, "Код — 6 цифр") }));
    const admin = createAdminClient();

    const { data: v } = await admin
      .from("phone_verifications")
      .select("*")
      .eq("user_id", actor.id)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!v || new Date(v.expires_at).getTime() < Date.now()) throw badRequest("Код истёк — запросите новый");
    if (v.attempts >= MAX_ATTEMPTS) throw badRequest("Слишком много попыток — запросите новый код");

    const expected = Buffer.from(v.code_hash);
    const actual = Buffer.from(hashCode(actor.id, code));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await admin.from("phone_verifications").update({ attempts: v.attempts + 1 }).eq("id", v.id);
      throw badRequest("Неверный код");
    }

    const now = new Date().toISOString();
    await admin.from("phone_verifications").update({ verified_at: now }).eq("id", v.id);
    const { error } = await admin.from("users").update({ phone: v.phone, phone_verified_at: now }).eq("id", actor.id);
    if (error) throw error;
    const { data: claimed } = await admin.rpc("claim_guest_orders", { p_user_id: actor.id });

    return NextResponse.json({ ok: true, phone: v.phone, claimedOrders: claimed ?? 0 });
  } catch (err) {
    return errorResponse(err);
  }
}
