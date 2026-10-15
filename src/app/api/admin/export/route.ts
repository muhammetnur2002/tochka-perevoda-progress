import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { errorResponse } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { toCsv, toXlsx, type Column } from "@/lib/export/table";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/config/constants";

export const dynamic = "force-dynamic";

const MONEY = '#,##0.00 "₽"';
const DATE = "dd.mm.yyyy hh:mm";

interface ExportFile {
  name: string;
  csv: () => string;
  xlsx: () => Promise<Buffer>;
}

/**
 * GET /api/admin/export?type=orders|payments|clients&format=xlsx|csv&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Выгрузка для бухгалтерии и отчётов (менеджер/админ).
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await requirePermission("order.view_all");
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type") ?? "orders";
    const format = sp.get("format") === "csv" ? "csv" : "xlsx";
    const from = sp.get("from")
      ? new Date(`${sp.get("from")}T00:00:00+03:00`)
      : new Date(Date.now() - 31 * 86_400_000);
    const to = sp.get("to") ? new Date(`${sp.get("to")}T23:59:59+03:00`) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw badRequest("Неверный период");
    const db = actor.supabase;

    let file: ExportFile;

    if (type === "orders") {
      const { data, error } = await db
        .from("orders")
        .select(
          "public_number, status, source, subtotal, discount, urgency_coefficient, notary_fee, delivery_fee, total_price, paid_amount, deadline, created_at, client:clients(name, phone, email, inn), items:order_items(name_snapshot, quantity)",
        )
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at");
      if (error) throw error;
      type Row = NonNullable<typeof data>[number];
      const cols: Column<Row>[] = [
        { header: "Номер", value: (r) => r.public_number, width: 18 },
        { header: "Дата", value: (r) => new Date(r.created_at), numFmt: DATE },
        { header: "Статус", value: (r) => ORDER_STATUS_LABELS[r.status as OrderStatus] },
        { header: "Источник", value: (r) => r.source },
        { header: "Клиент", value: (r) => r.client?.name, width: 28 },
        { header: "Телефон", value: (r) => r.client?.phone },
        { header: "Email", value: (r) => r.client?.email, width: 24 },
        { header: "ИНН", value: (r) => r.client?.inn },
        {
          header: "Услуги",
          value: (r) => (r.items ?? []).map((i) => `${i.name_snapshot} × ${i.quantity}`).join("; "),
          width: 50,
        },
        { header: "Сумма услуг", value: (r) => Number(r.subtotal), numFmt: MONEY },
        { header: "Скидка", value: (r) => Number(r.discount), numFmt: MONEY },
        { header: "Срочность ×", value: (r) => Number(r.urgency_coefficient) },
        { header: "Заверение", value: (r) => Number(r.notary_fee), numFmt: MONEY },
        { header: "Доставка", value: (r) => Number(r.delivery_fee), numFmt: MONEY },
        { header: "Итого", value: (r) => Number(r.total_price), numFmt: MONEY },
        { header: "Оплачено", value: (r) => Number(r.paid_amount), numFmt: MONEY },
        {
          header: "Долг",
          value: (r) => Math.max(0, Number(r.total_price) - Number(r.paid_amount)),
          numFmt: MONEY,
        },
        { header: "Срок", value: (r) => (r.deadline ? new Date(r.deadline) : null), numFmt: DATE },
      ];
      const rows = data ?? [];
      file = { name: "orders", csv: () => toCsv(rows, cols), xlsx: () => toXlsx("Заказы", rows, cols) };
    } else if (type === "payments") {
      const { data, error } = await db
        .from("payments")
        .select("amount, method, status, provider, provider_payment_id, paid_at, created_at, order:orders(public_number)")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at");
      if (error) throw error;
      type Row = NonNullable<typeof data>[number];
      const cols: Column<Row>[] = [
        { header: "Заказ", value: (r) => r.order?.public_number, width: 18 },
        { header: "Создан", value: (r) => new Date(r.created_at), numFmt: DATE },
        { header: "Оплачен", value: (r) => (r.paid_at ? new Date(r.paid_at) : null), numFmt: DATE },
        { header: "Сумма", value: (r) => Number(r.amount), numFmt: MONEY },
        { header: "Способ", value: (r) => r.method },
        { header: "Статус", value: (r) => r.status },
        { header: "Провайдер", value: (r) => r.provider },
        { header: "ID платежа", value: (r) => r.provider_payment_id, width: 40 },
      ];
      const rows = data ?? [];
      file = { name: "payments", csv: () => toCsv(rows, cols), xlsx: () => toXlsx("Платежи", rows, cols) };
    } else if (type === "clients") {
      const { data, error } = await db
        .from("clients")
        .select("name, type, phone, email, inn, created_at, orders(total_price, paid_amount, status)")
        .order("created_at");
      if (error) throw error;
      type Row = NonNullable<typeof data>[number];
      const active = (r: Row) => (r.orders ?? []).filter((o) => o.status !== "cancelled");
      const cols: Column<Row>[] = [
        { header: "Клиент", value: (r) => r.name, width: 30 },
        { header: "Тип", value: (r) => (r.type === "company" ? "Юр. лицо" : "Физ. лицо") },
        { header: "Телефон", value: (r) => r.phone },
        { header: "Email", value: (r) => r.email, width: 26 },
        { header: "ИНН", value: (r) => r.inn },
        { header: "Заказов", value: (r) => active(r).length },
        {
          header: "Сумма заказов",
          value: (r) => active(r).reduce((s, o) => s + Number(o.total_price), 0),
          numFmt: MONEY,
        },
        {
          header: "Оплачено",
          value: (r) => active(r).reduce((s, o) => s + Number(o.paid_amount), 0),
          numFmt: MONEY,
        },
        { header: "Создан", value: (r) => new Date(r.created_at), numFmt: DATE },
      ];
      const rows = data ?? [];
      file = { name: "clients", csv: () => toCsv(rows, cols), xlsx: () => toXlsx("Клиенты", rows, cols) };
    } else {
      throw badRequest("Неизвестный тип выгрузки");
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${file.name}-${stamp}.${format}`;
    const body = format === "csv" ? file.csv() : new Uint8Array(await file.xlsx());
    return new NextResponse(body, {
      headers: {
        "Content-Type":
          format === "csv"
            ? "text/csv; charset=utf-8"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
