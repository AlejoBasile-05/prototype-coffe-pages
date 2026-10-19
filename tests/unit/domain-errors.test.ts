import { describe, expect, it } from "vitest";
import {
  DomainError,
  ExternalServiceError,
  ResourceNotFoundError,
  ValidationError,
  toSafeErrorMessage,
} from "@/lib/domain";

describe("Jerarquía de errores de dominio", () => {
  it("debe conservar el code estable para comparaciones por código", () => {
    const error = new ResourceNotFoundError("Producto", "prod_123");

    expect(error.code).toBe("RESOURCE_NOT_FOUND");
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
  });

  it("no debe filtrar el mensaje interno de errores no presentables", () => {
    const message = toSafeErrorMessage(new Error("connection to 10.0.0.5:5432 refused"));

    expect(message).not.toContain("10.0.0.5");
    expect(message).toBe("Ocurrió un problema inesperado. Intentá de nuevo.");
  });

  it("debe propagar los errores de campo de validación para el formulario", () => {
    const error = new ValidationError({ phone: ["Formato inválido"] });

    expect(error.fieldErrors.phone).toEqual(["Formato inválido"]);
    expect(toSafeErrorMessage(error)).toBe("Datos inválidos");
  });

  it("debe congelar details y aislar la copia del objeto original", () => {
    const fieldErrors = { phone: ["Formato inválido"] };
    const error = new ValidationError(fieldErrors);

    expect(Object.isFrozen(error.details)).toBe(true);
    expect(Object.isFrozen(error.fieldErrors)).toBe(true);
    expect(Object.isFrozen(fieldErrors)).toBe(false);
    expect(error.details).not.toBe(error.fieldErrors);
  });

  it("no debe persistir el mensaje de la causa de un fallo externo", () => {
    const cause = new Error("connect ECONNREFUSED 10.0.0.5:5432 (password=super-secreto)");
    const error = new ExternalServiceError("supabase", cause);
    const detailsSerializados = JSON.stringify(error.details);

    expect(error.code).toBe("EXTERNAL_SERVICE_ERROR");
    expect(detailsSerializados).not.toContain("super-secreto");
    expect(detailsSerializados).not.toContain("10.0.0.5");
    expect(detailsSerializados).toContain("Error");
    expect(toSafeErrorMessage(error)).toBe("Ocurrió un problema. Intentá de nuevo.");
  });
});
