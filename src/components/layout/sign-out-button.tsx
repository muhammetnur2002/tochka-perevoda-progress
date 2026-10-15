"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Кнопка выхода (очищает сессию Supabase и уводит на /login). */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const t = useTranslations("nav");
  return (
    <button
      type="button"
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className={cn("inline-flex min-h-10 items-center gap-1.5 text-sm font-bold hover:underline", className)}
    >
      <LogOut className="h-4 w-4" /> {t("logout")}
    </button>
  );
}
