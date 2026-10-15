import type { Metadata } from "next";
import { COMPANY, CONSENT_VERSION } from "@/lib/config/constants";

export const metadata: Metadata = { title: "Согласие на обработку персональных данных" };

export default function ConsentPage() {
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="mb-6 text-2xl font-bold text-brand-900">
        Согласие на обработку персональных данных
      </h1>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          В соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных»
          я, действуя свободно, своей волей и в своём интересе, даю согласие{" "}
          {COMPANY.legalName} ({COMPANY.address}) на обработку моих персональных данных.
        </p>
        <h2 className="text-base font-semibold text-foreground">Перечень данных</h2>
        <p>
          Фамилия, имя, отчество; номер телефона; адрес электронной почты; идентификатор
          Telegram; сведения, содержащиеся в загруженных файлах, необходимых для выполнения
          перевода.
        </p>
        <h2 className="text-base font-semibold text-foreground">Цели</h2>
        <p>
          Оформление и выполнение заказа, расчёт стоимости, направление уведомлений о статусе
          заказа, ведение истории заказов.
        </p>
        <h2 className="text-base font-semibold text-foreground">Срок действия</h2>
        <p>
          Согласие действует с момента его предоставления и до достижения целей обработки или
          до момента отзыва. Согласие может быть отозвано путём обращения по адресу{" "}
          {COMPANY.email} или через личный кабинет.
        </p>
        <p className="text-xs text-muted-foreground">
          Версия документа: {CONSENT_VERSION}. Факт согласия фиксируется в системе при
          оформлении каждого заказа (дата, время, IP-адрес).
        </p>
      </div>
    </div>
  );
}
