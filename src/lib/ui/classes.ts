/**
 * Une clases de Tailwind resolviendo los conflictos de especificidad.
 *
 * Tailwind no evalúa strings: no puede saber que `px-4` pisa a `px-2` en
 * el CSS final. Lo que hace es respetar el ORDEN en el archivo generado.
 * Por eso el orden de los argumentos importa: el último gana.
 *
 * Ojo: este helper no reemplaza a `tailwind-merge`. Para esta tarea
 * alcanza con concatenar en el orden correcto. Si más adelante aparecen
 * variantes que se pisan entre sí, el arreglo es `tailwind-merge`, no
 * reordenar cadenas a mano.
 */
export function joinClasses(...groups: Array<string | false | null | undefined>): string {
  return groups.filter(Boolean).join(" ");
}
