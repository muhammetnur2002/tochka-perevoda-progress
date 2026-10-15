import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateInitData } from "@/lib/telegram/init-data";

const BOT_TOKEN = "123456:TEST-token";

/** Формирует initData так же, как Telegram (data_check_string + HMAC). */
function signInitData(fields: Record<string, string>, token = BOT_TOKEN): string {
  const dataCheck = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(dataCheck).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const now = Date.now();
const fields = {
  auth_date: String(Math.floor(now / 1000) - 60),
  query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
  user: JSON.stringify({ id: 42, first_name: "Айгуль", username: "aigul" }),
};

describe("проверка initData Telegram Mini App", () => {
  it("принимает корректную подпись и возвращает пользователя", () => {
    const r = validateInitData(signInitData(fields), BOT_TOKEN, 86400, now);
    expect(r.valid).toBe(true);
    expect(r.user?.id).toBe(42);
  });

  it("отклоняет подделанные данные пользователя", () => {
    const tampered = signInitData(fields).replace("42", "43");
    expect(validateInitData(tampered, BOT_TOKEN, 86400, now).valid).toBe(false);
  });

  it("отклоняет подпись другим токеном бота", () => {
    expect(validateInitData(signInitData(fields, "999:OTHER"), BOT_TOKEN, 86400, now).valid).toBe(false);
  });

  it("отклоняет устаревший auth_date (повтор перехваченных данных)", () => {
    const old = signInitData({ ...fields, auth_date: String(Math.floor(now / 1000) - 2 * 86400) });
    expect(validateInitData(old, BOT_TOKEN, 86400, now).valid).toBe(false);
  });

  it("отклоняет данные без hash и мусор", () => {
    expect(validateInitData("user=1", BOT_TOKEN).valid).toBe(false);
    expect(validateInitData("hash=zz&auth_date=1", BOT_TOKEN).valid).toBe(false);
  });
});
