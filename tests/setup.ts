/**
 * Utilidades compartidas de los tests de integración.
 *
 * Se prueba contra una base de datos REAL (Tarea 04 §10): un mock de Prisma
 * verificaría que el código se llama como se escribió, no que funcione.
 *
 * ⛔ Esa base real es la de TESTS (Docker local vía TEST_DATABASE_URL, o la
 *    efímera del job de CI) — nunca la de desarrollo/demo: este módulo la
 *    trunca, y `tests/setup-entorno.ts` lo garantiza con una guarda dura.
 */
import { prisma } from "@/server/infra/prisma";

/**
 * Limpia las tablas entre tests.
 *
 * TRUNCATE ... CASCADE borra en un solo statement sin importar el orden
 * de las FK. `business_settings` NO se trunca (es singleton): se vacía
 * con deleteMany para mantener la CHECK activa en cada run.
 */
export const resetDatabase = async (): Promise<void> => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "order_items",
      "orders",
      "product_variants",
      "products",
      "categories",
      "staff_members"
    RESTART IDENTITY CASCADE
  `);
  await prisma.businessSettings.deleteMany({});
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
};
