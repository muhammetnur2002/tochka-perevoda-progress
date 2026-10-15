import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { signInTelegramUser } from "@/lib/telegram/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { errorResponse, parseJson, tooManyRequests } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({ initData: z.string().min(1).max(4096) });

/**
 * POST /api/telegram/auth — вход пользователя Mini App по initData.
 * Подпись проверяется HMAC-SHA256 на токене бота; затем выдаётся сессия
 * Supabase (cookie), и все дальнейшие запросы Mini App идут под RLS клиента.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await checkRateLimit({ bucket: "tg-auth", identifier: clientIp(req.headers), limit: 30, windowMs: 10 * 60_000 }))) {
      return tooManyRequests();
    }
    const { initData } = await parseJson(req, schema);
    const result = await signInTelegramUser(initData);

    const supabase = createClient();
    const { error } = await supabase.auth.setSession({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    });
    if (error) throw error;

    return NextResponse.json({ userId: result.userId, isNew: result.isNew });
  } catch (err) {
    return errorResponse(err);
  }
}
