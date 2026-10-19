"use client";

/**
 * Store del estado "abierto/cerrado" del local (Tarea: estado horario).
 *
 * Mismo patrón que `availability-store`: un store diminuto de Zustand que
 * no sabe de horarios ni de relojes — solo guarda el último `OpenState`
 * calculado. Quien lo ESCRIBE es `OpenStateBridge` (única escritura);
 * quienes lo LEEN son `OpenStateBanner`, `AddToCartButton` y el checkout.
 *
 * El estado inicial es `null`: "todavía no computado". Los consumidores
 * tratan `null` como abierto (no bloquear por defecto sería peor para la
 * conversión) y el banner simplemente no renderiza hasta saber.
 */
import { create } from "zustand";

import type { OpenState } from "@/lib/domain";

interface OpenStateStore {
  readonly estado: OpenState | null;
  readonly aplicar: (estado: OpenState | null) => void;
}

export const useOpenStateStore = create<OpenStateStore>((set) => ({
  estado: null,
  aplicar: (estado) => set({ estado }),
}));

/** Selector estable: true solo si SABEMOS que está cerrado. */
export const useEstaCerrado = (): boolean =>
  useOpenStateStore((state) => state.estado?.estado === "cerrado");
