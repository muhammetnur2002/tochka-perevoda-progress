import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { EXECUTOR_ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import { SignOutButton } from "@/components/layout/sign-out-button";

export const metadata: Metadata = {
  title: { default: "Рабочее место", template: "%s · Рабочее место" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole([...EXECUTOR_ROLES, "admin"], "/workspace");
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="bg-brand-800 text-white">
        <div className="container flex flex-wrap items-center gap-3 py-3">
          <Link href="/workspace" className="flex items-center gap-3">
            <Image src="/brand/logo-mark.png" alt="" width={38} height={38} className="h-[38px] w-[38px] rounded-lg bg-white p-0.5" />
            <span>
              <span className="block font-extrabold">Рабочее место</span>
              <span className="text-xs text-[#C9D6EA]">
                {profile.name ?? profile.email} · {ROLE_LABELS[profile.role].toLowerCase()}
              </span>
            </span>
          </Link>
          <div className="ml-auto">
            <SignOutButton className="text-gold-200" />
          </div>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}
