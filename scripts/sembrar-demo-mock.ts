/**
 * Seed de DEMO: siembra categorías + productos del set MOCK ya PUBLISHED.
 *
 * ⛔ A DIFERENCIA de `npm run db:seed`, este script NO toca
 *    `business_settings`: la base dev puede tener datos reales del
 *    negocio (p. ej. el número de WhatsApp) y pisarlos con el mock
 *    `5492615000000` rompería el handoff. La configuración ya quedó
 *    sembrada por la Tarea 05.
 *
 * Es idempotente por slug: una segunda corrida omite lo existente.
 *
 * Uso: `npm run demo:datos`
 */
import { config as cargarEntorno } from "dotenv";

cargarEntorno({ path: ".env.local" });
cargarEntorno();

// Guarda de producción: este script publica datos con precios inventados.
if (process.env.NODE_ENV === "production") {
  throw new Error("⛔ scripts/sembrar-demo-mock.ts no corre en producción.");
}

const { ejecutarSeedDemo } = await import("../prisma/datos-seed/ejecutar-demo");
const { prisma } = await import("../src/server/infra/prisma");

try {
  await ejecutarSeedDemo();
} catch (error) {
  console.error("\n[demo] Falló la siembra de datos demo:\n", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
