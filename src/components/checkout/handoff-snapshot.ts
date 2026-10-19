"use client";

/**
 * Lo que se guarda entre el submit y la pantalla de éxito.
 *
 * ⛔ Se guardan **datos, no el mensaje ya armado**: el texto se produce
 * en la pantalla de éxito, con las funciones puras de la Tarea 12, una
 * sola vez. Si se guardara el texto, el mismo pedido existiría en dos
 * lugares y la primera edición de una de las dos funciones rompería el
 * checkout en silencio. Los datos hacen falta porque el carrito ya está
 * limpio cuando se llega allá.
 */
import type { WhatsAppCartLine, WhatsAppCustomer } from "@/lib/whatsapp/message-contract";

/** Una versión por payload: cambiar la forma es cambiar la clave. */
export const HANDOFF_KEY = "prototype:checkout-handoff:v1";

export interface HandoffSnapshot {
  readonly items: readonly WhatsAppCartLine[];
  readonly customer: WhatsAppCustomer;
  readonly total: number;
  /**
   * Número de comanda (#0045) si el registro en el tablero salió bien.
   * `undefined` en snapshots previos a la Tarea 23 y `null` cuando el
   * registro falló: el pedido igual viaja por WhatsApp.
   */
  readonly orderNumber?: number | null;
}

/**
 * ⛔ Guards de runtime, no solo de tipos: `sessionStorage` es del
 * navegador y cualquiera puede escribir en él desde la consola. Un `as`
 * acá sería una mentira que el usuario puede desmentir.
 */
const isCartLine = (value: unknown): value is WhatsAppCartLine => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.productId === "string" &&
    typeof record.name === "string" &&
    typeof record.unitPrice === "number" &&
    typeof record.quantity === "number" &&
    Number.isInteger(record.quantity) &&
    record.quantity > 0 &&
    (record.variantName === null || typeof record.variantName === "string")
  );
};

const isCustomer = (value: unknown): value is WhatsAppCustomer => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.fullName === "string" &&
    typeof record.phone === "string" &&
    (record.fulfillment === "delivery" || record.fulfillment === "pickup") &&
    (record.address === null || typeof record.address === "string") &&
    (record.notes === null || typeof record.notes === "string")
  );
};

export const isHandoffSnapshot = (value: unknown): value is HandoffSnapshot => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.items) &&
    record.items.length > 0 &&
    record.items.every(isCartLine) &&
    isCustomer(record.customer) &&
    typeof record.total === "number" &&
    Number.isFinite(record.total) &&
    // Tarea 23: ausente (snapshot viejo), null (registro falló) o número.
    (record.orderNumber === undefined ||
      record.orderNumber === null ||
      typeof record.orderNumber === "number")
  );
};

export const saveHandoffSnapshot = (snapshot: HandoffSnapshot): boolean => {
  try {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    // Modo privado sin almacenamiento o cuota llena: el checkout sigue
    // funcionando, la pantalla de éxito muestra el estado vacío.
    return false;
  }
};

export const readHandoffSnapshot = (): HandoffSnapshot | null => {
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isHandoffSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const clearHandoffSnapshot = (): void => {
  try {
    window.sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    // Si no se puede borrar, se ignora: el snapshot tiene fecha de
    // vencimiento en la práctica (la próxima compra lo sobreescribe).
  }
};
