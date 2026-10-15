import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StatusLookup } from "@/components/order/status-lookup";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("status"), description: t("statusDescription"), alternates: { canonical: "/status" } };
}

export default async function StatusPage({ searchParams }: { searchParams: { number?: string } }) {
  const t = await getTranslations("statusPage");
  return (
    <div className="container max-w-4xl py-10">
      <h1 className="mb-6 text-3xl font-extrabold text-brand-800 md:text-4xl">{t("title")}</h1>
      <StatusLookup initialNumber={searchParams.number?.slice(0, 32) ?? ""} />
    </div>
  );
}
