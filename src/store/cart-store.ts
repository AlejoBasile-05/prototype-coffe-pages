"use client";

/**
 * Store del carrito. Envoltura fina sobre `cart-rules`: el estado se
 * transforma solo con las funciones puras del dominio.
 *
 * · El store no guarda ni el subtotal ni la cantidad de artículos: son
 *   valores derivados de `lines` y duplicarlos en el estado es la forma
 *   más corta de que dejen de coincidir.
 *
 * · `addItem` devuelve un resultado en vez de disparar el toast: el
 *   store no sabe que existen los toasts, y eso es lo que permite
 *   probarlo aislado. La UI mapea el resultado a un mensaje.
 *
 * · `skipHydration: true`: la rehidratación la dispara `CartHydrator`
 *   en un `useEffect`, nunca en el render. Sin esto, el primer HTML del
 *   servidor y el del cliente no coinciden.
 *
 * · `safeStorage` prueba `localStorage` antes de confiar en él: Safari
 *   en modo privado tira `QuotaExceededError` al escribir, y sin la
 *   prueba el `persist` revienta en el primer agregado. El fallback en
 *   memoria mantiene la app viva aunque el carrito se pierda al
 *   recargar.
 *
 * · `merge` descarta en silencio lo que no valida contra el esquema:
 *   perder el carrito es una molestia menor; una app que no arranca
 *   por un `localStorage` corrupto es una caída.
 *
 * · `partialize` persiste solo `lines`: `isOpen` es estado de interfaz
 *   y recargar con el Sheet abierto dejaría el scroll del body trabado
 *   sobre un panel que el usuario no pidió.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  addItemToCart,
  clearCart as clearCartRules,
  getLineKey,
  removeItemFromCart as removeLine,
  updateItemQuantity as setLineQuantity,
} from "@/lib/cart/cart-rules";
import { CART_STORAGE_VERSION, persistedCartSchema } from "@/lib/cart/cart-schema";
import { MAX_DISTINCT_LINES, type CartLine, type CartState } from "@/lib/cart/cart-types";

export type AddItemOutcome =
  | { status: "added" }
  | { status: "merged" }
  | { status: "unavailable" }
  | { status: "limit-reached" };

interface CartStore extends CartState {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  addItem: (line: CartLine) => AddItemOutcome;
  removeItem: (productId: string, variantId: string | null) => void;
  setQuantity: (productId: string, variantId: string | null, quantity: number) => void;
  clear: () => void;
}

const memoryStorage = new Map<string, string>();

function safeStorage() {
  try {
    window.localStorage.setItem("__cartroca_probe__", "1");
    window.localStorage.removeItem("__cartroca_probe__");

    return window.localStorage;
  } catch {
    return {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memoryStorage.set(key, value);
      },
      removeItem: (key: string) => {
        memoryStorage.delete(key);
      },
    };
  }
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      lines: [],
      isOpen: false,

      setOpen: (open) => {
        set({ isOpen: open });
      },

      addItem: (line) => {
        if (!line.available) {
          return { status: "unavailable" };
        }

        const { lines } = get();
        const key = getLineKey(line);
        const exists = lines.some((current) => getLineKey(current) === key);

        if (!exists && lines.length >= MAX_DISTINCT_LINES) {
          return { status: "limit-reached" };
        }

        set({ lines: addItemToCart({ lines }, line).lines });

        return { status: exists ? "merged" : "added" };
      },

      removeItem: (productId, variantId) => {
        set({
          lines: removeLine({ lines: get().lines }, productId, variantId).lines,
        });
      },

      setQuantity: (productId, variantId, quantity) => {
        set({
          lines: setLineQuantity({ lines: get().lines }, productId, variantId, quantity).lines,
        });
      },

      clear: () => {
        set(clearCartRules());
      },
    }),
    {
      name: "cartroca:v1",
      version: CART_STORAGE_VERSION,
      storage: createJSONStorage(safeStorage),
      skipHydration: true,
      partialize: (state) => ({ lines: state.lines }),
      merge: (persisted, current) => {
        const result = persistedCartSchema.safeParse(persisted);

        return result.success ? { ...current, lines: result.data.state.lines } : current;
      },
    },
  ),
);
