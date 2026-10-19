import { describe, expect, it } from "vitest";

import { parseCartLineRef, serializeCartLineRef } from "@/lib/domain";

describe("serializeCartLineRef", () => {
  it("serializa una línea sin variante sin dos puntos finales", () => {
    expect(serializeCartLineRef({ productId: "cuid123", variantId: null })).toBe("cuid123");
  });

  it("serializa una línea con variante como productId:variantId", () => {
    expect(serializeCartLineRef({ productId: "cuid123", variantId: "var456" })).toBe(
      "cuid123:var456",
    );
  });
});

describe("parseCartLineRef", () => {
  it("parsea productId a secas con variantId null", () => {
    expect(parseCartLineRef("cuid123")).toEqual({ productId: "cuid123", variantId: null });
  });

  it("parsea productId:variantId", () => {
    expect(parseCartLineRef("cuid123:var456")).toEqual({
      productId: "cuid123",
      variantId: "var456",
    });
  });

  it("normaliza el `productId:` de clientes ya cargados a variantId null", () => {
    expect(parseCartLineRef("cuid123:")).toEqual({ productId: "cuid123", variantId: null });
  });

  it("rechaza un productId vacío", () => {
    expect(parseCartLineRef(":")).toBeNull();
    expect(parseCartLineRef(":var456")).toBeNull();
  });

  it("rechaza un doble separador", () => {
    expect(parseCartLineRef("cuid123:var456:")).toBeNull();
    expect(parseCartLineRef("cuid123::var456")).toBeNull();
  });

  it("rechaza caracteres fuera del charset y strings vacíos", () => {
    expect(parseCartLineRef("")).toBeNull();
    expect(parseCartLineRef("cuid123 ${DROP TABLE}")).toBeNull();
    expect(parseCartLineRef("cuid123:var 456")).toBeNull();
    expect(parseCartLineRef("cuid.123")).toBeNull();
  });

  it("rechaza ids más largos que el máximo permitido", () => {
    expect(parseCartLineRef("a".repeat(37))).toBeNull();
  });
});