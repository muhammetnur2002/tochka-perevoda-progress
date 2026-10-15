import type { Metadata } from "next";
import { CalculatorView } from "@/components/cart/calculator-view";
import type { ServiceCategory } from "@/types/database.types";

export const metadata: Metadata = {
  title: "Калькулятор стоимости перевода",
  description:
    "Рассчитайте стоимость перевода, нотариального заверения и полиграфии онлайн: количество страниц, срочность, доставка и дата готовности.",
  alternates: { canonical: "/calculator" },
};

const CATEGORIES = ["translation", "printing", "insurance"];

export default function CalculatorPage({ searchParams }: { searchParams: { category?: string } }) {
  const initial = CATEGORIES.includes(searchParams.category ?? "")
    ? (searchParams.category as ServiceCategory)
    : "translation";
  return (
    <div className="container py-8 md:py-10">
      <h1 className="text-3xl font-extrabold text-brand-800 md:text-4xl">Калькулятор и корзина</h1>
      <p className="mb-6 mt-2 text-muted-foreground">
        Укажите количество страниц или документов — итог и срок готовности пересчитываются сразу.
      </p>
      <CalculatorView initialCategory={initial} />
    </div>
  );
}
