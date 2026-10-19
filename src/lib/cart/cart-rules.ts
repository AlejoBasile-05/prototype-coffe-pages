/**
 * Las ocho reglas del carrito. Funciones puras: mismas entradas, misma
 * salida, sin React, sin Zustand, sin `localStorage`. Cada una devuelve
 * un `CartState` nuevo; ninguna muta el recibido.
 *
 * Decisiones:
 *
 * · `getLineKey` es la identidad de la línea: `productId` + `variantId`.
 *   Un café chico y uno grande del mismo producto son dos líneas.
 *
 * · `addItemToCart` no toca el precio de una línea existente: el
 *   carrito es una foto del momento de armado y la Tarea 13 revalida.
 *
 * · `addItemToCart` ignora un producto agotado: devuelve el mismo
 *   estado y la UI mapea el resultado a un toast.
 *
 * · `updateItemQuantity` con cantidad cero o negativa QUITA la línea:
 *   no existen líneas en cero.
 *
 * · `calculateCartSubtotal` redondea una sola vez, al final: redondear
 *   por línea y después sumar da totales que no cuadran.
 */
import { roundCurrency } from "@/lib/format/currency";

import {
  MAX_DISTINCT_LINES,
  MAX_QUANTITY_PER_ITEM,
  type CartLine,
  type CartState,
} from "./cart-types";

export function getLineKey(line: Pick<CartLine, "productId" | "variantId">): string {
  return `${line.productId}:${line.variantId ?? ""}`;
}

export function mergeLine(line: CartLine, existing: CartLine): CartLine {
  return {
    ...existing,
    available: line.available,
    quantity: Math.min(existing.quantity + line.quantity, MAX_QUANTITY_PER_ITEM),
  };
}

export function addItemToCart(state: CartState, line: CartLine): CartState {
  if (!line.available) {
    return state;
  }

  const normalized: CartLine = {
    ...line,
    quantity: Math.min(Math.max(1, Math.trunc(line.quantity)), MAX_QUANTITY_PER_ITEM),
  };

  const key = getLineKey(normalized);
  const index = state.lines.findIndex((current) => getLineKey(current) === key);

  if (index === -1) {
    if (state.lines.length >= MAX_DISTINCT_LINES) {
      return state;
    }

    return { lines: [...state.lines, normalized] };
  }

  const current = state.lines[index];
  if (current === undefined) {
    return state;
  }

  const lines = [...state.lines];
  lines[index] = mergeLine(normalized, current);

  return { lines };
}

export function removeItemFromCart(
  state: CartState,
  productId: string,
  variantId: string | null,
): CartState {
  const key = getLineKey({ productId, variantId });

  return {
    lines: state.lines.filter((line) => getLineKey(line) !== key),
  };
}

export function updateItemQuantity(
  state: CartState,
  productId: string,
  variantId: string | null,
  quantity: number,
): CartState {
  const key = getLineKey({ productId, variantId });
  const index = state.lines.findIndex((line) => getLineKey(line) === key);

  if (index === -1) {
    return state;
  }

  if (quantity <= 0) {
    return removeItemFromCart(state, productId, variantId);
  }

  const current = state.lines[index];
  if (current === undefined) {
    return state;
  }

  const lines = [...state.lines];
  lines[index] = {
    ...current,
    quantity: Math.min(Math.trunc(quantity), MAX_QUANTITY_PER_ITEM),
  };

  return { lines };
}

export function clearCart(): CartState {
  return { lines: [] };
}

export function isCartEmpty(state: CartState): boolean {
  return state.lines.length === 0;
}

export function getCartItemCount(state: CartState): number {
  return state.lines.reduce((total, line) => total + line.quantity, 0);
}

export function calculateCartSubtotal(state: CartState): number {
  const raw = state.lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);

  return roundCurrency(raw);
}
