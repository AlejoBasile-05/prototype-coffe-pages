/**
 * Zod del formulario de categorías (Tarea 17 §6.4).
 *
 * ⛔ IDs UUID. Un id sin validar que llega a Prisma produce un `P2025`
 *    que el repositorio traduce a `ResourceNotFoundError` y el mensaje
 *    "no existe" sobre un id basura. El error de campo es "ese id no es
 *    válido", que es exactamente lo que necesita el soporte.
 *
 * ⛔ Ningún payload lleva `slug` ni `position`.
 *    El alta los deriva del nombre y los deja al servicio: el formulario
 *    no elige la URL de otra sección del menú, no escribe nada.
 */
import * as z from "zod";

/** IDs de categoría: la única forma en que pasa Zod es UUID. */
export const CategoriaIdSchema = z.string().uuid("Ese identificador no es válido.");

const NOMBRE = z
  .string()
  .trim()
  .min(2, "Poné un nombre de al menos 2 letras.")
  .max(60, "El nombre no puede pasar los 60 caracteres.");

const DESCRIPCION = z
  .string()
  .trim()
  .max(300, "La descripción no puede pasar los 300 caracteres.")
  .transform((valor) => (valor.length === 0 ? null : valor))
  .nullable()
  .optional();

/** El slug se muestra pero no se manda: el servicio lo deriva del nombre. */
export const CategoriaAltaSchema = z.object({
  nombre: NOMBRE,
  descripcion: DESCRIPCION,
  isVisible: z.boolean().default(true),
});

export type CategoriaAltaInput = z.infer<typeof CategoriaAltaSchema>;

/** Edición de categoría. El slug pasa solo si no tiene productos. */
export const CategoriaEdicionSchema = z.object({
  id: CategoriaIdSchema,
  nombre: NOMBRE,
  descripcion: DESCRIPCION,
  isVisible: z.boolean(),
  /**
   * ⛔ Se acepta pero se valida igual: un slug con espacios da el
   *    mensaje del campo, no un error de base. Y se ignora si la
   *    categoría ya tiene productos — el doc lo deja escrito así (§5.2).
   */
  slug: z.string().trim().max(80, "El identificador no puede pasar los 80 caracteres.").optional(),
});

export type CategoriaEdicionInput = z.infer<typeof CategoriaEdicionSchema>;

/** El switch de visibilidad manda sólo par id + valor destino. */
export const CategoriaVisibilidadSchema = z.object({
  id: CategoriaIdSchema,
  isVisible: z.boolean(),
});

export type CategoriaVisibilidadInput = z.infer<typeof CategoriaVisibilidadSchema>;
