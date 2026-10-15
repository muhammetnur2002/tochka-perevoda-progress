import "server-only";
import { logger } from "@/lib/logger";

/**
 * AI-ассистент (этап 2, см. docs/ROADMAP.md). Интерфейс и заглушки готовы,
 * включается переменной AI_PROVIDER=yandexgpt | gigachat. По умолчанию off —
 * платформа полностью работает без ИИ.
 *
 * Запланированные сценарии: определение языка и объёма по загруженному файлу,
 * черновик перевода для переводчика, ответы бота на типовые вопросы.
 */

export interface DocumentEstimate {
  language: string | null;
  pages: number | null;
  documentType: string | null;
  confidence: number;
}

export interface AiProvider {
  readonly name: "yandexgpt" | "gigachat";
  /** Оценка документа по извлечённому тексту (OCR — вне провайдера). */
  estimateDocument(text: string): Promise<DocumentEstimate>;
  /** Черновой машинный перевод для переводчика (не для клиента). */
  draftTranslation(text: string, from: string, to: string): Promise<string>;
}

export function aiEnabled(): boolean {
  const p = process.env.AI_PROVIDER;
  return p === "yandexgpt" || p === "gigachat";
}

/** Провайдер ИИ или null, если выключен/не настроен. */
export async function getAiProvider(): Promise<AiProvider | null> {
  switch (process.env.AI_PROVIDER) {
    case "yandexgpt": {
      if (!process.env.YANDEXGPT_API_KEY || !process.env.YANDEXGPT_FOLDER_ID) {
        logger.warn("AI_PROVIDER=yandexgpt, но ключи не заданы — ИИ выключен");
        return null;
      }
      const { YandexGptProvider } = await import("./yandexgpt");
      return new YandexGptProvider();
    }
    case "gigachat": {
      if (!process.env.GIGACHAT_CLIENT_ID || !process.env.GIGACHAT_CLIENT_SECRET) {
        logger.warn("AI_PROVIDER=gigachat, но ключи не заданы — ИИ выключен");
        return null;
      }
      const { GigaChatProvider } = await import("./gigachat");
      return new GigaChatProvider();
    }
    default:
      return null;
  }
}
