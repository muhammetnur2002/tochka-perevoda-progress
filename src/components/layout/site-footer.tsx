import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "./logo";
import { COMPANY } from "@/lib/config/constants";
import { getOffices } from "@/lib/services/catalog";
import type { OfficeRow } from "@/types/database.types";

/** Подвал сайта: пункты приёма, навигация, юридические ссылки. */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const to = await getTranslations("offices");
  let offices: OfficeRow[] = [];
  try {
    offices = await getOffices();
  } catch {
    // БД недоступна — подвал без списка точек
  }

  return (
    <footer className="border-t bg-brand-900 text-brand-100">
      <div className="container grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo inverted size={44} className="[&_img]:rounded-lg [&_img]:bg-white [&_img]:p-0.5" />
          <p className="text-sm text-brand-200">{t("legalName")}</p>
          <div className="space-y-2 text-sm">
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
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{to("title")}</h3>
          <ul className="space-y-3 text-sm">
            {offices.map((o) => (
              <li key={o.id} className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
                <span>
                  <span className="block text-white">{o.address}</span>
                  <span className="text-xs text-brand-200">
                    {[o.hours ?? to("hoursTbd"), o.phone].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{t("clients")}</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link className="hover:text-white" href="/services">
                {t("translations")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/calculator">
                {t("calculator")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/checkout">
                {t("order")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/status">
                {t("status")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/account">
                {t("account")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{t("info")}</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link className="hover:text-white" href="/legal/privacy">
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/legal/terms">
                {t("terms")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/legal/consent">
                {t("consent")}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-5">
        <div className="container flex flex-col items-center justify-between gap-2 text-xs text-brand-300 sm:flex-row">
          <span>
            © {new Date().getFullYear()} {COMPANY.name}. {t("rights")}
          </span>
          <span>{to("title")}</span>
        </div>
      </div>
    </footer>
  );
}
