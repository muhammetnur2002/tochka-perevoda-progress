import { getLocale, getTranslations } from "next-intl/server";
import { Info } from "lucide-react";
import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * Юридические документы публикуются только на русском: для остальных языков
 * интерфейса показываем пометку, что официальный текст — русский.
 */
export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  return (
    <>
      {locale !== DEFAULT_LOCALE && (
        <div className="container max-w-3xl pt-8">
          <p className="flex items-start gap-2 rounded-xl border border-gold-300 bg-gold-50 p-4 text-sm text-brand-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" /> {t("officialNotice")}
          </p>
        </div>
      )}
      {children}
    </>
  );
}
