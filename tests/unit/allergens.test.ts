import { describe, expect, it } from "vitest";

import {
  ALERGENOS,
  isAllergen,
  normalizeAllergenKey,
  toCanonicalAllergen,
} from "@/lib/domain/allergens";

describe("allergens (glosario cerrado)", () => {
  it("el glosario tiene exactamente 8 claves (ADR-24 agregó pescado)", () => {
    expect(ALERGENOS).toEqual([
      "gluten",
      "lactosa",
      "huevo",
      "maní",
      "frutos secos",
      "sésamo",
      "soja",
      "pescado",
    ]);
  });

  describe("toCanonicalAllergen", () => {
    it.each([
      ["Maní", "maní"],
      ["MANI", "maní"],
      ["maní", "maní"],
      ["sésamo", "sésamo"],
      ["SESAMO", "sésamo"],
      [" gluten ", "gluten"],
      ["Frutos Secos", "frutos secos"],
      ["pescado", "pescado"],
    ])("normaliza %j a %j", (entrada, esperado) => {
      expect(toCanonicalAllergen(entrada)).toBe(esperado);
    });

    it.each(["soja y maní", "lacticosa", "sulfito", "", "   "])(
      "devuelve null para lo que no está en el glosario: %j",
      (entrada) => {
        expect(toCanonicalAllergen(entrada)).toBeNull();
      },
    );
  });

  describe("isAllergen", () => {
    it("discrimina con la misma normalización", () => {
      expect(isAllergen("MANÍ")).toBe(true);
      expect(isAllergen("mani")).toBe(true);
      expect(isAllergen("mani ")).toBe(true);
      expect(isAllergen("leche")).toBe(false);
    });
  });

  describe("normalizeAllergenKey", () => {
    it("hace indistinguibles tilde, eñe y mayúsculas", () => {
      expect(normalizeAllergenKey("Sésamo")).toBe(normalizeAllergenKey("sesamo"));
      expect(normalizeAllergenKey("maní")).toBe(normalizeAllergenKey("MANI"));
    });
  });
});
