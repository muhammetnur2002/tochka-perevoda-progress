import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Заказ оформлен", robots: { index: false } };

/**
 * Страница после оплаты. Сюда же возвращает ЮKassa (return_url) — к этому
 * моменту вебхук мог ещё не прийти, поэтому без ?paid=1 пишем «обрабатывается».
 */
export default function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: { number: string };
  searchParams: { paid?: string };
}) {
  const number = decodeURIComponent(params.number);
  const paid = searchParams.paid === "1";
  const statusHref = `/status?number=${encodeURIComponent(number)}`;

  return (
    <div className="container flex max-w-2xl flex-col items-center py-16 text-center">
      <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
        {paid ? (
          <CheckCircle2 className="h-10 w-10 text-emerald-700" aria-hidden />
        ) : (
          <Clock className="h-10 w-10 text-brand-500" aria-hidden />
        )}
      </span>
      <h1 className="text-3xl font-extrabold text-brand-800 md:text-4xl">
        {paid ? `Заказ ${number} оплачен` : `Заказ ${number} оформлен`}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-slate-700">
        {paid
          ? "Спасибо! Мы начали работу. Уведомления о статусе придут в Telegram, по SMS или на email."
          : "Платёж обрабатывается — как только банк подтвердит оплату, мы пришлём уведомление."}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">Сохраните номер заказа — по нему и телефону можно проверить статус.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href={statusHref}>Отследить статус</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/account">Мои заказы</Link>
        </Button>
      </div>
    </div>
  );
}
