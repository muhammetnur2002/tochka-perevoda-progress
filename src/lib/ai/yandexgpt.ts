import "server-only";
import type { AiProvider, DocumentEstimate } from "./index";

const ENDPOINT = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

/**
 * YandexGPT (Yandex Cloud Foundation Models). Данные не покидают РФ — подходит
 * под 152-ФЗ. Этап 2: реализация промптов и разбора ответа — заготовка.
 */
export class YandexGptProvider implements AiProvider {
  readonly name = "yandexgpt" as const;

  private async complete(system: string, user: string): Promise<string> {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Api-Key ${process.env.YANDEXGPT_API_KEY}`,
        "x-folder-id": process.env.YANDEXGPT_FOLDER_ID ?? "",
      },
      body: JSON.stringify({
        modelUri: `gpt://${process.env.YANDEXGPT_FOLDER_ID}/yandexgpt-lite/latest`,
        completionOptions: { stream: false, temperature: 0.1, maxTokens: 2000 },
        messages: [
          { role: "system", text: system },
          { role: "user", text: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`YandexGPT: ${res.status}`);
    const data = (await res.json()) as { result?: { alternatives?: { message?: { text?: string } }[] } };
    return data.result?.alternatives?.[0]?.message?.text ?? "";
  }

  async estimateDocument(text: string): Promise<DocumentEstimate> {
    const answer = await this.complete(
      'Определи язык документа (ISO 639-1), тип документа и число страниц по 1800 знаков. Ответь JSON: {"language","documentType","pages"}.',
      text.slice(0, 8000),
    );
    try {
      const parsed = JSON.parse(answer) as Partial<DocumentEstimate>;
      return {
        language: parsed.language ?? null,
        pages: typeof parsed.pages === "number" ? parsed.pages : Math.max(1, Math.ceil(text.length / 1800)),
        documentType: parsed.documentType ?? null,
        confidence: 0.6,
      };
    } catch {
      return { language: null, pages: Math.max(1, Math.ceil(text.length / 1800)), documentType: null, confidence: 0.2 };
    }
  }

  async draftTranslation(text: string, from: string, to: string): Promise<string> {
    return this.complete(`Переведи текст с языка ${from} на ${to}. Сохрани структуру и имена собственные.`, text);
  }
}
