"use client";

/**
 * Превращает PDF в страницы-картинки прямо в браузере сотрудника (pdfjs-dist),
 * чтобы на сервер уходили только JPEG. Библиотека подгружается лениво.
 */

/** Длинная сторона страницы после рендера (px): защита от огромных листов. */
const MAX_SIDE_PX = 2600;
const TARGET_SCALE = 2;

export class PdfPagesError extends Error {
  constructor(
    public readonly code: "TOO_MANY_PAGES" | "UNREADABLE",
    message: string,
    public readonly pages?: number,
  ) {
    super(message);
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.9);
  });
}

/**
 * @param maxPages сколько страниц ещё можно добавить; если в PDF больше — ошибка TOO_MANY_PAGES
 * @param onProgress вызывается после каждой готовой страницы
 */
export async function pdfToPageBlobs(
  file: File,
  opts: { maxPages: number; onProgress?: (done: number, total: number) => void },
): Promise<Blob[]> {
  const pdfjs = await import("pdfjs-dist");
  // Воркер лежит в public/ как есть: Next 14 пытается минифицировать его при сборке и падает.
  // Файл — копия node_modules/pdfjs-dist/build/pdf.worker.min.mjs той же версии (4.10.38).
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch {
    throw new PdfPagesError("UNREADABLE", "Не удалось открыть PDF");
  }

  try {
    const total = doc.numPages;
    if (total > opts.maxPages) throw new PdfPagesError("TOO_MANY_PAGES", "Слишком много страниц", total);

    const blobs: Blob[] = [];
    for (let n = 1; n <= total; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(TARGET_SCALE, MAX_SIDE_PX / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new PdfPagesError("UNREADABLE", "Canvas недоступен");
      // JPEG не хранит прозрачность — подкладываем белый лист
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      try {
        await page.render({ canvasContext: ctx, viewport }).promise;
        blobs.push(await canvasToJpeg(canvas));
      } catch {
        throw new PdfPagesError("UNREADABLE", "Не удалось отрисовать страницу");
      } finally {
        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }
      opts.onProgress?.(n, total);
    }
    return blobs;
  } finally {
    void doc.destroy();
  }
}
