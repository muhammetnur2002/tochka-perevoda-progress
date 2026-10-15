import type { Metadata, Viewport } from "next";
import Script from "next/script";
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

/** Telegram Mini App: без шапки и подвала сайта, своя оболочка с вкладками. */
export default function TgLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <TelegramProvider>
        <TgShell>{children}</TgShell>
      </TelegramProvider>
    </>
  );
}
