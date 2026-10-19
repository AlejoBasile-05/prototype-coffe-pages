import type { SitemapChangeFrequency } from "@/lib/domain";
import { PROTOTYPE_CONFIG } from "./prototype";

/**
 * Rutas que los buscadores no deberían recorrer (Tarea 18 §6.4).
 *
 * `/admin` y `/login` van primero: son las dos que importan y una
 * diferencia entre ellas es el motivo por el que se excluye el índice.
 */
export const ROBOTS_DISALLOWED: readonly string[] = [
  "/admin",
  "/login",
  "/checkout",
  "/api",
] as const;

/**
 * Frecuencia y prioridad del sitemap.
 *
 * Los números son conservadores a propósito: si mañana el panel se
 * abre una vez por semana, "daily" miente poco y "weekly" miente mucho.
 */
export const SITEMAP_STATIC: readonly {
  readonly path: string;
  readonly changeFrequency: SitemapChangeFrequency;
  readonly priority: number;
}[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/menu", changeFrequency: "daily", priority: 0.9 },
] as const;

/** La ficha de producto se mueve con la lectura de la base, no con el panel. */
export const SITEMAP_PRODUCT_FREQUENCY: SitemapChangeFrequency = "weekly";
export const SITEMAP_PRODUCT_PRIORITY = 0.8;

/** Tamaño de la imagen de Open Graph. Lo que piden WhatsApp e Instagram. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/**
 * ⛔ La localidad, la provincia y el país NO están en `BusinessSettings`:
 *    es el negocio que no cambia con el panel (§6.8). Si alguna vez se
 *    prefiere cargarlas por encima, se agregan al schema y queda en la
 *    Tarea 17.
 */
export const SITE_LOCALITY = PROTOTYPE_CONFIG.location.city;
export const SITE_REGION = PROTOTYPE_CONFIG.location.region;
export const SITE_COUNTRY = PROTOTYPE_CONFIG.location.countryCode;

/** `publicId` de la imagen de portada usada por el JSON-LD y la OG. */
export const OG_IMAGE_DEFAULT = "prototype/portada";