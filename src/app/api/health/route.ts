import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — проверка для балансировщика/мониторинга.
 * 200 — БД доступна; 503 — нет. Секреты не раскрываются, только режимы драйверов.
 */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" | "not_configured" = "not_configured";

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { error } = await createAdminClient().from("services").select("id", { head: true, count: "exact" });
      database = error ? "error" : "ok";
    } catch {
      database = "error";
    }
  }

  const body = {
    status: database === "ok" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - started,
    database,
    payments: getPaymentProvider().name,
    storage: process.env.STORAGE_DRIVER ?? "supabase",
    telegram: process.env.TELEGRAM_BOT_TOKEN ? "configured" : "mock",
    sms: process.env.SMSRU_API_ID ? "configured" : "mock",
    email: process.env.SMTP_HOST ? "configured" : "mock",
  };
  return NextResponse.json(body, { status: database === "error" ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
