import { describe, expect, it } from "vitest";

import { formatARS, roundCurrency } from "@/lib/format/currency";

describe("formatARS", () => {
  it("formatea sin decimales con el locale es-AR", () => {
    expect(formatARS(1200)).toContain("1.200");
  });

  it("no inventa decimales en importes enteros", () => {
    expect(formatARS(0)).toMatch(/0\s*$/);
    expect(formatARS(350)).not.toContain(",");
  });
});

describe("roundCurrency", () => {
  it("deja los importes sin centavos igual", () => {
    expect(roundCurrency(4500)).toBe(4500);
  });

  it("redondea a dos decimales", () => {
    expect(roundCurrency(1234.5678)).toBe(1234.57);
  });

  it("no pierde un centavo por error de coma flotante", () => {
    expect(roundCurrency(1.005)).toBe(1.01);
  });

  it("redondea medio hacia arriba", () => {
    expect(roundCurrency(0.125)).toBe(0.13);
  });

  it("mantiene el cero", () => {
    expect(roundCurrency(0)).toBe(0);
  });
});
