/**
 * POST /auth/session — canje de tokens de recovery por cookies (Tarea 24).
 *
 * Lo llama SOLO `HashRecovery` con los tokens que llegaron en el fragmento
 * de la URL. Server-side se hace `setSession()` para que las cookies
 * httpOnly del SSR queden escritas y `/nueva-contrasena` las vea.
 *
 * Defensas:
 *   · Same-origin: el `Origin` del POST tiene que ser el host que sirve.
 *     Un cross-origin podría fijar SESIÓN propia en el navegador de otra
 *     persona (session fixation asistida): el daño es confundir a la
 *     víctima sobre con qué cuenta está operando.
 *   · El token se VALIDA contra el servidor de Auth: `setSession` con un
 *     token basura no puede producir una sesión útil, pero validar acá
 *     evita responder 200 a un intento fallido.
 *   · El cuerpo es JSON con tamaño acotado: los JWT de Supabase no pasan
 *     de unos pocos KB, así que más grande es inválido por construcción.
 */
import { NextResponse, type NextRequest } from "next/server";

import { fijarSesionDeRecovery } from "@/server/auth/recovery";

const MAX_TOKEN_LENGTH = 8192;
const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Same-origin estricto: sin Origin (curl, navegadores viejos) se rechaza
  // también — el único cliente legítimo es el fetch del propio sitio.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin === null || host === null) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  let origenEsPropio = false;
  try {
    origenEsPropio = new URL(origin).host === host;
  } catch {
    origenEsPropio = false;
  }
  if (!origenEsPropio) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const crudo = await request.text();
  if (crudo.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let payload: { access_token?: unknown; refresh_token?: unknown };
  try {
    payload = JSON.parse(crudo) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (
    typeof payload.access_token !== "string" ||
    typeof payload.refresh_token !== "string" ||
    payload.access_token.length === 0 ||
    payload.access_token.length > MAX_TOKEN_LENGTH ||
    payload.refresh_token.length === 0 ||
    payload.refresh_token.length > MAX_TOKEN_LENGTH
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // El canje incluye la confirmación contra el servidor de Auth (ver
  // el módulo): un 200 acá significa sesión válida de verdad.
  const ok = await fijarSesionDeRecovery(payload.access_token, payload.refresh_token);

  return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
}
