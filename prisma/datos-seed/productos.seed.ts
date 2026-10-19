/**
 * Datos semilla de productos (prototipo genérico).
 *
 * Se generan a partir de `PROTOTYPE_CONFIG.defaultCategories`
 * (src/config/prototype.ts): un par de productos de ejemplo por categoría,
 * con nombres genéricos (`Producto A`, `Producto B`, …) y el `categorySlug`
 * tomado de la config. Todos nacen en `DRAFT`; el orquestador decide el
 * estado efectivo (solo `PUBLISHED` si el entorno trae `SEED_PUBLISH_MOCK=true`
 * explícito).
 *
 * Datos > lógica: este archivo exporta constantes `readonly`. Lo que depende
 * del entorno vive en `negocio.seed.ts` (`leerAdminDelEntorno`) y en el
 * orquestador (`ejecutar-semilla.ts`).
 */

import { PROTOTYPE_CONFIG } from "@/config/prototype";
import type { Allergen } from "../../src/lib/domain/allergens";
import type { ProductStatus } from "@prisma/client";

export interface ProductoSeed {
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly price: number;
  readonly categorySlug: string;
  readonly allergens: readonly Allergen[];
  readonly isFeatured: boolean;
  readonly sortOrder: number;
  /** Estado editorial en el dato: siempre DRAFT en el set de ejemplo. */
  readonly status: ProductStatus;
}

/** Cuántos productos de ejemplo se generan por categoría. */
const PRODUCTOS_POR_CATEGORIA = 2;

/** Sufijos alfabéticos para los nombres genéricos (A, B, C, …). */
const SUFIJOS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Imágenes de relleno.
 *
 * ⛔ NO son fotos de los productos reales. La nube `demo` de Cloudinary
 *    sirve estos JPG sin cuenta y sirve de soporte del layout; las fotos
 *    reales las sube el negocio más adelante.
 *
 * `imageUrl` nunca va vacía: la base la exige (`imageUrl: String` no nulo).
 * `imagePublicId` SIEMPRE es `null` en el seed — no por descuido: si se
 * inventara un id, el reemplazo de foto intentaría destruir un asset
 * inexistente y cortaría el guardado.
 */
const DEMO_SAMPLES = [
  "cld-sample-2",
  "cld-sample-3",
  "cld-sample-4",
  "cld-sample-5",
  "sample",
] as const;

export const buildImagenDeRelleno = (sample: string): string =>
  `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,g_auto,w_1200/${sample}.jpg`;

export const imageSampleFor = (index: number): string =>
  DEMO_SAMPLES[((index % DEMO_SAMPLES.length) + DEMO_SAMPLES.length) % DEMO_SAMPLES.length] ??
  "sample";

export const PRODUCTOS_SEED: readonly ProductoSeed[] = PROTOTYPE_CONFIG.defaultCategories.flatMap(
  (categoria, indiceCategoria) =>
    Array.from(
      { length: PRODUCTOS_POR_CATEGORIA },
      (_, indiceProducto): ProductoSeed => {
        const numero = indiceCategoria * PRODUCTOS_POR_CATEGORIA + indiceProducto;
        const sufijo = SUFIJOS[numero] ?? String(numero + 1);

        return {
          name: `Producto ${sufijo}`,
          slug: `producto-${sufijo.toLowerCase()}`,
          description: `Producto de ejemplo de la categoría "${categoria.name}".`,
          price: (numero + 1) * 100,
          categorySlug: categoria.slug,
          allergens: [...PROTOTYPE_CONFIG.defaultAllergens],
          isFeatured: indiceProducto === 0,
          sortOrder: indiceProducto + 1,
          status: "DRAFT",
        };
      },
    ),
);
