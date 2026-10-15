import createNextIntlPlugin from "next-intl/plugin";

const isProd = process.env.NODE_ENV === "production";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
const supabaseWs = supabaseOrigin.replace(/^http/, "ws");

/**
 * Content-Security-Policy:
 *  - Telegram WebApp SDK (telegram.org) и встраивание Mini App в web.telegram.org;
 *  - Яндекс.Карты (iframe на главной);
 *  - Supabase (REST/Auth/Realtime по wss).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isProd ? "" : "'unsafe-eval'"} https://telegram.org`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs} https://*.supabase.co wss://*.supabase.co`,
  "frame-src 'self' https://yandex.ru https://*.yandex.ru",
  "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
  "base-uri 'self'",
  "form-action 'self' https://yoomoney.ru https://*.yoomoney.ru",
  "worker-src 'self' blob:",
  "object-src 'none'",
]
  .join("; ")
  .replace(/\s+/g, " ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // линт запускается отдельно (pnpm lint) — сборка в CI не дублирует проверку
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["exceljs", "nodemailer", "@aws-sdk/client-s3", "qrcode", "sharp"],
  },
  webpack: (config) => {
    // pdfjs-dist (разбор PDF в браузере сотрудника) необязательно подтягивает node-canvas
    config.resolve.alias.canvas = false;
    return config;
  },
  images: {
    // Все изображения next/image — локальные (public/brand). Удалённые источники
    // не разрешены, чтобы /_next/image не стал открытым прокси.
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    const security = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self)" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
    ];
    if (isProd) {
      security.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
    }
    return [
      { source: "/:path*", headers: security },
      // Личные разделы и API не кэшируются прокси
      { source: "/(account|admin|workspace|proof)/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

// Языки интерфейса: src/i18n/request.ts (словари в messages/*.json)
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
