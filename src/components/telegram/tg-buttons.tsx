"use client";

import * as React from "react";
import { useTelegram } from "@/hooks/use-telegram";
import { cn } from "@/lib/utils";

interface TgMainButtonProps {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Главная кнопка Mini App: в Telegram — нативная MainButton (золотая),
 * в браузере — закреплённая снизу кнопка с теми же свойствами.
 */
export function TgMainButton({ text, onClick, disabled, loading }: TgMainButtonProps) {
  const { webApp } = useTelegram();
  const handler = React.useRef(onClick);
  handler.current = onClick;

  React.useEffect(() => {
    if (!webApp) return;
    const mb = webApp.MainButton;
    const cb = () => {
      if (!disabled && !loading) handler.current();
    };
    mb.setParams({
      text,
      color: disabled ? "#C5CEDB" : "#D4A02A",
      text_color: "#00214C",
      is_active: !disabled,
      is_visible: true,
    });
    if (loading) mb.showProgress(false);
    else mb.hideProgress();
    mb.onClick(cb);
    return () => {
      mb.offClick(cb);
    };
  }, [webApp, text, disabled, loading]);

  React.useEffect(() => {
    if (!webApp) return;
    const mb = webApp.MainButton;
    return () => mb.hide();
  }, [webApp]);

  if (webApp) return null;
  return (
    <div className="safe-area-bottom sticky bottom-0 z-20 border-t bg-white px-3 pt-2.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className={cn(
          "min-h-[50px] w-full rounded-xl text-base font-extrabold text-brand-800",
          disabled || loading ? "bg-slate-300" : "bg-gold-400",
        )}
      >
        {loading ? "Подождите…" : text}
      </button>
    </div>
  );
}

/** Кнопка «Назад» в шапке Telegram (только внутри Telegram). */
export function TgBackButton({ onClick }: { onClick: () => void }) {
  const { webApp } = useTelegram();
  const handler = React.useRef(onClick);
  handler.current = onClick;

  React.useEffect(() => {
    if (!webApp) return;
    const cb = () => handler.current();
    webApp.BackButton.show();
    webApp.BackButton.onClick(cb);
    return () => {
      webApp.BackButton.offClick(cb);
      webApp.BackButton.hide();
    };
  }, [webApp]);

  if (webApp) return null;
  return (
    <button type="button" onClick={onClick} className="min-h-11 text-sm font-bold text-brand-500">
      ← Назад
    </button>
  );
}
