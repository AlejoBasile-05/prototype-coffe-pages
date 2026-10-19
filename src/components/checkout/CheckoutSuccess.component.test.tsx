import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui";
import type { BusinessSettingsDTO } from "@/lib/domain";

import { CheckoutSuccess } from "./CheckoutSuccess";
import { HANDOFF_KEY } from "./handoff-snapshot";

const BUSINESS: BusinessSettingsDTO = {
  name: "Mi Negocio",
  whatsappPhone: "5492615551234",
  address: null,
  instagramUrl: null,
  openingHours: {},
  closingMessage: null,
  legalNotice: null,
};

const SNAPSHOT = {
  items: [{ productId: "p1", name: "Classic", variantName: null, unitPrice: 1450, quantity: 1 }],
  customer: {
    fullName: "Juan Pérez",
    phone: "5492615551234",
    fulfillment: "pickup" as const,
    address: null,
    notes: null,
  },
  total: 1450,
};

const renderSuccess = () =>
  render(
    <ToastProvider>
      <CheckoutSuccess business={BUSINESS} />
    </ToastProvider>,
  );

beforeEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("CheckoutSuccess", () => {
  it("debe mostrar el enlace real a wa.me con el mensaje ya armado", async () => {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(SNAPSHOT));
    renderSuccess();

    const link = await screen.findByRole("link", { name: /Abrir WhatsApp con el pedido/ });

    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/5492615551234?text="),
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("debe codificar el mensaje en el href sin espacios crudos", async () => {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(SNAPSHOT));
    renderSuccess();

    const link = await screen.findByRole("link", { name: /Abrir WhatsApp/ });
    const href = link.getAttribute("href") ?? "";

    expect(href).not.toContain(" ");
    expect(href).toContain("%C3%A9");
  });

  it("debe mostrar el estado vacío si entra directo por URL sin snapshot", async () => {
    renderSuccess();

    expect(await screen.findByText(/Tu pedido ya está en el chat/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Abrir WhatsApp/ })).toBeNull();
  });

  it("debe sobrevivir a un refresh con el snapshot todavía guardado", async () => {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(SNAPSHOT));
    const { unmount } = renderSuccess();
    await screen.findByRole("link", { name: /Abrir WhatsApp/ });
    unmount();

    renderSuccess();

    expect(await screen.findByRole("link", { name: /Abrir WhatsApp/ })).toBeInTheDocument();
  });

  it("debe avisar que el navegador bloqueó la ventana y dejar el enlace", async () => {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(SNAPSHOT));
    vi.spyOn(window, "open").mockReturnValue(null);
    const user = userEvent.setup();
    renderSuccess();

    await user.click(await screen.findByRole("button", { name: /Abrir en una ventana nueva/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/No pudimos abrir/);
    expect(screen.getByRole("link", { name: /Abrir WhatsApp/ })).toBeInTheDocument();
  });

  it("debe avisar que el mensaje quedó recortado", async () => {
    const notas = "Sin mayonesa, sin cebolla, con la salsa aparte. ".repeat(40);
    window.sessionStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({
        ...SNAPSHOT,
        items: Array.from({ length: 8 }, (_, index) => ({
          productId: `p${index}`,
          name: `Sándwich ${index}`,
          variantName: null,
          unitPrice: 1000,
          quantity: 1,
        })),
        customer: { ...SNAPSHOT.customer, notes: notas },
      }),
    );
    renderSuccess();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/recort/i));
  });
});
