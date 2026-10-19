/**
 * Sitemap del sitio.
 *
 * ⛔ El route handler delega en el servicio: ESLint bloquea que este
 *    archivo importe un repositorio, así la puerta se abre y no se
 *    recupera con una excepción suelta (§4.1).
 */
import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/domain/seo";
import { SITE_URL } from "@/config/site";
import { getSeoDependencies } from "@/server/services";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dependencies = getSeoDependencies();
  const entries = await dependencies.getSitemapEntries(dependencies);

  return entries.map((entrada) => ({
    url: absoluteUrl(entrada.path, SITE_URL),
    lastModified: entrada.lastModified,
    changeFrequency: entrada.changeFrequency,
    priority: entrada.priority,
  }));
}
