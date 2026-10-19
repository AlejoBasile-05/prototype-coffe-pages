/**
 * Servicio del sitemap (Tarea 18 §6.5).
 *
 * ⛔ No es el route handler: es el cableado de lectura + caché, en la
 *    forma de `catalog.service` (Tarea 08 §6.6). De ese modo el route
 *    handler no importa un repositorio.
 *
 * `readSitemapEntries` es pura y testeable en `node` (sin mocks), y
 * `getSitemapEntries` es la puerta pública con la caché con
 * `unstable_cache`.
 */
import { unstable_cache } from "next/cache";

import { CATALOG_CACHE_TAG } from "@/server/services/catalog.service";
import { SITEMAP_PRODUCT_FREQUENCY, SITEMAP_PRODUCT_PRIORITY, SITEMAP_STATIC } from "@/config/seo";
import type { SitemapEntry } from "@/lib/domain";
import type { ProductSitemapReader } from "@/server/services/repository-ports";

interface SeoDependencies {
  readonly productRepository: ProductSitemapReader;
  readonly getContentUpdatedAt: () => Promise<Date>;
}

/** Ensamblaje puro. La llamada sin caché = la que prueban los tests. */
export const readSitemapEntries = async (
  dependencies: SeoDependencies,
): Promise<readonly SitemapEntry[]> => {
  const [products, contenidoActualizado] = await Promise.all([
    dependencies.productRepository.findPublishedProductsForSitemap(),
    dependencies.getContentUpdatedAt(),
  ]);

  const estaticas = SITEMAP_STATIC.map((entrada) => ({
    path: entrada.path,
    lastModified: contenidoActualizado,
    changeFrequency: entrada.changeFrequency,
    priority: entrada.priority,
  }));

  const fichas = products.map((product) => ({
    path: `/producto/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: SITEMAP_PRODUCT_FREQUENCY,
    priority: SITEMAP_PRODUCT_PRIORITY,
  }));

  return [...estaticas, ...fichas];
};

/**
 * `unstable_cache` serializa los argumentos para armar la clave, así que
 * no puede recibir funciones. Las dependencias se capturan en el cierre
 * y la clave queda constante: misma entrada de caché en todas las
 * requests.
 */
const getCachedSitemapEntries = (dependencies: SeoDependencies): Promise<readonly SitemapEntry[]> =>
  unstable_cache(async () => readSitemapEntries(dependencies), ["sitemap-entradas"], {
    tags: [CATALOG_CACHE_TAG],
    revalidate: 3600,
  })();

export const getSitemapEntries = (
  dependencies: SeoDependencies,
): Promise<readonly SitemapEntry[]> => getCachedSitemapEntries(dependencies);
