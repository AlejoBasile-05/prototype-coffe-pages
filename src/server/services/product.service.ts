/**
 * Servicio de producto del panel (Tarea 14).
 *
 * Dos operaciones, y ninguna más:
 *   1. Proyectar `ProductDTO[]` a filas de tabla (lectura).
 *   2. Fijar la disponibilidad de un producto (escritura).
 *
 * ⛔ Sin React, sin `next/*` y sin Prisma: recibe sus dependencias por
 *    parámetro (DIP) y por eso los tests corren sin base de datos.
 */
import "server-only";

import type { CategoryDTO, ProductDTO, ProductRow } from "@/lib/domain";
import type {
  CategoryAdminLister,
  ProductAdminReader,
  ProductAvailabilityWriter,
} from "./repository-ports";

export type { ProductRow };

/** Categoría sin nombre propio: la tabla muestra "(sin categoría)" y no un hueco. */
const UNASSIGNED_CATEGORY_NAME = "(sin categoría)";

/**
 * Une productos con el nombre de su categoría.
 *
 * El `ProductDTO` solo trae `categoryId`. Unir acá y no en el JSX tiene una
 * razón concreta: si el nombre se cruzara en el componente, hacer el `Map`
 * sería responsabilidad de la vista y se repetiría en cada render.
 */
const buildProductRows = (
  products: readonly ProductDTO[],
  categories: readonly CategoryDTO[],
): readonly ProductRow[] => {
  const nameByCategoryId = new Map(categories.map((category) => [category.id, category.name]));

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    imageUrl: product.imageUrl,
    price: product.price,
    status: product.status,
    isAvailable: product.isAvailable,
    isFeatured: product.isFeatured,
    sortOrder: product.sortOrder,
    categoryId: product.categoryId,
    categoryName: nameByCategoryId.get(product.categoryId) ?? UNASSIGNED_CATEGORY_NAME,
  }));
};

export interface ProductAdminDependencies {
  readonly productRepository: ProductAdminReader;
  readonly categoryRepository: CategoryAdminLister;
}

/**
 * Listado del panel de productos.
 *
 * ⛔ Sin caché y sin tag de revalidación. Es una lectura de admin sobre
 *    datos que el admin acaba de cambiar, detrás de una sesión. Cachear
 *    una tabla que el usuario está editando produce la sensación exacta
 *    de "guardé y no pasó nada".
 *
 * ⚠️ No filtra por `status`: el panel tiene que **ver** los borradores y
 *    los archivados para poder promotearlos. El filtro `PUBLISHED` es
 *    una regla del catálogo público (Tarea 08 §4.3), no del panel.
 *
 * ⚠️ No pagina. Con veinte a cuarenta productos del menú no hace falta;
 *    si creciera, la paginación va en el **repositorio**
 *    (`limit`/`cursor`), nunca con un `.slice()` acá (Tarea 14 §9).
 */
export const getProductsForAdmin = async (
  dependencies: ProductAdminDependencies,
): Promise<readonly ProductRow[]> => {
  const [products, categories] = await Promise.all([
    dependencies.productRepository.findAllProductsForAdmin(),
    dependencies.categoryRepository.findAllCategoriesForAdmin(),
  ]);

  return buildProductRows(products, categories);
};

export interface SetProductAvailabilityInput {
  readonly id: string;
  readonly isAvailable: boolean;
}

export interface ProductAvailabilityDependencies {
  readonly productRepository: ProductAvailabilityWriter;
}

/**
 * Fija la disponibilidad de un producto.
 *
 * Se llama `set`, no `toggle`, porque recibe el valor destino y lo aplica.
 * El repositorio ya traduce `P2025` a `ResourceNotFoundError`, y eso se
 * propaga sin envolver: el Server Action lo traduce a un mensaje de UI.
 *
 * ⛔ Este servicio **no** revalida caché. La invalidación es de la capa 2,
 *    y además acá no hay nada que invalidar: la disponibilidad no vive
 *    en el HTML cacheado (Tarea 08 §4.5, Tarea 14 §4.3).
 */
export const setProductAvailability = async (
  dependencies: ProductAvailabilityDependencies,
  input: SetProductAvailabilityInput,
): Promise<ProductDTO> =>
  dependencies.productRepository.toggleProductAvailability(input.id, input.isAvailable);
