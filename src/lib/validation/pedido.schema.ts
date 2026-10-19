/**
 * Contrato del registro de comanda desde el checkout (Tarea 23).
 *
 * Vive en `src/lib/validation/` y no en `src/server/schemas/` por la
 * misma regla que `checkout.schema.ts`: el Client Component del checkout
 * lo importa para tipar el payload, y la regla `no-restricted-imports`
 * le prohíbe tocar `@/server/*`.
 *
 * ⛔ El precio NO viaja. El cliente manda QUÉ quiere (producto +
 *    cantidad) y el SERVIDOR cotiza contra la base. Mandar el precio
 *    desde el navegador sería regalarle el total a quien edite el
 *    payload (CWE-840: abuso de lógica de negocio).
 */
import { z } from "zod";

import { MAX_DISTINCT_LINES, MAX_QUANTITY_PER_ITEM } from "@/lib/domain/cart";
import { checkoutSchema } from "@/lib/validation/checkout.schema";

/**
 * Mismo patrón de caracteres que `parseCartLineRef`: el id lo genera la
 * base y jamás lleva espacios ni dos puntos. Un id que no calza es un
 * payload armado a mano y se corta acá.
 */
const productIdField = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,36}$/, "El producto del pedido no es válido.");

export const orderItemInputSchema = z.object({
  productId: productIdField,
  quantity: z
    .number()
    .int("La cantidad tiene que ser un número entero.")
    .min(1, "La cantidad mínima es 1.")
    .max(MAX_QUANTITY_PER_ITEM, `La cantidad máxima por ítem es ${MAX_QUANTITY_PER_ITEM}.`),
});

export const registerOrderInputSchema = z.object({
  /**
   * Se reutiliza el schema del checkout TAL CUAL: re-validar con las
   * mismas reglas en el servidor es la mitad del trato (la otra mitad
   * la hace el navegador para UX). El teléfono entra normalizado a
   * E.164 por la transformación de `phoneField`.
   */
  customer: checkoutSchema,
  items: z
    .array(orderItemInputSchema)
    .min(1, "El pedido no tiene productos.")
    .max(MAX_DISTINCT_LINES, `El pedido admite hasta ${MAX_DISTINCT_LINES} ítems distintos.`),
  /**
   * Honeypot anti-bots: el campo es invisible para el humano (fuera de
   * viewport, sin label accesible) y lo llenan solo los autómatas. Se
   * valida "vacío o ausente" en la action, no acá, porque el rechazo no
   * debe parecer rechazo: ver `pedidos.ts`.
   */
  company: z.string().max(120).optional(),
});

export type RegisterOrderInput = z.infer<typeof registerOrderInputSchema>;
