import { NextResponse } from "next/server";

import { validatePublicCartLines } from "@/server/services";
import { parseCartLineRef } from "@/lib/domain";
import type { CartLineReference } from "@/lib/domain";

/**
 * Revalidación de precio y disponibilidad del carrito.
 *
 * Endpoint **público**: no guarda nada, no devuelve datos del cliente y
 * solo lee lo que el catálogo público ya muestra. No requiere sesión
 * porque no hay sesión: el cliente no tiene cuenta y no va a tenerla.
 *
 * Amigable con rate limit por diseño (§9):
 *  · Es `GET`, o sea que un proxy con caché lo podría cachear. Acá se
 *    fuerza `no-store` porque el dato caduca en minutos.
 *  · `MAX_LINES_PER_REQUEST` acota el trabajo: una request con 5000 ids
 *    se rechaza con 400 antes de tocar la base.
 *  · No hay rate limit propio: agregarlo es envolver la función (la
 *    Tarea 19 endurece la red).
 */

/** Holgado para un carrito real y acota el trabajo por request. */
const MAX_LINES_PER_REQUEST = 30;

export const dynamic = "force-dynamic";

type ParsedRequest =
  | { readonly ok: true; readonly lines: readonly CartLineReference[] }
  | { readonly ok: false; readonly error: string };

const parseRequest = (searchParams: URLSearchParams): ParsedRequest => {
  const raw = searchParams.getAll("line");

  if (raw.length === 0) {
    return { ok: false, error: "Mandá al menos un producto con el parámetro line." };
  }

  if (raw.length > MAX_LINES_PER_REQUEST) {
    return {
      ok: false,
      error: `Se pueden validar hasta ${MAX_LINES_PER_REQUEST} productos por request.`,
    };
  }

  const parsed = raw.map(parseCartLineRef);

  if (parsed.some((line) => line === null)) {
    return { ok: false, error: "Alguno de los productos enviados no tiene un formato válido." };
  }

  return {
    ok: true,
    lines: parsed.filter((line): line is CartLineReference => line !== null),
  };
};

const noStore = { "Cache-Control": "no-store, max-age=0" } as const;

export async function GET(request: Request): Promise<NextResponse> {
  const parsed = parseRequest(new URL(request.url).searchParams);

  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400, headers: noStore });
  }

  try {
    // El punto de composición (repositorio + servicio) es el composition
    // root de `@/server/services`: el handler solo parsea y responde.
    const result = await validatePublicCartLines(parsed.lines);

    // `new Date()` acá y no en el mensaje de la Tarea 12: `checkedAt` es
    // metadata de la respuesta HTTP, no contenido del pedido.
    return NextResponse.json(
      { ok: true, ...result, checkedAt: new Date().toISOString() },
      { headers: noStore },
    );
  } catch (error) {
    console.error("[api:cart/validate]", error);
    // ⛔ Mensaje genérico al cliente: un `error.message` de Prisma
    // publicaría la cadena de conexión en el navegador.
    return NextResponse.json(
      { ok: false, error: "No pudimos validar el carrito." },
      { status: 500, headers: noStore },
    );
  }
}
