"use client";

/**
 * Store de disponibilidad en tiempo real (Tarea 15 §6.1). Solo guarda
 * `id → isAvailable`, sin contenido y sin `persist`: en un refresh el
 * HTML del servidor ya trae el valor, y duplicarlo acá generaría dos
 * fuentes de verdad que podrían diverger. Ver §4.4 y §5.1.
 */
import { create } from "zustand";

interface AvailabilityState {
  /** Última disponibilidad conocida por push. */
  byProductId: Record<string, boolean>;
  applyAvailability: (id: string, isAvailable: boolean) => void;
  /** Reset al estado inicial (tests y desmontaje del bridge). */
  clearAvailability: () => void;
}

export const useAvailabilityStore = create<AvailabilityState>()((set) => ({
  byProductId: {},

  applyAvailability: (id, isAvailable) =>
    set((state) => {
      // Devolver el MISMO estado hace que Zustand no notifique: es lo
      // que separa "llegó un evento" de "cambió algo" (§5.2).
      if (state.byProductId[id] === isAvailable) return state;
      return { byProductId: { ...state.byProductId, [id]: isAvailable } };
    }),

  clearAvailability: () => set({ byProductId: {} }),
}));

/**
 * Selector fino (§4.3): re-renderiza SOLO la card cuyo valor cambió.
 * `inicial` es el snapshot del HTML del servidor cuando el store
 * todavía no tiene el producto (ver §2.1).
 */
export const useProductAvailability = (id: string, inicial: boolean): boolean =>
  useAvailabilityStore((state) => state.byProductId[id] ?? inicial);
