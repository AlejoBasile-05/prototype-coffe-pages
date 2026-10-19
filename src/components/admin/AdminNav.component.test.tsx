import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminNav } from "./AdminNav";

let pathname = "/admin/productos";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  pathname = "/admin/productos";
});

describe("AdminNav", () => {
  it("debe marcar con aria-current la sección de la ruta actual", () => {
    render(<AdminNav variant="sidebar" businessName="Mi Negocio" />);

    expect(screen.getByRole("link", { name: "Productos" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Catálogo" })).not.toHaveAttribute("aria-current");
  });

  it("debe marcar Catálogo y no Productos cuando la ruta es /admin exacta", () => {
    // `/admin` es prefijo de `/admin/productos`: sin el `${href}/` del
    // `startsWith`, las dos secciones quedan activas a la vez.
    pathname = "/admin";
    render(<AdminNav variant="sidebar" businessName="Mi Negocio" />);

    expect(screen.getByRole("link", { name: "Catálogo" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Productos" })).not.toHaveAttribute("aria-current");
  });

  it("debe mostrar todas las secciones activas del panel como enlaces", () => {
    render(<AdminNav variant="sidebar" businessName="Mi Negocio" />);

    // Ajustes y categorías ya están habilitados por la Tarea 17: nada
    // de "sin aparezir": el encargado entra y ve lo que hay.
    expect(screen.getByRole("link", { name: "Catálogo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Productos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Categorías" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configuración" })).toBeInTheDocument();
  });

  it("debe abrir el panel en mobile con el Sheet y cerrarlo al elegir una sección", async () => {
    const user = userEvent.setup();
    render(<AdminNav variant="sheet" businessName="Mi Negocio" />);

    const trigger = screen.getByRole("button", { name: "Menú" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog", { name: "Panel" });
    expect(dialog).toBeInTheDocument();

    // Elegir una sección navega: el panel se cierra solo, como un drawer.
    await user.click(screen.getByRole("link", { name: "Productos" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("no debe montar el disparador del panel en la variante de escritorio", () => {
    render(<AdminNav variant="sidebar" businessName="Mi Negocio" />);

    expect(screen.queryByRole("button", { name: "Menú" })).toBeNull();
    expect(screen.getByRole("link", { name: "Catálogo" })).toBeInTheDocument();
  });
});
