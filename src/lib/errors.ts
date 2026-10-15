/** Единый тип ошибки API с HTTP-статусом и кодом. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = "INTERNAL",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function notFound(message = "Не найдено"): ApiError {
  return new ApiError(404, message, "NOT_FOUND");
}

export function badRequest(message = "Некорректный запрос"): ApiError {
  return new ApiError(400, message, "BAD_REQUEST");
}

export function unauthorized(message = "Требуется авторизация"): ApiError {
  return new ApiError(401, message, "UNAUTHORIZED");
}

export function forbidden(message = "Недостаточно прав"): ApiError {
  return new ApiError(403, message, "FORBIDDEN");
}

export function conflict(message = "Конфликт данных"): ApiError {
  return new ApiError(409, message, "CONFLICT");
}

/** Ошибка PostgREST/Postgres (объект, а не экземпляр Error). */
function dbErrorCode(err: unknown): string | null {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  return null;
}

/** Стандартный ответ ошибки для API routes. */
export function errorBody(err: unknown): { error: { message: string; code: string } } {
  if (err instanceof ApiError) {
    return { error: { message: err.message, code: err.code } };
  }
  const code = dbErrorCode(err);
  if (code === "42501") return { error: { message: "Недостаточно прав", code: "FORBIDDEN" } };
  if (code === "PGRST116") return { error: { message: "Не найдено", code: "NOT_FOUND" } };
  if (err instanceof Error) {
    return { error: { message: err.message, code: "INTERNAL" } };
  }
  if (err && typeof err === "object" && "message" in err) {
    return { error: { message: String((err as { message: unknown }).message), code: code ?? "INTERNAL" } };
  }
  return { error: { message: "Внутренняя ошибка", code: "INTERNAL" } };
}

/** Статус ответа по ошибке. */
export function errorStatus(err: unknown): number {
  if (err instanceof ApiError) return err.status;
  const code = dbErrorCode(err);
  if (code === "42501") return 403;
  if (code === "PGRST116") return 404;
  if (code === "23505") return 409;
  return 500;
}
