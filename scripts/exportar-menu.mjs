// scripts/exportar-menu.mjs
// ⛔ Sin dependencias externas. Prisma ya está y `@prisma/client` viene del
//    `postinstall`. Ver §5.2: este script exporta y nada más.
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * ⛔ Ésta es la única excepción a la regla de "un solo PrismaClient" (Tarea 02 §7),
 *    y hay una razón técnica, no de conveniencia: `src/server/infra/prisma.ts`
 *    arranca con `import "server-only"`, que **lanza** al importarse fuera
 *    de Next. Un script de Node plano no puede usar el cliente de la app.
 *
 *    El script construye el suyo y cierra la conexión al final. No
 *    reexporta nada: si algo de `src/` lo importara, el build lo corta
 *    con la regla de capas de la Tarea 01.
 */
const prisma = new PrismaClient();

/**
 * ⛔ Sólo productos PUBLICADOS y no archivados.
 *
 * El export es la red de seguridad del contenido, no un dump de la base.
 * Si aparece un DRAFT es información que el local todavía no publicó, y
 * un archivo con datos que nadie autorizó no es una red de seguridad: es
 * una fuga con buena prensa.
 */
const productos = await prisma.product.findMany({
  where: { status: "PUBLISHED" },
  orderBy: [{ categoryId: "asc" }, { name: "asc" }],
  include: { category: { select: { name: true } } },
});

const marca = new Date().toISOString().slice(0, 10);
const destinoDir = join("exports");
await mkdir(destinoDir, { recursive: true });

const destinoJson = join(destinoDir, `menu-${marca}.json`);
await writeFile(destinoJson, `${JSON.stringify(productos, null, 2)}\n`, "utf8");

/**
 * ⛔ El CSV es para que el local lo abra en una planilla, así que las
 *    columnas van en español y los centavos van como número, no como
 *    `$ 1.450,00`: una planilla en es-AR no parsea ese formato.
 */
const columnas = ["categoria", "nombre", "precio", "disponible"];
const celda = (valor) => `"${String(valor ?? "").replaceAll('"', '""')}"`;
const filas = productos.map((p) =>
  [
    p.category?.name,
    p.name,
    p.price.toString(),
    p.isAvailable ? "sí" : "no",
  ]
    .map(celda)
    .join(","),
);

const destinoCsv = join(destinoDir, `menu-${marca}.csv`);
await writeFile(
  destinoCsv,
  `${columnas.join(",")}\n${filas.join("\n")}\n`,
  "utf8",
);

console.info(`[exportar-menu] ${productos.length} productos en exports/menu-${marca}.{json,csv}`);

await prisma.$disconnect();