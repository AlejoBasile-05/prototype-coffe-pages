import { describe, expect, it } from "vitest";

import { joinClasses } from "@/lib/ui/classes";

describe("joinClasses", () => {
  it("descarta los segmentos falsy y conserva el orden", () => {
    expect(joinClasses("a", false, undefined, "b", null, "c")).toBe("a b c");
  });

  it("no altera las clases: el orden lo resuelve Tailwind, no este helper", () => {
    // px-3 llega antes que px-5 a propósito: en el CSS final gana px-5
    // porque Tailwind respeta el orden del stylesheet, no el del string.
    expect(joinClasses("px-3", "px-5")).toBe("px-3 px-5");
  });

  it("con cero entradas devuelve cadena vacía", () => {
    expect(joinClasses()).toBe("");
    expect(joinClasses(undefined, false)).toBe("");
  });
});
