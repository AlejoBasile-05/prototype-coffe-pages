"use client";

/**
 * Borrador del formulario de checkout.
 *
 * `sessionStorage` y no `localStorage` a propósito: el borrador muere con
 * la pestaña, no con el navegador. Un nombre, un teléfono y una dirección
 * guardados para siempre en `localStorage` son datos personales del
 * cliente quedándose en un dispositivo compartido. El carrito sí vive en
 * `localStorage` (Tarea 11) porque no tiene nada personal.
 *
 * Implementado como store externo con `useSyncExternalStore`: leer
 * `sessionStorage` ES suscribirse a un sistema externo, y ese es el
 * patrón que la regla `react-hooks/set-state-in-effect` pide para este
 * caso. Además no hay cascada de renders: una sola lectura por cambio.
 */
import { useCallback, useSyncExternalStore } from "react";

import { EMPTY_CHECKOUT_DRAFT, type CheckoutDraft } from "@/lib/validation/checkout.schema";

const STORAGE_KEY = "prototype:checkout-draft:v1";

const isCheckoutDraft = (value: unknown): value is CheckoutDraft => {
  if (typeof value !== "object" || value === null) return false;

  // El `as` justificado de la regla §11: convierte `unknown` en algo
  // indexable para poder verificar la forma, no para mentirle al tipado.
  const record = value as Record<string, unknown>;

  return (
    typeof record.fullName === "string" &&
    typeof record.phone === "string" &&
    (record.fulfillment === "delivery" || record.fulfillment === "pickup") &&
    typeof record.address === "string" &&
    typeof record.notes === "string"
  );
};

const readDraft = (): CheckoutDraft => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return EMPTY_CHECKOUT_DRAFT;
    const parsed: unknown = JSON.parse(raw);
    return isCheckoutDraft(parsed) ? parsed : EMPTY_CHECKOUT_DRAFT;
  } catch {
    // JSON corrupto o `sessionStorage` bloqueado: perder el borrador no
    // puede romper el checkout.
    return EMPTY_CHECKOUT_DRAFT;
  }
};

// ─── Store externo mínimo ────────────────────────────────────────────
// La referencia devuelta por `getSnapshot` debe ser estable entre
// lecturas: un objeto nuevo en cada llamada re-renderiza en bucle.

let current: CheckoutDraft = EMPTY_CHECKOUT_DRAFT;
let loaded = false;

const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  // Cada montaje lee el storage fresco: el checkout se monta una sola
  // vez por navegación, y una lectura vieja traería un borrador de otra
  // pestaña-tiempo. Además hace que dos renders seguidos en un test
  // arranquen del storage y no del módulo.
  loaded = false;
  getSnapshot();
  notify();
  return () => {
    listeners.delete(listener);
  };
};

const notify = (): void => {
  for (const listener of listeners) listener();
};

const getSnapshot = (): CheckoutDraft => {
  // ⛔ Nunca se lee el storage durante el render del servidor: el primer
  // render del cliente usa `getServerSnapshot` (riesgo R4). Acá `window`
  // siempre existe, porque `getSnapshot` solo corre en el cliente.
  if (!loaded) {
    loaded = true;
    current = readDraft();
  }
  return current;
};

const getServerSnapshot = (): CheckoutDraft => EMPTY_CHECKOUT_DRAFT;

export function useCheckoutDraft() {
  const draft = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // `isRestored` en el cliente es siempre true: el primer render del
  // cliente ya trae `getSnapshot` resuelto, y el del servidor nunca
  // renderiza el formulario completo (lo cubre la página con `dynamic`).
  const isRestored = true;

  const update = useCallback((patch: Partial<CheckoutDraft>): void => {
    current = { ...current, ...patch };
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Cuota llena o almacenamiento deshabilitado: el formulario sigue
      // funcionando, solo no se recupera si el usuario se va.
    }
    notify();
  }, []);

  const clear = useCallback((): void => {
    current = EMPTY_CHECKOUT_DRAFT;
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Mismo caso que arriba.
    }
    notify();
  }, []);

  return { draft, update, clear, isRestored } as const;
}
