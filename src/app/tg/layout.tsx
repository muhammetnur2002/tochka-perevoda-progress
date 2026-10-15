import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { TelegramProvider } from "@/components/telegram/telegram-provider";
import { TgShell } from "@/components/telegram/tg-shell";

export const metadata: Metadata = {
  title: "Точка Перевода — Telegram",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#00214C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Telegram Mini App: без шапки и подвала сайта, своя оболочка с вкладками.
 * Mini App работает только на русском — общие компоненты получают русские тексты
 * независимо от выбранного на сайте языка.
 */
export default async function TgLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages({ locale: DEFAULT_LOCALE });
  return (
    <NextIntlClientProvider locale={DEFAULT_LOCALE} messages={messages} timeZone="Europe/Moscow">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <TelegramProvider>
        <TgShell>{children}</TgShell>
      </TelegramProvider>
    </NextIntlClientProvider>
  );
}
