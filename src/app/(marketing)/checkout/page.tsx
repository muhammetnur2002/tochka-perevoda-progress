import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckoutView } from "@/components/order/checkout-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("checkout"), robots: { index: false } };
}

export default async function CheckoutPage() {
  const t = await getTranslations("checkout");
  return (
    <div className="container py-8 md:py-10">
      <Link href="/calculator" className="inline-flex min-h-11 items-center text-sm font-bold text-brand-500">
        {t("backToCart")}
      </Link>
      <h1 className="mb-6 text-3xl font-extrabold text-brand-800 md:text-4xl">{t("title")}</h1>
      <CheckoutView />
    </div>
  );
}
