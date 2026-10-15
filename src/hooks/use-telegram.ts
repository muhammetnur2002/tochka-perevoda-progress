"use client";

import * as React from "react";

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TgButton {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  setText: (text: string) => void;
  setParams: (p: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
}

export interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: TgUser; start_param?: string };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  version: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  MainButton: TgButton;
  BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
  HapticFeedback?: {
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    impactOccurred: (style: "light" | "medium" | "heavy") => void;
  };
  requestContact?: (cb: (shared: boolean, res?: { responseUnsafe?: { contact?: { phone_number?: string } } }) => void) => void;
  isVersionAtLeast?: (v: string) => boolean;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

export type TgAuthStatus = "pending" | "authed" | "guest";

export interface TelegramContextValue {
  webApp: TgWebApp | null;
  isTelegram: boolean;
  user: TgUser | null;
  auth: TgAuthStatus;
  haptic: (type?: "success" | "error" | "warning") => void;
}

export const TelegramContext = React.createContext<TelegramContextValue>({
  webApp: null,
  isTelegram: false,
  user: null,
  auth: "guest",
  haptic: () => undefined,
});

/** Доступ к Telegram WebApp SDK и статусу входа Mini App (см. TelegramProvider). */
export function useTelegram(): TelegramContextValue {
  return React.useContext(TelegramContext);
}
