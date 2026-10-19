/**
 * Zod del formulario de ajustes (Tarea 17 §6.5).
 *
 * Horarios: se valida con `HorarioInputSchema` de
 * `@/lib/validation/ajustes` — esa es la única Zod del formulario que
 * vive en capa 0, porque el fieldset la usa mientras se tipea. La
 * regla del doc (§2.5): si el Zod lo necesita el cliente, va a
 * `src/lib/validation`.
 *
 * Un solo botón de submit: todos los grupos de campos se guardan o
 * ninguno. Un guardado por bloque produciría estados parciales donde
 * el nombre cambia pero el teléfono no, y eso es lo que hace que un
 * cliente le escriba al número viejo.
 */
import { WEEKDAY_KEYS } from "@/lib/domain";
import { HorarioInputSchema } from "@/lib/validation/ajustes";
import * as z from "zod";

/** Texto opcional: vacío y ausente son lo mismo, y se guardan como `null`. */
const textoONull = (campo: string, maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, `${campo}: máximo ${maximo} caracteres.`)
    .nullable()
    .optional()
    .transform((valor) => (valor === undefined || valor === null || valor === "" ? null : valor));

export const AjustesSchema = z.object({
  nombre: z.string().trim().min(2, "Poné un nombre de al menos 2 letras.").max(80),
  telefonoWhatsapp: z
    .string()
    .trim()
    .min(6, "Ingresá el número de WhatsApp.")
    .max(32, "Ese número es demasiado largo."),
  direccion: textoONull("direccion", 200),
  instagram: textoONull("instagram", 200),
  mensajeCierre: textoONull("mensajeCierre", 280),
  avisoLegal: textoONull("avisoLegal", 2000),
  horarios: z.record(z.enum([...WEEKDAY_KEYS]), HorarioInputSchema),
});

export type AjustesInput = z.infer<typeof AjustesSchema>;
