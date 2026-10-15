import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("mockSbp"), robots: { index: false } };
}

/**
 * Сюда ведёт QR-код mock-провайдера (когда ключи ЮKassa не заданы).
 * Реальной оплаты нет: подтвердите её кнопкой «Я оплатил(а)» на странице оплаты.
 */
export default async function MockSbpPage() {
  const t = await getTranslations("mockSbp");
  return (
    <div className="container max-w-xl py-16 text-center">
      <h1 className="text-2xl font-extrabold text-brand-800">{t("title")}</h1>
      <p className="mt-4 text-slate-700">{t("text")}</p>
    </div>
  );
}
