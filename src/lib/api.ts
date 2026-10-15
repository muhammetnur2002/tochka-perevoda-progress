import "server-only";
import { NextResponse } from "next/server";
import type { ZodType, ZodTypeDef } from "zod";
import { ApiError, badRequest, errorBody, errorStatus } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** Разбирает JSON-тело запроса Zod-схемой; бросает 400 с первым сообщением. */
export async function parseJson<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  const body: unknown = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Некорректный запрос");
  }
  return parsed.data;
}

/** Ответ об ошибке API. Неожиданные ошибки логируются, клиенту — без деталей в проде. */
export function errorResponse(err: unknown): NextResponse {
  const status = errorStatus(err);
  if (!(err instanceof ApiError)) {
    logger.error("API error", { error: err instanceof Error ? err.message : String(err) });
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: { message: "Внутренняя ошибка сервера", code: "INTERNAL" } }, { status });
    }
  }
  return NextResponse.json(errorBody(err), { status });
}

/** 429 Too Many Requests. */
export function tooManyRequests(): NextResponse {
  return NextResponse.json(
    { error: { message: "Слишком много запросов. Попробуйте позже.", code: "RATE_LIMIT" } },
    { status: 429 },
  );
}
