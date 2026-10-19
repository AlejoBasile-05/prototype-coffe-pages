import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { CatalogDTO } from "@/lib/domain";
import { getPublicCatalog, getPublicFeaturedProducts } from "@/server/services";

import HomePage from "./page";

vi.mock("@/server/services", () => ({
  getPublicCatalog: vi.fn(),
  getPublicFeaturedProducts: vi.fn(),
}));

const mockCatalog = vi.mocked(getPublicCatalog);
const mockFeatured = vi.mocked(getPublicFeaturedProducts);

const CATALOG: CatalogDTO = {
  sections: [],
  settings: {
    name: "Café de la Esquina",
    whatsappPhone: "5492615551234",
    address: null,
    instagramUrl: null,
    openingHours: {},
    closingMessage: null,
    legalNotice: null,
  },
  hasAnyAvailableProduct: true,
};

/**
 * La página es un Server Component async: `render` necesita el JSX ya
 * resuelto, así que se espera la promesa antes de renderizar. Lo que se
 * prueba es el árbol que devuelve, con los servicios sustituidos.
 */
const renderPagina = async () => render(await HomePage());

beforeEach(() => {
  mockCatalog.mockResolvedValue(CATALOG);
  mockFeatured.mockResolvedValue([]);
});

describe("(public)/page.tsx", () => {
  it("muestra 'Tu Negocio' como título, ignorando el nombre configurado en la base", async () => {
    await renderPagina();

    expect(screen.getByRole("heading", { level: 1, name: "Tu Negocio" })).toBeInTheDocument();
    expect(screen.queryByText("Café de la Esquina")).toBeNull();
  });

  it("mantiene el enlace al catálogo cuando el local tiene producto disponible", async () => {
    await renderPagina();

    expect(screen.getByRole("link", { name: "Catálogo" })).toHaveAttribute("href", "/menu");
  });
});
