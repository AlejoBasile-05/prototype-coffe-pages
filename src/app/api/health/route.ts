import { NextResponse } from "next/server";
import { prisma } from "@/server/infra/prisma";

export const dynamic = "force-dynamic";

/**
 * Sonda de salud de la conexión a la base de datos.
 *
 * No devuelve datos del negocio: solo un booleano y la latencia observada.
 * Es la verificación de humo que reutilizan el deploy (Tarea 21) y el
 * monitoreo externo.
 *
 * ⛔ Esta ruta es la única excepción documentada a la regla de frontera de
 * capas: `src/app/**` no puede importar `src/server/infra/**`. Un chequeo de
 * vida de la infraestructura no es una consulta de negocio — no tiene
 * servicio que lo encapsule — y meterlo en un servicio exigiría inventar
 * lógica que solo existe para poder llamar a Prisma. La excepción vive en
 * `eslint.config.mjs`, limitada a este archivo.
 */
export async function GET() {
  const startedAt = performance.now();
  const noStoreHeaders = { "Cache-Control": "no-store" } as const;

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        database: "reachable",
        latencyMs: Math.round(performance.now() - startedAt),
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    // Dos cuidados al registrar el fallo:
    //
    // 1. Se registra solo nombre y mensaje. El objeto de error completo de
    //    Prisma puede incluir la connection string en `meta`, y los logs no
    //    son un lugar para credenciales. El detalle técnico se consulta en el
    //    panel de Supabase.
    // 2. El mensaje de Prisma ocupa decenas de líneas con un blinking box y
    //    sugerencias de "please make sure your database is running". Sin
    //    colapsar, un solo request fallido escribía 477 líneas y partía la
    //    entrada en el agregador de logs, impidiendo alertar sobre ella.
    const cause =
      error instanceof Error
        ? `${error.name}: ${error.message.replace(/\s+/g, " ").trim()}`
        : typeof error;
    console.error("[health] Fallo la conexión a la base de datos:", cause);

    return NextResponse.json(
      { status: "error", database: "unreachable" },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
