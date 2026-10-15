import type { Metadata } from "next";
import { COMPANY } from "@/lib/config/constants";

export const metadata: Metadata = { title: "Политика конфиденциальности" };

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="mb-6 text-2xl font-bold text-brand-900">Политика конфиденциальности</h1>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          {COMPANY.legalName} ({COMPANY.address}) обрабатывает персональные данные на основании
          Федерального закона № 152-ФЗ «О персональных данных».
        </p>
        <h2 className="text-base font-semibold text-foreground">1. Какие данные мы собираем</h2>
        <p>
          ФИО, номер телефона, адрес электронной почты, Telegram, а также файлы, которые вы
          загружаете для выполнения перевода. Данные собираются только для оформления и
          выполнения заказа, расчёта стоимости и уведомления о статусе.
        </p>
        <h2 className="text-base font-semibold text-foreground">2. Цели обработки</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Оформление и выполнение заказов на перевод, полиграфию и страхование;</li>
          <li>Расчёт стоимости и срока выполнения;</li>
          <li>Отправка уведомлений о статусе заказа (Telegram, SMS, email);</li>
          <li>Ведение истории заказов в личном кабинете.</li>
        </ul>
        <h2 className="text-base font-semibold text-foreground">3. Хранение и защита</h2>
        <p>
          Данные хранятся на серверах, расположенных на территории Российской Федерации
          (Yandex Cloud / Selectel). Доступ к данным ограничен ролевой моделью (RLS),
          файлы хранятся в приватном хранилище и выдаются по подписанным ссылкам с
          ограниченным сроком действия.
        </p>
        <h2 className="text-base font-semibold text-foreground">4. Ваши права</h2>
        <p>
          Вы вправе запросить выгрузку своих данных или их удаление. Для этого обратитесь в
          личный кабинет (раздел «Мои данные») или напишите на {COMPANY.email}.
        </p>
      </div>
    </div>
  );
}
