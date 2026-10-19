/**
 * Server Action PÚBLICA de registro de comandas (Tarea 23).
 *
 * ⛔ ES LA ÚNICA ACTION DEL PROYECTO QUE NO PIDE SESIÓN DE ADMIN: la
 *    dispara el cliente al confirmar el checkout. Toda la defensa del
 *    lado del servidor está acá, en orden:
 *
 *      0. HONEYPOT: el campo invisible `company` lo llenan los bots. Un
 *         bot recibe un `ok` FALSO (no registramos nada): rechazarlo con
 *         un error le confirmaría que fue detectado y lo invitaría a
 *         ajustar el script.
 *      1. RATE LIMIT por IP: frena scripts y doble-submit frenético
 *         (ver `src/server/infra/rate-limit.ts` y su limitación en
 *         serverless).
 *      2. ZOD: el payload se valida completo, y el teléfono se
 *         normaliza igual que en el formulario.
 *      3. COTIZACIÓN SERVER-SIDE: el servicio ignora cualquier precio
 *         del navegador y recalcula contra la base (CWE-840).
 *
 * ⛔ DEGRADACIÓN: si esto falla, el checkout NO se bloquea. El handoff
 *    de WhatsApp es el canal sagrado (DESIGN.md §6.3): peor que una
 *    comanda perdida en el tablero es un pedido perdido en el negocio.
 *    Por eso el cliente que llama trata cualquier `ok: false` como
 *    "seguir igual".
 */
"use server";

import { headers } from "next/headers";

import { ConflictError, ValidationError, toSafeErrorMessage } from "@/lib/domain";
import type { DomainErrorCode } from "@/lib/domain";
import { consumeRateLimit } from "@/server/infra/rate-limit";
import { registerPublicOrder } from "@/server/services";
import { registerOrderInputSchema } from "@/lib/validation/pedido.schema";

export type RegisterOrderActionResult =
  | {
      readonly ok: true;
      readonly data: { readonly id: string; readonly orderNumber: number };
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly code: DomainErrorCode | "UNKNOWN";
    };

/** 5 comandas por IP cada 10 minutos: sobra para un humano, ahoga a un script. */
const RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 } as const;

/**
 * IP del cliente. En Vercel, `x-forwarded-for` la escribe el edge y el
 * cliente NO la puede falsificar (la plataforma la pisa con la conexión
 * real). Se toma la PRIMERA de la lista, que es la que puso el edge.
 */
const ipDelCliente = async (): Promise<string> => {
  const cabeceras = await headers();
  const forwarded = cabeceras.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() ?? "";
};

export async function registerOrderAction(
  rawInput: unknown,
): Promise<RegisterOrderActionResult> {
  // 0. HONEYPOT. Antes que todo: un bot no merece ni una query de rate limit.
  const company = (rawInput as { company?: unknown } | null)?.company;
  if (typeof company === "string" && company.trim() !== "") {
    console.warn("[action:registerOrder] honeypot activado: registro descartado");
    return { ok: true, data: { id: "", orderNumber: 0 } };
  }

  // 1. RATE LIMIT.
  const ip = await ipDelCliente();
  if (!consumeRateLimit({ key: `register-order:${ip}`, ...RATE_LIMIT })) {
    return {
      ok: false,
      error: "Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.",
      code: "CONFLICT",
    };
  }

  // 2. VALIDAR.
  const parsed = registerOrderInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "No se pudo leer el pedido.", code: "VALIDATION_ERROR" };
  }

  try {
    // 3. DELEGAR (cotización y revalidación en el servicio).
    const order = await registerPublicOrder({
      items: parsed.data.items,
      customer: {
        fullName: parsed.data.customer.fullName,
        phone: parsed.data.customer.phone,
        fulfillment: parsed.data.customer.fulfillment,
        address:
          parsed.data.customer.fulfillment === "delivery"
            ? (parsed.data.customer.address ?? null)
            : null,
        notes:
          parsed.data.customer.notes !== undefined && parsed.data.customer.notes.trim() !== ""
            ? parsed.data.customer.notes.trim()
            : null,
      },
    });

    return { ok: true, data: { id: order.id, orderNumber: order.orderNumber } };
  } catch (error) {
    if (error instanceof ConflictError || error instanceof ValidationError) {
      return { ok: false, error: toSafeErrorMessage(error), code: error.code };
    }
    // El detalle crudo (driver, host, enums) queda en el log del servidor.
    console.error("[action:registerOrder]", error);
    return {
      ok: false,
      error: "No se pudo registrar el pedido.",
      code: "UNKNOWN",
    };
  }
}
