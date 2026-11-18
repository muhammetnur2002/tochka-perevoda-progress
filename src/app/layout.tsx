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
  title: { default: COMPANY.name, template: `%s · ${COMPANY.name}` },
  description: "Resminamalaryň terjimesi. Onlaýn sargyt, baha hasaplamasy we sargydyň ýagdaýy.",
  applicationName: COMPANY.name,
  openGraph: {
    type: "website",
    locale: "tk_TM",
    url: siteUrl,
    siteName: COMPANY.name,
    title: COMPANY.name,
  },
  twitter: { card: "summary", title: COMPANY.name },
};

export const viewport: Viewport = {
  themeColor: "#00214C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
