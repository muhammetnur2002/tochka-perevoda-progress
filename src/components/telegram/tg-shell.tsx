"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTelegram } from "@/hooks/use-telegram";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/tg", label: "Заказать" },
  { href: "/tg/orders", label: "Мои заказы" },
  { href: "/tg/chat", label: "Чат" },
];

/** Оболочка Mini App: фирменная шапка и вкладки (как в утверждённом макете). */
export function TgShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, auth } = useTelegram();

  return (
    <div className="safe-area-top flex min-h-screen flex-col bg-[#F1F3F7] text-slate-900">
      <header className="flex items-center gap-2.5 bg-brand-800 px-3 py-3 text-white">
        <Image
          src="/brand/logo-mark.png"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 rounded-full bg-white object-contain p-0.5"
          priority
        />
        <div className="min-w-0 flex-1">
          <div className="font-extrabold">Точка Перевода</div>
          <div className="truncate text-xs text-[#C9D6EA]">
            {user ? `Здравствуйте, ${user.first_name ?? "друг"}!` : "бюро переводов · Казань"}
            {auth === "pending" && " · вход…"}
          </div>
        </div>
      </header>
      <nav className="flex gap-1.5 border-b bg-white px-3 py-2.5" aria-label="Разделы">
        {TABS.map((t) => {
          const active = t.href === "/tg" ? pathname === "/tg" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 flex-1 items-center justify-center rounded-xl text-sm font-bold",
                active ? "bg-brand-800 text-white" : "bg-[#F1F3F7] text-slate-700",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
