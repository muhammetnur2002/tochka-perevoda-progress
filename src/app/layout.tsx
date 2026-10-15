import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "@/components/providers";
import { COMPANY } from "@/lib/config/constants";
import "./globals.css";

const inter = Inter({
  // latin-ext: туркменский, турецкий, азербайджанский, узбекский; cyrillic-ext: казахский, киргизский
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  variable: "--font-inter",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${COMPANY.name} — бюро переводов в Казани`,
    template: `%s · ${COMPANY.name}`,
  },
  description:
    "Переводы документов, нотариальное заверение, полиграфия и страхование в Казани. " +
    "Онлайн-заказ, расчёт стоимости, оплата и статус заказа в Telegram и на сайте.",
  applicationName: COMPANY.name,
  keywords: [
    "перевод документов",
    "нотариальный перевод",
    "бюро переводов Казань",
    "полиграфия Казань",
    "перевод паспорта",
    "перевод диплома",
    "ДМС студентам",
  ],
  authors: [{ name: COMPANY.name }],
  creator: COMPANY.name,
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: siteUrl,
    siteName: COMPANY.name,
    title: `${COMPANY.name} — бюро переводов в Казани`,
    description: "Переводы, полиграфия, страхование. Онлайн-заказ и оплата.",
    images: [
      {
        url: "/brand/og-image.jpg",
        width: 1200,
        height: 630,
        alt: `${COMPANY.name} — бюро переводов`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${COMPANY.name} — бюро переводов в Казани`,
    description: "Переводы, полиграфия, страхование. Онлайн-заказ и оплата.",
    images: ["/brand/og-image.jpg"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#00214C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={inter.variable}>
      <body className="font-sans">
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Moscow">
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
