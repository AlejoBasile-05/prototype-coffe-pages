import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/domain";
import { buildWhatsAppUrl } from "@/lib/whatsapp/whatsapp-url.service";

/** `encodeURIComponent` deja pasar exactamente estos caracteres sin escapar. */
const QUERY_ALLOWED = /^[A-Za-z0-9\-_.!~*'()%]*$/;

describe("buildWhatsAppUrl", () => {
  it("debe armar la URL con el teléfono en E.164 y el mensaje codificado", () => {
    const url = buildWhatsAppUrl("5492615551234", "Hola");

    expect(url).toBe("https://wa.me/5492615551234?text=Hola");
  });

  it("debe enviar los saltos de línea como %0A", () => {
    const url = buildWhatsAppUrl("5492615551234", "uno\ndos");

    expect(url).toContain("uno%0Ados");
    expect(url).not.toContain("%0D");
  });

  it("debe escapar el ampersand y la almohadilla de la dirección", () => {
    const url = buildWhatsAppUrl("5492615551234", "Entrega en: Av. Sur 123 & Norte #4");

    expect(url).toContain("%26");
    expect(url).toContain("%23");
    expect(url.split("?text=")[1]).not.toContain("&");
  });

  it("debe no tener espacios crudos ni caracteres fuera del set permitido", () => {
    const url = buildWhatsAppUrl("+54 9 261 555-1234", "¡Hola! Total: $3.700 — año 2026\n");

    expect(url).not.toContain(" ");
    const query = url.slice(url.indexOf("?text=") + 6);
    expect(QUERY_ALLOWED.test(query ?? "")).toBe(true);
  });

  it("debe codificar el signo de porcentaje una sola vez", () => {
    const url = buildWhatsAppUrl("5492615551234", "descuento 10% — ¡gracias!");

    expect(url).toContain("10%25");
    expect(url).not.toContain("%2525");
  });

  it("debe normalizar el teléfono antes de armar la URL", () => {
    expect(buildWhatsAppUrl("+54 9 261 555-1234", "Hola")).toContain("/5492615551234?");
    expect(buildWhatsAppUrl("0261 555 1234", "Hola")).toContain("/5492615551234?");
  });

  it("debe conservar las tildes y eñes codificadas en UTF-8", () => {
    const url = buildWhatsAppUrl("5492615551234", "Ñoquis con jamón");

    expect(url).toContain("%C3%91oquis");
    expect(url).not.toContain("Ñ");
  });

  it("debe lanzar ValidationError con un teléfono que no es válido", () => {
    expect(() => buildWhatsAppUrl("261555", "Hola")).toThrow(ValidationError);
  });

  it("debe lanzar ValidationError con un mensaje vacío", () => {
    expect(() => buildWhatsAppUrl("5492615551234", "")).toThrow(ValidationError);
  });
});
