import Link from "next/link";
import { Logo } from "@/components/layout/logo";

/** Обёртка страниц аутентификации (центрированная карточка). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="mb-6">
        <Logo size={64} />
      </div>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/" className="hover:text-brand-700">
          ← Вернуться на сайт
        </Link>
      </p>
    </div>
  );
}
