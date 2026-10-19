/**
 * Ensamblaje del catálogo público: qué es visible, en qué orden y con
 * qué caché.
 *
 * Las reglas viven en `readCatalogSections`/`buildCatalogDTO` (sin caché,
 * 100% testeables) y `getCatalogForPublic` solo agrega la envoltura de
 * `unstable_cache` y los ajustes. Ver §4.5 y §6.6 de la tarea.
 */
import "server-only";

import { unstable_cache } from "next/cache";

import { ResourceNotFoundError, hasAvailableProducts } from "@/lib/domain";
import type {
  BusinessSettingsDTO,
  CatalogDTO,
  CatalogSection,
  CategoryDTO,
  ProductDTO,
} from "@/lib/domain";
import type { CategoryCatalogReader, ProductCatalogReader } from "./repository-ports";

/**
 * ⛔ Tag único de invalidación del contenido. Lo llaman el alta, la
 * edición, la publicación, la despublicación, el archivado y el reorden.
 *
 * ⛔ El toggle de disponibilidad NO lo llama: la disponibilidad no vive
 * en el HTML cacheado (§4.5), se propaga por Realtime (Tarea 15). Si un
 * día un toggle invalida el catálogo, es un bug.
 */
export const CATALOG_CACHE_TAG = "products";

/**
 * Red de seguridad temporal: si un `revalidateTag` quedara sin escribir
 * en algún camino futuro, el contenido se refresca solo en una hora.
 * No es el mecanismo principal: es lo que evita servir HTML viejo de
 * productos durante semanas por un olvido.
 */
const CATALOG_REVALIDATE_SECONDS = 3600;

/** Clave estable de la entrada de caché. No lleva datos del negocio. */
const CATALOG_CACHE_KEY = ["prototype", "catalogo-publico", "secciones"] as const;

/**
 * Axioma de dominio. El repositorio ya filtra, pero el filtro se repite
 * acá a propósito: "solo PUBLISHED" es una regla del dominio, no un
 * detalle de la consulta. Si mañana el catálogo se lee de otro lado
 * (CMS, fixture, doble de test mal armado), este filtro sigue existiendo
 * y sigue siendo cierto (§4.3).
 */
const isPublished = (product: ProductDTO): boolean => product.status === "PUBLISHED";

const bySortOrderThenName = (a: ProductDTO, b: ProductDTO): number =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es");

/**
 * Agrupa productos publicados bajo sus categorías visibles.
 *
 * ⚠️ Se itera sobre las **categorías**, no sobre los productos:
 *  · si se iteraran los productos, uno cuya categoría está oculta
 *    aparecería suelto, sin encabezado, publicado para quien tenga el
 *    link;
 *  · si no se filtrara `products.length > 0`, una categoría visible sin
 *    publicados dejaría un encabezado con un grid vacío debajo, que es
 *    exactamente el error de DESIGN.md §10.5.
 */
const buildCatalogSections = (
  categories: readonly CategoryDTO[],
  products: readonly ProductDTO[],
): readonly CatalogSection[] => {
  const published = products.filter(isPublished);

  const byCategoryId = new Map<string, ProductDTO[]>();
  for (const product of published) {
    const bucket = byCategoryId.get(product.categoryId);
    if (bucket === undefined) byCategoryId.set(product.categoryId, [product]);
    else bucket.push(product);
  }

  return categories
    .map((category) => ({
      category,
      products: [...(byCategoryId.get(category.id) ?? [])].sort(bySortOrderThenName),
    }))
    .filter((section) => section.products.length > 0);
};

export interface CatalogContentReaders {
  readonly productRepository: ProductCatalogReader;
  readonly categoryRepository: CategoryCatalogReader;
}

export interface CatalogServiceDependencies extends CatalogContentReaders {
  /** Se inyecta como función suelta: `getBusinessSettings` es un servicio, no un repositorio. */
  readonly getBusinessSettings: () => Promise<BusinessSettingsDTO>;
}

/**
 * Lectura del contenido, SIN caché. Acá viven todas las reglas.
 *
 * Es la función que se testea. `getCatalogForPublic` la envuelve en
 * `unstable_cache` y le suma los ajustes; los tests llaman esta, nunca la
 * otra (la caché es global y con dobles distintos devolvería el resultado
 * del test anterior).
 */
export const readCatalogSections = async (
  dependencies: CatalogContentReaders,
): Promise<readonly CatalogSection[]> => {
  const [categories, products] = await Promise.all([
    dependencies.categoryRepository.findVisibleCategories(),
    dependencies.productRepository.findPublishedProducts(),
  ]);

  return buildCatalogSections(categories, products);
};

/**
 * Envuelve la lectura en la caché ISR de Next.
 *
 * Detalle no obvio: `unstable_cache` serializa los argumentos para armar
 * la clave, así que **no puede recibir funciones**. Las dependencias se
 * capturan en el cierre y la clave es constante: la entrada de caché es
 * la misma en todos los requests.
 */
const readCachedCatalogSections = (
  dependencies: CatalogContentReaders,
): Promise<readonly CatalogSection[]> =>
  unstable_cache(async () => readCatalogSections(dependencies), [...CATALOG_CACHE_KEY], {
    tags: [CATALOG_CACHE_TAG],
    revalidate: CATALOG_REVALIDATE_SECONDS,
  })();

/** Ensamblaje puro del DTO. Sin I/O, sin caché: totalmente testeable. */
export const buildCatalogDTO = (
  sections: readonly CatalogSection[],
  settings: BusinessSettingsDTO,
): CatalogDTO => ({
  sections,
  settings,
  hasAnyAvailableProduct: hasAvailableProducts(sections),
});

/**
 * Catálogo público completo: contenido cacheado + ajustes sin caché.
 *
 * Es la única puerta de entrada del catálogo: la Tarea 10 la llama desde
 * un Server Component y el resultado se serializa a los Client
 * Components como DTO plano.
 *
 * ⚠️ `hasAnyAvailableProduct` es un snapshot del HTML generado, no el
 * estado final de la disponibilidad (ese vive en el cliente, por
 * Realtime). Se calcula fuera de la función cacheada: meterlo adentro lo
 * volvería más viejo todavía sin aportar nada.
 */
export const getCatalogForPublic = async (
  dependencies: CatalogServiceDependencies,
): Promise<CatalogDTO> => {
  const [sections, settings] = await Promise.all([
    readCachedCatalogSections(dependencies),
    dependencies.getBusinessSettings(),
  ]);

  return buildCatalogDTO(sections, settings);
};

/**
 * Catálogo filtrando los agotados. **Sin caché**, a propósito: existe
 * para la lectura de respaldo de disponibilidad (Tarea 15), que tiene
 * que reflejar el estado actual y no el de hace hasta una hora.
 *
 * ⚠️ Si ninguna vista termina usándola, es código muerto y hay que
 * borrarla. Consumidores previstos: el fallback sin Realtime y, si se
 * decide exponerlo, el filtro "Solo disponibles" de la Tarea 10.
 */
export const getCatalogWithOnlyAvailable = async (
  dependencies: CatalogContentReaders,
): Promise<readonly CatalogSection[]> => {
  const [categories, products] = await Promise.all([
    dependencies.categoryRepository.findVisibleCategories(),
    dependencies.productRepository.findPublishedProducts({ onlyAvailable: true }),
  ]);

  return buildCatalogSections(categories, products);
};

/**
 * Ficha de producto para la página pública.
 *
 * Traduce el `null` del repositorio a `ResourceNotFoundError`. Un slug
 * que apunta a un DRAFT o a un ARCHIVED devuelve 404, igual que un slug
 * inexistente: responder 403 confirmaría que ese producto existe y fue
 * retirado, que es información innecesaria de dar.
 */
export const getProductBySlugForPublic = async (
  dependencies: { readonly productRepository: ProductCatalogReader },
  slug: string,
): Promise<ProductDTO> => {
  const product = await dependencies.productRepository.findPublishedProductBySlug(slug);
  if (product === null || !isPublished(product)) {
    throw new ResourceNotFoundError("Producto", slug);
  }
  return product;
};

/**
 * Destacados de la home.
 *
 * `limit` se acota a un rango razonable: el repositorio no pagina y este
 * catálogo tiene veinte a cuarenta productos, así que un `limit` de
 * `10000` desde un call site equivocado no debe convertir esto en un
 * `findMany` que trae todo.
 */
export const getFeaturedProductsForPublic = async (
  dependencies: { readonly productRepository: ProductCatalogReader },
  limit = 4,
): Promise<readonly ProductDTO[]> => {
  const bounded = Math.min(Math.max(Math.trunc(limit), 1), 12);
  const products = await dependencies.productRepository.findFeaturedProducts(bounded);
  return products.filter(isPublished).slice(0, bounded);
};
