import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatPhone, isValidRuPhone, normalizePhone, phoneMask } from "@/lib/format/phone";
import { formatMoney, round2 } from "@/lib/format/money";
import {
  isClientNotifiableStatus,
  newOrderMessage,
  plain,
  readyMessage,
  statusChangedMessage,
} from "@/lib/notifications/templates";
import { SEED_SERVICES } from "@/lib/seed/services";

describe("телефоны", () => {
  it("нормализация к 7XXXXXXXXXX", () => {
    expect(normalizePhone("8 (917) 123-45-67")).toBe("79171234567");
    expect(normalizePhone("+7 917 123 45 67")).toBe("79171234567");
    expect(normalizePhone("9171234567")).toBe("79171234567");
  });

  it("валидация и маска ввода", () => {
    expect(isValidRuPhone("+7 (917) 123-45-67")).toBe(true);
    expect(isValidRuPhone("12345")).toBe(false);
    expect(phoneMask("89171234567")).toBe("+7 (917) 123-45-67");
    expect(formatPhone("79171234567")).toBe("+7 (917) 123-45-67");
  });
});

describe("деньги", () => {
  it("формат ru-RU и округление", () => {
    expect(formatMoney(2390).replace(/\s/g, " ")).toBe("2 390 ₽");
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
  });
});

describe("шаблоны уведомлений", () => {
  it("статусы для клиента", () => {
    expect(statusChangedMessage("ТП-2026-000124", "in_progress").text).toContain("переводится");
    expect(isClientNotifiableStatus("new")).toBe(false);
    expect(isClientNotifiableStatus("ready")).toBe(true);
  });

  it("готовность: адрес выдачи или доставка", () => {
    expect(readyMessage("ТП-1", "pickup").text).toContain("Сибирский Тракт, 7/6");
    expect(readyMessage("ТП-1", "delivery").text).toContain("Курьер");
  });

  it("HTML для Telegram вычищается для SMS/email", () => {
    const m = newOrderMessage("ТП-2026-000125", "2 390 ₽", "сайт", "• Перевод паспорта × 1");
    expect(m.text).toContain("<b>");
    expect(plain(m.text)).not.toContain("<b>");
  });
});

describe("прайс: TS-каталог совпадает с SQL-сидом (24 позиции ТЗ)", () => {
  const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/0007_seed_services.sql"), "utf8");
  const rows = [...sql.matchAll(/\('([a-z0-9-]+)', '(translation|printing|insurance)', '([^']+)',\s*'[^']*',\s*(\d+), '(page|document|item)'/g)];

  it("в сиде ровно 24 услуги: 11 переводов, 12 полиграфии, 1 страхование", () => {
    expect(rows).toHaveLength(24);
    expect(rows.filter((r) => r[2] === "translation")).toHaveLength(11);
    expect(rows.filter((r) => r[2] === "printing")).toHaveLength(12);
    expect(rows.filter((r) => r[2] === "insurance")).toHaveLength(1);
  });

  it("цены и единицы совпадают с src/lib/seed/services.ts", () => {
    expect(SEED_SERVICES).toHaveLength(24);
    for (const [, slug, category, name, price, unit] of rows) {
      const s = SEED_SERVICES.find((x) => x.slug === slug);
      expect(s, slug).toBeDefined();
      expect({ slug, category, name, price: Number(price), unit }).toEqual({
        slug: s!.slug,
        category: s!.category,
        name: s!.name,
        price: s!.price,
        unit: s!.unit,
      });
    }
  });
});
