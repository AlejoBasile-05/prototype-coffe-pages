"use server";

/**
 * Actions de categorías (Tarea 17 §6.8).
 *
 * Autorizar, validar, delegar, revalidar. Ninguna de las cuatro lee un
 * campo del payload antes de `verifyAdminSession`: un payload manipulado
 * es datos de un desconocido hasta que se demuestra lo contrario.
 *
 * ⛔ `categorias` es contenido del catálogo: cada cambio invalida
 *    `revalidateTag("products")` y los paths del menú. Los ajustes del
 *    negocio sí van por otro camino (§2.7): sin tag, solo paths del
 *    perfil de página.
 */
import { logAdminAction } from "@/server/infra/audit-log";
import { revalidatePath, revalidateTag } from "next/cache";

import { ConflictError, ValidationError } from "@/lib/domain";
import { verifyAdminSession } from "@/server/auth/verify-admin";
import {
  CategoriaAltaSchema,
  CategoriaEdicionSchema,
  CategoriaVisibilidadSchema,
  CategoriaIdSchema,
} from "@/server/schemas/categorias.schema";
import {
  createCategoryFromAdmin,
  updateCategoryFromAdmin,
  deleteCategoryFromAdmin,
  setCategoryVisibilityFromAdmin,
  camposEditadosDeCategoria,
} from "@/server/services/category-admin.service";
import { getCategoryAdminDependencies } from "@/server/services";

type CategoriaActionResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: string;
      readonly fieldErrors?: Record<string, readonly string[]>;
    };

const SIN_SESION: CategoriaActionResult = {
  ok: false,
  error: "Sesión expirada. Volvé a iniciar sesión.",
};

const ERROR_GENERICO = "No se pudo guardar la categoría. Intentá de nuevo.";

/** Cálculo de errores de Zod para mantener cada action lineal. */
const primeroCadaCampo = (
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
) =>
  issues.reduce<Record<string, readonly string[]>>((acumulado, issue) => {
    const clave = String(issue.path[0] ?? "general");
    if (!(clave in acumulado)) acumulado[clave] = [issue.message];
    return acumulado;
  }, {});

const revalidateCategorias = (): void => {
  // ⛔ El contenido de categoría invalida el catálogo entero: es
  //    contenido (nombre, descripción, orden) y el tag lo cubre (§2.7).
  revalidateTag("products", "max");
  revalidatePath("/menu");
  revalidatePath("/admin/categorias");
  revalidatePath("/admin/productos");
};

/** Crea una categoría. El slug se deriva del nombre en el servicio. */
export async function createCategoryAction(rawInput: unknown): Promise<CategoriaActionResult> {
  const session = await verifyAdminSession();
  if (session === null) return SIN_SESION;

  const parsed = CategoriaAltaSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisá los datos del formulario.",
      fieldErrors: primeroCadaCampo(parsed.error.issues),
    };
  }

  try {
    const creada = await createCategoryFromAdmin(getCategoryAdminDependencies(), parsed.data);

    logAdminAction(
      "categoria.creada",
      { actorId: session.userId, actorEmail: session.email, actorRole: session.role },
      { entity: "categoria", entityId: creada.id, nombre: creada.nombre, slug: creada.slug },
    );
    revalidateCategorias();
    return { ok: true };
  } catch (error) {
    if (error instanceof ConflictError) {
      return { ok: false, error: error.message, fieldErrors: { slug: [error.message] } };
    }
    if (error instanceof ValidationError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    console.error("[action:createCategory]", error);
    return { ok: false, error: ERROR_GENERICO };
  }
}

/** Edita una categoría. El slug se ignora cuando tiene productos. */
export async function updateCategoryAction(rawInput: unknown): Promise<CategoriaActionResult> {
  const session = await verifyAdminSession();
  if (session === null) return SIN_SESION;

  const parsed = CategoriaEdicionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisá los datos del formulario.",
      fieldErrors: primeroCadaCampo(parsed.error.issues),
    };
  }

  try {
    const actualizada = await updateCategoryFromAdmin(getCategoryAdminDependencies(), parsed.data);

    logAdminAction(
      "categoria.actualizada",
      { actorId: session.userId, actorEmail: session.email, actorRole: session.role },
      {
        entity: "categoria",
        entityId: actualizada.id,
        // ⛔ Los NOMBRES de los campos que cambiaron, no `Object.keys`:
        //    el formulario manda la categoría entera aunque el encargado
        //    haya tocado una sola letra (§7.1).
        camposEditados: camposEditadosDeCategoria(actualizada, parsed.data),
      },
    );
    revalidateCategorias();
    return { ok: true };
  } catch (error) {
    if (error instanceof ConflictError) {
      return { ok: false, error: error.message, fieldErrors: { slug: [error.message] } };
    }
    if (error instanceof ValidationError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    console.error("[action:updateCategory]", error);
    return { ok: false, error: ERROR_GENERICO };
  }
}

/** Visibilidad: un valor destino, nunca un toggle (§5.3). */
export async function setCategoryVisibilityAction(
  rawInput: unknown,
): Promise<CategoriaActionResult> {
  const session = await verifyAdminSession();
  if (session === null) return SIN_SESION;

  const parsed = CategoriaVisibilidadSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "Revisá los datos del formulario." };

  try {
    await setCategoryVisibilityFromAdmin(getCategoryAdminDependencies(), parsed.data);

    logAdminAction("categoria.visibilidad",
      { actorId: session.userId, actorEmail: session.email, actorRole: session.role },
      { entity: "categoria", entityId: parsed.data.id },
    );
    revalidateCategorias();
    return { ok: true };
  } catch (error) {
    console.error("[action:setCategoryVisibility]", error);
    return { ok: false, error: ERROR_GENERICO };
  }
}

/** Borra una categoría. La deuda de §6.8 la resuelve borrado, no
 * "borrado con productos desde otro typo de permiso". */
export async function deleteCategoryAction(rawInput: unknown): Promise<CategoriaActionResult> {
  const session = await verifyAdminSession();
  if (session === null) return SIN_SESION;

  const parsed = CategoriaIdSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "Ese identificador no es válido." };

  try {
    await deleteCategoryFromAdmin(getCategoryAdminDependencies(), parsed.data);

    logAdminAction("categoria.eliminada",
      { actorId: session.userId, actorEmail: session.email, actorRole: session.role },
      { entity: "categoria", entityId: parsed.data },
    );
    revalidateCategorias();
    return { ok: true };
  } catch (error) {
    if (error instanceof ConflictError) {
      return { ok: false, error: error.message };
    }
    console.error("[action:deleteCategory]", error);
    return { ok: false, error: ERROR_GENERICO };
  }
}
