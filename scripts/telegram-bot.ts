/**
 * Локальный polling-режим бота (без вебхука и публичного HTTPS) для разработки.
 * Запуск: pnpm tg:poll
 * Polling и вебхук взаимоисключающие: скрипт снимает вебхук при старте;
 * для продакшена верните его командой pnpm tg:set-webhook.
 */
import "./_env";
import { handleUpdate } from "../src/lib/telegram/bot";
import type { TelegramUpdate } from "../src/lib/telegram/types";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function main() {
  if (!TOKEN) {
    console.error("Не задан TELEGRAM_BOT_TOKEN (.env.local)");
    process.exit(1);
  }
  await fetch(`https://api.telegram.org/bot${TOKEN}/deleteWebhook`).catch(() => undefined);
  console.log("Polling запущен. Ctrl+C — остановить.");

  let offset = 0;
  for (;;) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates?timeout=30&offset=${offset}`);
      const data = (await res.json()) as { result?: TelegramUpdate[] };
      for (const update of data.result ?? []) {
        offset = Math.max(offset, update.update_id + 1);
        await handleUpdate(update).catch((err) => console.error("Ошибка обработки апдейта:", err));
      }
    } catch (err) {
      console.error("Poll error:", (err as Error).message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

void main();
