import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AccountNav } from "@/components/layout/account-nav";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: { default: "Личный кабинет", template: "%s · Личный кабинет" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser("/account");
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="container flex-1 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-brand-800 md:text-4xl">Личный кабинет</h1>
            <p className="text-sm text-muted-foreground">{profile.name ?? profile.email}</p>
          </div>
          <AccountNav />
        </div>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
