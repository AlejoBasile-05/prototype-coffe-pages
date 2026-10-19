/**
 * Sesión de recuperación de contraseña (Tarea 24).
 *
 * Encapsula los tres gestos de Supabase Auth que necesita el flujo, para
 * que las RUTAS (`/auth/confirm`, `/nueva-contrasena`) no importen la
 * capa de infraestructura directamente — la regla ESLint
 * `no-restricted-imports` lo prohíbe y este módulo es el punto de
 * encapsulación, al mismo nivel que `verify-admin.ts`.
 *
 * ⛔ Nada de esto autoriza el panel: una sesión de recovery permite
 *    cambiar la contraseña propia y NADA más. El acceso a `/admin` lo
 *    sigue decidiendo `verifyAdminSession()` con su fila de staff.
 */
import "server-only";

import { supabaseServer } from "@/server/infra/supabase/server";

/**
 * Formato OTP: la plantilla de mail recomendada apunta a
 * `/auth/confirm?token_hash=…&type=recovery`.
 */
export const verificarTokenRecovery = async (tokenHash: string): Promise<boolean> => {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });

  if (error !== null) {
    console.warn("[auth/recovery] token_hash rechazado:", error.message);
    return false;
  }
  return true;
};

/**
 * Formato PKCE: la plantilla por defecto (`{{ .ConfirmationURL }}`)
 * devuelve `?code=…`.
 */
export const intercambiarCodigoRecovery = async (code: string): Promise<boolean> => {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error !== null) {
    console.warn("[auth/recovery] código PKCE rechazado:", error.message);
    return false;
  }
  return true;
};

/**
 * ¿Hay sesión de recovery activa? Se valida con `getUser()`, que consulta
 * al servidor de Auth (no solo la firma local): un token revocado o un
 * usuario recién borrado no pasan.
 */
export const haySesionDeRecovery = async (): Promise<boolean> => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  return error === null && data.user !== null;
};

/**
 * Flujo implícito (tokens en el `#fragmento`): la pantalla `HashRecovery`
 * lee los tokens en el navegador y los manda a `POST /auth/session`;
 * acá se escriben como las cookies httpOnly del SSR y se CONFIRMAN
 * contra el servidor de Auth.
 *
 * Devuelve `true` solo si la sesión quedó válida de verdad: un
 * `setSession` aceptado localmente pero con token rechazado por el
 * servidor tiene que verse como fracaso, no como éxito.
 */
export const fijarSesionDeRecovery = async (
  accessToken: string,
  refreshToken: string,
): Promise<boolean> => {
  const supabase = await supabaseServer();

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error !== null) {
    console.warn("[auth/session] setSession rechazado:", error.message);
    return false;
  }

  return haySesionDeRecovery();
};
