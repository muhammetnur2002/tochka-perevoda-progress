import { describe, expect, it } from "vitest";
import { addBusinessDays, isBusinessDay, mskDateKey } from "@/lib/services/deadline";

const HOLIDAYS = ["2026-11-04", "2026-12-31", "2027-01-01"];
const msk = (d: Date) => d.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });

describe("производственный календарь (МСК)", () => {
  it("дата считается по Москве, а не по часовому поясу сервера", () => {
    // 22:30 UTC 14 октября = 01:30 МСК 15 октября
    expect(mskDateKey(new Date("2026-10-14T22:30:00Z"))).toBe("2026-10-15");
  });

  it("выходные и праздники — нерабочие", () => {
    expect(isBusinessDay(new Date("2026-10-17T09:00:00+03:00"), HOLIDAYS)).toBe(false); // суббота
    expect(isBusinessDay(new Date("2026-11-04T09:00:00+03:00"), HOLIDAYS)).toBe(false); // праздник
    expect(isBusinessDay(new Date("2026-11-05T09:00:00+03:00"), HOLIDAYS)).toBe(true);
  });

  it("2 рабочих дня от среды — пятница, 19:00 МСК", () => {
    const d = addBusinessDays(new Date("2026-10-14T10:00:00+03:00"), 2, HOLIDAYS);
    expect(d.toISOString()).toBe("2026-10-16T16:00:00.000Z");
    expect(msk(d)).toContain("16.10.2026, 19:00");
  });

  it("от пятницы 2 рабочих дня — вторник (выходные пропускаются)", () => {
    const d = addBusinessDays(new Date("2026-10-16T12:00:00+03:00"), 2, HOLIDAYS);
    expect(mskDateKey(d)).toBe("2026-10-20");
  });

  it("праздник 4 ноября пропускается", () => {
    const d = addBusinessDays(new Date("2026-11-03T12:00:00+03:00"), 1, HOLIDAYS);
    expect(mskDateKey(d)).toBe("2026-11-05");
  });

  it("«в день обращения» в выходной переносится на понедельник", () => {
    const d = addBusinessDays(new Date("2026-10-17T12:00:00+03:00"), 0, HOLIDAYS);
    expect(mskDateKey(d)).toBe("2026-10-19");
  });

  it("новогодние каникулы: 30.12 + 1 день → после праздников", () => {
    const d = addBusinessDays(new Date("2026-12-30T12:00:00+03:00"), 1, HOLIDAYS);
    expect(mskDateKey(d)).toBe("2027-01-04");
  });
});
