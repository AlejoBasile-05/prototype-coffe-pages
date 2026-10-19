"use client";

/**
 * Dispara la rehidratación del carrito después del montaje. Con
 * `skipHydration: true` el primer render del servidor y del cliente
 * son iguales (carrito vacío), y el `useEffect` carga lo persistido
 * después, sin aviso de hidratación.
 */
import { useEffect, type ReactNode } from "react";

import { useCartStore } from "@/store/cart-store";

export function CartHydrator({ children }: { children?: ReactNode }) {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  return <>{children}</>;
}
