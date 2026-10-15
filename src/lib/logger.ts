/** Простой структурированный логгер (JSON-строки для продакшена). */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function write(level: Level, message: string, meta?: Record<string, unknown>): void {
  const threshold = (process.env.LOG_LEVEL as Level) ?? "info";
  if (LEVEL_ORDER[level] < LEVEL_ORDER[threshold]) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const line = process.env.NODE_ENV === "production"
    ? JSON.stringify(entry)
    : `${entry.ts} [${level.toUpperCase()}] ${message}${meta ? " " + JSON.stringify(meta) : ""}`;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => write("debug", m, meta),
  info: (m: string, meta?: Record<string, unknown>) => write("info", m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => write("warn", m, meta),
  error: (m: string, meta?: Record<string, unknown>) => write("error", m, meta),
};
