import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { errorResponse } from "@/lib/api";
import { getDashboardStats } from "@/lib/services/reports";

export const dynamic = "force-dynamic";

/** GET /api/admin/stats?days=30 — агрегаты для дашборда и отчётов (менеджер/админ). */
export async function GET(req: NextRequest) {
  try {
    const actor = await requirePermission("order.view_all");
    const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 30, 1), 366);
    return NextResponse.json(await getDashboardStats(actor.supabase, days));
  } catch (err) {
    return errorResponse(err);
  }
}
