import { z } from "zod";

/**
 * Entrada de la acción de disponibilidad (Tarea 14).
 *
 * ⛔ `.strict()`: un objeto con claves que no están acá se rechaza, en
 *    lugar de aceptarse con campos de más que nadie lee. El cliente nunca
 *    es confiable, y "aceptar de más" en la frontera es la forma más
 *    corta de que un campo sin nombre aparezca en el payload y nadie sepa
 *    de dónde salió.
 *
 * ⛔ `isAvailable` es `z.boolean()`, sin coerción: `"true"` (string) se
 *    rechaza con `VALIDATION_ERROR`. Aceptar `"false"` como booleo es
 *    exactamente el recorte mal hecho que después se lee al revés.
 *
 * El `max(64)` acota el payload antes de tocar la base. No es la
 * validación del id (la base es la única que puede decir si existe), es
 * el techo de tamaño de una entrada de formulario.
 */
export const ToggleProductAvailabilitySchema = z
  .object({
    id: z.string().trim().min(1, { message: "Falta el producto." }).max(64),
    isAvailable: z.boolean(),
  })
  .strict();

export type ToggleProductAvailabilityInput = z.infer<typeof ToggleProductAvailabilitySchema>;
