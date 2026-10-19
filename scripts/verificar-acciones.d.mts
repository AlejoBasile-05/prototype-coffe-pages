/**
 * Tipos de `scripts/verificar-acciones.mjs` (Tarea 19 §5.4).
 *
 * ⛔ El script es `.mjs` a propósito: corre con `node` sin compilar, sin
 *    `tsx` y sin `tsc`, y así `npm run verify:actions` funciona en un
 *    checkout recién clonado donde todavía no hay build.
 *
 * ⛔ Y a pesar de eso el test lo importa. Sin este archivo, `tsc --noEmit`
 *    lo trataría como `any` implícito y `strict` lo rechaza. Declarar la
 *    forma acá es lo que permite tener el script ejecutable por Node y, al
 *    mismo tiempo, tipado en el test.
 */

/** El veredicto de una action. `motivo` es `null` cuando `ok` es `true`. */
export interface VeredictoDeAccion {
  readonly nombre: string;
  readonly ok: boolean;
  readonly motivo: string | null;
}

/**
 * Verifica que la sesión se compruebe antes de tocar el payload.
 *
 * @param nombre Nombre de la action, sin el módulo.
 * @param cuerpo Texto de la acción completa, desde su firma.
 * @param parametro Nombre del primer parámetro, si tiene.
 */
export function verificarOrden(
  nombre: string,
  cuerpo: string,
  parametro?: string,
): VeredictoDeAccion;

/** Rutas relativas de los archivos con actions de escritura. */
export const ARCHIVOS: readonly string[];

/** Verifica todas las actions de `ARCHIVOS` y devuelve sus veredictos. */
export function verificarTodas(raiz?: string): VeredictoDeAccion[];