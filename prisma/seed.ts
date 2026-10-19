/**
 * Punto de entrada del seed (`npm run db:seed`).
 *
 * La carga de entorno es explícita y ordenada — ver §6.3 de la Tarea 05:
 * los módulos de infraestructura (`prisma`, `supabaseAdmin`) leen
 * `process.env` en el momento en que se IMPORTAN, así que las variables
 * tienen que estar pobladas antes de cualquier import estático de ellos.
 *
 * Por eso acá solo hay imports estáticos de `dotenv`, y el orquestador
 * (que a su vez importa repositorios) llega por import dinámico.
 *
 * Orden de archivos: `.env.local` primero, `.env` después, y `dotenv` NO
 * pisa lo que ya estaba cargado: `.env.local` gana. Es la misma convención
 * de precedencia que usa Next.js.
 */
import { config as cargarEntorno } from "dotenv";

cargarEntorno({ path: ".env.local" });
cargarEntorno();

const { ejecutarSeed } = await import("./datos-seed/ejecutar-semilla");
const { prisma } = await import("../src/server/infra/prisma");

try {
  await ejecutarSeed();
} catch (error) {
  console.error("\n[seed] Falló la siembra de datos:\n", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
