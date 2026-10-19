import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { BusinessSettingsDTO } from "@/lib/domain";
import type { WhatsAppCustomer } from "@/lib/whatsapp/message-contract";

import type { CartLineReview } from "./use-cart-validation";
import { WhatsAppHandoff } from "./WhatsAppHandoff";

const BUSINESS: BusinessSettingsDTO = {
  name: "Mi Negocio",
  whatsappPhone: "5492615551234",
  address: null,
  instagramUrl: null,
  openingHours: {},
  closingMessage: null,
  legalNotice: null,
};

const CUSTOMER: WhatsAppCustomer = {
  fullName: "Juan Pérez",
  phone: "5492615551234",
  fulfillment: "pickup",
  address: null,
  notes: null,
};

const LINES = [
  { productId: "p1", name: "Classic", variantName: null, unitPrice: 1450, quantity: 2 },
];

const renderHandoff = (props: Partial<Parameters<typeof WhatsAppHandoff>[0]> = {}) =>
  render(
    <form>
      <WhatsAppHandoff
        business={BUSINESS}
        lines={LINES}
        customer={CUSTOMER}
        total={2900}
        reviews={null}
        isValidating={false}
        {...props}
      />
    </form>,
  );

describe("WhatsAppHandoff", () => {
  it("debe tener un button submit y no un enlace a wa.me", () => {
    renderHandoff();

    expect(screen.getByRole("button", { name: /Enviar por WhatsApp/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /wa\.me/ })).toBeNull();
  });

  it("debe avisar que hay precios que cambiaron sin bloquear el envío", () => {
    const reviews: CartLineReview[] = [
      {
        productId: "p1",
        variantId: null,
        currentUnitPrice: 1600,
        isPriceChanged: true,
        issue: null,
      },
    ];
    renderHandoff({ reviews });

    expect(screen.getByRole("status")).toHaveTextContent(/cambió de precio/);
    expect(screen.getByRole("button", { name: /Enviar por WhatsApp/ })).not.toBeDisabled();
  });

  it("debe avisar con role=alert que hay productos no comprables", () => {
    const reviews: CartLineReview[] = [
      {
        productId: "p1",
        variantId: null,
        currentUnitPrice: null,
        isPriceChanged: false,
        issue: "FUERA_DE_CATALOGO",
      },
    ];
    renderHandoff({ reviews });

    expect(screen.getByRole("alert")).toHaveTextContent(/ya no se pueden pedir/);
  });

  it("debe renderizar el preview del mensaje solo al abrir el details", async () => {
    const user = userEvent.setup();
    renderHandoff();

    expect(screen.queryByText(/Quiero hacer un pedido/)).toBeNull();

    await user.click(screen.getByText("Ver el mensaje que se va a enviar"));

    expect(screen.getByText(/Quiero hacer un pedido/)).toBeInTheDocument();
  });

  it("debe no romperse en el preview con datos a medio cargar", async () => {
    const user = userEvent.setup();
    renderHandoff({ customer: { ...CUSTOMER, fullName: "" } });

    await user.click(screen.getByText("Ver el mensaje que se va a enviar"));

    expect(screen.getByText(/Completá tus datos/)).toBeInTheDocument();
  });
});
