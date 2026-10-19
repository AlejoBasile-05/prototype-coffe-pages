import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui";
import type { BusinessSettingsDTO } from "@/lib/domain";
import { useCartStore } from "@/store/cart-store";

import { CheckoutForm } from "./CheckoutForm";

const push = vi.fn();

// El router es el límite del componente: se mockea, no se testea.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// La revalidación es red. Se mockea para que estos tests midan el
// formulario, no el endpoint. El endpoint tiene sus propios tests.
vi.mock("./use-cart-validation", () => ({
  useCartValidation: () => ({
    reviews: null,
    isValidating: false,
    hasBlockingIssues: false,
    hasPriceChanges: false,
  }),
}));

// El registro de la comanda es una Server Action (Tarea 23): server-only
// por diseño y con `headers()` de Next adentro. Acá se mockea como límite
// del componente; sus defensas tienen tests propios.
vi.mock("@/server/actions/pedidos", () => ({
  registerOrderAction: vi.fn().mockResolvedValue({ ok: true, data: { id: "ord_1", orderNumber: 45 } }),
}));

const BUSINESS: BusinessSettingsDTO = {
  name: "Mi Negocio",
  whatsappPhone: "5492615551234",
  address: null,
  instagramUrl: null,
  openingHours: {},
  closingMessage: null,
  legalNotice: null,
};

const fillValidDraft = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/Nombre/), "Juan Pérez");
  await user.type(screen.getByLabelText(/Tu WhatsApp/), "2615551234");
};

const renderForm = () =>
  render(
    <ToastProvider>
      <CheckoutForm business={BUSINESS} />
    </ToastProvider>,
  );

beforeEach(() => {
  push.mockReset();
  window.sessionStorage.clear();
  useCartStore.setState({
    lines: [
      {
        productId: "prod_1",
        slug: "miga-de-jamon",
        name: "Miga de jamón",
        variantId: null,
        variantName: null,
        unitPrice: 2900,
        quantity: 1,
        imageUrl: null,
        available: true,
      },
    ],
  });
});

describe("CheckoutForm", () => {
  it("debe bloquear el envío con el teléfono inválido y no navegar", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Nombre/), "Juan Pérez");
    await user.type(screen.getByLabelText(/Tu WhatsApp/), "123");
    await user.click(screen.getByRole("button", { name: /Enviar por WhatsApp/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/teléfono/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("debe pedir la dirección solo cuando elige envío", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByLabelText(/Dirección de entrega/)).toBeNull();

    await user.click(screen.getByRole("radio", { name: /Delivery/ }));

    expect(screen.getByLabelText(/Dirección de entrega/)).toBeInTheDocument();
  });

  it("debe llevar el foco al primer campo con error", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /Enviar por WhatsApp/ }));

    await waitFor(() => expect(screen.getByLabelText(/Nombre/)).toHaveFocus());
  });

  it("debe limpiar el carrito y navegar a la pantalla de éxito con el draft válido", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValidDraft(user);

    await user.click(screen.getByRole("button", { name: /Enviar por WhatsApp/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/checkout/exito"));
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("debe mostrar la previsualización del teléfono normalizado en vivo", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Tu WhatsApp/), "261 555 1234");

    expect(screen.getByText(/Va a figurar como \+54 9 261 555-1234/)).toBeInTheDocument();
  });
});
