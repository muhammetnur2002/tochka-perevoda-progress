import type { Metadata } from "next";
import { PayView } from "./pay-view";

export const metadata: Metadata = { title: "Оплата заказа", robots: { index: false } };

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
