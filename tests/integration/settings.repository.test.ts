import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_BUSINESS_SETTINGS,
  findBusinessSettings,
  saveBusinessSettings,
} from "@/server/repositories/settings.repository";
import { prisma } from "@/server/infra/prisma";
import { disconnectDatabase, resetDatabase } from "../setup";

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

const buildSettings = () => ({
  name: "Mi Negocio",
  whatsappPhone: "5492615551234",
  address: "San Rafael, Mendoza",
  instagramUrl: "https://instagram.com/modo.miga",
  openingHours: { monday: { opens: "09:00", closes: "21:00" } },
  closingMessage: "Cerramos los lunes.",
  legalNotice: null,
});

describe("settings.repository", () => {
  it("debe devolver los defaults si la fila singleton no existe, sin lanzar", async () => {
    const settings = await findBusinessSettings();

    expect(settings).toEqual(DEFAULT_BUSINESS_SETTINGS);
    expect(settings.openingHours).toEqual({});
  });

  it("debe hacer upsert de la fila singleton y mantener una sola fila", async () => {
    const input = buildSettings();

    const created = await saveBusinessSettings(input);
    const updated = await saveBusinessSettings({ ...input, name: "Mi Negocio Bar" });

    expect(created.name).toBe("Mi Negocio");
    expect(updated.name).toBe("Mi Negocio Bar");
    // Sigue siendo una sola fila.
    expect(await prisma.businessSettings.count()).toBe(1);
  });

  it("debe degradar a vacío un openingHours corrupto en lugar de romper", async () => {
    await prisma.businessSettings.create({
      data: {
        id: "1",
        name: "Mi Negocio",
        whatsappPhone: "5492615551234",
        openingHours: "corrupto",
      },
    });

    const settings = await findBusinessSettings();

    expect(settings.openingHours).toEqual({});
    expect(settings.name).toBe("Mi Negocio");
  });

  it("la base debe rechazar una segunda fila del singleton (CHECK id = '1')", async () => {
    await saveBusinessSettings(buildSettings());

    await expect(
      prisma.businessSettings.create({
        data: { id: "2", name: "Otra", whatsappPhone: "5492610000000" },
      }),
    ).rejects.toThrow();
  });
});
