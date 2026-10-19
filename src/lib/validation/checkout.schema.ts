/**
 * Contrato de validación del checkout.
 *
 * Vive en `src/lib/validation/` y no en `src/server/schemas/` porque la
 * regla `no-restricted-imports` del proyecto prohíbe a los Client
 * Components importar `@/server/*` (salvo Server Actions). No hay I/O
 * acá: el mismo esquema valida en el navegador, para UX, y en el Route
 * Handler, para seguridad (ADR-13 de `DESIGN.md`).
 */
import { z } from "zod";

import { normalizeArgentinePhone } from "@/lib/format/phone";
import type { E164Phone } from "@/lib/format/phone";
import type { WhatsAppCustomer } from "@/lib/whatsapp/message-contract";

export const FULFILLMENT_VALUES = ["delivery", "pickup"] as const;

export const MIN_ADDRESS_LENGTH = 10;
export const MAX_ADDRESS_LENGTH = 240;
export const MAX_NOTES_LENGTH = 500;

/**
 * El teléfono se **transforma** a E.164, no se valida con una regex
 * aparte: dos reglas que aceptan formatos distintos se desincronizan.
 * Delegar en `normalizeArgentinePhone` hace que formulario, mensaje y
 * panel de ajustes compartan la misma definición de "teléfono válido"
 * (Tarea 12 §4.3).
 *
 * `z.NEVER` es el centinela de Zod para "transformación fallida": corta
 * la cadena sin ensuciar el tipo de salida.
 */
const phoneField = z
  .string()
  .trim()
  .min(1, "Ingresá tu teléfono.")
  .max(32, "El teléfono es demasiado largo.")
  .transform((value, ctx): E164Phone | typeof z.NEVER => {
    try {
      return normalizeArgentinePhone(value);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "El teléfono no es válido. Escribilo como +54 9 261 555-1234.",
      });
      return z.NEVER;
    }
  });

const baseSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Ingresá tu nombre.")
    .max(80, "El nombre puede tener hasta 80 caracteres."),
  phone: phoneField,
  fulfillment: z.enum(FULFILLMENT_VALUES, {
    error: "Elegí si querés envío o retiro.",
  }),
  address: z
    .string()
    .trim()
    .max(MAX_ADDRESS_LENGTH, `La dirección puede tener hasta ${MAX_ADDRESS_LENGTH} caracteres.`)
    .optional(),
  notes: z
    .string()
    .trim()
    .max(MAX_NOTES_LENGTH, `Las notas pueden tener hasta ${MAX_NOTES_LENGTH} caracteres.`)
    .optional(),
});

/**
 * La dirección es condicional, y `superRefine` es el lugar correcto para
 * una regla que depende de otro campo: con un `refine` sobre `address`
 * sola, Zod no puede mirar `fulfillment`.
 */
export const checkoutSchema = baseSchema.superRefine((value, ctx) => {
  if (value.fulfillment === "pickup") return;

  const address = value.address ?? "";

  if (address.length === 0) {
    ctx.addIssue({
      path: ["address"],
      code: "custom",
      message: "Ingresá la dirección de entrega.",
    });
    return;
  }

  if (address.length < MIN_ADDRESS_LENGTH) {
    ctx.addIssue({
      path: ["address"],
      code: "custom",
      message: "La dirección es demasiado corta. Incluí calle, número y barrio.",
    });
  }
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Estado del formulario, con los campos opcionales siempre presentes. */
export interface CheckoutDraft {
  readonly fullName: string;
  readonly phone: string;
  readonly fulfillment: (typeof FULFILLMENT_VALUES)[number];
  readonly address: string;
  readonly notes: string;
}

export const EMPTY_CHECKOUT_DRAFT: CheckoutDraft = {
  fullName: "",
  phone: "",
  fulfillment: "pickup",
  address: "",
  notes: "",
};

/**
 * Convierte el error de Zod en el mapa que consume el formulario.
 * Sin el filtro de clave, `Record<string, readonly string[]>` no se
 * puede afirmar sin un `as`, y los valores `undefined` se cuelan en el
 * render.
 */
export const toFieldErrors = (error: z.ZodError): Readonly<Record<string, readonly string[]>> => {
  const result: Record<string, readonly string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") continue;
    const current = result[key] ?? [];
    result[key] = [...current, issue.message];
  }

  return result;
};

/**
 * Traduce el draft al contrato de la Tarea 12.
 *
 * Vive acá y no en el componente porque es el único punto del proyecto
 * donde se cruzan el schema del checkout y el contrato del mensaje. Si
 * mañana el mensaje necesita un campo más, se cambia en un archivo.
 */
/**
 * Traduce el draft (o la salida ya validada del schema) al contrato de
 * la Tarea 12. Los campos opcionales se declaran opcionales porque la
 * salida de Zod los tipa `string | undefined`.
 *
 * Vive acá y no en el componente porque es el único punto del proyecto
 * donde se cruzan el schema del checkout y el contrato del mensaje. Si
 * mañana el mensaje necesita un campo más, se cambia en un archivo.
 */
export const toWhatsAppCustomer = (input: {
  readonly fullName: string;
  readonly phone: string;
  readonly fulfillment: (typeof FULFILLMENT_VALUES)[number];
  readonly address?: string | undefined;
  readonly notes?: string | undefined;
}): WhatsAppCustomer => {
  const notes = input.notes?.trim() ?? "";

  return {
    fullName: input.fullName.trim(),
    phone: input.phone,
    fulfillment: input.fulfillment,
    // ⛔ Sin `|| null` sobre el draft crudo: una dirección vacía es `""`,
    // que es distinto de "no pidió delivery", y el mensaje los trata
    // distinto.
    address: input.fulfillment === "delivery" ? (input.address ?? "").trim() : null,
    notes: notes === "" ? null : notes,
  };
};
