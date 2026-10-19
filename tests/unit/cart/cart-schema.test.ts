import { describe, expect, it } from "vitest";

import { CART_STORAGE_VERSION, persistedCartSchema } from "@/lib/cart/cart-schema";

const VALID = {
  version: CART_STORAGE_VERSION,
  state: {
    lines: [
      {
        productId: "prod-1",
        slug: "cafe",
        name: "Café",
        variantId: null,
        variantName: null,
        unitPrice: 4500,
        quantity: 2,
        imageUrl: null,
        available: true,
      },
    ],
  },
};

describe("persistedCartSchema", () => {
  it("acepta un payload válido", () => {
    expect(persistedCartSchema.safeParse(VALID).success).toBe(true);
  });

  it("rechaza una versión vieja", () => {
    expect(persistedCartSchema.safeParse({ ...VALID, version: 0 }).success).toBe(false);
  });

  it("rechaza una cantidad fuera de rango", () => {
    expect(
      persistedCartSchema.safeParse({
        ...VALID,
        state: { lines: [{ ...VALID.state.lines[0], quantity: 999 }] },
      }).success,
    ).toBe(false);
  });

  it("rechaza una cantidad en cero", () => {
    expect(
      persistedCartSchema.safeParse({
        ...VALID,
        state: { lines: [{ ...VALID.state.lines[0], quantity: 0 }] },
      }).success,
    ).toBe(false);
  });

  it("rechaza un precio negativo", () => {
    expect(
      persistedCartSchema.safeParse({
        ...VALID,
        state: { lines: [{ ...VALID.state.lines[0], unitPrice: -1 }] },
      }).success,
    ).toBe(false);
  });

  it("rechaza un payload con líneas que no son una lista", () => {
    expect(persistedCartSchema.safeParse({ ...VALID, state: { lines: "nope" } }).success).toBe(
      false,
    );
  });

  it("rechaza un payload que no es un objeto", () => {
    expect(persistedCartSchema.safeParse("{{{").success).toBe(false);
  });
});
