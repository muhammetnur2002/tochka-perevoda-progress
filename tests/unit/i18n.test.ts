import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_LOCALES, STAFF_LOCALES, isLocale, isStaffLocale, matchAcceptLanguage } from "@/i18n/config";

type Dict = { [key: string]: string | Dict };

function load(locale: string, file: "site" | "staff"): Dict {
  return JSON.parse(readFileSync(path.join(process.cwd(), "messages", locale, `${file}.json`), "utf8")) as Dict;
}

function flatten(d: Dict, prefix = ""): Record<string, string> {
  return Object.entries(d).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? { ...acc, [key]: v } : { ...acc, ...flatten(v, key) };
  }, {});
}

/** Имена ICU-аргументов: {date}, {count, plural, …} → date, count. */
function args(s: string): string[] {
  return [...s.matchAll(/\{(\w+)(?=[,}])/g)].map((m) => m[1]!).filter((a) => !["one", "few", "many", "other", "zero", "two"].includes(a)).sort();
}

describe("выбор языка интерфейса", () => {
  it("9 языков сайта и 3 языка CRM", () => {
    expect(SITE_LOCALES).toEqual(["ru", "en", "tk", "tr", "uz", "kk", "ky", "az", "fr"]);
    expect(STAFF_LOCALES).toEqual(["ru", "en", "tk"]);
    expect(isLocale("tk")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isStaffLocale("tr")).toBe(false);
  });

  it("Accept-Language: первый поддерживаемый по весу, иначе русский", () => {
    expect(matchAcceptLanguage("uz-UZ,uz;q=0.9,ru;q=0.8")).toBe("uz");
    expect(matchAcceptLanguage("de-DE,de;q=0.9,fr;q=0.5")).toBe("fr");
    expect(matchAcceptLanguage("ru;q=0.5,tk;q=0.9")).toBe("tk");
    expect(matchAcceptLanguage("zh-CN")).toBe("ru");
    expect(matchAcceptLanguage(null)).toBe("ru");
  });
});

describe("словари совпадают с русским мастером", () => {
  const cases = [
    ...SITE_LOCALES.filter((l) => l !== "ru").map((l) => [l, "site"] as const),
    ...STAFF_LOCALES.filter((l) => l !== "ru").map((l) => [l, "staff"] as const),
  ];

  it.each(cases)("%s/%s.json: те же ключи и аргументы", (locale, file) => {
    expect(existsSync(path.join(process.cwd(), "messages", locale, `${file}.json`))).toBe(true);
    const master = flatten(load("ru", file));
    const target = flatten(load(locale, file));
    expect(Object.keys(target).sort()).toEqual(Object.keys(master).sort());
    for (const [key, value] of Object.entries(master)) {
      expect({ key, args: args(target[key]!) }).toEqual({ key, args: args(value) });
    }
  });
});
