/**
 * ⛔ Necesita DOM (`window.sessionStorage`): corre en el proyecto `ui`
 * de Vitest con jsdom. Moverlo al proyecto `node` lo rompería.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearHandoffSnapshot,
  HANDOFF_KEY,
  isHandoffSnapshot,
  readHandoffSnapshot,
  saveHandoffSnapshot,
  type HandoffSnapshot,
} from "@/components/checkout/handoff-snapshot";

const SNAPSHOT: HandoffSnapshot = {
  items: [{ productId: "p1", name: "Classic", variantName: null, unitPrice: 1450, quantity: 2 }],
  customer: {
    fullName: "Juan Pérez",
    phone: "5492615551234",
    fulfillment: "pickup",
    address: null,
    notes: null,
  },
  total: 2900,
};

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handoffSnapshot", () => {
  it("debe escribir y leer el snapshot sin perder un campo", () => {
    expect(saveHandoffSnapshot(SNAPSHOT)).toBe(true);
    expect(readHandoffSnapshot()).toEqual(SNAPSHOT);
  });

  it("debe devolver null cuando no hay nada guardado", () => {
    expect(readHandoffSnapshot()).toBeNull();
  });

  it("debe descartar un snapshot corrupto en vez de confiar en él", () => {
    // ⛔ `sessionStorage` es del navegador: cualquiera puede escribir
    // desde la consola. Un snapshot a medio validar muestra una URL con
    // `undefined`.
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ items: [{ name: 1 }] }));

    expect(readHandoffSnapshot()).toBeNull();
  });

  it("debe devolver false sin romper cuando sessionStorage lanza", () => {
    // Storage.prototype: `sessionStorage` no es un objeto propio de
    // `window` sino un getter que devuelve la instancia `Storage`, así
    // que espiar `window.sessionStorage` no intercepta el método.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(saveHandoffSnapshot(SNAPSHOT)).toBe(false);
  });

  it("debe rechazar una cantidad cero o negativa escrita a mano", () => {
    expect(isHandoffSnapshot({ ...SNAPSHOT, items: [{ ...SNAPSHOT.items[0], quantity: 0 }] })).toBe(
      false,
    );
  });

  it("debe limpiar el snapshot sin romper si el storage lanza", () => {
    saveHandoffSnapshot(SNAPSHOT);
    clearHandoffSnapshot();

    expect(readHandoffSnapshot()).toBeNull();
  });
});
