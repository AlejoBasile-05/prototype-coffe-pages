/**
 * Cliente Supabase con `service_role`. Uso EXCLUSIVAMENTE en servidor
 * y para tareas administrativas puntuales.
 *
 * ⛔ `service_role` BYPASEA todas las políticas RLS. Es la llave maestra.
 *    Su filtración permite leer y escribir toda la base de datos, incluyendo
 *    los productos en borrador.
 *
 * ⛔ Este archivo lleva `server-only`. Si se importa desde el cliente,
 *    el build falla. Esa es exactamente la garantía buscada.
 *
 * Cuándo usarlo (uso legítimo y acotado):
 *   - Crear el usuario administrador inicial (Tarea 07)
 *   - Ejecutar scripts de mantenimiento (Tarea 05, 21)
 *   - Backups programados
 *
 * Cuándo NO usarlo:
 *   - Para leer datos del catálogo. Para eso está el `anon` client
 *     (Tarea 15) o Prisma en los repositorios.
 *   - En cualquier Server Action. Nunca.
 */
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const createAdminClient = (): SupabaseClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const globalForSupabase = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined;
};

export const supabaseAdmin: SupabaseClient = globalForSupabase.supabaseAdmin ?? createAdminClient();

if (process.env.NODE_ENV === "development") {
  globalForSupabase.supabaseAdmin = supabaseAdmin;
}
