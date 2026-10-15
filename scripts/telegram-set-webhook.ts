/**
 * Установка вебхука Telegram-бота.
 * Запуск: pnpm tg:set-webhook
 * Требует TELEGRAM_BOT_TOKEN и NEXT_PUBLIC_SITE_URL (https для продакшена).
 *
 * Для локальной разработки используйте туннель (cloudflared/ngrok) или
 * polling-режим: `tsx scripts/telegram-bot.ts --poll`.
 */
import "./_env";
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token) throw new Error("Не задан TELEGRAM_BOT_TOKEN");
  if (!site) throw new Error("Не задан NEXT_PUBLIC_SITE_URL");

  const url = `${site.replace(/\/$/, "")}/api/webhooks/telegram`;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret || undefined,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    }),
  });

  const data = await res.json();
  console.log("setWebhook:", JSON.stringify(data, null, 2));
  if (!secret) console.warn("⚠ TELEGRAM_WEBHOOK_SECRET не задан — в продакшене вебхук будет отклонять апдейты.");

  // Команды бота и кнопка меню, открывающая Mini App
  const api = (method: string, body: unknown) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  console.log(
    "setMyCommands:",
    await api("setMyCommands", {
      commands: [
        { command: "order", description: "Оформить заказ" },
        { command: "status", description: "Статус заказа" },
        { command: "help", description: "Справка" },
      ],
    }),
  );
  console.log(
    "setChatMenuButton:",
    await api("setChatMenuButton", {
      menu_button: { type: "web_app", text: "Заказать", web_app: { url: `${site.replace(/\/$/, "")}/tg` } },
    }),
  );

  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) =>
    r.json(),
  );
  console.log("getWebhookInfo:", JSON.stringify(info, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
