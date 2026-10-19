import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ToastProvider, ToastViewport } from "@/components/ui";

import { ProductCard, type ProductCardData } from "./ProductCard";

const AVAILABLE: ProductCardData = {
  id: "prod-1",
  slug: "jdq-clasico",
  name: "Jamón y queso clásico",
  description: "Jamón natural, queso y pan de miga de la casa.",
  price: 4500,
  available: true,
  imageUrl: "",
};

const SOLD_OUT: ProductCardData = {
  ...AVAILABLE,
  id: "prod-2",
  slug: "cortado",
  name: "Cortado",
  available: false,
};

function renderCard(product: ProductCardData) {
  return render(
    <ToastProvider>
      <ProductCard product={product} />
      <ToastViewport />
    </ToastProvider>,
  );
}

describe("ProductCard", () => {
  it("muestra el precio formateado y el botón cuando hay stock", () => {
    renderCard(AVAILABLE);

    expect(screen.getByText("Jamón y queso clásico")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar" })).toBeInTheDocument();
    expect(screen.getByText(/\$\s?4\.500/)).toBeInTheDocument();
  });

  it("sin botón y con badge cuando está agotado", () => {
    renderCard(SOLD_OUT);

    // Both the badge and the price line show "Sin stock"
    expect(screen.getAllByText("Sin stock")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Agregar" })).not.toBeInTheDocument();
  });

  it("agrega el producto al carrito y avisa con un toast", async () => {
    const user = userEvent.setup();
    renderCard(AVAILABLE);

    await user.click(screen.getByRole("button", { name: "Agregar" }));

    const { useCartStore } = await import("@/store/cart-store");
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCartStore.getState().lines[0]?.productId).toBe("prod-1");
    expect(screen.getByText("Agregado al carrito.")).toBeInTheDocument();

    useCartStore.setState({ lines: [] });
  });

  it("expone el enlace de la ficha con nombre accesible", () => {
    renderCard(AVAILABLE);

    expect(screen.getByRole("link", { name: "Producto: Jamón y queso clásico" })).toHaveAttribute(
      "href",
      "/producto/jdq-clasico",
    );
  });
});