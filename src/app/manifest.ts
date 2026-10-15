import type { MetadataRoute } from "next";
import { COMPANY } from "@/lib/config/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: COMPANY.name,
    short_name: COMPANY.shortName,
    description: "Бюро переводов в Казани: переводы, полиграфия, страхование",
    start_url: "/",
    display: "standalone",
    background_color: "#00214C",
    theme_color: "#00214C",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
