import "server-only";
import ExcelJS from "exceljs";

/**
 * Выгрузка таблиц в Excel (xlsx) и CSV, совместимый с Excel в русской локали:
 * UTF-8 с BOM, разделитель «;», десятичная запятая.
 */

export interface Column<Row> {
  header: string;
  width?: number;
  value: (row: Row) => string | number | Date | null | undefined;
  /** Формат числа в Excel, например '#,##0.00 "₽"'. */
  numFmt?: string;
}

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (value instanceof Date) s = value.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
  else if (typeof value === "number") s = String(value).replace(".", ",");
  else s = String(value);
  // защита от CSV-инъекций формул в Excel
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<Row>(rows: Row[], columns: Column<Row>[]): string {
  const lines = [
    columns.map((c) => csvCell(c.header)).join(";"),
    ...rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(";")),
  ];
  return "﻿" + lines.join("\r\n");
}

export async function toXlsx<Row>(sheetName: string, rows: Row[], columns: Column<Row>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Точка Перевода Прогресс";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c, i) => ({ header: c.header, key: `c${i}`, width: c.width ?? 18 }));
  for (const row of rows) {
    ws.addRow(Object.fromEntries(columns.map((c, i) => [`c${i}`, c.value(row) ?? null])));
  }
  columns.forEach((c, i) => {
    if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt;
  });
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00214C" } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
