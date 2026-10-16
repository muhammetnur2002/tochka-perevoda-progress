import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfficePaymentCard } from "@/components/payments/office-payment-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("success"), robots: { index: false } };
}

/**
 * Страница после оплаты. Сюда же возвращает ЮKassa (return_url) — к этому
 * моменту вебхук мог ещё не прийти, поэтому без ?paid=1 пишем «обрабатывается».
 */
export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: { number: string };
  searchParams: { paid?: string; order?: string; office?: string };
}) {
  const t = await getTranslations("success");
  const number = decodeURIComponent(params.number);
  const paid = searchParams.paid === "1";
  // «Оплата в точке»: онлайн платить не нужно — показываем, сколько и куда принести
  const officeOrder = searchParams.office === "1" && /^[0-9a-f-]{36}$/i.test(searchParams.order ?? "") ? searchParams.order! : null;
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
        {paid ? t("paidTitle", { number }) : t("createdTitle", { number })}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-slate-700">
        {paid ? t("paidText") : officeOrder ? t("officeText") : t("pendingText")}
      </p>
      {officeOrder && <OfficePaymentCard orderId={officeOrder} />}
      <p className="mt-2 text-sm text-muted-foreground">{t("keepNumber")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href={statusHref}>{t("track")}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/account">{t("myOrders")}</Link>
        </Button>
      </div>
    </div>
  );
}
