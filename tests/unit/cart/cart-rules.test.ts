import { describe, expect, it } from "vitest";

import {
  addItemToCart,
  calculateCartSubtotal,
  clearCart,
  getCartItemCount,
  isCartEmpty,
  removeItemFromCart,
  updateItemQuantity,
} from "@/lib/cart/cart-rules";
import { MAX_DISTINCT_LINES, MAX_QUANTITY_PER_ITEM, type CartLine } from "@/lib/cart/cart-types";

const EMPTY: { lines: CartLine[] } = { lines: [] };

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: "prod-1",
    slug: "cafe",
    name: "Café",
    variantId: null,
    variantName: null,
    unitPrice: 4500,
    quantity: 1,
    imageUrl: null,
    available: true,
    ...overrides,
  };
}

describe("addItemToCart", () => {
  it("agrega una línea nueva", () => {
    expect(addItemToCart(EMPTY, line()).lines).toHaveLength(1);
  });

  it("suma cantidad si el producto ya estaba", () => {
    const first = addItemToCart(EMPTY, line({ quantity: 2 }));
    const next = addItemToCart(first, line({ quantity: 3 }));

    expect(next.lines).toHaveLength(1);
    expect(next.lines[0]?.quantity).toBe(5);
  });

  it("mantiene el precio original al sumar cantidad", () => {
    const first = addItemToCart(EMPTY, line({ unitPrice: 4000 }));
    const next = addItemToCart(first, line({ unitPrice: 5000 }));

    expect(next.lines[0]?.unitPrice).toBe(4000);
  });

  it("trata la variante como otra línea", () => {
    const first = addItemToCart(EMPTY, line({ variantId: "chico" }));
    const next = addItemToCart(first, line({ variantId: "grande" }));

    expect(next.lines).toHaveLength(2);
  });

  it("respeta el tope por producto", () => {
    const full = addItemToCart(EMPTY, line({ quantity: MAX_QUANTITY_PER_ITEM }));
    const next = addItemToCart(full, line({ quantity: 5 }));

    expect(next.lines[0]?.quantity).toBe(MAX_QUANTITY_PER_ITEM);
  });

  it("no agrega un producto agotado", () => {
    expect(addItemToCart(EMPTY, line({ available: false })).lines).toHaveLength(0);
  });

  it("no supera el tope de líneas distintas", () => {
    let state = EMPTY;
    for (let index = 0; index < MAX_DISTINCT_LINES + 5; index += 1) {
      state = addItemToCart(state, line({ productId: `prod-${index}` }));
    }

    expect(state.lines).toHaveLength(MAX_DISTINCT_LINES);
  });
});

describe("updateItemQuantity", () => {
  it("cambia la cantidad de la línea indicada", () => {
    const state = addItemToCart(EMPTY, line());
    const next = updateItemQuantity(state, "prod-1", null, 4);

    expect(next.lines[0]?.quantity).toBe(4);
  });

  it("recorta al tope por producto", () => {
    const state = addItemToCart(EMPTY, line());
    const next = updateItemQuantity(state, "prod-1", null, 999);

    expect(next.lines[0]?.quantity).toBe(MAX_QUANTITY_PER_ITEM);
  });

  it("quita la línea si la cantidad llega a cero", () => {
    const state = addItemToCart(EMPTY, line());
    const next = updateItemQuantity(state, "prod-1", null, 0);

    expect(next.lines).toHaveLength(0);
  });

  it("no hace nada si la línea no existe", () => {
    const state = addItemToCart(EMPTY, line());

    expect(updateItemQuantity(state, "no-existe", null, 3)).toBe(state);
  });
});

describe("subtotal y contadores", () => {
  it("suma precio por cantidad", () => {
    const first = addItemToCart(EMPTY, line({ quantity: 2 }));
    const second = addItemToCart(
      first,
      line({ productId: "prod-2", unitPrice: 1200, quantity: 1 }),
    );

    expect(calculateCartSubtotal(second)).toBe(10200);
  });

  it("cuenta unidades, no líneas", () => {
    const first = addItemToCart(EMPTY, line({ quantity: 3 }));
    const second = addItemToCart(first, line({ productId: "prod-2", quantity: 2 }));

    expect(getCartItemCount(second)).toBe(5);
  });

  it("un carrito recién vaciado está vacío", () => {
    expect(isCartEmpty(clearCart())).toBe(true);
  });

  it("quitar una línea no toca las otras", () => {
    const first = addItemToCart(EMPTY, line({ quantity: 1 }));
    const second = addItemToCart(first, line({ productId: "prod-2", quantity: 1 }));
    const next = removeItemFromCart(second, "prod-1", null);

    expect(next.lines).toHaveLength(1);
    expect(next.lines[0]?.productId).toBe("prod-2");
  });
});
