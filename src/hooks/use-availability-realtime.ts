"use client";

/**
 * Suscripción a la disponibilidad de productos en tiempo real (Tarea 15).
 *
 * ⛔ SOLO LECTURA. El WebSocket es un canal de una sola dirección: este
 *    hook nunca escribe, nunca llama a una action y nunca toca la base.
 *    El único camino de escritura es `toggleProductAvailabilityAction`
 *    (Tarea 14 §6.5). Ver §4.2.
 */
import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ⛔ Excepción acotada de la frontera de capas, ver `eslint.config.mjs`.
import { supabaseBrowser } from "@/server/infra/supabase/client";
import { useAvailabilityStore } from "@/store/availability-store";

/** Canal compartido por el catálogo público y el panel. Ver §5.3. */
const CHANNEL_NAME = "catalog-availability";

/** Fila mínima que el hook necesita del evento. Nunca más que eso. */
export interface ProductAvailabilityEvent {
  id: string;
  isAvailable: boolean;
  /** El payload trae la fila entera; el resto de las columnas se ignora. */
  [columna: string]: unknown;
}

/**
 * ⛔ Type guard, no un `as`. El payload de `postgres_changes` viene
 *    tipado como `Record<string, any>` por la librería, y heredarlo con
 *    un cast sería propagar ese `any` a todo el hook. El guard repite el
 *    chequeo en runtime y devuelve un tipo que sí se puede usar. Ver §7.
 */
const esEventoDeDisponibilidad = (
  valor: Record<string, unknown>,
): valor is ProductAvailabilityEvent =>
  typeof valor.id === "string" && typeof valor.isAvailable === "boolean";

/**
 * Texto seguro del error del canal. El objeto completo de un error de
 * Realtime puede arrastrar metadatos de la conexión (y con ellos la URL
 * del proyecto y hasta la clave anónima en el query interno). Solo se
 * registra el mensaje; el detalle completo vive en el dashboard de
 * Supabase, no en el registro del navegador. Ver §8.5.
 */
const mensajeDeErrorSeguro = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Se suscribe a los cambios de `isAvailable` de `products` y los aplica
 * al store. Una suscripción por pestaña.
 *
 * La dependencia del `useEffect` es `applyAvailability`: Zustand
 * devuelve una función estable, así que el efecto no se re-suscribe en
 * cada render. Si en su lugar se pusiera el store entero, el efecto se
 * dispararía en cada cambio de disponibilidad y se abriría una
 * suscripción por evento.
 */
/**
 * Config de Realtime presente (y bien formada) o no.
 *
 * La demo local puede correr sin proyecto de Supabase configurado
 * (`.env.local` con placeholders): en ese caso no hay suscripción y la
 * web funciona con el snapshot del SSR, que es un estado coherente.
 * El chequeo es de URL válida, no de string vacío: "PENDIENTE" rompe
 * `createBrowserClient` antes de que el canal exista.
 */
export const realtimeConfigPresente = (): boolean => {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "";
  try {
    return anonKey !== "" && new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};

export const useAvailabilityRealtime = (): void => {
  const applyAvailability = useAvailabilityStore((state) => state.applyAvailability);

  useEffect(() => {
    if (!realtimeConfigPresente()) {
      // Degradación elegida, no silencio: un aviso en consola explica
      // por qué la disponibilidad no se actualiza sola en este ambiente.
      console.info(
        "[realtime] Supabase sin configurar en este ambiente: el catálogo " +
          "funciona con el estado del servidor, sin actualizaciones en vivo.",
      );
      return;
    }

    const channel: RealtimeChannel = supabaseBrowser()
      .channel(CHANNEL_NAME)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "products",
          // Sin filtro: el servidor decide qué se publica. Filtrar por
          // id acá implicaría mantener una lista de ids que se
          // desactualiza sola, que es peor que recibir de más.
        },
        (payload: { new: Record<string, unknown> }) => {
          // El guard va ANTES de usar los campos. Un evento sin `id` se
          // descarta en vez de escribir `undefined` como clave del store.
          if (!esEventoDeDisponibilidad(payload.new)) return;

          applyAvailability(payload.new.id, payload.new.isAvailable);
        },
      )
      .on("error", (error: unknown) => {
        // Un canal caído no es un error de usuario: el snapshot del HTML
        // sigue siendo un estado coherente. Ver §5.5 y §8.5.
        console.warn(
          `[realtime] error en el canal ${CHANNEL_NAME}: ${mensajeDeErrorSeguro(error)}`,
        );
      })
      .subscribe();

    return () => {
      // Con StrictMode el cleanup corre en el desmontaje intermedio: sin
      // esto, la primera suscripción queda viva para siempre. Ver §5.4.
      void supabaseBrowser().removeChannel(channel);
    };
  }, [applyAvailability]);
};
