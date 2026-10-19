/**
 * Tests del Componente `CartLineItem`. El `beforeEach` escribe el
 * estado del store directo con `setState`: así se prueba sin
 * `localStorage` ni rehidratación, que en JSDOM no son las de un
 * dispositivo real.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CartLine } from "@/lib/cart/cart-types";
import { useCartStore } from "@/store/cart-store";

import { CartLineItem } from "./CartLineItem";

const LINE: CartLine = {
  productId: "prod-1",
  slug: "cafe",
  name: "Café",
  variantId: null,
  variantName: null,
  unitPrice: 4500,
  quantity: 2,
  imageUrl: null,
  available: true,
};

function renderLine(line: CartLine = LINE) {
  return render(
    <ul>
      <CartLineItem line={line} />
    </ul>,
  );
}

describe("CartLineItem", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [LINE] });
  });

  it("muestra el total de la línea, no el precio unitario", () => {
    renderLine();

    expect(screen.getByText("Café")).toBeInTheDocument();
    expect(screen.getByText(/9\.000/)).toBeInTheDocument();
  });

  it("avisa cuando el producto ya no está disponible", () => {
    renderLine({ ...LINE, available: false });

    expect(screen.getByText("Ya no está disponible")).toBeInTheDocument();
  });

  it("quita la línea del store", async () => {
    const user = userEvent.setup();
    renderLine();

    await user.click(screen.getByRole("button", { name: "Quitar Café del carrito" }));

    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("cambia la cantidad desde el stepper", async () => {
    const user = userEvent.setup();
    renderLine();

    await user.click(screen.getByRole("button", { name: "Agregar una unidad de Café" }));

    expect(useCartStore.getState().lines[0]?.quantity).toBe(3);
  });

  it("une el nombre con el nombre de la variante", () => {
    renderLine({ ...LINE, variantName: "Grande" });

    expect(screen.getByText("Café · Grande")).toBeInTheDocument();
  });
});
