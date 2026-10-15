import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Logo } from "@/components/layout/logo";

/** Обёртка страниц аутентификации (центрированная карточка). */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth");
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <LocaleSwitcher className="absolute right-4 top-4" />
      <div className="mb-6">
        <Logo size={64} />
      </div>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/" className="hover:text-brand-700">
          {t("backToSite")}
        </Link>
      </p>
    </div>
  );
}
