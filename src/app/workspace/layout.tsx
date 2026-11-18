import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/guards";
import { EXECUTOR_ROLES } from "@/lib/auth/roles";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

export const metadata: Metadata = {
  title: { default: "Iş ýeri", template: "%s · Iş ýeri" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole([...EXECUTOR_ROLES, "admin"], "/workspace");
  const [t, tRoles] = await Promise.all([getTranslations("workspace"), getTranslations("roles")]);
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="bg-brand-800 text-white">
        <div className="container flex flex-wrap items-center gap-3 py-3">
          <Link href="/workspace" className="flex items-center gap-3">
            <span aria-hidden="true" className="inline-block h-10 w-10 shrink-0" />
            <span>
              <span className="block font-extrabold">{t("title")}</span>
              <span className="text-xs text-[#C9D6EA]">
                {profile.name ?? profile.email} · {tRoles(profile.role).toLowerCase()}
              </span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <LocaleSwitcher
              variant="staff"
              className="text-white [&_select]:border-white/20 [&_select]:bg-white/10 [&_select]:hover:bg-white/15"
            />
            <SignOutButton className="text-gold-200" />
          </div>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}
