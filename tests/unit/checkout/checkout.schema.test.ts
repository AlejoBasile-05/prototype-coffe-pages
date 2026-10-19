import { describe, expect, it } from "vitest";

import { checkoutSchema, toFieldErrors } from "@/lib/validation/checkout.schema";

const base = {
  fullName: "Juan Pérez",
  phone: "2615551234",
  fulfillment: "pickup" as const,
  address: "",
  notes: "",
};

describe("checkoutSchema", () => {
  it("debe normalizar el teléfono a E.164 en la salida", () => {
    const parsed = checkoutSchema.safeParse(base);

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.phone).toBe("5492615551234");
  });

  it("debe exigir dirección con envío y no exigirla con retiro", () => {
    const sinDireccion = checkoutSchema.safeParse({ ...base, fulfillment: "delivery" });
    const conRetiro = checkoutSchema.safeParse(base);

    expect(sinDireccion.success).toBe(false);
    expect(conRetiro.success).toBe(true);
  });

  it("debe rechazar una dirección de menos de 10 caracteres", () => {
    const parsed = checkoutSchema.safeParse({
      ...base,
      fulfillment: "delivery",
      address: "Centro",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(toFieldErrors(parsed.error).address?.[0]).toMatch(/corta/i);
    }
  });

  it("debe rechazar un teléfono con letras que no deja nada válido", () => {
    const parsed = checkoutSchema.safeParse({ ...base, phone: "no tengo" });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(Object.keys(toFieldErrors(parsed.error))).toContain("phone");
    }
  });

  it("debe aceptar notas de hasta 500 caracteres y rechazar una más", () => {
    expect(checkoutSchema.safeParse({ ...base, notes: "a".repeat(500) }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, notes: "a".repeat(501) }).success).toBe(false);
  });

  it("debe rechazar una modalidad que no es delivery ni pickup", () => {
    const parsed = checkoutSchema.safeParse({ ...base, fulfillment: "moto" });

    expect(parsed.success).toBe(false);
  });
});
