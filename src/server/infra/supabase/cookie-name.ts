/**
 * ⛔ Módulo SIN `import "server-only"` a propósito.
 *
 * `proxy.ts` (el middleware de Next 16) corre en Edge y no puede importar
 * nada marcado como servidor. El nombre de la cookie lo necesitan los dos
 * lados, así que vive acá, en un módulo neutro, y ambos lo importan.
 *
 * Supabase nombra la cookie `sb-<project-ref>-auth-token`, donde el
 * `<project-ref>` sale de la URL del proyecto:
 *
 *   https://abcdefghijklm.supabase.co  ->  sb-abcdefghijklm-auth-token
 */

export const buildSupabaseCookieName = (
  supabaseUrl: string | undefined = process.env["NEXT_PUBLIC_SUPABASE_URL"],
): string => `sb-${extractProjectRef(supabaseUrl)}-auth-token`;

const extractProjectRef = (supabaseUrl: string | undefined): string => {
  if (supabaseUrl === undefined || supabaseUrl === "") return "placeholder";
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] ?? "placeholder";
  } catch {
    // Una URL mal formada no debe romper el arranque del servidor.
    return "placeholder";
  }
};
