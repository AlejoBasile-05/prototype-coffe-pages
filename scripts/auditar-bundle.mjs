/**
 * Auditoría del bundle cliente (Tarea 19 §5.1 / §5.3).
 *
 * Busca el VALOR de cada secreto dentro de `.next/static`, no su nombre.
 * Es la diferencia entre una auditoría y un falso positivo: `SERVICE_ROLE`
 * aparece escrito en el código con todas las constantes que cualquiera
 * puede leer,
 * y `DATABASE_URL` se llama así en la documentación de Prisma. Lo que no
 * puede aparecer es `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...` con el
 * payload que alguien pegó por error.
 *
 * Por eso el script no falla si el secreto no está definido: lo que no se
 * puede verificar en una máquina sin `.env` es exactamente el escenario en
 * el que el bundle puede haberse construido con una clave inyectada. Falla
 * si encuentra algo, y avisa qué variable no pudo verificar.
 *
 * Sin dependencias: `node:fs` y `node:path` (Node >= 20.9, `engines`).
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

/**
 * ⛔ Las cinco de la §5.1. `CLOUDINARY_API_KEY` entra acá aunque no sea un
 *    secreto: en la práctica el par key+secret de Cloudinary es lo que hay
 *    que proteger, y separar el key del secret para "ahorrar" una comprobación
 *    deja el error a medias.
 */
const SECRETOS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_API_KEY",
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
];

/**
 * ⛔ Un valor que HUELE a placeholder no es un secreto, y buscarlo en el
 *    bundle es teatro: no puede aparecer porque no es el valor real. En el
 *    pipeline las variables se llenan con valores de mentira para que el
 *    build tenga qué leer, y con ellos esta auditoría "pasaba" sin haber
 *    comparado nada contra nada (Tarea 20 §9). Se cuentan como NO
 *    verificadas, que es lo que son.
 */
const MARCADORES_DE_PLACEHOLDER = /(placeholder|stub|example\.|changeme|dummy|falso)/i;

/** Extensiones que Next escribe en `.next/static`. */
const EXTENSIONES = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".map",
  ".json",
  ".txt",
  ".html",
  ".woff",
  ".woff2",
  ".ttf",
]);

/**
 * Punteros largos y con forma de JWT.
 *
 * ⛔ Es una red secundaria, NO el criterio. Los límites más chicos generan
 *    ruido: un bundle minificado tiene `sourceMappingURL` legítimamente y
 *    `eval(` aparece en librerías de terceros sin que eso sea un agujero
 *    nuestro. Los patrones largos y específicos casi nunca dan positivo.
 */
const PATRONES_SOSPECHOSOS = [
  { patron: /\beval\s*\(\s*(?:atob|decodeURIComponent|String\.fromCharCode)/, motivo: "eval de cadena decodificada" },
  { patron: /\bnew\s+Function\s*\(\s*(?:atob|decodeURIComponent)/, motivo: "new Function con cadena decodificada" },
  { patron: /\bsourceMappingURL=data:application\/json;base64,/, motivo: "source map embebido en el bundle" },
  { patron: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, motivo: "JWT embebido en el bundle" },
];

/** Threshold de tamaño: más grande que esto no es un chunk de Next. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Lee `.env.local` y `.env` a mano.
 *
 * ⚠️ `node --env-file` es de Node >= 22.9 y el proyecto declara `>=20.9.0`:
 *    depender del flag rompe el script justo en la máquina de la otra
 *    persona. Y `dotenv` es una dependencia de desarrollo: este script corre
 *    en `postinstall`-like contexts donde puede no estar.
 *
 * Es un parser a propósito y no uno completo: sólo necesita el par
 * clave/valor para BUSCARLO, no para interpretar escapes ni comentarios.
 */
const leerEnv = (ruta) => {
  if (!existsSync(ruta)) return {};

  const valores = {};
  for (const linea of readFileSync(ruta, "utf8").split("\n")) {
    const limpia = linea.trim();
    if (limpia === "" || limpia.startsWith("#")) continue;

    const separador = limpia.indexOf("=");
    if (separador === -1) continue;

    const clave = limpia.slice(0, separador).replace(/^export\s+/, "").trim();
    let valor = limpia.slice(separador + 1).trim();
    // Comillas envolventes, sin desescapar: para comparar y buscar alcanza.
    if (
      (valor.startsWith('"') && valor.endsWith('"') && valor.length >= 2) ||
      (valor.startsWith("'") && valor.endsWith("'") && valor.length >= 2)
    ) {
      valor = valor.slice(1, -1);
    }

    valores[clave] = valor;
  }
  return valores;
};

/** Archivos bajo `directorio`, en profundidad, filtrando por extensión. */
const archivosEn = (directorio) => {
  const encontrados = [];

  const recorrer = (actual) => {
    for (const entrada of readdirSync(actual, { withFileTypes: true })) {
      const ruta = join(actual, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(ruta);
        continue;
      }
      if (!EXTENSIONES.has(extname(entrada.name))) continue;

      const { size } = statSync(ruta);
      if (size > MAX_BYTES) continue;

      encontrados.push(ruta);
    }
  };

  recorrer(directorio);
  return encontrados;
};

const principal = () => {
  const directorio = join(process.cwd(), ".next", "static");

  if (!existsSync(directorio)) {
    console.error(
      "[auditar-bundle] No existe .next/static. El script corre después de `next build`:",
    );
    console.error("[auditar-bundle]   npm run build");
    process.exit(1);
  }

  const archivos = archivosEn(directorio);
  const env = { ...leerEnv(join(process.cwd(), ".env")), ...leerEnv(join(process.cwd(), ".env.local")) };

  /**
   * ⛔ El entorno del proceso pisa a los archivos, y sólo para estas claves.
   *
   * En el pipeline los valores vienen de `env:` del workflow, no de un
   * `.env`, así que leer sólo los archivos hacía que los placeholders fueran
   * invisibles para el script: los_reportaba como "sin valor" en vez de
   * "valor falso". Los dos casosVerifierían igual de mal, pero uno vale la
   * pena poder distinguir. Se mergean sólo las claves que el script
   * audita, no `process.env` entero, para no arrastrar el entorno entero
   * del runner a un objeto que después se imprime.
   */
  for (const clave of [...SECRETOS, "AUDITAR_BUNDLE_SIN_SECRETOS"]) {
    if (process.env[clave] !== undefined) env[clave] = process.env[clave];
  }

  const hallazgos = [];

  // ⛔ Se calcula ANTES de recorrer los archivos, porque el veredicto
  //    depende de si hubo algo que comparar. Recorrer primero y decidir
  //    después obligaba a reconstruir el mismo dato en dos lugares.
  const sinVerificar = [];
  for (const clave of SECRETOS) {
    const valor = env[clave];
    const inutil =
      valor === undefined ||
      valor === "" ||
      // Un valor de menos de 20 caracteres es un placeholder, no un secreto.
      valor.length < 20 ||
      MARCADORES_DE_PLACEHOLDER.test(valor);
    if (inutil && !sinVerificar.includes(clave)) sinVerificar.push(clave);
  }
  const verificadas = SECRETOS.filter((clave) => !sinVerificar.includes(clave));

  for (const ruta of archivos) {
    const contenido = readFileSync(ruta, "utf8");

    for (const clave of verificadas) {
      const valor = env[clave];
      if (contenido.includes(valor)) hallazgos.push({ ruta, detalle: `valor de ${clave}` });
    }

    for (const { patron, motivo } of PATRONES_SOSPECHOSOS) {
      if (patron.test(contenido)) hallazgos.push({ ruta, detalle: motivo });
    }
  }

  if (sinVerificar.length > 0) {
    console.warn(
      `[auditar-bundle] Sin valor REAL en el entorno para: ${sinVerificar.join(", ")}`,
    );
    console.warn("[auditar-bundle] No se pudo verificar que no estén en el bundle.");
  }

  /**
   * ⛔ Si no se verificó NINGUNA, el OK de abajo no significa nada. Es el
   *    caso del pipeline de la Tarea 20: los jobs corren sin secretos (a
   *    propósito, §6.11) y sin `.env`, así que sin este corte el job
   *    publicaría un verde de auditing que no auditó nada.
   *
   *    Se puede levantar la mano con `AUDITAR_BUNDLE_SIN_SECRETOS=1`, y
   *    queda escrito en el workflow: una excepción explícita y visible es
   *    defendible; un verde automático, no.
   */
  if (verificadas.length === 0 && env["AUDITAR_BUNDLE_SIN_SECRETOS"] !== "1") {
    console.error(
      `[auditar-bundle] FALLÓ: no se pudo verificar ninguna de las ${SECRETOS.length} variables.`,
    );
    console.error(
      "[auditar-bundle] Con los valores de placeholder del pipeline la auditoría no compara nada.",
    );
    console.error(
      "[auditar-bundle] Para aceptarlo a propósito: AUDITAR_BUNDLE_SIN_SECRETOS=1 npm run audit:bundle",
    );
    process.exit(1);
  }

  if (hallazgos.length > 0) {
    console.error(`[auditar-bundle] FALLÓ: ${hallazgos.length} hallazgo(s) en ${archivos.length} archivo(s)`);
    for (const { ruta, detalle } of hallazgos) {
      console.error(`[auditar-bundle]   ${detalle} → ${ruta}`);
    }
    process.exit(1);
  }

  console.log(
    `[auditar-bundle] OK: ${archivos.length} archivo(s) de .next/static, ${verificadas.length} de ${SECRETOS.length} variables verificadas.`,
  );
};

principal();