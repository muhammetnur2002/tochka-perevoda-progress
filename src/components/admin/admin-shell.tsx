"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
  Users2,
  Wallet,
} from "lucide-react";
import { NewOrderAlert } from "./new-order-alert";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database.types";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: typeof ClipboardList; adminOnly?: boolean }[] = [
  { href: "/admin", label: "Дашборд", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Заказы", icon: ClipboardList },
  { href: "/admin/clients", label: "Клиенты", icon: Users },
  { href: "/admin/services", label: "Услуги и цены", icon: FileText },
  { href: "/admin/translators", label: "Исполнители", icon: Users2 },
  { href: "/admin/finance", label: "Финансы", icon: Wallet },
  { href: "/admin/reports", label: "Отчёты", icon: BarChart3 },
  { href: "/admin/settings", label: "Настройки", icon: Settings },
  { href: "/admin/audit", label: "Аудит", icon: ShieldCheck, adminOnly: true },
];

/** Оболочка CRM: тёмно-синее меню слева (на телефоне — сверху), контент справа. */
export function AdminShell({ children, user }: { children: React.ReactNode; user: { name: string; role: UserRole } }) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-wrap bg-[#F5F7FA]">
      <NewOrderAlert />
      <nav
        aria-label="Разделы CRM"
        className="flex max-w-full flex-[1_1_220px] flex-col gap-1 bg-brand-800 px-3 py-4 text-[#C9D6EA] lg:sticky lg:top-0 lg:h-screen"
      >
        <Link href="/admin" className="flex items-center gap-2.5 px-2 pb-4">
          <Image src="/brand/logo-mark.png" alt="" width={38} height={38} className="h-[38px] w-[38px] rounded-lg bg-white p-0.5" />
          <span>
            <span className="block font-extrabold text-white">Точка Перевода</span>
            <span className="text-xs">CRM · {ROLE_LABELS[user.role].toLowerCase()}</span>
          </span>
        </Link>
        <div className="flex flex-wrap gap-1 lg:flex-col">
          {NAV.filter((n) => !n.adminOnly || user.role === "admin").map((n) => {
            const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-[15px] font-bold transition-colors",
                  active ? "bg-white/15 text-white" : "hover:bg-white/10 hover:text-white",
                )}
              >
                <n.icon className="h-4 w-4" aria-hidden />
                {n.label}
              </Link>
            );
          })}
        </div>
        <div className="mt-auto border-t border-white/15 px-2 pt-4 text-sm">
          <div className="truncate">{user.name}</div>
          <button onClick={signOut} className="mt-1 inline-flex min-h-9 items-center gap-1.5 text-gold-200 hover:underline">
            <LogOut className="h-4 w-4" /> Выйти
          </button>
        </div>
      </nav>
      <main className="min-w-0 flex-[999_1_640px] p-4 lg:p-6">{children}</main>
    </div>
  );
}
