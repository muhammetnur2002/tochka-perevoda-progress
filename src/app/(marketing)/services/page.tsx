import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Section } from "@/components/common/section";
import { CatalogSection } from "@/components/services/catalog-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("services"), description: t("servicesDescription"), alternates: { canonical: "/services" } };
}

export default async function ServicesPage() {
  const t = await getTranslations("catalog");
  return (
    <Section title={t("title")} subtitle={t("subtitle")}>
      <CatalogSection />
    </Section>
  );
}
