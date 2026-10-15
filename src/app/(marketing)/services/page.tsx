import type { Metadata } from "next";
import { Section } from "@/components/common/section";
import { CatalogSection } from "@/components/services/catalog-section";

export const metadata: Metadata = {
  title: "Услуги и цены",
  description:
    "Полный прайс бюро переводов «Точка Перевода Прогресс»: переводы документов, полиграфия, страхование. Цены за страницу и за документ.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <Section
      title="Каталог услуг и цены"
      subtitle="Выберите категорию. Нотариальное заверение — для услуг с пометкой «нотариально» включено в цену, для остальных добавляется отдельно."
    >
      <CatalogSection />
    </Section>
  );
}
