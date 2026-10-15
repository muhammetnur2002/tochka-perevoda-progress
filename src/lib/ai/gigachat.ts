import "server-only";
import type { AiProvider, DocumentEstimate } from "./index";

/**
 * GigaChat (Сбер). Этап 2 — заглушка: требует OAuth-токена по client_id/secret
 * и сертификата НУЦ Минцифры в доверенных. Сейчас возвращает эвристику без сети.
 */
export class GigaChatProvider implements AiProvider {
  readonly name = "gigachat" as const;

  async estimateDocument(text: string): Promise<DocumentEstimate> {
    return { language: null, pages: Math.max(1, Math.ceil(text.length / 1800)), documentType: null, confidence: 0.1 };
  }

  async draftTranslation(): Promise<string> {
    throw new Error("GigaChat: черновой перевод появится на этапе 2 (docs/ROADMAP.md)");
  }
}
