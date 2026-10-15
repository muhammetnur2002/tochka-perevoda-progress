import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutView } from "@/components/order/checkout-view";

export const metadata: Metadata = {
  title: "Оформление заказа",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <div className="container py-8 md:py-10">
      <Link href="/calculator" className="inline-flex min-h-11 items-center text-sm font-bold text-brand-500">
        ← Назад к корзине
      </Link>
      <h1 className="mb-6 text-3xl font-extrabold text-brand-800 md:text-4xl">Оформление заказа</h1>
      <CheckoutView />
    </div>
  );
}
