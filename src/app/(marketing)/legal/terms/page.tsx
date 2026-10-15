import type { Metadata } from "next";
import { COMPANY } from "@/lib/config/constants";

export const metadata: Metadata = { title: "Условия оказания услуг" };

export default function TermsPage() {
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="mb-6 text-2xl font-bold text-brand-900">Условия оказания услуг</h1>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">1. Общие положения</h2>
        <p>
          {COMPANY.legalName} оказывает услуги письменного перевода, нотариального заверения,
          полиграфии и страхования. Оформляя заказ, клиент соглашается с настоящими условиями.
        </p>
        <h2 className="text-base font-semibold text-foreground">2. Сроки</h2>
        <p>
          Стандартный срок выполнения — 1–2 рабочих дня, если иное не указано для конкретной
          услуги. Срочное выполнение (1 день) и экспресс (в день обращения) оплачиваются с
          повышающим коэффициентом 1.5× и 2× соответственно.
        </p>
        <h2 className="text-base font-semibold text-foreground">3. Оплата</h2>
        <p>
          Оплата производится онлайн (банковская карта, СБП) либо наличными при получении.
          Возможна частичная предоплата. Момент оплаты отражается в статусе заказа.
        </p>
        <h2 className="text-base font-semibold text-foreground">4. Отмена и возврат</h2>
        <p>
          Заказ можно отменить до начала выполнения. Возврат средств за оплаченный, но не
          выполненный заказ производится в порядке, предусмотренном законодательством РФ.
        </p>
        <h2 className="text-base font-semibold text-foreground">5. Ответственность</h2>
        <p>
          Исполнитель несёт ответственность за качество перевода в пределах стоимости заказа.
          Нотариальное заверение осуществляется в соответствии с законодательством о нотариате.
        </p>
      </div>
    </div>
  );
}
