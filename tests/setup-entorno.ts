/**
 * Carga de entorno del proyecto de integración. Sin dependencias a propósito
 * (`node:fs` y `node:path`): este archivo corre antes que cualquier import
 * del test. Existe por el conflicto 3 de la Tarea 20 §2.3 — `tests/setup.ts`
 * estaba como `setupFiles` GLOBAL, y hasta los tests de lógica pura abrían
 * una conexión a Postgres para no usarla.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ⛔ No sobreescribe variables que ya existen: en CI llegan del entorno del
 *    job y tienen prioridad, para que el `.env.local` de una máquina de
 *    desarrollo no pueda apuntar el pipeline en silencio a otra base.
 */
const cargarSiFalta = (archivo: string): void => {
  const ruta = join(process.cwd(), archivo);
  if (!existsSync(ruta)) return;

  for (const linea of readFileSync(ruta, "utf8").split("\n")) {
    const definicion = /^([A-Z0-9_]+)=(.*)$/.exec(linea.trim());
    if (definicion === null) continue;

    const clave = definicion[1];
    const valor = definicion[2]?.replace(/^["']|["']$/g, "");
    if (clave === undefined || valor === undefined) continue;
    if (process.env[clave] !== undefined) continue;

    process.env[clave] = valor;
  }
};

cargarSiFalta(".env.local");
cargarSiFalta(".env");

/**
 * ⛔ Aislamiento de la base de tests (Tarea 20 §4.4, endurecido).
 *
 * `tests/setup.ts` TRUNCA todas las tablas entre tests: si apunta a la
 * base de desarrollo/demo (Supabase), cada corrida destruye los datos
 * — incluidos los horarios y el catálogo de la demo.
 *
 * Regla:
 *  · `TEST_DATABASE_URL` definida → los tests corren contra ESA base
 *    (el Postgres de Docker de `docker-compose.test.yml`).
 *  · `CI=true` → estamos en el pipeline, que ya inyecta su propia
 *    `DATABASE_URL` efímera (`.github/workflows/ci.yml`); no se toca nada.
 *    (NO se usa NODE_ENV: Vitest lo fija a "test" en CADA corrida local,
 *    así que no distingue CI de local.)
 *  · En cualquier otro caso se exige `ALLOW_TESTS_ON_DEV_DB=1`: un escape
 *    hatch explícito y escrito, nunca un default peligroso.
 */
const FORZAR_TEST_DB = process.env["TEST_DATABASE_URL"];
if (FORZAR_TEST_DB !== undefined && FORZAR_TEST_DB !== "") {
  process.env["DATABASE_URL"] = FORZAR_TEST_DB;
  process.env["DIRECT_DATABASE_URL"] = FORZAR_TEST_DB;
} else if (process.env["CI"] !== "true" && process.env["ALLOW_TESTS_ON_DEV_DB"] !== "1") {
  throw new Error(
    "[setup-entorno] Los tests de integración truncan la base. Definí TEST_DATABASE_URL " +
      "y levantá los servicios (`npm run db:test:up && npm run db:test:migrate`), " +
      "o exportá ALLOW_TESTS_ON_DEV_DB=1 si sabés que la base de desarrollo es descartable.",
  );
}

// Falla ruidosamente y temprano. Un `P1001` tres minutos después, en el
// primer `beforeEach`, cuesta el doble de entender que esto.
const requeridas = ["DATABASE_URL", "DIRECT_DATABASE_URL"] as const;
const faltantes = requeridas.filter((clave) => process.env[clave] === undefined);

if (faltantes.length > 0) {
  throw new Error(
    `[setup-entorno] Faltan ${faltantes.join(", ")}. ` +
      "Corré con .env.local en la raíz o exportalas en el entorno. " +
      "Los proyectos `unit` y `ui` no necesitan base: usá `npm run test:unit`.",
  );
}
