import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PayView } from "./pay-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("pay"), robots: { index: false } };
}

export default function PayPage({
  params,
  searchParams,
}: {
  params: { orderId: string };
  searchParams: { method?: string };
}) {
  const method = ["sbp", "qr", "card"].includes(searchParams.method ?? "")
    ? (searchParams.method as "sbp" | "qr" | "card")
    : "sbp";
  return (
    <div className="container max-w-3xl py-10">
      <PayView orderId={params.orderId} method={method} />
    </div>
  );
}
