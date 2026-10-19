import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/domain";
import { ROBOTS_DISALLOWED } from "@/config/seo";
import { SITE_URL } from "@/config/site";

/**
 * ⛔ `Sitemap:` con URL **absoluta** y sin barra final. La ruta relativa
 *    la ignoran los rastreadores sin avisar (§2.5).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...ROBOTS_DISALLOWED],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml", SITE_URL),
    host: absoluteUrl("/", SITE_URL).replace(/\/$/, ""),
  };
}
