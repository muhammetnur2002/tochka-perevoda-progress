import "server-only";
import sharp from "sharp";
import { PROOF_VIEW_WIDTH } from "./constants";

/**
 * Страницы сверки отдаются клиенту только с водяным знаком, «запечённым» в
 * пиксели на сервере: чистая страница в браузер не попадает, а любой снимок
 * экрана или фото экрана содержит номер заказа, имя клиента и время просмотра.
 *
 * Текст набирается шрифтом из системы (в Docker-образе — DejaVu Sans, он
 * содержит кириллицу). Это не защита от всего, а сдерживание и след для разбора.
 */

const FONT = "DejaVu Sans, Arial, Helvetica, sans-serif";

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] ?? c);
}

function overlaySvg(width: number, height: number, tileText: string, banner: string): string {
  const fontSize = Math.max(16, Math.round(width / 70));
  const tileW = Math.round(fontSize * tileText.length * 0.78 + 160);
  const tileH = fontSize * 7;
  const bannerH = Math.round(fontSize * 2.1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="wm" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
      <text x="0" y="${fontSize * 2}" font-family="${FONT}" font-size="${fontSize}" font-weight="700" fill="#111827" fill-opacity="0.17">${esc(tileText)}</text>
      <text x="${Math.round(tileW / 2)}" y="${fontSize * 5}" font-family="${FONT}" font-size="${fontSize}" font-weight="700" fill="#111827" fill-opacity="0.17">${esc(tileText)}</text>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#wm)"/>
  <rect x="0" y="0" width="${width}" height="${bannerH}" fill="#b91c1c" fill-opacity="0.88"/>
  <text x="${width / 2}" y="${Math.round(bannerH * 0.68)}" text-anchor="middle" font-family="${FONT}" font-size="${Math.round(fontSize * 0.95)}" font-weight="700" fill="#ffffff">${esc(banner)}</text>
  <rect x="0" y="${height - bannerH}" width="${width}" height="${bannerH}" fill="#b91c1c" fill-opacity="0.88"/>
  <text x="${width / 2}" y="${height - Math.round(bannerH * 0.32)}" text-anchor="middle" font-family="${FONT}" font-size="${Math.round(fontSize * 0.95)}" font-weight="700" fill="#ffffff">${esc(tileText)}</text>
</svg>`;
}

export interface WatermarkLabels {
  /** Повторяющийся текст: номер заказа · имя · время просмотра. */
  tile: string;
  /** Красная полоса сверху: «ПРОВЕРКА ПЕРЕВОДА — НЕ ЯВЛЯЕТСЯ КОПИЕЙ ДОКУМЕНТА». */
  banner: string;
}

/** Страница для просмотра: уменьшена, с водяным знаком, JPEG. */
export async function watermarkPage(source: Buffer, labels: WatermarkLabels): Promise<Buffer> {
  const base = await sharp(source)
    .rotate()
    .resize({ width: PROOF_VIEW_WIDTH, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = base.info;
  return sharp(base.data)
    .composite([{ input: Buffer.from(overlaySvg(width, height, labels.tile, labels.banner)), top: 0, left: 0 }])
    .jpeg({ quality: 80 })
    .toBuffer();
}

/** Нормализует загруженную сотрудником страницу: поворот по EXIF, без метаданных, не шире 2000 px. */
export async function normalizeUploadedPage(source: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const out = await sharp(source)
    .rotate()
    .resize({ width: 2000, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });
  return { data: out.data, width: out.info.width, height: out.info.height };
}
