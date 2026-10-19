"use server";

/**
 * Server Actions del CRUD de productos (Tarea 16 §6.4).
 *
 * Las tres tienen la misma forma: autorizar, validar, delegar,
 * revalidar. El orden no es un estilo, es la regla 10 del README.
 *
 * ⛔ Distinto patrón de caché que la Tarea 14: este CRUD escribe
 *    contenido (nombre, precio, categoría), así que sí llama
 *    `revalidateTag("products")`. El toggle de la Tarea 14 SÓLO
 *    `revalidatePath("/admin/productos")`: el stock viaja por Realtime,
 *    y confundir las dos fronteras hace el cambio de stock caro cuando
 *    no lo es (§2.4).
 */
import { revalidatePath, revalidateTag } from "next/cache";

import { logAdminAction } from "@/server/infra/audit-log";
import { ResourceNotFoundError, ValidationError, ConflictError } from "@/lib/domain";
import type { DomainErrorCode } from "@/lib/domain";
import { verifyAdminSession } from "@/server/auth/verify-admin";
import { ProductoAltaSchema, ProductoEdicionSchema } from "@/lib/validation/producto-admin";
import {
  camposEditadosDeProducto,
  createProductFromAdmin,
  updateProductFromAdmin,
  archiveProductFromAdmin,
} from "@/server/services";

export type Resultado =
  { ok: true } | { ok: false; error: string; code: DomainErrorCode | "UNKNOWN" };

/**
 * Crea un producto. El archivo viaja fuera del payload de la action
 * porque la subida ya está hecha: el cliente mandó a Cloudinary y le
 * devolvió `imageUrl` + `imagePublicId`. El único dato que llega por
 * acá es el formulario ya validado del lado del servidor.
 */
export async function createProductAction(datos: unknown, imagen: File | null): Promise<Resultado> {
  const admin = await verifyAdminSession();
  if (admin === null) {
    return { ok: false, error: "Tu sesión expiró. Volvé a entrar.", code: "UNAUTHORIZED" };
  }

  const parsed = ProductoAltaSchema.safeParse(datos);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisá los datos del formulario",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const resultado = await createProductFromAdmin(parsed.data, imagen);

    logAdminAction(
      "producto.creado",
      { actorId: admin.userId, actorEmail: admin.email, actorRole: admin.role },
      { entity: "producto", entityId: resultado.id, nombre: parsed.data.nombre },
    );

    /**
     * ⛐ Esta operación escribe contenido del catálogo: el tag del ISR
     *    saca la ficha pública del momento y el valor que el panel ve.
     *    El booleano de disponibilidad es otro: por el WS (Tarea 14
     *    §8.3), no por una recarga.
     */
    revalidateTag("products", "max");
    revalidatePath("/admin/productos");
    revalidatePath("/menu");

    return { ok: true };
  } catch (error) {
    if (error instanceof ConflictError) {
      return {
        ok: false,
        error: "Ese identificador ya lo usa otro producto",
        code: "CONFLICT",
      };
    }
    if (error instanceof ValidationError) {
      return { ok: false, error: error.message, code: "VALIDATION_ERROR" };
    }
    console.error("[action:createProduct]", error);
    return {
      ok: false,
      error: "No se pudo crear el producto. Intentá de nuevo.",
      code: "UNKNOWN",
    };
  }
}

/**
 * Edita un producto. Sin sesión, `ResourceNotFoundError` salta antes
 * que la lectura y la action no toca la base (verificable por test).
 */
export async function updateProductAction(datos: unknown, imagen: File | null): Promise<Resultado> {
  const admin = await verifyAdminSession();
  if (admin === null) {
    return { ok: false, error: "Tu sesión expiró. Volvé a entrar.", code: "UNAUTHORIZED" };
  }

  const parsed = ProductoEdicionSchema.safeParse(datos);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisá los datos del formulario",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const actualizado = await updateProductFromAdmin(parsed.data, imagen);

    // ⛔ El log va DESPUÉS del servicio y ANTES del revalidado: si el
    //    revalidado lanza, la escritura ya está en la base y tiene que
    //    poder verse (§6.4). Se registran los nombres de los campos que
    //    cambiaron, nunca sus valores: un precio no va a un destino de
    //    logs de terceros (§7.1).
    logAdminAction(
      "producto.actualizado",
      { actorId: admin.userId, actorEmail: admin.email, actorRole: admin.role },
      {
        entity: "producto",
        entityId: actualizado.id,
        camposEditados: camposEditadosDeProducto(actualizado, parsed.data),
      },
    );

    revalidateTag("products", "max");
    revalidatePath("/admin/productos");
    revalidatePath("/menu");

    return { ok: true };
  } catch (error) {
    if (error instanceof ConflictError) {
      return {
        ok: false,
        error: "Ese identificador ya lo usa otro producto",
        code: "CONFLICT",
      };
    }
    if (error instanceof ResourceNotFoundError) {
      return {
        ok: false,
        error: "Ese producto ya no existe.",
        code: "RESOURCE_NOT_FOUND",
      };
    }
    if (error instanceof ValidationError) {
      return { ok: false, error: error.message, code: "VALIDATION_ERROR" };
    }
    console.error("[action:updateProduct]", error);
    return {
      ok: false,
      error: "No se pudo guardar el producto. Intentá de nuevo.",
      code: "UNKNOWN",
    };
  }
}

/**
 * Archiva. Nunca borra físicamente. La confirmación con texto explícito
 * la hace el diálogo de la fila: la action es lo que dice la regla, el
 * diálogo es quién la firma.
 */
export async function archiveProductAction(id: unknown): Promise<Resultado> {
  const admin = await verifyAdminSession();
  if (admin === null) {
    return { ok: false, error: "Tu sesión expiró. Volvé a entrar.", code: "UNAUTHORIZED" };
  }

  const parsed =
    typeof id === "string" ? { success: true as const, data: id } : { success: false as const };
  if (!parsed.success || parsed.data.trim().length === 0) {
    return { ok: false, error: "Producto inválido.", code: "VALIDATION_ERROR" };
  }

  try {
    const archivado = await archiveProductFromAdmin(parsed.data);

    logAdminAction(
      "producto.archivado",
      { actorId: admin.userId, actorEmail: admin.email, actorRole: admin.role },
      { entity: "producto", entityId: archivado.id },
    );

    revalidateTag("products", "max");
    revalidatePath("/admin/productos");
    revalidatePath("/menu");

    return { ok: true };
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return {
        ok: false,
        error: "Ese producto ya no existe.",
        code: "RESOURCE_NOT_FOUND",
      };
    }
    console.error("[action:archiveProduct]", error);
    return {
      ok: false,
      error: "No se pudo archivar el producto.",
      code: "UNKNOWN",
    };
  }
}
