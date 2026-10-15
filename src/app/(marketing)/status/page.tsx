import type { Metadata } from "next";
import { StatusLookup } from "@/components/order/status-lookup";

export const metadata: Metadata = {
  title: "Статус заказа",
  description: "Проверьте статус заказа по номеру и телефону: принят, в работе, готов к выдаче.",
  alternates: { canonical: "/status" },
};

export default function StatusPage({ searchParams }: { searchParams: { number?: string } }) {
  return (
    <div className="container max-w-4xl py-10">
      <h1 className="mb-6 text-3xl font-extrabold text-brand-800 md:text-4xl">Статус заказа</h1>
      <StatusLookup initialNumber={searchParams.number?.slice(0, 32) ?? ""} />
    </div>
  );
}
