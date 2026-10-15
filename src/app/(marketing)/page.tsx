import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  FileText,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/common/section";
import { CatalogSection } from "@/components/services/catalog-section";
import { COMPANY } from "@/lib/config/constants";

export const metadata: Metadata = {
  title: "Переводы, полиграфия и страхование в Казани",
  description:
    "Бюро переводов «Точка Перевода Прогресс» в Казани: переводы документов, нотариальное заверение, полиграфия, страхование. Онлайн-заказ, оплата и статус.",
  alternates: { canonical: "/" },
};

const ADVANTAGES = [
  {
    icon: Clock,
    title: "Срок 1–2 дня",
    text: "Большинство переводов готовим за 1–2 рабочих дня. Есть срочный и экспресс-режим.",
  },
  {
    icon: ShieldCheck,
    title: "Нотариальное заверение",
    text: "Заверяем переводы у нотариуса — всё в одном окне, без лишних поездок.",
  },
  {
    icon: Wallet,
    title: "Прозрачные цены",
    text: "Точный расчёт в калькуляторе до оформления. Оплата картой, СБП или наличными.",
  },
  {
    icon: MessageCircle,
    title: "Telegram-сервис",
    text: "Заказ и статус прямо в Telegram. Уведомления о готовности приходят автоматически.",
  },
];

const STEPS = [
  { n: "01", title: "Выберите услуги", text: "Добавьте услуги в корзину в каталоге или калькуляторе." },
  { n: "02", title: "Прикрепите файлы", text: "Фото, скан, PDF или DOC — прямо с телефона или компьютера." },
  { n: "03", title: "Оплатите онлайн", text: "Карта, СБП по QR или наличными при получении." },
  { n: "04", title: "Получите результат", text: "Самовывоз или доставка. Статус — на сайте и в Telegram." },
];

const FAQ = [
  {
    q: "Сколько стоит перевод страницы?",
    a: "Юридические и медицинские документы — 550 ₽/страница, техническая документация — 650 ₽/страница. Документы с фиксированной ценой (паспорт, диплом, справка) — по прайсу в каталоге.",
  },
  {
    q: "Как быстро будет готов перевод?",
    a: "Стандартный срок — 1–2 рабочих дня. Возможна срочность за доплату: в течение 1 дня (×1.5) или в день обращения (×2).",
  },
  {
    q: "Вы заверяете переводы у нотариуса?",
    a: "Да. Нотариальное заверение можно добавить к любому переводу. Услуги с пометкой «нотариальный» уже включают заверение в цену.",
  },
  {
    q: "Как отследить статус заказа?",
    a: "По номеру заказа или телефону на странице «Статус заказа». После оформления заказа вы также получаете уведомления в Telegram, SMS или email.",
  },
  {
    q: "Где вы находитесь?",
    a: "г. Казань, ул. Сибирский Тракт, 7/6. Работаем пн–пт 9:00–19:00, сб 10:00–16:00.",
  },
];

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: COMPANY.name,
    image: "/brand/logo.png",
    address: {
      "@type": "PostalAddress",
      streetAddress: "ул. Сибирский Тракт, 7/6",
      addressLocality: "Казань",
      addressCountry: "RU",
    },
    telephone: COMPANY.phone,
    openingHours: "Mo-Fr 09:00-19:00 Sa 10:00-16:00",
    priceRange: "₽₽",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 80% 20%, #d4a02a 0, transparent 45%)",
          }}
        />
        <div className="container relative grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1 text-sm text-gold-200">
              <MapPin className="h-4 w-4" /> Казань · {COMPANY.addressShort}
            </div>
            <h1 className="text-balance text-4xl font-bold leading-tight md:text-5xl">
              Переводы документов с нотариальным заверением
            </h1>
            <p className="max-w-xl text-lg text-brand-100">
              Юридические, медицинские и технические переводы, полиграфия и страхование.
              Онлайн-заказ, прозрачный расчёт и оплата за пару минут.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="xl" variant="gold">
                <Link href="/calculator">
                  Рассчитать стоимость <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="xl"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/services">Каталог услуг</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-200">
              <span className="flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-gold-300" /> Нотариально
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-gold-300" /> 1–2 дня
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-gold-300" /> 24 услуги в прайсе
              </span>
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <div className="rounded-2xl bg-white/95 p-6 shadow-2xl">
              <Image
                src="/brand/logo.png"
                alt={`${COMPANY.name} — логотип`}
                width={320}
                height={280}
                priority
                className="h-auto w-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Каталог (превью) */}
      <Section
        title="Услуги и цены"
        subtitle="Актуальный прайс. Точную стоимость с учётом срочности и количества страниц считает калькулятор."
      >
        <CatalogSection limit={6} showTabs={false} />
        <div className="mt-8 text-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/services">
              Все услуги и цены <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Section>

      {/* Преимущества */}
      <Section className="bg-muted/40">
        <div className="mb-10">
          <h2 className="text-balance text-2xl font-bold tracking-tight text-brand-900 md:text-3xl">
            Почему выбирают нас
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ADVANTAGES.map((a) => (
            <div key={a.title} className="rounded-xl border bg-card p-6 shadow-sm">
              <a.icon className="mb-4 h-8 w-8 text-gold-500" />
              <h3 className="mb-2 font-semibold text-brand-900">{a.title}</h3>
              <p className="text-sm text-muted-foreground">{a.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Как это работает */}
      <Section title="Как оформить заказ">
        <div className="grid gap-6 md:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <div className="text-4xl font-bold text-gold-400">{s.n}</div>
              <h3 className="mt-2 font-semibold text-brand-900">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section title="Частые вопросы" className="bg-muted/40">
        <div className="grid gap-4 md:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q} className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="mb-2 font-semibold text-brand-900">{item.q}</h3>
              <p className="text-sm text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Контакты */}
      <Section title="Контакты">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-xl border bg-card p-6">
            <p className="flex items-center gap-2 font-medium">
              <MapPin className="h-5 w-5 text-gold-500" /> {COMPANY.address}
            </p>
            <p className="flex items-center gap-2 font-medium">
              <Clock className="h-5 w-5 text-gold-500" /> {COMPANY.workHours}
            </p>
            <p className="flex items-center gap-2 font-medium">
              <a href={`tel:${COMPANY.phoneHref}`} className="hover:text-brand-700">
                {COMPANY.phone}
              </a>
            </p>
            <Button asChild size="lg" variant="gold">
              <Link href="/checkout">Оформить заказ</Link>
            </Button>
          </div>
          <div className="overflow-hidden rounded-xl border bg-muted">
            <iframe
              title="Карта — Точка Перевода Прогресс"
              src="https://yandex.ru/map-widget/v1/?text=Казань%2C%20Сибирский%20Тракт%2C%207%2F6&z=16"
              className="h-full min-h-[280px] w-full border-0"
              loading="lazy"
            />
          </div>
        </div>
      </Section>
    </>
  );
}
