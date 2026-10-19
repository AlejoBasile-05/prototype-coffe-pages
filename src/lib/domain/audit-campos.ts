/**
 * Nombres de los campos que un guardado realmente cambió (Tarea 19 §7.1).
 *
 * ⛔ El log de una edición registra QUÉ campos se tocaron, nunca sus
 *    valores: un precio y una `imageUrl` son datos del negocio, y con los
 *    nombres alcanza para reconstruir qué pasó sin exponer qué había antes.
 *
 * ⛔ Y no es `Object.keys(input)`: el formulario manda el producto entero
 *    aunque el encargado haya tocado un solo campo, así que esa lista no
 *    diría nada. La comparación es contra la fila.
 *
 * ⛔ Sin `server-only` ni I/O: es una función de la capa 0 y se testea sin
 *    levantar nada.
 */

/**
 * Los parámetros son `object` y no `Record<string, unknown>` a propósito:
 * las interfaces del dominio (`CategoryRow`, un `ProductDTO`) no tienen
 * firma de índice, así que una proyección de un solo nivel los volvería
 * ilegibles y obligaría a cada service a copiar su fila.
 */
const valorDe = (objeto: object, clave: string): unknown =>
  (objeto as Record<string, unknown>)[clave];

/**
 * Compara por valor normalizado.
 *
 * `null` y `undefined` son el mismo valor de negocio —en un formulario un
 * campo vacío es `""` y en la base es `null`—, así que se comparan como la
 * cadena vacía. Un `Decimal` de Prisma llega como objeto con `toString`, y
 * una lista de alérgenos se compara por su forma, no por referencia.
 */
const normalizar = (valor: unknown): string => {
  if (valor === null || valor === undefined) return "";
  if (Array.isArray(valor)) return JSON.stringify(valor);
  if (typeof valor === "object") return String(valor);
  return String(valor);
};

/**
 * Claves de `posterior` cuyo valor normalizado difiere de `anterior`.
 *
 * Itera sobre `posterior` y no sobre la unión de las dos: la lista es "lo
 * que este envío tocó", y un campo que el formulario ni mandó no puede
 * haber cambiado por este guardado.
 */
export const camposEditados = (anterior: object, posterior: object): readonly string[] =>
  Object.keys(posterior).filter(
    (clave) => normalizar(valorDe(posterior, clave)) !== normalizar(valorDe(anterior, clave)),
  );