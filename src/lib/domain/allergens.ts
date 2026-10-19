/**
 * Glosario cerrado de alérgenos (capa 0 · dominio).
 *
 * Por defecto la fuente de verdad es `docs/menu-maestro.md` §5 y es
 * CERRADO a propósito: no se agrega una clave sin que el encargado la
 * confirme, porque un alérgeno inventado en el menú es un problema de
 * salud, no de contenido.
 *
 * El glosario se puede reemplazar desde `PROTOTYPE_CONFIG.defaultAllergens`
 * para reutilizar el código en otro negocio. Si la config trae una lista
 * no vacía, ESA es la fuente de verdad; si está vacía (el default), se
 * mantiene el glosario argentino de ocho claves de abajo.
 *
 * Son OCHO claves por defecto, no las siete originales de la Tarea 00: se
 * agregó `pescado` por ADR-24 (sin él, `Atún` y `Salmon y Palta` quedarían
 * sin declarar, lo que es un fallo de información, no un detalle estético).
 *
 * ⛔ Las claves se guardan y se muestran con tilde y eñe, exactamente como
 *    están acá: "maní", "sésamo". La comparación externa (entrada del
 *    usuario, JSON, etc.) pasa por `toCanonicalAllergen`, que normaliza
 *    y devuelve la clave canónica.
 */
import { PROTOTYPE_CONFIG } from "@/config/prototype";

/** Glosario por defecto: las ocho claves argentinas (docs/menu-maestro.md §5). */
const DEFAULT_ALLERGENS = [
  "gluten",
  "lactosa",
  "huevo",
  "maní",
  "frutos secos",
  "sésamo",
  "soja",
  "pescado",
] as const;

/**
 * Lista efectiva de alérgenos.
 *
 * Si `PROTOTYPE_CONFIG.defaultAllergens` trae valores, se usan esos; si
 * está vacía o no es un array de strings no vacíos, se cae al glosario por
 * defecto. Se limpian entradas vacías para que un `[""]` accidental no
 * agregue un alérgeno fantasma.
 */
const configuredAllergens = PROTOTYPE_CONFIG.defaultAllergens
  .map((allergen) => allergen.trim())
  .filter((allergen) => allergen.length > 0);

export const ALERGENOS: readonly string[] =
  configuredAllergens.length > 0 ? configuredAllergens : DEFAULT_ALLERGENS;

export type Allergen = string;

/**
 * Reduce un valor a la clave de comparación.
 *
 * Descompone en NFD y saca los diacríticos, de modo que "Maní", "MANÍ",
 * "maní " y "mani" colisionan en la misma clave (la ñ se descompone en
 * "n" + tilde combinante). Con el glosario por defecto solo hay una clave
 * por nombre; si algún día se agregara un alérgeno que solo difiera en
 * tildes, este lugar lo haría indistinguible del otro.
 */
export const normalizeAllergenKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const CANONICAL_BY_KEY: ReadonlyMap<string, Allergen> = new Map(
  ALERGENOS.map((allergen) => [normalizeAllergenKey(allergen), allergen]),
);

/** Traduce una entrada a la clave canónica, o `null` si no existe en el glosario. */
export const toCanonicalAllergen = (value: string): Allergen | null =>
  CANONICAL_BY_KEY.get(normalizeAllergenKey(value)) ?? null;

export const isAllergen = (value: string): value is Allergen => toCanonicalAllergen(value) !== null;
