/**
 * Reglas de negocio de categorías.
 *
 * ⛔ No agrupa productos: eso es de `catalog.service` (§4.6). Acá solo
 * viven el orden canónico, la lectura visible y la traducción de `null`
 * a `ResourceNotFoundError` para el panel.
 */
import "server-only";

import { ResourceNotFoundError } from "@/lib/domain";
import type { CategoryDTO } from "@/lib/domain";
import type { CategoryAdminReader, CategoryCatalogReader } from "./repository-ports";

/**
 * Orden canónico de las categorías.
 *
 * `position` es el criterio manual del local. El desempate por nombre
 * existe porque `position` es un `Int` editable a mano en Prisma Studio
 * y es perfectamente posible que dos categorías queden con el mismo
 * valor. Sin desempate, el orden de la base (que no está garantizado) se
 * filtraría a la pantalla y las secciones del menú saltarían entre
 * cargas. `localeCompare(..., "es")` ordena "Álbones" junto a
 * "Albóndigas", como espera un lector en español.
 */
export const orderCategories = (categories: readonly CategoryDTO[]): readonly CategoryDTO[] =>
  [...categories].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "es"));

/**
 * Categorías visibles, en el orden en que se muestran.
 *
 * Filtra `isVisible` y ordena. La usan `catalog.service` (agrupación) y
 * la Tarea 10 (anclas del menú).
 */
export const getVisibleCategories = async (dependencies: {
  readonly categoryRepository: CategoryCatalogReader;
}): Promise<readonly CategoryDTO[]> =>
  orderCategories(await dependencies.categoryRepository.findVisibleCategories());

/**
 * Categoría puntual para el panel admin.
 *
 * Traduce el `null` del repositorio a `ResourceNotFoundError`, que el
 * Server Action traduce a un mensaje en pantalla. El editor de producto
 * (Tarea 16) lo usa para confirmar que la categoría elegida existe antes
 * de mandar el formulario.
 */
export const getCategoryForAdmin = async (
  dependencies: { readonly categoryRepository: CategoryAdminReader },
  id: string,
): Promise<CategoryDTO> => {
  const category = await dependencies.categoryRepository.findCategoryById(id);
  if (category === null) throw new ResourceNotFoundError("Categoría", id);
  return category;
};
