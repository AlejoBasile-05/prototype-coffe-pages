"use client";

import { useAvailabilityRealtime } from "@/hooks/use-availability-realtime";

/**
 * Monta la suscripción de disponibilidad una vez por pestaña.
 *
 * No renderiza nada: existe para que el hook corra en un punto del árbol
 * que no dependa de que haya productos en pantalla (Tarea 15 §4.5). Si
 * el hook se llamara en el layout, no podría testearse en aislamiento:
 * haría falta montar header y footer junto con el test.
 */
export function AvailabilityRealtimeBridge(): null {
  useAvailabilityRealtime();
  return null;
}
