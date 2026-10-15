import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  FileText,
  Languages,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/common/section";
import { CatalogSection } from "@/components/services/catalog-section";
import { COMPANY } from "@/lib/config/constants";
import { getLanguages, getOffices } from "@/lib/services/catalog";
import type { LanguageRow, OfficeRow } from "@/types/database.types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/" },
  };
}

const ADVANTAGES = [
  { icon: Clock, key: "days" },
  { icon: ShieldCheck, key: "notary" },
  { icon: Wallet, key: "prices" },
  { icon: MessageCircle, key: "telegram" },
] as const;

const STEPS = ["1", "2", "3", "4"] as const;
const FAQ = ["price", "time", "notary", "languages", "status", "where"] as const;

function routeUrl(office: OfficeRow): string {
  return `https://yandex.ru/maps/?text=${encodeURIComponent(`${office.city}, ${office.address}`)}`;
}

export default async function HomePage() {
  const t = await getTranslations("home");
  const tl = await getTranslations("languages");
  const to = await getTranslations("offices");

  let languages: LanguageRow[] = [];
  let offices: OfficeRow[] = [];
  try {
    [languages, offices] = await Promise.all([getLanguages(), getOffices()]);
  } catch {
    // БД недоступна — секции без динамических данных
  }
  const sources = languages.filter((l) => l.is_source);
  const mainOffice = offices[0];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: COMPANY.name,
    image: "/brand/logo.png",
    telephone: COMPANY.phone,
    priceRange: "₽₽",
    address: (offices.length ? offices : [{ address: COMPANY.addressShort, city: COMPANY.city }]).map((o) => ({
      "@type": "PostalAddress",
      streetAddress: o.address,
      addressLocality: o.city,
      addressCountry: "RU",
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #d4a02a 0, transparent 45%)" }}
        />
        <div className="container relative grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1 text-sm text-gold-200">
              <MapPin className="h-4 w-4" /> {t("badge")}
            </div>
            <h1 className="text-balance text-4xl font-bold leading-tight md:text-5xl">{t("heroTitle")}</h1>
            <p className="max-w-xl text-lg text-brand-100">{t("heroText")}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="xl" variant="gold">
                <Link href="/calculator">
                  {t("ctaCalc")} <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="xl"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/services">{t("ctaCatalog")}</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-200">
              <span className="flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-gold-300" /> {t("factNotary")}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-gold-300" /> {t("factDays")}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-gold-300" /> {t("factServices")}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-gold-300" /> {t("factOffices")}
              </span>
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <div className="rounded-2xl bg-white/95 p-6 shadow-2xl">
              <Image src="/brand/logo.png" alt={t("logoAlt")} width={320} height={280} priority className="h-auto w-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* Языки */}
      <Section title={t("languagesTitle")} subtitle={t("languagesText")}>
        <ul className="flex flex-wrap gap-2.5">
          {sources.map((l) => (
            <li
              key={l.id}
              className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium text-brand-900 shadow-sm"
            >
              <Languages className="h-4 w-4 text-gold-500" />
              {tl.has(l.code) ? tl(l.code) : l.name}
              <span className="text-muted-foreground">→ {tl("ru")}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Каталог (превью) */}
      <Section title={t("servicesTitle")} subtitle={t("servicesSubtitle")} className="bg-muted/40">
        <CatalogSection limit={6} showTabs={false} />
        <div className="mt-8 text-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/services">
              {t("allServices")} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Section>

      {/* Преимущества */}
      <Section title={t("whyTitle")}>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ADVANTAGES.map((a) => (
            <div key={a.key} className="rounded-xl border bg-card p-6 shadow-sm">
              <a.icon className="mb-4 h-8 w-8 text-gold-500" />
              <h3 className="mb-2 font-semibold text-brand-900">{t(`why.${a.key}.title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`why.${a.key}.text`)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Как это работает */}
      <Section title={t("stepsTitle")} className="bg-muted/40">
        <div className="grid gap-6 md:grid-cols-4">
          {STEPS.map((n) => (
            <div key={n} className="relative">
              <div className="text-4xl font-bold text-gold-400">0{n}</div>
              <h3 className="mt-2 font-semibold text-brand-900">{t(`steps.${n}.title`)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t(`steps.${n}.text`)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section title={t("faqTitle")}>
        <div className="grid gap-4 md:grid-cols-2">
          {FAQ.map((key) => (
            <div key={key} className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="mb-2 font-semibold text-brand-900">{t(`faq.${key}.q`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`faq.${key}.a`)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Точки приёма */}
      <Section id="offices" title={to("title")} subtitle={t("officesText")} className="bg-muted/40">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-4">
            {offices.map((o) => (
              <div key={o.id} className="space-y-2 rounded-xl border bg-card p-5 shadow-sm">
                <p className="flex items-start gap-2 font-semibold text-brand-900">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" /> {o.address}
                </p>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 text-gold-500" /> {o.hours ?? to("hoursTbd")}
                </p>
                {o.phone && (
                  <p className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-gold-500" />
                    <a href={`tel:${o.phone.replace(/[^\d+]/g, "")}`} className="hover:text-brand-700">
                      {o.phone}
                    </a>
                  </p>
                )}
                <a
                  href={routeUrl(o)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
                >
                  <Navigation className="h-4 w-4" /> {to("route")}
                </a>
              </div>
            ))}
            <Button asChild size="lg" variant="gold">
              <Link href="/checkout">{t("orderCta")}</Link>
            </Button>
          </div>
          <div className="overflow-hidden rounded-xl border bg-muted">
            <iframe
              title={t("mapTitle")}
              src={`https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(
                mainOffice ? `${mainOffice.city}, ${mainOffice.address}` : COMPANY.address,
              )}&z=13`}
              className="h-full min-h-[320px] w-full border-0"
              loading="lazy"
            />
          </div>
        </div>
      </Section>
    </>
  );
}
