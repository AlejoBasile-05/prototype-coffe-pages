/**
 * Cliente Supabase de navegador.
 *
 * ⚠️ En esta tarea (07) NO se usa para nada. Queda preparado para la
 *    suscripción Realtime de la Tarea 15, que sí necesita un cliente en
 *    el navegador.
 *
 * ⛔ Solo se exportan `NEXT_PUBLIC_*`. Si este archivo llegara a leer
 *    `SUPABASE_SERVICE_ROLE_KEY`, ese string viajaría al bundle del
 *    cliente, y es la llave maestra de la base.
 */
"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Se llama desde un Client Component.
 *
 * ⛔ NO llamar en un Server Component ni en un Route Handler: ahí existe
 *    `supabaseServer`, que sí puede escribir cookies.
 *
 * La variable es a nivel de módulo a propósito: si se creara un cliente
 * por render, cada montaje abriría una conexión nueva a Supabase.
 */
let cliente: ReturnType<typeof createBrowserClient> | undefined;

export const supabaseBrowser = () => {
  cliente ??= createBrowserClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "",
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "",
  );
  return cliente;
};
