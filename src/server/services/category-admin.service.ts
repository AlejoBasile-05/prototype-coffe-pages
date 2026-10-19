/**
 * Escritura y lectura de categorías para el panel (Tarea 17 §6.6).
 *
 * ⛔ Un servicio por dominio, no una acción por cada operación:
 *    la regla del slug congelado necesita el conteo de productos
 *    (§4.3), y el conteo viaja junto con el nombre para que el diálogo
 *    de borrado pueda nombrar la categoría sin una lectura extra.
 *
 * ⛔ Sin React ni `next/*`. Los tests de §10.1 corren sin base porque
 *    el wiring ocurre en `src/server/services/index.ts`.
 */
import "server-only";

import { ConflictError, ResourceNotFoundError, ValidationError } from "@/lib/domain";
import { camposEditados } from "@/lib/domain/audit-campos";
import { orderCategories } from "@/server/services/category.service";
import { buildSlug, isValidSlug } from "@/lib/validation/slug";
import type {
  CategoriaAltaInput,
  CategoriaEdicionInput,
  CategoriaVisibilidadInput,
} from "@/server/schemas/categorias.schema";
import type {
  CategoryAdminLister,
  CategoryAdminWriter,
  ProductAdminReader,
} from "@/server/services/repository-ports";
import type { CategoryRow } from "@/lib/domain";

interface CategoryAdminDependencies {
  readonly categoryRepository: CategoryAdminLister & CategoryAdminWriter;
  readonly productRepository: ProductAdminReader;
}

/**
 * Filas de la tabla de categorías, en el orden en que se muestran.
 *
 * El conteo de productos se arma cruzando con `findAllProductsForAdmin`,
 * que ya existe y ya trae `categoryId`. No se agrega un `count` al
 * repositorio: un panel de cinco categorías no paga una consulta extra.
 */
export async function getCategoriesForAdmin(
  dependencies: CategoryAdminDependencies,
): Promise<readonly CategoryRow[]> {
  const [categories, products] = await Promise.all([
    dependencies.categoryRepository.findAllCategoriesForAdmin(),
    dependencies.productRepository.findAllProductsForAdmin(),
  ]);

  const countByCategory = new Map<string, number>();
  for (const product of products) {
    countByCategory.set(product.categoryId, (countByCategory.get(product.categoryId) ?? 0) + 1);
  }

  return orderCategories(categories).map((category) => {
    const productCount = countByCategory.get(category.id) ?? 0;
    return {
      id: category.id,
      nombre: category.name,
      slug: category.slug,
      descripcion: category.description,
      isVisible: category.isVisible,
      productCount,
      isSlugEditable: productCount === 0,
    };
  });
}

/**
 * Alta de categoría.
 *
 * El slug sale del nombre y la posición va al final. Ninguno de los dos
 * viene del payload (§5.2): un POST con `slug` o `position` manipulados
 * sería una URL de la categoría de otro producto.
 */
export async function createCategoryFromAdmin(
  dependencies: CategoryAdminDependencies,
  input: CategoriaAltaInput,
): Promise<CategoryRow> {
  const slug = buildSlug(input.nombre);
  if (slug === "") {
    throw new ValidationError({ nombre: ["Ese nombre no genera un identificador usable."] });
  }

  const [categories, products] = await Promise.all([
    dependencies.categoryRepository.findAllCategoriesForAdmin(),
    dependencies.productRepository.findAllProductsForAdmin(),
  ]);
  const nextPosition =
    categories.reduce((maximo, categoria) => Math.max(maximo, categoria.position), 0) + 1;

  const creada = await dependencies.categoryRepository.createCategory({
    name: input.nombre,
    slug,
    description: input.descripcion ?? null,
    position: nextPosition,
    isVisible: input.isVisible,
  });

  return {
    id: creada.id,
    nombre: creada.name,
    slug: creada.slug,
    descripcion: creada.description,
    isVisible: creada.isVisible,
    productCount: products.filter((producto) => producto.categoryId === creada.id).length,
    isSlugEditable: true,
  };
}

/**
 * Edición de categoría.
 *
 * ⛔ El slug se ignora cuando la categoría tiene productos. No se lanza
 *    un error: el resto del formulario es válido y el usuario no tiene
 *    por qué perder lo que escribió por un campo que ya no aplica (§5.3).
 */
export async function updateCategoryFromAdmin(
  dependencies: CategoryAdminDependencies,
  input: CategoriaEdicionInput,
): Promise<CategoryRow> {
  const { productCount } = await findRow(dependencies, input.id);

  const slug = productCount > 0 ? undefined : resolveEditableSlug(input.slug, input.nombre);
  if (productCount > 0 && input.slug !== undefined && input.slug !== "") {
    console.warn(
      `[categorias] Se ignora el cambio de slug de "${input.nombre}": la categoría tiene ${productCount} producto(s).`,
    );
  }

  const actualizada = await dependencies.categoryRepository.updateCategory(input.id, {
    name: input.nombre,
    description: input.descripcion ?? null,
    ...(slug !== undefined ? { slug } : {}),
  });

  return {
    id: actualizada.id,
    nombre: actualizada.name,
    slug: actualizada.slug,
    descripcion: actualizada.description,
    isVisible: actualizada.isVisible,
    productCount,
    isSlugEditable: productCount === 0,
  };
}

/**
 * Visibilidad de una categoría. Recibe el valor destino y lo aplica:
 * dos clics simultáneos no pueden desincronizarse porque el servidor
 * nunca "alterna" (Tarea 14 §5.3).
 */
export async function setCategoryVisibilityFromAdmin(
  dependencies: CategoryAdminDependencies,
  input: CategoriaVisibilidadInput,
): Promise<CategoryRow> {
  const actualizada = await dependencies.categoryRepository.updateCategory(input.id, {
    isVisible: input.isVisible,
  });
  const fila = await findRow(dependencies, actualizada.id);
  return { ...fila, isVisible: actualizada.isVisible };
}

/**
 * Borrado de categoría.
 *
 * ⛔ El chequeo va **antes** de tocar la base (§5.4). El diálogo muestra
 *    el conteo y abajo del botón, de modo que la base nunca vea el
 *    intento. Un cliente manipulado podría mandar el id igual —
 *    `deleteCategory` ya traduce el P2003 a `ConflictError`.
 */
export async function deleteCategoryFromAdmin(
  dependencies: CategoryAdminDependencies,
  id: string,
): Promise<void> {
  const fila = await findRow(dependencies, id);
  if (fila.productCount > 0) {
    throw new ConflictError(
      `No se puede borrar "${fila.nombre}": tiene ${fila.productCount} producto(s) asignado(s).`,
      { productCount: fila.productCount },
    );
  }
  await dependencies.categoryRepository.deleteCategory(id);
}

/** Lee la fila completa; P2025 significa que la fila ya no existe. */
const findRow = async (
  dependencies: CategoryAdminDependencies,
  id: string,
): Promise<CategoryRow> => {
  const fila = (await getCategoriesForAdmin(dependencies)).find((row) => row.id === id);
  if (fila === undefined) {
    throw new ResourceNotFoundError("Categoría", id);
  }
  return fila;
};

/** Slug de la edición: el del formulario si es válido, si no el del nombre. */
const resolveEditableSlug = (slug: string | undefined, nombre: string): string => {
  if (slug === undefined || slug === "") return buildSlug(nombre);
  if (!isValidSlug(slug)) {
    throw new ValidationError({ slug: ["Sin espacios, tildes ni barras. Sólo letras y números."] });
  }
  return slug;
};

/**
 * Campos del formulario que quedaron distintos de lo que quedó guardado
 * (Tarea 19 §7.1). Es lo que va al log de `categoria.actualizada`.
 *
 * ⛔ No es `Object.keys(input)`: el formulario manda nombre, descripción y
 *    visibilidad aunque el encargado sólo haya tipeado una letra. La
 *    comparación contra la fila guardada no cuesta ninguna consulta extra,
 *    porque `updateCategoryFromAdmin` ya la devuelve.
 *
 * ⚠️ El `slug` aparece cuando el servicio lo ignoró por tener productos:
 *    el envío intentó cambiarlo y eso también es un hecho que auditar.
 */
export const camposEditadosDeCategoria = (
  guardada: CategoryRow,
  input: CategoriaEdicionInput,
): readonly string[] => camposEditados(guardada, input);
