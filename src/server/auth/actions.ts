/**
 * Server Actions de autenticación.
 *
 * Plantilla de las Server Actions del proyecto: autorizar → validar →
 * delegar → revalidar. Acá la excepción es que no hay sesión que
 * autorizar todavía: es el login. Se valida igual, porque el cliente
 * nunca es confiable.
 */
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LoginSchema, MagicLinkSchema, PasswordResetSchema } from "@/server/schemas/auth.schema";
import { supabaseServer } from "@/server/infra/supabase/server";
import { verifyAdminSession } from "@/server/auth/verify-admin";
import { sanitizeNextPath } from "@/lib/validation/ruta-retorno";

export type AuthActionResult =
  | { readonly ok: true; readonly message: string }
  | {
      readonly ok: false;
      readonly error: string;
      readonly fieldErrors?: Record<string, readonly string[]>;
    };

const leerDestinoSeguro = (formData: FormData): string => {
  const valor = formData.get("next");
  return sanitizeNextPath(valor === null ? null : String(valor));
};

const erroresDeFormulario = (error: {
  flatten(): { fieldErrors: Record<string, string[] | undefined> };
}): AuthActionResult => {
  const plano = error.flatten().fieldErrors;
  const fieldErrors: Record<string, readonly string[]> = {};
  for (const [campo, mensajes] of Object.entries(plano)) {
    if (mensajes !== undefined) fieldErrors[campo] = mensajes;
  }
  return { ok: false, error: "Revisá los datos del formulario.", fieldErrors };
};

/**
 * Login con email y contraseña.
 *
 * ⚠️ MENSAJE GENÉRICO A PROPÓSITO. "Credenciales inválidas" es la misma
 *    respuesta para email inexistente, contraseña incorrecta y cuenta sin
 *    confirmar. Con mensajes distintos, la pantalla se convierte en un
 *    formulario de enumeración de cuentas.
 *
 *    La enumeración no desaparece con un mensaje genérico: se atenúa. La
 *    defensa fuerte es el rate limiting de Supabase (Tarea 19).
 */
export async function loginAction(
  _estadoAnterior: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return erroresDeFormulario(parsed.error);
  }

  const destino = leerDestinoSeguro(formData);
  const supabase = await supabaseServer();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error !== null) {
    return { ok: false, error: "Credenciales inválidas." };
  }

  // El login fue exitoso, pero puede que ese usuario no esté autorizado.
  // Se revalida contra `staff_members` antes de dejarlo avanzar.
  const session = await verifyAdminSession();
  if (session === null) {
    // Se cierra la sesión que se acaba de abrir: dejarla viva sería dejar
    // un token válido para alguien que no tiene fila en `staff_members`.
    await supabase.auth.signOut();
    return {
      ok: false,
      error: "Tu cuenta no tiene acceso al panel. Pedile al encargado que te habilite.",
    };
  }

  // ⚠️ `redirect()` FUERA de cualquier try/catch: internamente lanza una
  //    excepción con digest especial y un catch genérico la traga y la
  //    convierte en un error de login.
  redirect(destino);
}

export async function loginWithMagicLinkAction(
  _estadoAnterior: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = MagicLinkSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return erroresDeFormulario(parsed.error);
  }

  const supabase = await supabaseServer();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // ⛔ `shouldCreateUser: false`: el link mágico NO puede dar de alta
      //    a cualquiera que conozca la URL del login. Solo entra quien ya
      //    tiene cuenta en `auth.users`, y aun así necesita la fila en
      //    `staff_members` (verifyAdminSession).
      shouldCreateUser: false,
      emailRedirectTo: `${process.env["NEXT_PUBLIC_SITE_URL"] ?? ""}/admin`,
    },
  });

  if (error !== null) {
    console.error("[action:loginWithMagicLink]", error);
    return { ok: false, error: "No se pudo enviar el email. Intentá de nuevo." };
  }

  // Mismo mensaje exista o no el email: revelar la diferencia permitiría
  // enumerar las cuentas del local.
  return { ok: true, message: "Si el email está registrado, te enviamos un link." };
}

export async function logoutAction(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

/* ═══════════════ Recuperación de contraseña (Tarea 24) ═══════════════ */

/**
 * Pide el email de recuperación.
 *
 * ⚠️ Dos clases de resultado, y se dicen distinto:
 *
 *    · ÉXITO o email inexistente → mensaje genérico. La anti-enumeración
 *      la garantiza el propio Supabase (responde igual exista o no la
 *      cuenta), así que el éxito acá es honesto.
 *    · ERROR de infraestructura (URL inválida, redirect no permitido,
 *      rate limit) → se MUESTRA el fallo. Esconder un "no se envió nada"
 *      detrás de un "te enviamos el link" deja al usuario esperando un
 *      correo que nunca va a llegar — exactamente el bug que motivó este
 *      cambio. Revelar "el servidor no pudo enviar" no revela nada sobre
 *      qué cuentas existen.
 */
export async function requestPasswordResetAction(
  _estadoAnterior: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = MagicLinkSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return erroresDeFormulario(parsed.error);
  }

  const supabase = await supabaseServer();

  /**
   * ⛔ El redirect va con el ORIGEN DEL REQUEST, no con NEXT_PUBLIC_SITE_URL.
   *
   * En desarrollo el puerto cambia (3000 ocupado → 3001) y una constante
   * de entorno queda apuntando a un servidor que no existe: el mail llega,
   * el link abre y el navegador dice "this site can't be reached". Fue el
   * bug real del 2026-10-08.
   *
   * Es seguro: Supabase SOLO redirige a URLs de su whitelist de Redirect
   * URLs del dashboard, así que un `origin` falseado en el header produce
   * un error visible de Supabase, no un open redirect.
   */
  const cabeceras = await headers();
  const origen =
    cabeceras.get("origin") ?? process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    // Aterriza en el Route Handler que intercambia el token por sesión.
    // Sin esta ruta declarada en "Redirect URLs" del dashboard, Supabase
    // cae a la Site URL y el flujo muere con otp_expired en pantalla.
    redirectTo: `${origen}/auth/confirm`,
  });

  if (error !== null) {
    console.error("[action:requestPasswordReset]", error);
    return {
      ok: false,
      error: "No pudimos enviar el email de recuperación. Esperá unos minutos e intentá de nuevo.",
    };
  }

  return { ok: true, message: "Si el email está registrado, te enviamos un link." };
}

/**
 * Cambia la contraseña con la sesión de recovery que abrió
 * `/auth/confirm`.
 *
 * ⛔ El control de acceso acá es la SESIÓN de recovery: `getUser()` la
 *    valida contra el servidor de Supabase (no solo la firma local, como
 *    en `verifyAdminSession`). NO se pide staff: quien recupera la
 *    contraseña puede no estar habilitado todavía y cambiar su clave es
 *    su derecho igual. Lo que NO puede es entrar al panel: eso lo sigue
 *    garantizando `verifyAdminSession` en cada action admin.
 */
export async function updatePasswordAction(
  _estadoAnterior: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = PasswordResetSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return erroresDeFormulario(parsed.error);
  }

  const supabase = await supabaseServer();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return {
      ok: false,
      error: "El link venció o ya se usó. Pedí uno nuevo desde «Olvidé mi contraseña».",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error !== null) {
    console.error("[action:updatePassword]", error);
    return { ok: false, error: "No se pudo cambiar la contraseña. Intentá de nuevo." };
  }

  // ⛔ `redirect()` fuera de try/catch, igual que en loginAction.
  redirect("/admin");
}
