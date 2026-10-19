import { describe, expect, it } from "vitest";

import { DEFAULT_ADMIN_PATH, sanitizeNextPath } from "@/lib/validation/ruta-retorno";

describe("sanitizeNextPath", () => {
  it("deja pasar un path interno válido", () => {
    expect(sanitizeNextPath("/admin/productos")).toBe("/admin/productos");
  });

  it("rechaza un protocolo relativo que apunta a otro sitio", () => {
    // El vector de open redirect clásico.
    expect(sanitizeNextPath("//evil.com/steal")).toBe(DEFAULT_ADMIN_PATH);
  });

  it("rechaza un path con barra invertida", () => {
    expect(sanitizeNextPath("/\\evil.com")).toBe(DEFAULT_ADMIN_PATH);
  });

  it("rechaza un salto de línea (header injection)", () => {
    expect(sanitizeNextPath("/admin\r\nSet-Cookie: a=b")).toBe(DEFAULT_ADMIN_PATH);
  });

  it("devuelve el admin cuando no hay valor o está vacío", () => {
    expect(sanitizeNextPath(null)).toBe(DEFAULT_ADMIN_PATH);
    expect(sanitizeNextPath("")).toBe(DEFAULT_ADMIN_PATH);
    expect(sanitizeNextPath("   ")).toBe(DEFAULT_ADMIN_PATH);
  });

  it("rechaza una URL absoluta", () => {
    expect(sanitizeNextPath("https://evil.com")).toBe(DEFAULT_ADMIN_PATH);
  });

  it("evita el bucle de redirección hacia el propio login", () => {
    expect(sanitizeNextPath("/login")).toBe(DEFAULT_ADMIN_PATH);
    expect(sanitizeNextPath("/login?next=/admin")).toBe(DEFAULT_ADMIN_PATH);
    expect(sanitizeNextPath("/login/x")).toBe(DEFAULT_ADMIN_PATH);
  });

  it("el vector de la documentación del ataque queda bloqueado", () => {
    expect(sanitizeNextPath("//evil.com/steal")).toBe(DEFAULT_ADMIN_PATH);
    expect(sanitizeNextPath("/\\evil.com/steal")).toBe(DEFAULT_ADMIN_PATH);
  });
});
