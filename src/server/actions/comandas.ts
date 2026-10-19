/**
 * Server Action de transición de comandas en el tablero (Tarea 23).
 *
 * ⛔ ESTA ES LA FRONTERA DE SEGURIDAD DE LA OPERACIÓN, no el layout y no
 *    el proxy — igual que en `product-availability.actions.ts`.
 */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ConflictError,
  ORDER_STATUSES,
  ResourceNotFoundError,
  toSafeErrorMessage,
} from "@/lib/domain";
import type { DomainErrorCode, OrderDTO } from "@/lib/domain";
import { verifyAdminSession } from "@/server/auth/verify-admin";
import { logAdminAction } from "@/server/infra/audit-log";
import { transitionOrderFromAdmin } from "@/server/services";

const TransitionOrderSchema = z.object({
  id: z.string().min(1).max(36),
  to: z.enum(ORDER_STATUSES),
});

export type TransitionOrderActionResult =
  | { readonly ok: true; readonly data: OrderDTO }
  | {
      readonly ok: false;
      readonly error: string;
      readonly code: DomainErrorCode | "UNKNOWN";
    };

export async function transitionOrderStatusAction(
  rawInput: unknown,
): Promise<TransitionOrderActionResult> {
  // 1. AUTORIZAR. Primero, siempre.
  const session = await verifyAdminSession();
  if (session === null) {
    return {
      ok: false,
      error: "Tu sesión expiró. Volvé a iniciar sesión para seguir.",
      code: "UNAUTHORIZED",
    };
  }

  // 2. VALIDAR.
  const parsed = TransitionOrderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "No se pudo leer la solicitud.", code: "VALIDATION_ERROR" };
  }

  try {
    // 3. DELEGAR. La máquina de estados se aplica en el servicio.
    const order = await transitionOrderFromAdmin(parsed.data);

    logAdminAction(
      "pedido.estado",
      { actorId: session.userId, actorEmail: session.email, actorRole: session.role },
      { entity: "comanda", entityId: order.id },
    );

    // 4. REVALIDAR solo la vista del panel. La propagación al resto de
    //    las pantallas la hace Realtime; esto cubre el `router.refresh()`.
    revalidatePath("/admin/comandas");

    return { ok: true, data: order };
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return {
        ok: false,
        error: "Esa comanda ya no existe. Actualizá la página.",
        code: "RESOURCE_NOT_FOUND",
      };
    }
    if (error instanceof ConflictError) {
      return { ok: false, error: toSafeErrorMessage(error), code: "CONFLICT" };
    }
    console.error("[action:transitionOrderStatus]", error);
    return {
      ok: false,
      error: "No se pudo cambiar el estado de la comanda. Intentá de nuevo.",
      code: "UNKNOWN",
    };
  }
}
