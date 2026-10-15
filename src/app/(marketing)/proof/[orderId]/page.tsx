import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { ProofViewer } from "@/components/proof/proof-viewer";
import { resolveOrderAccess } from "@/lib/services/order-access";
import { getProofViewModel } from "@/lib/services/proof-service";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("proof");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Проверка перевода клиентом перед печатью. Доступ: владелец заказа (вошёл в кабинет),
 * гость по ссылке с токеном из уведомления, сотрудник — только просмотр.
 */
export default async function ProofPage({
  params,
  searchParams,
}: {
  params: { orderId: string };
  searchParams: { token?: string };
}) {
  if (!/^[0-9a-f-]{36}$/i.test(params.orderId)) notFound();
  const t = await getTranslations("proof");
  const token = searchParams.token?.slice(0, 200) ?? null;

  let mode: "manager" | "owner" | "executor" | "guest" | null = null;
  try {
    mode = (await resolveOrderAccess(params.orderId, token)).mode;
  } catch {
    mode = null;
  }

  if (!mode) {
    return (
      <div className="container max-w-xl py-16 text-center">
        <h1 className="text-2xl font-extrabold text-brand-800">{t("accessDenied")}</h1>
        <p className="mt-3 text-slate-700">{t("accessDeniedText")}</p>
        <Button asChild className="mt-6" variant="gold" size="lg">
          <Link href={`/login?next=${encodeURIComponent(`/proof/${params.orderId}`)}`}>{t("login")}</Link>
        </Button>
      </div>
    );
  }

  const model = await getProofViewModel(params.orderId);
  if (!model) {
    return (
      <div className="container max-w-xl py-16 text-center">
        <h1 className="text-2xl font-extrabold text-brand-800">{t("notSent")}</h1>
        <Button asChild className="mt-6" variant="outline" size="lg">
          <Link href="/account">{t("backToOrders")}</Link>
        </Button>
      </div>
    );
  }

  const canDecide = mode === "owner" || mode === "guest";
  return (
    <div className="container py-8 md:py-10">
      <ProofViewer model={model} token={canDecide && mode === "guest" ? token : null} canDecide={canDecide} />
    </div>
  );
}
