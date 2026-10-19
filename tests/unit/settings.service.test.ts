import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "@/lib/domain";
import type { BusinessSettingsDTO } from "@/lib/domain";
import {
  isSettingsConfigured,
  normalizeArgentinePhone,
  normalizeInstagramUrl,
  normalizeOpeningHours,
} from "@/lib/validation/ajustes";
import { getBusinessSettings, updateBusinessSettings } from "@/server/services/settings.service";

const buildSettingsGuardadas = (): BusinessSettingsDTO => ({
  name: "Mi Negocio",
  whatsappPhone: "5492615551234",
  address: null,
  instagramUrl: null,
  openingHours: {},
  closingMessage: null,
  legalNotice: null,
});

describe("normalizeArgentinePhone", () => {
  it.each([
    ["+54 9 261 555-1234", "5492615551234"],
    ["5492615551234", "5492615551234"],
    ["54 261 555 1234", "5492615551234"],
    ["0261 555 1234", "5492615551234"],
    ["261 555 1234", "5492615551234"],
    ["0054 9 261 555 1234", "5492615551234"],
    ["(261) 555-1234", "5492615551234"],
  ])("normaliza %s a %s", (entrada, esperado) => {
    expect(normalizeArgentinePhone(entrada)).toBe(esperado);
  });

  it("debe rechazar un número vacío", () => {
    expect(() => normalizeArgentinePhone("   ")).toThrow(ValidationError);
  });

  it("debe rechazar un número demasiado corto para ser argentino", () => {
    expect(() => normalizeArgentinePhone("112233")).toThrow(ValidationError);
  });

  it("debe rechazar la notación heredada con 15 en lugar del 9", () => {
    // A propósito: es ambigua y el servicio no adivina (§6.3).
    expect(() => normalizeArgentinePhone("+54 261 15 555-1234")).toThrow(ValidationError);
  });
});

describe("normalizeInstagramUrl", () => {
  it("debe agregar https:// a un perfil sin protocolo", () => {
    expect(normalizeInstagramUrl("instagram.com/modo.miga")).toBe(
      "https://instagram.com/modo.miga",
    );
  });

  it("debe devolver null ante un esquema peligroso", () => {
    expect(normalizeInstagramUrl("javascript:alert(1)")).toBeNull();
  });

  it("debe devolver null ante una cadena vacía o solo espacios", () => {
    expect(normalizeInstagramUrl("   ")).toBeNull();
    expect(normalizeInstagramUrl(null)).toBeNull();
  });
});

describe("normalizeOpeningHours", () => {
  it("debe conservar los días válidos y descartar las claves desconocidas", () => {
    const resultado = normalizeOpeningHours({
      monday: { opens: "09:00", closes: "21:00" },
      lunes: { opens: "09:00", closes: "21:00" },
    });

    expect(resultado).toEqual({ monday: { opens: "09:00", closes: "21:00" } });
  });

  it("debe conservar un día en null como cerrado, sin inventar los demás", () => {
    const resultado = normalizeOpeningHours({ sunday: null });

    expect(resultado).toEqual({ sunday: null });
    expect(Object.keys(resultado)).toHaveLength(1);
  });

  it("debe descartar un horario con formato inválido", () => {
    expect(normalizeOpeningHours({ monday: { opens: "9am", closes: "9pm" } })).toEqual({});
  });

  it("debe devolver un objeto vacío cuando no hay horarios cargados", () => {
    expect(normalizeOpeningHours({})).toEqual({});
    expect(normalizeOpeningHours(null)).toEqual({});
    expect(normalizeOpeningHours("corrupto")).toEqual({});
  });
});

describe("isSettingsConfigured", () => {
  const con = (whatsappPhone: string): BusinessSettingsDTO => ({
    ...buildSettingsGuardadas(),
    whatsappPhone,
  });

  it("debe dar falso con el teléfono de relleno del repositorio", () => {
    expect(isSettingsConfigured(con("5492610000000"))).toBe(false);
  });

  it("debe dar verdadero con un número real", () => {
    expect(isSettingsConfigured(con("5492615551234"))).toBe(true);
  });
});

describe("getBusinessSettings", () => {
  it("debe devolver los defaults normalizados y registrar que el local no está configurado", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const settings = await getBusinessSettings({
      settingsRepository: {
        findBusinessSettings: async () => ({
          name: "  Mi Negocio  ",
          whatsappPhone: "5492610000000",
          address: "   ",
          instagramUrl: "instagram.com/modo.miga",
          openingHours: {},
          closingMessage: null,
          legalNotice: null,
        }),
      },
    });

    expect(settings.name).toBe("Mi Negocio");
    expect(settings.address).toBeNull();
    expect(settings.instagramUrl).toBe("https://instagram.com/modo.miga");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("debe propagar el error del repositorio en vez de devolver defaults inventados", async () => {
    await expect(
      getBusinessSettings({
        settingsRepository: {
          findBusinessSettings: async () => {
            throw new Error("connection refused");
          },
        },
      }),
    ).rejects.toThrow("connection refused");
  });
});

describe("updateBusinessSettings", () => {
  it("debe normalizar el teléfono antes de guardar", async () => {
    const guardado: BusinessSettingsDTO[] = [];
    const resultado = await updateBusinessSettings(
      {
        settingsRepository: {
          findBusinessSettings: async () => buildSettingsGuardadas(),
          saveBusinessSettings: async (input) => {
            guardado.push(input);
            return input;
          },
        },
      },
      {
        name: "Mi Negocio",
        whatsappPhone: "+54 261 555 1234",
        address: null,
        instagramUrl: null,
        openingHours: {},
        closingMessage: null,
        legalNotice: null,
      },
    );

    expect(guardado[0]?.whatsappPhone).toBe("5492615551234");
    expect(resultado.whatsappPhone).toBe("5492615551234");
  });

  it("debe rechazar guardar con un teléfono que no normaliza, sin tocar la base", async () => {
    let escribio = false;
    await expect(
      updateBusinessSettings(
        {
          settingsRepository: {
            findBusinessSettings: async () => buildSettingsGuardadas(),
            saveBusinessSettings: async (input) => {
              escribio = true;
              return input;
            },
          },
        },
        {
          name: "Mi Negocio",
          whatsappPhone: "123",
          address: null,
          instagramUrl: null,
          openingHours: {},
          closingMessage: null,
          legalNotice: null,
        },
      ),
    ).rejects.toThrow(ValidationError);
    expect(escribio).toBe(false);
  });
});
