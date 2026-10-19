import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/domain";
import {
  formatArgentinePhoneForDisplay,
  normalizeArgentinePhone,
  sanitizePhoneDigits,
} from "@/lib/format/phone";

describe("normalizeArgentinePhone", () => {
  it("debe normalizar un número local de diez dígitos agregando el 9 móvil", () => {
    expect(normalizeArgentinePhone("2615551234")).toBe("5492615551234");
  });

  it("debe normalizar el formato internacional con espacios, guiones y el 9 móvil", () => {
    expect(normalizeArgentinePhone("+54 9 261 555-1234")).toBe("5492615551234");
  });

  it("debe reemplazar el cero de la forma 0261 por el prefijo 54", () => {
    expect(normalizeArgentinePhone("0261 555 1234")).toBe("5492615551234");
  });

  it("debe agregar el 9 móvil a un 54 261 que no lo tiene", () => {
    expect(normalizeArgentinePhone("54 261 555 1234")).toBe("5492615551234");
  });

  it("debe dejar intacto un número que ya está en E.164", () => {
    expect(normalizeArgentinePhone("5492615551234")).toBe("5492615551234");
  });

  it("debe sacar el prefijo internacional 00", () => {
    expect(normalizeArgentinePhone("0054 9 261 555-1234")).toBe("5492615551234");
  });

  it("debe sacar el cero de un 540261 escrito como teléfono fijo", () => {
    expect(normalizeArgentinePhone("540261 555 1234")).toBe("5492615551234");
  });

  it("debe rechazar un teléfono vacío", () => {
    expect(() => normalizeArgentinePhone("")).toThrow(ValidationError);
  });

  it("debe rechazar un teléfono con letras cuando no queda nada válido", () => {
    expect(() => normalizeArgentinePhone("no tengo teléfono")).toThrow(ValidationError);
  });

  it("debe rechazar la notación heredada ambigua con el 15", () => {
    expect(() => normalizeArgentinePhone("54 261 15 555-1234")).toThrow(ValidationError);
  });

  it("debe rechazar una cadena absurdamente larga", () => {
    expect(() => normalizeArgentinePhone("5492615551234".repeat(5))).toThrow(ValidationError);
  });

  it("debe ignorar los caracteres de control pegados al número", () => {
    const sucio = `+54 9 261 555-1234${String.fromCharCode(0)}${String.fromCharCode(0x202e)}`;
    expect(normalizeArgentinePhone(sucio)).toBe("5492615551234");
  });

  it("debe reportar el error con la clave phone para que el formulario lo muestre", () => {
    expect.assertions(2);
    try {
      normalizeArgentinePhone("");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(Object.keys(error.fieldErrors)).toContain("phone");
      }
    }
  });
});

describe("sanitizePhoneDigits", () => {
  it("debe dejar solo los dígitos", () => {
    expect(sanitizePhoneDigits("+54 (261) 555-1234")).toBe("542615551234");
  });

  it("debe devolver cadena vacía si no hay dígitos", () => {
    expect(sanitizePhoneDigits("abc")).toBe("");
  });
});

describe("formatArgentinePhoneForDisplay", () => {
  it("debe mostrar el teléfono en el formato que usa WhatsApp", () => {
    expect(formatArgentinePhoneForDisplay(normalizeArgentinePhone("5492615551234"))).toBe(
      "+54 9 261 555-1234",
    );
  });
});
