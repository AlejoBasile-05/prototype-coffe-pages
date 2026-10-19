import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { ToastViewport } from "@/components/ui/ToastViewport";
import { useCartStore } from "@/store/cart-store";
import type { CartLine } from "@/lib/cart/cart-types";
import { useOpenStateStore } from "@/store/open-state-store";

import { AddToCartButton } from "./AddToCartButton";

const LINE: Omit<CartLine, "quantity"> = {
  productId: "prod-1",
  slug: "tostado",
  name: "Tostado",
  variantId: null,
  variantName: null,
  unitPrice: 3200,
  imageUrl: null,
  available: true,
};

const renderButton = () =>
  render(
    <ToastProvider>
      <AddToCartButton line={LINE} />
      <ToastViewport />
    </ToastProvider>,
  );

describe("AddToCartButton", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [] });
    useOpenStateStore.getState().aplicar(null);
  });

  it("con el local ABIERTO agrega y confirma", async () => {
    const user = userEvent.setup();
    useOpenStateStore.getState().aplicar({ estado: "abierto", cierra: "20:30" });
    renderButton();

    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(await screen.findByText("Agregado al carrito.")).toBeInTheDocument();
  });

  it("con el local CERRADO no agrega y el botón explica cuándo abre", async () => {
    const user = userEvent.setup();
    useOpenStateStore.getState().aplicar({
      estado: "cerrado",
      motivo: "dia_completo",
      proximaApertura: { diaLabel: "Mañana", hora: "08:30" },
    });
    renderButton();

    const boton = screen.getByRole("button", { name: "Cerrado ahora" });
    expect(boton).toBeDisabled();
    await user.click(boton);

    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("mientras el estado no se computó (null) no bloquea: presunción de abierto", async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: "Agregar" }));
    expect(useCartStore.getState().lines).toHaveLength(1);
  });
});
