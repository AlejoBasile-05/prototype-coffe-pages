"use server";

/**
 * Action de ajustes del negocio (Tarea 17 §6.9).
 *
 * ⛔ `isOwner` va **después** de `verifyAdminSession` y antes de leer el
 *    payload. Un `STAFF` recibe el mensaje de la capa, no la de la
 *    pantalla: el formulario está deshabilitado, pero un cliente
 *    manipulado puede mandar el POST igual. El mensaje dice qué le falta,
 *    sin enumerar campos.
 *
 * ⛔ Sin `revalidateTag("products")`: los ajustes no son contenido del
 *    catálogo. Sólo se revalidan las páginas del panel y el menú/acceso
 *    al índice, porque aparecen en el header y el pie de página.
 */
import { logAdminAction } from "@/server/infra/audit-log";
import { revalidatePath } from "next/cache";

import { ValidationError, toSafeErrorMessage } from "@/lib/domain";
import { isOwner } from "@/lib/domain";
import { verifyAdminSession } from "@/server/auth/verify-admin";
import { AjustesSchema } from "@/server/schemas/ajustes.schema";
import {
  updateSettingsFromAdmin,
  camposEditadosDeAjustes,
} from "@/server/services/settings-admin.service";
import { getSettingsAdminDependencies } from "@/server/services";

export type AjustesActionResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: string;
      readonly fieldErrors?: Record<string, readonly string[]>;
    };

const SIN_PERMANEZCO: AjustesActionResult = {
  ok: false,
  error: "Sesión expirada. Volvé a iniciar sesión.",
};

const SIN_PERMISO: AjustesActionResult = {
  ok: false,
  error: "Sólo el dueño del negocio puede cambiar los datos de contacto.",
};

const primeroCadaCampo = (
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
) =>
  issues.reduce<Record<string, readonly string[]>>((acumulado, issue) => {
    const clave = String(issue.path[0] ?? "general");
    if (!(clave in acumulado)) acumulado[clave] = [issue.message];
    return acumulado;
  }, {});

export async function updateBusinessSettingsAction(
  rawInput: unknown,
): Promise<AjustesActionResult> {
  const session = await verifyAdminSession();
  if (session === null) return SIN_PERMANEZCO;

  if (!isOwner(session)) return SIN_PERMISO;

  const parsed = AjustesSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisá los datos del formulario.",
      fieldErrors: primeroCadaCampo(parsed.error.issues),
    };
  }

  try {
    const guardados = await updateSettingsFromAdmin(getSettingsAdminDependencies(), parsed.data);

    // ⛔ Los NOMBRES de los campos que cambiaron, no sus valores: el
    //    formulario de ajustes lleva teléfono, dirección e Instagram, y
    //    ninguno de eso va a un destino de logs de terceros (§7.1).
    logAdminAction(
      "ajustes.actualizados",
      { actorId: session.userId, actorEmail: session.email, actorRole: session.role },
      { entity: "ajustes", camposEditados: camposEditadosDeAjustes(guardados, parsed.data) },
    );

    /**
     * ⛔ No se toca `revalidateTag("products")`: el tag cubre contenido
     *    del catálogo (nombre, precio, categoría), no el contacto del
     *    negocio. Ver §2.7.
     */
    revalidatePath("/menu");
    revalidatePath("/admin/ajustes");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    if (error instanceof ValidationError) {
      // El error del teléfono tiene su `whatsappPhone` ya etiquetado: el
      // usuario lo ve pegado al campo, no como un toast genético.
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    console.error("[action:updateBusinessSettings]", error);
    return { ok: false, error: toSafeErrorMessage(error) };
  }
}
