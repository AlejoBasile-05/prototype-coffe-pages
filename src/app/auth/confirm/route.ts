/**
 * Route Handler del link de recuperación de contraseña (Tarea 24).
 *
 * El mail de Supabase llega con un link de UN SOLO USO y dos formatos
 * posibles según la plantilla configurada en el dashboard:
 *
 *   a) `…/auth/confirm?token_hash=…&type=recovery` (recomendado, OTP)
 *   b) `…/auth/confirm?code=…` (PKCE, si la plantilla sigue usando
 *      `{{ .ConfirmationURL }}` sin tocar)
 *
 * Acá se intercambia cualquiera de los dos por una sesión de recovery y
 * se manda al usuario a elegir la contraseña nueva.
 *
 * ⛔ NUNCA se redirige con el error de Supabase en la URL: el detalle
 *    (`error_code`, `error_description`) queda en el log del servidor. Al
 *    navegador va un motivo amable y genérico — el link venció o ya se
 *    usó — porque los códigos crudos le confirman a un atacante qué
 *    estado tiene el token que robó.
 */
import { NextResponse, type NextRequest } from "next/server";

import {
  haySesionDeRecovery,
  intercambiarCodigoRecovery,
  verificarTokenRecovery,
} from "@/server/auth/recovery";

const ERROR_DESTINO = "/login?error=link-invalido";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  // ⛔ Sin open redirect: los destinos son CONSTANTES del servidor. La
  //    query `next` del querystring jamás se usa para redirigir acá.
  if (type === "recovery" && tokenHash !== null && tokenHash !== "") {
    const ok = await verificarTokenRecovery(tokenHash);
    return NextResponse.redirect(new URL(ok ? "/nueva-contrasena" : ERROR_DESTINO, origin));
  }

  if (code !== null && code !== "") {
    const ok = await intercambiarCodigoRecovery(code);
    return NextResponse.redirect(new URL(ok ? "/nueva-contrasena" : ERROR_DESTINO, origin));
  }

  // Ni token_hash ni code: puede ser el flujo IMPLÍCITO (tokens en el
  // `#fragmento`, invisibles para el servidor). Se redirige a la pantalla
  // que lo lee en el navegador: una redirección HTTP sin fragmento propio
  // CONSERVA el que traía la URL original, así que el hash llega entero.
  // Si ya hay una sesión válida, ni hace falta ir por el hash.
  if (await haySesionDeRecovery()) {
    return NextResponse.redirect(new URL("/nueva-contrasena", origin));
  }
  return NextResponse.redirect(new URL("/auth/hash", origin));
}
