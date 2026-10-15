import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="container flex flex-col items-center justify-center py-24 text-center">
      <p className="text-7xl font-bold text-gold-400">404</p>
      <h1 className="mb-2 mt-4 text-2xl font-bold text-brand-900">{t("notFoundTitle")}</h1>
      <p className="mb-6 text-muted-foreground">{t("notFoundText")}</p>
      <Button asChild variant="gold">
        <Link href="/">{t("toMain")}</Link>
      </Button>
    </div>
  );
}
