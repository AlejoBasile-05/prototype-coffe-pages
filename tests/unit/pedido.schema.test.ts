/**
 * Schema del registro público de comandas (Tarea 23).
 *
 * La action lo ejecuta server-side sobre un payload que NO es confiable:
 * acá se fijan los cortes que impiden que un objeto armado a mano entre
 * como pedido.
 */
import { describe, expect, it } from "vitest";

import { registerOrderInputSchema } from "@/lib/validation/pedido.schema";

const baseValida = {
  customer: {
    fullName: "Ana Prueba",
    phone: "+54 9 261 555-1234",
    fulfillment: "pickup",
    address: "",
    notes: "",
  },
  items: [{ productId: "prd_abc123", quantity: 2 }],
} as const;

describe("registerOrderInputSchema", () => {
  it("acepta un pedido válido y normaliza el teléfono a E.164", () => {
    const parsed = registerOrderInputSchema.safeParse(baseValida);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.customer.phone).toBe("5492615551234");
      expect(parsed.data.items[0]?.quantity).toBe(2);
    }
  });

  it("rechaza un productId con caracteres inyectables", () => {
    const parsed = registerOrderInputSchema.safeParse({
      ...baseValida,
      items: [{ productId: "'; DROP TABLE orders;--", quantity: 1 }],
    });

    expect(parsed.success).toBe(false);
  });

  it("rechaza cantidades fuera de rango", () => {
    const cero = registerOrderInputSchema.safeParse({
      ...baseValida,
      items: [{ productId: "prd_1", quantity: 0 }],
    });
    const exceso = registerOrderInputSchema.safeParse({
      ...baseValida,
      items: [{ productId: "prd_1", quantity: 999 }],
    });

    expect(cero.success).toBe(false);
    expect(exceso.success).toBe(false);
  });

  it("rechaza un pedido sin ítems", () => {
    const parsed = registerOrderInputSchema.safeParse({ ...baseValida, items: [] });

    expect(parsed.success).toBe(false);
  });

  it("rechaza un cliente inválido aunque los ítems estén bien", () => {
    const parsed = registerOrderInputSchema.safeParse({
      ...baseValida,
      customer: { ...baseValida.customer, fullName: "" },
    });

    expect(parsed.success).toBe(false);
  });

  it("exige dirección cuando el fulfillment es delivery", () => {
    const parsed = registerOrderInputSchema.safeParse({
      ...baseValida,
      customer: { ...baseValida.customer, fulfillment: "delivery", address: "" },
    });

    expect(parsed.success).toBe(false);
  });
});
