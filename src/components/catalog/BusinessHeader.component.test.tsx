import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BusinessSettingsDTO } from "@/lib/domain";

import { BusinessHeader } from "./BusinessHeader";

const buildSettings = (overrides: Partial<BusinessSettingsDTO> = {}): BusinessSettingsDTO => ({
  name: "Café de la Esquina",
  whatsappPhone: "5492615551234",
  address: null,
  instagramUrl: null,
  openingHours: {},
  closingMessage: null,
  legalNotice: null,
  ...overrides,
});

const brandLink = () => screen.getAllByRole("link")[0];

describe("BusinessHeader", () => {
  it("muestra 'Tu Negocio' en la marca, ignorando el nombre configurado en la base", () => {
    render(<BusinessHeader settings={buildSettings()} />);

    expect(brandLink()).toHaveTextContent("Tu Negocio");
    expect(brandLink()).not.toHaveTextContent("Café de la Esquina");
  });

  it("muestra 'Tu Negocio' en el enlace de navegación (Modo Miga)", () => {
    render(<BusinessHeader settings={buildSettings()} />);

    const nav = within(screen.getByRole("navigation", { name: "Principal" }));
    const link = nav.getByRole("link");

    expect(link).toHaveTextContent("Tu Negocio");
    expect(link).not.toHaveTextContent("Café de la Esquina");
    expect(link).not.toHaveTextContent("Catálogo");
  });
});
