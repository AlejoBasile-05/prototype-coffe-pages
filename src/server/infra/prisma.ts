/**
 * Cliente Prisma singleton.
 *
 * ⚠️ ESTE ES EL ÚNICO LUGAR DEL PROYECTO DONDE SE INSTANCIA PrismaClient.
 *
 * Tres decisiones críticas y no obvias:
 *
 * 1. `server-only` hace que el build de Next.js FALLE si este archivo llega
 *    al bundle del navegador. Prisma no puede ni debe correr en el cliente.
 *
 * 2. El bloque `globalThis` es para DESARROLLO, no para producción. En dev,
 *    Next.js hot-reload re-evalúa los módulos en cada cambio: sin el
 *    singleton, cada recarga abriría un pool nuevo de conexiones y
 *    agotaría el límite de Supabase (15 conexiones en plan Free) en minutos.
 *    En producción (serverless) cada invocación es un módulo nuevo, así que
 *    `globalThis` es inofensivo.
 *
 * 3. `errorFormat: "minimal"` en producción. El valor por defecto (`pretty`)
 *    imprime cajas coloreadas con rutas absolutas del filesystem y diffs de
 *    query completos: en los logs de una función serverless eso es ruido que
 *    además filtra estructura interna. Fuera de desarrollo se usa el mínimo.
 *
 * Sobre pooler vs. conexión directa: la URL de runtime (pooler, puerto 6543)
 * multiplexa muchas conexiones de aplicación sobre pocas conexiones reales.
 * Es la única forma de sobrevivir en un entorno serverless donde cada
 * request puede crear su propio cliente. Ver DESIGN.md §4.5.
 */
import "server-only";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isDevelopment = process.env.NODE_ENV === "development";

const createPrismaClient = (): PrismaClient =>
  new PrismaClient({
    log: isDevelopment ? ["warn", "error"] : ["error"],
    errorFormat: isDevelopment ? "pretty" : "minimal",
  });

/**
 * @example
 * import { prisma } from "@/server/infra/prisma";
 *
 * const products = await prisma.product.findMany({ where: { status: "PUBLISHED" } });
 */
export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

/**
 * Solo `development` reutiliza el pool. Con `NODE_ENV` ausente o distinto de
 * `production` (por ejemplo en tests) NO se cachea: un proceso de test no
 * debe arrastrar un pool de conexiones entre suites.
 */
if (isDevelopment) {
  globalForPrisma.prisma = prisma;
}
