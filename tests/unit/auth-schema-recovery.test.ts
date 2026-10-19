/**
 * Schema del cambio de contraseña (Tarea 24).
 *
 * La action lo ejecuta server-side sobre un FormData que NO es confiable:
 * acá se fijan los cortes que impiden dejar una contraseña débil o
 * desprotegida por un "confirm" distinto del original.
 */
import { describe, expect, it } from "vitest";

import { PasswordResetSchema } from "@/server/schemas/auth.schema";

describe("PasswordResetSchema", () => {
  it("acepta una contraseña válida con confirmación idéntica", () => {
    const parsed = PasswordResetSchema.safeParse({
      password: "RiverPlate1986",
      confirmPassword: "RiverPlate1986",
    });

    expect(parsed.success).toBe(true);
  });

  it("rechaza menos de 8 caracteres", () => {
    const parsed = PasswordResetSchema.safeParse({
      password: "corta1",
      confirmPassword: "corta1",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("8 caracteres");
    }
  });

  it("rechaza confirmaciones que no coinciden, con el error en confirmPassword", () => {
    const parsed = PasswordResetSchema.safeParse({
      password: "RiverPlate1986",
      confirmPassword: "BocaJuniors2000",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      expect(issue?.path[0]).toBe("confirmPassword");
      expect(issue?.message).toContain("no coinciden");
    }
  });

  it("rechaza la confirmación vacía y contraseñas gigantes", () => {
    expect(
      PasswordResetSchema.safeParse({ password: "RiverPlate1986", confirmPassword: "" }).success,
    ).toBe(false);

    const gigante = "a".repeat(201);
    expect(
      PasswordResetSchema.safeParse({ password: gigante, confirmPassword: gigante }).success,
    ).toBe(false);
  });
});
