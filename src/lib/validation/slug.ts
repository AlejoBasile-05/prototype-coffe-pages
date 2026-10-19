/**
 * Construcción y validación de `slug` (capa 0).
 *
 * Es la ÚNICA forma de construir un slug en el proyecto (`DESIGN.md` §5.4).
 * La usan el seed (Tarea 05), el formulario admin (Tarea 16) y la
 * derivación del `public_id` de Cloudinary (Tarea 06). Si el slug se
 * construyera de dos maneras distintas, un mismo producto tendría dos
 * identidades.
 *
 * Regla: minúsculas, sin tildes, sin signos, palabras separadas por `-`,
 * máximo 80 caracteres.
 */
export const buildSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** Un slug válido solo contiene `[a-z0-9-]` y no puede arrancar con `-`. */
export const isValidSlug = (value: string): boolean =>
  value.length > 0 && value.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
