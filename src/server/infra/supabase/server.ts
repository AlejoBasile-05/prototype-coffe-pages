/**
 * Cliente Supabase para el servidor, con gestión de cookies.
 *
 * ⚠️ NO es `supabaseAdmin`: ese usa `service_role` y bypasea RLS.
 *    Acá va la `anon` key, que es segura porque las políticas RLS son
 *    las que protegen los datos (defensa en profundidad, Tarea 19).
 *
 * Por qué `getAll`/`setAll` y no `cookies().set()` suelto: la API de
 * `@supabase/ssr` existe justamente para que el `Set-Cookie` del refresh
 * del token llegue a la respuesta en un Server Component o Route Handler.
 *
 * ⛔ No cachear con `React.cache` ni a nivel de módulo: cada request
 *    tiene sus cookies.
 */
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const supabaseServer = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "",
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // ⛔ Se traga el error a propósito.
            //
            // `cookies().set()` lanza cuando se lo llama desde un Server
            // Component (solo se permite escribir desde un Route Handler o
            // una Server Action). Eso pasa cuando el layout de admin llama
            // a `verifyAdminSession` durante el render (Tarea 14). El
            // refresh del token lo hace el proxy (`proxy.ts`), así que
            // perder este `Set-Cookie` no deja al usuario sin sesión:
            // degrada a "el token se renueva en el próximo request".
            //
            // Sin este catch, el panel entero tira 500 en producción y el
            // error real no dice nada de cookies.
          }
        },
      },
    },
  );
};
