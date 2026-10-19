/**
 * Sondeo de solo lectura sobre la base (demo/mock).
 *
 * Uso: `npx tsx --conditions=react-server scripts/sondear-datos.ts`
 *
 * Lee conteos y estados; NO escribe nada. Sirve para decidir si la demo
 * necesita seed completo o solo la publicación del set MOCK.
 */
import { config as cargarEntorno } from "dotenv";

cargarEntorno({ path: ".env.local" });
cargarEntorno();

const { prisma } = await import("../src/server/infra/prisma");
const { WEEKDAY_KEYS, WEEKDAY_LABELS } = await import("../src/lib/domain/settings");
const { normalizeOpeningHours } = await import("../src/lib/validation/ajustes");

const [productos, porEstado, categorias, settings] = await Promise.all([
  prisma.product.count(),
  prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),
  prisma.category.count(),
  prisma.businessSettings.findFirst(),
]);

console.log(`[sondeo] productos: ${productos}`);
for (const fila of porEstado) {
  console.log(`  - status=${fila.status}: ${fila._count._all}`);
}
console.log(`[sondeo] categorías: ${categorias}`);
console.log(
  `[sondeo] business_settings: ${settings ? `presente (whatsappPhone=${settings.whatsappPhone})` : "AUSENTE"}`,
);

// Grilla de horarios con el MISMO normalizador que usa la app: lo que se
// imprime es exactamente lo que el footer público va a mostrar.
const horarios = normalizeOpeningHours(settings?.openingHours ?? {});
console.log("[sondeo] horarios:");
for (const dia of WEEKDAY_KEYS) {
  const franja = horarios[dia];
  const label = WEEKDAY_LABELS[dia];
  console.log(
    `  - ${label}: ${franja ? `${franja.opens}–${franja.closes}` : dia in horarios ? "cerrado" : "sin informar"}`,
  );
}

await prisma.$disconnect();
