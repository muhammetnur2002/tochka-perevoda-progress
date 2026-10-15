import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { normalizeUploadedPage, watermarkPage } from "@/lib/proof/watermark";
import { issueOrderToken, verifyOrderToken } from "@/lib/auth/order-access";
import { PROOF_LINK_TTL_DAYS, PROOF_MAX_PAGES } from "@/lib/proof/constants";

async function samplePage(width = 1800, height = 2400): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: "#ffffff" } }).png().toBuffer();
}

describe("страницы сверки", () => {
  it("загруженная страница нормализуется: JPEG не шире 2000 px", async () => {
    const out = await normalizeUploadedPage(await samplePage(3000, 4000));
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(2000);
    expect(out.width).toBe(2000);
    expect(out.height).toBe(2667);
  });

  it("не-изображение отклоняется", async () => {
    await expect(normalizeUploadedPage(Buffer.from("%PDF-1.4 not an image"))).rejects.toThrow();
  });

  it("водяной знак меняет пиксели и уменьшает страницу для просмотра", async () => {
    const source = await samplePage(2000, 2800);
    const marked = await watermarkPage(source, { tile: "ТП-2026-000011 · Иван …4567 · 16.10.2026, 12:00", banner: "ПРОВЕРКА ПЕРЕВОДА" });
    const meta = await sharp(marked).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1400);
    // чисто белая страница после знака уже не белая: на ней есть тёмные пиксели
    const { channels } = await sharp(marked).stats();
    expect(channels[0]!.min).toBeLessThan(200);
  });

  it("разный текст знака даёт разные картинки (след для разбора утечки)", async () => {
    const source = await samplePage(1000, 1400);
    const a = await watermarkPage(source, { tile: "ТП-1 · Анна · 10:00", banner: "ПРОВЕРКА" });
    const b = await watermarkPage(source, { tile: "ТП-1 · Борис · 10:00", banner: "ПРОВЕРКА" });
    expect(a.equals(b)).toBe(false);
  });

  it("служебные символы в имени не ломают разметку знака", async () => {
    const out = await watermarkPage(await samplePage(800, 1000), { tile: `ТП-2 · <b>"Tom" & 'Jerry'</b>`, banner: "ПРОВЕРКА" });
    expect((await sharp(out).metadata()).format).toBe("jpeg");
  });
});

describe("ссылка на проверку из уведомления", () => {
  it("токен на неделю работает только для своего заказа", () => {
    process.env.ORDER_ACCESS_SECRET = "test-secret";
    const now = Date.now();
    const token = issueOrderToken("order-1", now, PROOF_LINK_TTL_DAYS * 86_400_000);
    expect(verifyOrderToken("order-1", token, now + 6 * 86_400_000)).toBe(true);
    expect(verifyOrderToken("order-2", token, now)).toBe(false);
    expect(verifyOrderToken("order-1", token, now + 8 * 86_400_000)).toBe(false);
  });

  it("лимиты сверки заданы", () => {
    expect(PROOF_MAX_PAGES).toBeGreaterThanOrEqual(10);
  });
});
