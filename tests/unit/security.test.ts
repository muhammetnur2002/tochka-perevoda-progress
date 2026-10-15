import { describe, expect, it } from "vitest";
import { issueOrderToken, verifyOrderToken } from "@/lib/auth/order-access";
import { can, canTransition, homePathForRole } from "@/lib/auth/roles";
import { csvCell, toCsv } from "@/lib/export/table";

const ORDER = "3f1c0b7e-8d0a-4a51-9a40-1f6f4d8f2b11";
const OTHER = "7a1c0b7e-8d0a-4a51-9a40-1f6f4d8f2b99";

describe("токен гостевого доступа к заказу", () => {
  it("действует для своего заказа", () => {
    expect(verifyOrderToken(ORDER, issueOrderToken(ORDER))).toBe(true);
  });

  it("не подходит к чужому заказу и не подделывается", () => {
    const token = issueOrderToken(ORDER);
    expect(verifyOrderToken(OTHER, token)).toBe(false);
    expect(verifyOrderToken(ORDER, token.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBe(false);
    expect(verifyOrderToken(ORDER, null)).toBe(false);
    expect(verifyOrderToken(ORDER, "garbage")).toBe(false);
  });

  it("истекает через 24 часа", () => {
    const token = issueOrderToken(ORDER, Date.now() - 25 * 3600_000);
    expect(verifyOrderToken(ORDER, token)).toBe(false);
  });
});

describe("матрица прав", () => {
  it("переходы статусов: вперёд — да, на шаг назад — да, назад через шаг — нет", () => {
    expect(canTransition("new", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "ready")).toBe(true);
    expect(canTransition("ready", "in_progress")).toBe(true);
    expect(canTransition("ready", "new")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
    expect(canTransition("in_progress", "cancelled")).toBe(true);
    expect(canTransition("cancelled", "new")).toBe(true);
    expect(canTransition("new", "new")).toBe(false);
  });

  it("права по ролям", () => {
    expect(can("manager", "order.change_status")).toBe(true);
    expect(can("translator", "order.change_status")).toBe(false);
    expect(can("translator", "task.update_own")).toBe(true);
    expect(can("manager", "audit.view")).toBe(false);
    expect(can("admin", "user.change_role")).toBe(true);
    expect(can("client", "order.view_all")).toBe(false);
    expect(can(null, "order.view_all")).toBe(false);
  });

  it("домашняя страница по роли", () => {
    expect(homePathForRole("admin")).toBe("/admin");
    expect(homePathForRole("translator")).toBe("/workspace");
    expect(homePathForRole("client")).toBe("/account");
  });
});

describe("CSV для Excel (RU)", () => {
  it("BOM, разделитель «;», десятичная запятая", () => {
    const csv = toCsv([{ a: "Заказ", b: 1234.5 }], [
      { header: "Номер", value: (r) => r.a },
      { header: "Сумма", value: (r) => r.b },
    ]);
    expect(csv.startsWith("﻿Номер;Сумма\r\nЗаказ;1234,5")).toBe(true);
  });

  it("экранирует кавычки/разделители и нейтрализует формулы (CSV-инъекция)", () => {
    expect(csvCell('ООО "Ромашка"; филиал')).toBe('"ООО ""Ромашка""; филиал"');
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toMatch(/^"?'=/);
    expect(csvCell("+79001234567")).toBe("'+79001234567");
    expect(csvCell(null)).toBe("");
  });
});
