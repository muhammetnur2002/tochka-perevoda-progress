import Link from "next/link";
import { Logo } from "./logo";
import { COMPANY } from "@/lib/config/constants";
import { MapPin, Clock, Phone, Mail } from "lucide-react";

/** Подвал сайта: реквизиты, навигация, юридические ссылки. */
export function SiteFooter() {
  return (
    <footer className="border-t bg-brand-900 text-brand-100">
      <div className="container grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo inverted size={44} className="[&_img]:rounded-lg [&_img]:bg-white [&_img]:p-0.5" />
          <p className="text-sm text-brand-200">{COMPANY.legalName}</p>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gold-300" />
              {COMPANY.address}
            </p>
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gold-300" />
              {COMPANY.workHours}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gold-300" />
              <a href={`tel:${COMPANY.phoneHref}`} className="hover:text-white">
                {COMPANY.phone}
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gold-300" />
              <a href={`mailto:${COMPANY.email}`} className="hover:text-white">
                {COMPANY.email}
              </a>
            </p>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
            Услуги
          </h3>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/services">Переводы документов</Link></li>
            <li><Link className="hover:text-white" href="/services#printing">Полиграфия</Link></li>
            <li><Link className="hover:text-white" href="/services#insurance">Страхование</Link></li>
            <li><Link className="hover:text-white" href="/calculator">Калькулятор стоимости</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
            Клиентам
          </h3>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/checkout">Оформить заказ</Link></li>
            <li><Link className="hover:text-white" href="/status">Проверить статус</Link></li>
            <li><Link className="hover:text-white" href="/account">Личный кабинет</Link></li>
            <li><Link className="hover:text-white" href="/login">Войти</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
            Информация
          </h3>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/legal/privacy">Политика конфиденциальности</Link></li>
            <li><Link className="hover:text-white" href="/legal/terms">Условия оказания услуг</Link></li>
            <li><Link className="hover:text-white" href="/legal/consent">Согласие на обработку ПД</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-5">
        <div className="container flex flex-col items-center justify-between gap-2 text-xs text-brand-300 sm:flex-row">
          <span>© {new Date().getFullYear()} {COMPANY.name}. Все права защищены.</span>
          <span>г. Казань · ул. Сибирский Тракт, 7/6</span>
        </div>
      </div>
    </footer>
  );
}
