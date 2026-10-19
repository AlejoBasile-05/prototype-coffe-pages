/**
 * Server Action de disponibilidad de producto (Tarea 14).
 *
 * ⛔ ESTA ES LA FRONTERA DE SEGURIDAD DE LA OPERACIÓN, no el layout y no
 *    el proxy. El layout protege el render; esto protege el dato. Si
 *    mañana alguien saca esta llamada, alternar stock pasa a ser una
 *    ruta pública (Tarea 07 §4.2).
 */
"use server";

import { revalidatePath } from "next/cache";

import { ResourceNotFoundError, ValidationError, toSafeErrorMessage } from "@/lib/domain";
import type { DomainErrorCode } from "@/lib/domain";
import { verifyAdminSession } from "@/server/auth/verify-admin";
import { ToggleProductAvailabilitySchema } from "@/server/schemas/product-availability.schema";
import { setProductAvailability } from "@/server/services";
import { logAdminAction } from "@/server/infra/audit-log";

export type ProductAvailabilityActionResult =
  | {
      readonly ok: true;
      readonly data: { readonly id: string; readonly isAvailable: boolean };
    }
  | {
      readonly ok: false;
      /** Texto presentable. ⛔ Nunca el `message` crudo de la excepción. */
      readonly error: string;
      /**
       * Código de dominio estable. El cliente lo usa para decidir qué
       * hacer además de mostrar el mensaje: con `UNAUTHORIZED` navega al
       * login, con `RESOURCE_NOT_FOUND` refresca la tabla.
       */
      readonly code: DomainErrorCode | "UNKNOWN";
    };

export async function toggleProductAvailabilityAction(
  rawInput: unknown,
): Promise<ProductAvailabilityActionResult> {
  // 1. AUTORIZAR. Siempre primero, antes de mirar el input: el cuerpo de
  //    la petición existe aunque no haya sesión, y leerlo antes de
  //    autorizar es confiar en el cliente.
  const session = await verifyAdminSession();
  if (session === null) {
    return {
      ok: false,
      error: "Tu sesión expiró. Volvé a iniciar sesión para seguir.",
      code: "UNAUTHORIZED",
    };
  }

  // 2. VALIDAR. El cliente manda JSON, no una confianza.
  const parsed = ToggleProductAvailabilitySchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "No se pudo leer la solicitud.", code: "VALIDATION_ERROR" };
  }

  try {
    // 3. DELEGAR. El servicio no sabe de React ni de caché.
    const product = await setProductAvailability({
      id: parsed.data.id,
      isAvailable: parsed.data.isAvailable,
    });

    /**
     * ⛔ Novena action de escritura, y la única que no revalida el
     *    catálogo. El registro va igual, después del servicio y antes del
     *    revalidado (Tarea 19 §6.4): el switch de stock es el gesto que más
     *    se repite en el panel y el que más vale poder reconstruir después
     *    ("alguien lo dejó agotado y nadie sabe cuándo").
     */
    logAdminAction(
      "producto.disponibilidad",
      { actorId: session.userId, actorEmail: session.email, actorRole: session.role },
      { entity: "producto", entityId: product.id },
    );

    // 4. REVALIDAR. Solo la vista del panel.
    //
    // ⛔ NO va `revalidateTag("products")` acá. La disponibilidad no vive
    //    en el HTML cacheado: se propaga por Realtime (Tarea 15). Invalidar
    //    el catálogo obligaría a regenerarlo para todos los clientes en
    //    cada cambio de stock. Ver Tarea 08 §4.5 y Tarea 14 §4.3.
    //    `revalidatePath` sí hace falta: sin ella, un `router.refresh()`
    //    posterior puede devolver la tabla con el valor viejo.
    revalidatePath("/admin/productos");

    // El dato vuelve confirmado, no "vacío": el cliente puede contrastar
    // lo que ve en pantalla con lo que quedó guardado (Tarea 14 §6.5).
    return { ok: true, data: { id: product.id, isAvailable: product.isAvailable } };
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return {
        ok: false,
        error: "Ese producto ya no existe. Actualizá la página.",
        code: "RESOURCE_NOT_FOUND",
      };
    }
    if (error instanceof ValidationError) {
      return { ok: false, error: toSafeErrorMessage(error), code: "VALIDATION_ERROR" };
    }
    // El detalle crudo (nombres de tabla y columna, host, puerto) va al
    // log del servidor; a pantalla llega un mensaje genérico.
    console.error("[action:toggleProductAvailability]", error);
    return {
      ok: false,
      error: "No se pudo cambiar la disponibilidad. Intentá de nuevo.",
      code: "UNKNOWN",
    };
  }
}
