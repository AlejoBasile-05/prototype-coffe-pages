"use client";

/**
 * Bridge del estado abierto/cerrado: NO renderiza nada; computa el estado
 * en el navegador y lo escribe en `open-state-store`.
 *
 * ⛔ POR QUÉ ES CLIENTE: las páginas públicas se sirven desde la caché
 *    ISR (`revalidate: 3600`). Si el estado se computara en el servidor,
 *    una página generada a las 12:00 seguiría diciendo "abierto" a las
 *    21:30. El servidor solo pasa los HORARIOS (dato estático); la hora
 *    la mira el navegador, cada minuto, así un local que cierra mientras
 *    el cliente mira el menú pasa a "cerrado" sin recargar.
 *
 * Se monta una vez por pestaña en el layout público, al igual que
 * `AvailabilityRealtimeBridge`. Mismo patrón, mismo motivo.
 */
import { useEffect } from "react";

import { getOpenState, type OpeningHours } from "@/lib/domain";
import { useOpenStateStore } from "@/store/open-state-store";

/** Re-eval por minuto: no por frame (desperdicio) ni por hora (se nota). */
const REEVALUAR_CADA_MS = 60_000;

export function OpenStateBridge({ hours }: { hours: OpeningHours }) {
  const aplicar = useOpenStateStore((state) => state.aplicar);

  useEffect(() => {
    const evaluar = () => aplicar(getOpenState(hours, new Date()));
    evaluar();
    // El intervalo vive dentro del efecto: con StrictMode el primer
    // intervalo muere con el montaje intermedio y no queda doble reloj.
    const intervalo = setInterval(evaluar, REEVALUAR_CADA_MS);
    return () => clearInterval(intervalo);
  }, [hours, aplicar]);

  return null;
}
