"use client";

import * as React from "react";
import { TelegramContext, type TgAuthStatus, type TgWebApp } from "@/hooks/use-telegram";

/**
 * Провайдер Mini App: ждёт загрузки telegram-web-app.js, вызывает ready/expand,
 * красит шапку в фирменный navy и один раз входит по initData (сессия Supabase
 * в cookie). Вне Telegram страница работает как обычный сайт (гость).
 */
export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [webApp, setWebApp] = React.useState<TgWebApp | null>(null);
  const [auth, setAuth] = React.useState<TgAuthStatus>("pending");

  React.useEffect(() => {
    let attempts = 0;
    const timer = setInterval(() => {
      const wa = window.Telegram?.WebApp;
      attempts += 1;
      if (wa && wa.initData) {
        clearInterval(timer);
        wa.ready();
        wa.expand();
        wa.setHeaderColor?.("#00214C");
        setWebApp(wa);
      } else if (attempts > 20) {
        clearInterval(timer); // 2 секунды — значит, открыто не в Telegram
        setAuth("guest");
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!webApp?.initData) return;
    fetch("/api/telegram/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: webApp.initData }),
    })
      .then((r) => setAuth(r.ok ? "authed" : "guest"))
      .catch(() => setAuth("guest"));
  }, [webApp]);

  const value = React.useMemo(
    () => ({
      webApp,
      isTelegram: Boolean(webApp),
      user: webApp?.initDataUnsafe?.user ?? null,
      auth,
      haptic: (type: "success" | "error" | "warning" = "success") => webApp?.HapticFeedback?.notificationOccurred(type),
    }),
    [webApp, auth],
  );

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}
