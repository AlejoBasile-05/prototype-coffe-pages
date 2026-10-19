/**
 * Tipos del sitemap y construcción de URLs absolutas (Tarea 18 §6.1).
 *
 * ⛔ Capa 0: sin React, sin Next, sin `process.env`. El `siteUrl` entra
 *    como argumento `siteUrl`: así la función es testeable sin entorno
 *    y nadie puede usarla leyendo una variable global por accidente.
 */

/** El mismo vocabulario que acepta `MetadataRoute.Sitemap`. */
export type SitemapChangeFrequency =
  "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export interface SitemapEntry {
  /** Ruta con barra inicial: `"/"`, `"/menu"`, `"/producto/x"`. */
  readonly path: string;
  readonly lastModified: Date;
  readonly changeFrequency: SitemapChangeFrequency;
  readonly priority: number;
}

/**
 * Lo único que el sitemap necesita de un producto.
 *
 * ⛔ Existe para que `ProductDTO` no crezca con un `updatedAt` que nadie
 *    más usa (§2.3). Una fila muy estrecha para una consulta barata.
 */
export interface SitemapProductRecord {
  readonly slug: string;
  readonly updatedAt: Date;
}

/**
 * URL absoluta a partir de una ruta del sitio.
 *
 * Hace tres cosas que concatenar a mano no haría:
 *   1. Saca la barra final del `siteUrl`, para no producir `//menu`.
 *   2. Devuelve la ruta sin tocar si ya es absoluta. Sirve para las URLs
 *      de Cloudinary, que son de otro host y no admiten el prefijo.
 *   3. Mantiene la barra inicial cuando la ruta es `"/"`: la home no
 *      puede ser el host pelado.
 */
export const absoluteUrl = (path: string, siteUrl: string): string => {
  const base = siteUrl.replace(/\/+$/, "");

  if (/^https?:\/\//i.test(path)) return path;
  if (path === "" || path === "/") return `${base}/`;

  const conBarra = path.startsWith("/") ? path : `/${path}`;
  return `${base}${conBarra}`;
};
