import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BusinessSettingsDTO } from "@/lib/domain";

import { BusinessFooter } from "./BusinessFooter";

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

describe("BusinessFooter", () => {
  it("muestra 'Tu Negocio' junto a la dirección, ignorando el nombre configurado en la base", () => {
    render(<BusinessFooter settings={buildSettings({ address: "Belgrano 1234" })} />);

    expect(screen.getByText("Tu Negocio")).toBeInTheDocument();
    expect(screen.queryByText("Café de la Esquina")).toBeNull();
    expect(screen.getByText("Belgrano 1234")).toBeInTheDocument();
  });

  it("muestra 'Tu Negocio' en el copyright, ignorando el nombre configurado en la base", () => {
    render(<BusinessFooter settings={buildSettings()} />);

    const anio = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${anio} Tu Negocio`))).toBeInTheDocument();
    expect(screen.queryByText("Café de la Esquina")).toBeNull();
  });

  it("linkea al sitio personal en nueva pestaña, sin mostrar el link de Instagram", () => {
    render(
      <BusinessFooter settings={buildSettings({ instagramUrl: "https://instagram.com/otro" })} />,
    );

    const link = screen.getByRole("link", { name: "alejobasile.dev" });
    expect(link).toHaveAttribute("href", "https://alejobasile.dev/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByText("Instagram")).toBeNull();
  });
});
