import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CalculatorView } from "@/components/cart/calculator-view";
import type { ServiceCategory } from "@/types/database.types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("calculator"), description: t("calculatorDescription"), alternates: { canonical: "/calculator" } };
}

const CATEGORIES = ["translation", "printing", "insurance"];

export default async function CalculatorPage({ searchParams }: { searchParams: { category?: string } }) {
  const t = await getTranslations("calculator");
  const initial = CATEGORIES.includes(searchParams.category ?? "")
    ? (searchParams.category as ServiceCategory)
    : "translation";
  return (
    <div className="container py-8 md:py-10">
      <h1 className="text-3xl font-extrabold text-brand-800 md:text-4xl">{t("title")}</h1>
      <p className="mb-6 mt-2 text-muted-foreground">{t("subtitle")}</p>
      <CalculatorView initialCategory={initial} />
    </div>
  );
}
