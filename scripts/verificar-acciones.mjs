/**
 * Verificación del orden de las actions de escritura (Tarea 19 §5.4).
 *
 * ⛔ La pantalla no es el control de acceso. El formulario deshabilita el
 *    botón para un `STAFF`, pero el POST es un `fetch` que cualquiera puede
 *    reescribir. El único control que vale es `verifyAdminSession()`, y va
 *    **antes** de tocar el payload.
 *
 * ⛔ Por qué antes del parseo y no sólo "en algún lado de la función":
 *    leer y validar el payload de un usuario sin sesión es trabajo gratis
 *    para un atacante —CPU, mensajes de validación que confirman qué campos
 *    existen y con qué forma— y la §6.9 lo pone explícito. Además, si el
 *    permiso se valida después, un `throw` de parseo se convierte en un
 *    mensaje de error de negocio que además confirma qué campos espera el
 *    endpoint.
 *
 * El script no importa las actions: las *lee*. Importar una `"use server"`
 *    en un proceso de Node arrastra `next/cache`, Prisma y el cliente de
 *    Supabase; leer el texto no pide nada y no puede dar un falso verde por
 *    un módulo mockeado.
 *
 * Sin dependencias: `node:fs` (Node >= 20.9, `engines`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * ⛔ Los CUATRO archivos, no los tres de §5.4: con tres son ocho actions y
 *    el toggle de disponibilidad queda sin verificar, que es el gesto que
 *    más se repite en el panel. La lista es explícita y no un `readdir`:
 *    un archivo nuevo con actions tiene que entrar a propósito.
 */
export const ARCHIVOS = [
  "src/server/actions/productos.ts",
  "src/server/actions/categorias.ts",
  "src/server/actions/ajustes.ts",
  "src/server/actions/product-availability.actions.ts",
  // Tarea 23: la transición de comandas del tablero (admin).
  "src/server/actions/comandas.ts",
  // ⛔ `pedidos.ts` NO va en la lista a propósito: es la ÚNICA action
  //    pública del sistema (el cliente que confirma el checkout no tiene
  //    sesión). Sus defensas son honeypot → rate limit → Zod → cotización
  //    server-side, documentadas en su cabecera y en docs/tasks/23.
];

/**
 * Las señales de "tocó el payload".
 *
 * ⛔ Incluyen el NOMBRE del primer parámetro, y no sólo `.parse(`. Las
 *    actions no están obligadas a usar Zod: `archiveProductAction` valida
 *    con un `typeof` y un `.trim()`, y una lista de señales de parseo la
 *    declararía "sin acceso al payload" — es decir, la marcaría como
 *    segura sin haber comprobado nada. El parámetro es la entrada no
 *    confiable, y su primera aparición en el cuerpo es el acceso.
 */
const senalesDeAcceso = (parametro) => [
  ".safeParse(",
  ".parse(",
  "formData",
  ".get(",
  ...(parametro === undefined ? [] : [parametro]),
];

/**
 * ⛔ `verifyAdminSession` sin argumentos y con paréntesis: `isOwner(` es un
 *    permiso de rol y NO autentica. Aceptar cualquiera de los dos sería
 *    aceptar una action que autoriza a un OWNER anónimo.
 */
const VERIFICACION = "verifyAdminSession(";

/**
 * Una acción: su nombre, su cuerpo y el nombre de su primer parámetro, para
 * poder comparar posiciones dentro de la función.
 *
 * @param {string} nombre
 * @param {string} cuerpo
 * @param {string | undefined} parametro
 */
export const verificarOrden = (nombre, cuerpo, parametro) => {
  // La firma contiene el nombre del parámetro, así que el cuerpo arranca en
  // la primera `{` que sigue al cierre de los paréntesis de la firma.
  const inicioCuerpo = cuerpo.indexOf("{", cuerpo.indexOf(")"));

  const indiceVerificacion = cuerpo.indexOf(VERIFICACION);
  if (indiceVerificacion === -1) {
    return { nombre, ok: false, motivo: "no llama a verifyAdminSession()" };
  }

  const indicesAcceso = senalesDeAcceso(parametro)
    .map((senal) => cuerpo.indexOf(senal, inicioCuerpo))
    .filter((indice) => indice !== -1);

  if (indicesAcceso.length === 0) {
    return {
      nombre,
      ok: false,
      motivo: "no se pudo ubicar el acceso al payload; revisar el patrón",
    };
  }

  const primerAcceso = Math.min(...indicesAcceso);
  if (indiceVerificacion > primerAcceso) {
    return {
      nombre,
      ok: false,
      motivo: `lee el payload antes de verificar la sesión (posición ${primerAcceso} < ${indiceVerificacion})`,
    };
  }

  return { nombre, ok: true, motivo: null };
};

/** Todas las actions `export async function <nombre>Action` de un archivo. */
const accionesDelArchivo = (contenido, archivo) => {
  const acciones = [];
  // El primer parámetro se captura porque su nombre ES la señal de acceso al
  // payload cuando la action valida sin Zod (ver `senalesDeAcceso`).
  const patron = /export\s+(?:async\s+)?function\s+(\w*Action)\s*\(\s*(\w+)?/g;

  let coincidencia;
  while ((coincidencia = patron.exec(contenido)) !== null) {
    // El cuerpo va desde la firma hasta la próxima declaración `export` de
    // nivel superior: alcanza para el orden y no intenta parsear JS.
    const desde = coincidencia.index;
    const siguiente = contenido.indexOf("\nexport ", desde + 1);
    const cuerpo = contenido.slice(desde, siguiente === -1 ? undefined : siguiente);

    acciones.push({ nombre: coincidencia[1], parametro: coincidencia[2], archivo, cuerpo });
  }

  return acciones;
};

/** Todas las actions de los archivos declarados, con su veredicto. */
export const verificarTodas = (raiz = process.cwd()) => {
  const resultados = [];

  for (const relativo of ARCHIVOS) {
    const contenido = readFileSync(join(raiz, relativo), "utf8");
    for (const accion of accionesDelArchivo(contenido, relativo)) {
      resultados.push(verificarOrden(accion.nombre, accion.cuerpo, accion.parametro));
    }
  }

  return resultados;
};

const principal = () => {
  const resultados = verificarTodas();
  const fallidas = resultados.filter((resultado) => !resultado.ok);

  for (const resultado of resultados) {
    const estado = resultado.ok ? "OK  " : "FALLA";
    console.log(`[verificar-acciones] ${estado} ${resultado.nombre}`);
    if (!resultado.ok) console.log(`[verificar-acciones]        → ${resultado.motivo}`);
  }

  if (fallidas.length > 0) {
    console.error(
      `[verificar-acciones] FALLÓ: ${fallidas.length} de ${resultados.length} actions verifican la sesión tarde o no la verifican.`,
    );
    process.exit(1);
  }

  console.log(`[verificar-acciones] OK: ${resultados.length} actions verifican la sesión antes del payload.`);
};

// Se ejecuta sólo desde la línea de comandos: el test importa `verificarOrden`.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal();
}