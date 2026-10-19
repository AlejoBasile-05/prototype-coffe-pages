/**
 * Validación del payload persistido en `localStorage`. Lo que vuelve de
 * ahí no es confiable: puede venir de una versión vieja del código, de
 * alguien que editó el storage a mano o de un payload truncado.
 *
 * `version` va EN el payload: si cambia la forma de `CartLine`, subir
 * la constante invalida todo lo guardado y la validación dice por qué.
 *
 * Los `.min(1)` y `.max(...)` viven en el esquema, no solo en las
 * reglas: un payload guardado con 999 unidades se rechaza al
 * rehidratar, no se recorta en silencio.
 */
import { z } from "zod";

import { MAX_DISTINCT_LINES, MAX_QUANTITY_PER_ITEM } from "./cart-types";

export const CART_STORAGE_VERSION = 1;

const lineSchema = z.object({
  productId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  variantId: z.string().min(1).nullable(),
  variantName: z.string().nullable(),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_ITEM),
  imageUrl: z.string().nullable(),
  available: z.boolean(),
});

export const persistedCartSchema = z.object({
  version: z.literal(CART_STORAGE_VERSION),
  state: z.object({
    lines: z.array(lineSchema).max(MAX_DISTINCT_LINES),
  }),
});

export type PersistedCart = z.infer<typeof persistedCartSchema>;
