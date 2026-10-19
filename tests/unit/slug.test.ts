import { describe, expect, it } from "vitest";

import { buildSlug, isValidSlug } from "@/lib/validation/slug";

describe("slug", () => {
  describe("buildSlug", () => {
    it.each([
      ["Jamón y Queso Doble", "jamon-y-queso-doble"],
      ["Flotante de Chocolate", "flotante-de-chocolate"],
      ["Café Espresso", "cafe-espresso"],
      ["Jamón Crudo y Rucola", "jamon-crudo-y-rucola"],
      ["Limonada con Menta 500 ml", "limonada-con-menta-500-ml"],
      ["Atún", "atun"],
    ])("%j → %j", (entrada, esperado) => {
      expect(buildSlug(entrada)).toBe(esperado);
    });

    it("recorta espacios al inicio y al final", () => {
      expect(buildSlug("  Jamón y Queso  ")).toBe("jamon-y-queso");
    });

    it("colapsa signos y espacios repetidos en un solo guion", () => {
      expect(buildSlug("Jamón  y   Queso")).toBe("jamon-y-queso");
      expect(buildSlug("Jamón - y - Queso")).toBe("jamon-y-queso");
      expect(buildSlug("Jamón/y/queso")).toBe("jamon-y-queso");
    });

    it("elimina tildes, eñes y diacríticos combinantes", () => {
      expect(buildSlug("Piña Colada")).toBe("pina-colada");
      expect(buildSlug("Sésamo & Sésamo")).toBe("sesamo-sesamo");
    });

    it("limita a 80 caracteres", () => {
      expect(buildSlug("x".repeat(200)).length).toBeLessThanOrEqual(80);
    });

    it("un string de puros signos queda vacío (el fallo lo decide el caller)", () => {
      expect(buildSlug("¡¡¿¿??")).toBe("");
    });
  });

  describe("isValidSlug", () => {
    it.each(["", "-abc", "abc-", "a--b", "ABC", "con espacios", "con_tildesñ", "x".repeat(81)])(
      "rechaza %j",
      (entrada) => {
        expect(isValidSlug(entrada)).toBe(false);
      },
    );

    it.each(["abc", "a-b", "jamon-y-queso", "gaseosa-500-ml"])("acepta %j", (entrada) => {
      expect(isValidSlug(entrada)).toBe(true);
    });
  });

  it("todo slug construido por buildSlug (no vacío) es válido", () => {
    for (const nombre of ["Jamón y Queso Doble", "Roast Beef", "Café Espresso"]) {
      expect(isValidSlug(buildSlug(nombre))).toBe(true);
    }
  });
});
