import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { errorResponse, parseJson, tooManyRequests } from "@/lib/api";
import { isValidRuPhone, normalizePhone } from "@/lib/format/phone";

export const dynamic = "force-dynamic";

const lookupSchema = z.object({
  number: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase().replace(/^TP/, "ТП"))
    .pipe(z.string().regex(/^ТП-\d{4}-\d{5,7}$/, "Номер вида ТП-2026-000123")),
  phone: z.string().trim().refine(isValidRuPhone, "Введите телефон, указанный в заказе"),
});

/**
 * POST /api/orders/lookup — публичная проверка статуса.
 * Требует ОБА поля: номер заказа и телефон (номера последовательные — по одному
 * номеру нельзя раскрывать данные). Лимит: 5 запросов за 10 минут с IP.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req.headers);
    if (!(await checkRateLimit({ bucket: "order-lookup", identifier: ip, limit: 5, windowMs: 10 * 60_000 }))) {
      return tooManyRequests();
    }
    const { number, phone } = await parseJson(req, lookupSchema);

    const admin = createAdminClient();
    const { data: order, error } = await admin
      .from("orders")
      .select(
        "id, public_number, status, total_price, paid_amount, deadline, delivery_type, created_at, client:clients(phone), items:order_items(name_snapshot, quantity)",
      )
      .eq("public_number", number)
      .maybeSingle();
    if (error) throw error;

    // Одинаковый ответ для «нет заказа» и «не тот телефон» — не раскрываем существование
    if (!order || order.client?.phone !== normalizePhone(phone)) {
      return NextResponse.json({ order: null });
    }

    const { data: history } = await admin
      .from("status_history")
      .select("to_status, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      order: {
        public_number: order.public_number,
        status: order.status,
        total_price: order.total_price,
        paid: Number(order.paid_amount) >= Number(order.total_price),
        deadline: order.deadline,
        delivery_type: order.delivery_type,
        created_at: order.created_at,
        items: order.items ?? [],
        history: history ?? [],
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
