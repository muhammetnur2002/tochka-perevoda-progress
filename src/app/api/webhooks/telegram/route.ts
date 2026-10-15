import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { handleUpdate } from "@/lib/telegram/bot";
import type { TelegramUpdate } from "@/lib/telegram/types";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function secretOk(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production"; // в проде секрет обязателен
  const got = Buffer.from(req.headers.get("x-telegram-bot-api-secret-token") ?? "");
  const exp = Buffer.from(expected);
  return got.length === exp.length && timingSafeEqual(got, exp);
}

/**
 * POST /api/webhooks/telegram — апдейты бота.
 * Проверка X-Telegram-Bot-Api-Secret-Token (задаётся в scripts/telegram-set-webhook.ts).
 */
export async function POST(req: NextRequest) {
  if (!secretOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const update = (await req.json()) as TelegramUpdate;
    await handleUpdate(update);
  } catch (err) {
    logger.error("Ошибка обработки апдейта бота", { error: (err as Error).message });
  }
  // Всегда 200: иначе Telegram будет повторять апдейт
  return NextResponse.json({ ok: true });
}
