import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  // Только публичные индексируемые страницы (оформление, кабинет и CRM закрыты в robots.ts)
  const routes = ["", "/services", "/calculator", "/status", "/legal/privacy", "/legal/terms", "/legal/consent"];
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
