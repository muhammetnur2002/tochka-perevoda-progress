import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Коды статусов SMS.ru: 103 — доставлено; 104–108, 150 — не доставлено. */
const FAILED_CODES = new Set(["104", "105", "106", "107", "108", "150"]);

/**
 * POST /api/webhooks/sms?secret=… — callback статусов доставки SMS.ru.
 * Формат: data[N]="sms_status\n<sms_id>\n<код>". Ответ должен быть «100».
 * URL с секретом указывается в кабинете SMS.ru (SMSRU_CALLBACK_SECRET).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SMSRU_CALLBACK_SECRET;
  if (!secret || req.nextUrl.searchParams.get("secret") !== secret) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const admin = createAdminClient();
  for (const [key, value] of form?.entries() ?? []) {
    if (!key.startsWith("data")) continue;
    const [type, smsId, code] = String(value).split("\n");
    if (type !== "sms_status" || !smsId || !code) continue;
    if (FAILED_CODES.has(code)) {
      await admin
        .from("notifications")
        .update({ status: "failed", last_error: `SMS.ru: код ${code}` })
        .eq("channel", "sms")
        .eq("provider_id", smsId);
      logger.warn("SMS не доставлено", { smsId, code });
    }
  }
  return new NextResponse("100");
}
