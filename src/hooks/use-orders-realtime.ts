"use client";

/**
 * Suscripción del tablero de comandas a Realtime (Tarea 23).
 *
 * ⛔ SOLO LECTURA y SIN payload. A diferencia del hook de disponibilidad,
 *    el evento no se usa para pintar: una fila de `orders` no trae sus
 *    `order_items`, así que el evento funciona como SEÑAL ("algo cambió")
 *    y dispara un `router.refresh()` anti-rebote. Los datos completos los
 *    vuelve a traer el Server Component, que es la única fuente de verdad.
 *
 * Fallback: si Realtime no está configurado o el canal falla, el tablero
 * pasa a consultar cada 10 s (polling de `refresh`). La cocina nunca se
 * queda con una pantalla congelada sin saberlo: el componente muestra el
 * modo activo.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ⛔ Excepción acotada de la frontera de capas, igual que
//    `use-availability-realtime`: ver `eslint.config.mjs`.
import { supabaseBrowser } from "@/server/infra/supabase/client";
import { realtimeConfigPresente } from "@/hooks/use-availability-realtime";

const CHANNEL_NAME = "board-orders";

/** Rebote: varios eventos juntos (transición + insert) = un solo refresh. */
const REFRESH_DEBOUNCE_MS = 400;
/** Polling cuando no hay Realtime. */
const POLLING_INTERVAL_MS = 10_000;

export type BoardSyncMode = "realtime" | "polling";

/**
 * Sincroniza el tablero. Devuelve el modo activo por ref + callback para
 * que el componente lo muestre sin re-suscribir el canal en cada render.
 */
export const useOrdersRealtime = (onModeChange: (mode: BoardSyncMode) => void): void => {
  const router = useRouter();
  // Ref estable: el último callback gana sin re-suscribir el canal.
  // Ref estable: el último callback gana sin re-suscribir el canal.
  // La escritura va en un efecto: escribir un ref en el render lo
  // prohíbe el lint de React (y tiene razón: el render puede abortar).
  const modeChangeRef = useRef(onModeChange);
  useEffect(() => {
    modeChangeRef.current = onModeChange;
  }, [onModeChange]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = (): void => {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    };

    if (!realtimeConfigPresente()) {
      console.info(
        "[realtime] Supabase sin configurar: el tablero consulta cada 10 s.",
      );
      modeChangeRef.current("polling");
      const interval = setInterval(() => router.refresh(), POLLING_INTERVAL_MS);
      return () => clearInterval(interval);
    }

    modeChangeRef.current("realtime");

    const channel: RealtimeChannel = supabaseBrowser()
      .channel(CHANNEL_NAME)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => scheduleRefresh(),
      )
      .on("error", (error: unknown) => {
        console.warn(
          `[realtime] error en el canal ${CHANNEL_NAME}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      })
      .subscribe();

    return () => {
      // Con StrictMode el cleanup corre en el desmontaje intermedio.
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      void supabaseBrowser().removeChannel(channel);
    };
  }, [router]);
};
