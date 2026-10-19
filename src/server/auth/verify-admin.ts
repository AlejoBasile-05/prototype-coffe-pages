/**
 * Verificación de sesión del administrador.
 *
 * ⛔ ESTA ES LA FRONTERA DE SEGURIDAD DEL PANEL.
 *
 * Toda Server Action del admin la llama PRIMERO. El proxy (`proxy.ts`)
 * no la reemplaza: el proxy es UX, esto es seguridad (Tarea 07 §4.2).
 */
import "server-only";

import { toAdminRole, UnauthorizedError } from "@/lib/domain";
import type { AdminSession } from "@/lib/domain";
import { supabaseServer } from "@/server/infra/supabase/server";
import { findStaffById } from "@/server/repositories/staff.repository";

/**
 * Devuelve la sesión del admin o `null`.
 *
 * Hace TRES comprobaciones, en orden, y corta en la primera que falla:
 *
 *   1. `supabase.auth.getUser()` valida el token **contra el servidor de
 *      Supabase** (ver abajo por qué no `getSession`).
 *   2. `findStaffById(user.id)` busca la fila en `staff_members`.
 *   3. Sin fila → `null`. El usuario existe pero no está autorizado.
 *
 * ## Por qué `getUser()` y no `getSession()`  ← leer antes de tocar
 *
 * `getSession()` **no hace ninguna llamada de red**: lee la cookie y la
 * valida solo con la firma criptográfica. Un token revocado, o uno de un
 * usuario borrado del panel de Supabase, sigue siendo criptográficamente
 * válido hasta su vencimiento.
 *
 * `getUser()` hace un `GET /auth/v1/user` con el token. Cuesta ~100 ms
 * y devuelve `401` si el token está revocado o el usuario ya no existe.
 * En un panel de 2 o 3 personas con operaciones de baja frecuencia,
 * 100 ms es nada; la alternativa es dejar entrar a un ex-empleado.
 *
 * ## Por qué falla cerrada
 *
 * Si `getUser()` falla por caída de red, devuelve `error` y acá se
 * devuelve `null`. El usuario ve "sesión expirada" y vuelve a entrar.
 * Degradar a "autorizado" convertiría un problema de infraestructura en
 * una brecha de seguridad.
 */
export const verifyAdminSession = async (): Promise<AdminSession | null> => {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.auth.getUser();

  if (error !== null) {
    return null;
  }

  const user = data.user;
  if (user === null || user.email === undefined || user.email === "") {
    return null;
  }

  // Segunda capa: existir en `auth.users` NO alcanza. Tiene que estar en
  // `staff_members`. Esta consulta es la que permite dar de baja a alguien
  // sin borrar su cuenta de Supabase.
  const staff = await findStaffById(user.id);
  if (staff === null) {
    return null;
  }

  return {
    userId: staff.id,
    email: staff.email,
    role: toAdminRole(staff.role),
  };
};

/**
 * Igual que `verifyAdminSession`, pero lanza en vez de devolver `null`.
 *
 * Para Route Handlers, donde no hay formulario al que devolverle un
 * estado de error: se traduce a un `401` en el `catch`.
 */
export const requireAdminSession = async (): Promise<AdminSession> => {
  const session = await verifyAdminSession();
  if (session === null) {
    throw new UnauthorizedError("Sesión de administrador no válida o expirada.");
  }
  return session;
};
