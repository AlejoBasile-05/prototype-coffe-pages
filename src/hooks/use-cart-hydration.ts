"use client";

/**
 * Devuelve `true` cuando la rehidratación del carrito terminó. Es lo
 * que distingue "cargando" de "vacío": sin él, el Sheet mostraría "tu
 * carrito está vacío" en el frame en que todavía está leyendo el
 * `localStorage` persistido.
 */
import { useEffect, useState } from "react";

import { useCartStore } from "@/store/cart-store";

export function useCartHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsubscribe = useCartStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    void useCartStore.persist.rehydrate();

    return unsubscribe;
  }, []);

  return hydrated;
}
