/**
 * Esquemas Zod del formulario de producto del panel (Tarea 16 §6.1).
 *
 * ⛔ Sin `server-only` y sin I/O: este módulo lo importa el componente
 *    de cliente para validar antes de subir 6 MB. Ver §4.1.
 */
import { z } from "zod";

import { isValidSlug } from "@/lib/validation/slug";

const NOMBRE_MAX = 120;
const DESCRIPCION_MAX = 600;
const PRECIO_MAX = 1_000_000;

/**
 * Acepta "1450", "1450,50" y "1450.50". Rechaza "1.450,50" a propósito:
 * el separador de miles no se adivina, y un `NaN` silencioso en el
 * precio es peor que un error visible. Ver §5.5.
 */
const precioComoNumero = z
  .string()
  .trim()
  .regex(/^\d{1,7}([.,]\d{1,2})?$/, "Escribí el precio como 1450 o 1450,50")
  .transform((valor) => Number(valor.replace(",", ".")))
  .refine((valor) => Number.isFinite(valor) && valor >= 0 && valor <= PRECIO_MAX, {
    message: `El precio debe estar entre 0 y ${PRECIO_MAX}`,
  });

const nombre = z
  .string()
  .trim()
  .min(3, "El nombre tiene al menos 3 caracteres")
  .max(NOMBRE_MAX, `El nombre tiene hasta ${NOMBRE_MAX} caracteres`);

const descripcion = z
  .string()
  .trim()
  .max(DESCRIPCION_MAX, `La descripción tiene hasta ${DESCRIPCION_MAX} caracteres`)
  .transform((valor) => (valor.length === 0 ? null : valor));

/**
 * ⛔ El enum está escrito a mano y NO se deriva de `ALERGENOS` con un
 *    cast. Un `z.enum(ALERGENOS as [Allergen, ...Allergen[]])` compila,
 *    pero el `as` le miente al compilador sobre la forma del array y
 *    nada detecta que al glosario le agregaron una clave y el enum
 *    quedó viejo. La prueba es la línea de §10.1. Ver §5.3.
 */
// ⚠️ Escrito a mano y NO derivado de `ALERGENOS` (§5.3). El test de
//    §10.1 compara esta lista con el glosario y avisa si quedó vieja.
const allergenEnumValues = [
  "gluten",
  "lactosa",
  "huevo",
  "maní",
  "frutos secos",
  "sésamo",
  "soja",
  "pescado",
] as const;

const allergens = z.array(z.enum(allergenEnumValues)).default([]);

const categoryId = z.string().min(1, "Elegí una categoría");

/** Datos que llegan YA con la imagen subida. Ver §2.3. */
const imagenSubida = z.object({
  imageUrl: z.string().url().startsWith("https://res.cloudinary.com/"),
  imagePublicId: z.string().min(1),
});

export const ProductoAltaSchema = z.object({
  nombre,
  descripcion,
  precio: precioComoNumero,
  categoryId,
  allergens,
  isFeatured: z.boolean().default(false),
  imagen: imagenSubida,
});

export const ProductoEdicionSchema = ProductoAltaSchema.omit({ imagen: true }).extend({
  id: z.string().min(1),
  /** Opcional: si no viene, se conserva la foto actual. Ver §6.2. */
  imagen: imagenSubida.optional(),
  /** Sólo se acepta si el producto está en DRAFT. Lo verifica el servicio. */
  slug: z.string().trim().refine(isValidSlug, "Sólo minúsculas, números y guiones").optional(),
  /** ⛔ No incluye `ARCHIVED`: archivar tiene su propia action y su diálogo. */
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});

export type ProductoAltaInput = z.infer<typeof ProductoAltaSchema>;
export type ProductoEdicionInput = z.infer<typeof ProductoEdicionSchema>;
