import type { MetadataRoute } from "next";
import { COMPANY } from "@/lib/config/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: COMPANY.name,
    short_name: COMPANY.shortName,
    description: "Terjime, çap we ätiýaçlandyryş hyzmatlary",
    start_url: "/",
    display: "standalone",
    background_color: "#00214C",
    theme_color: "#00214C",
    lang: "tk",
    icons: [],
  };
}
