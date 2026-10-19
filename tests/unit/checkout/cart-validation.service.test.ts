/** ⛔ `environment: "node"`: el servicio es de servidor y no toca el DOM. */
import { describe, expect, it } from "vitest";

import type { ProductDTO } from "@/lib/domain";
import { validateCartLines } from "@/server/services/cart-validation.service";

const product = (overrides: Partial<ProductDTO> = {}): ProductDTO => ({
  id: "p1",
  slug: "classic",
  name: "Classic",
  description: null,
  price: 1000,
  imageUrl: "",
  imagePublicId: null,
  isAvailable: true,
  status: "PUBLISHED",
  isFeatured: false,
  sortOrder: 0,
  allergens: [],
  categoryId: "c1",
  variants: [{ id: "v1", name: "Sin cebolla", priceDelta: 100, isAvailable: true, sortOrder: 0 }],
  ...overrides,
});

/** El doble implementa solo el puerto, no `ProductRepository` entero. */
const reader = (products: readonly ProductDTO[]) => ({
  productRepository: { findPublishedProducts: async () => [...products] },
});

describe("validateCartLines", () => {
  it("debe devolver el precio vigente con el priceDelta de la variante", async () => {
    const result = await validateCartLines(reader([product()]), [
      { productId: "p1", variantId: "v1" },
    ]);

    expect(result.lines[0]?.currentUnitPrice).toBe(1100);
    expect(result.hasBlockingIssues).toBe(false);
  });

  it("debe marcar FUERA_DE_CATALOGO con precio null, no con cero", async () => {
    const result = await validateCartLines(reader([]), [
      { productId: "no-existe", variantId: null },
    ]);

    expect(result.lines[0]?.issue).toBe("FUERA_DE_CATALOGO");
    // ⛔ Cero significaría "gratis" y el cliente vería un pedido de $0.
    expect(result.lines[0]?.currentUnitPrice).toBeNull();
    expect(result.hasBlockingIssues).toBe(true);
  });

  it("debe distinguir producto agotado de producto inexistente", async () => {
    const result = await validateCartLines(reader([product({ isAvailable: false })]), [
      { productId: "p1", variantId: null },
    ]);

    expect(result.lines[0]?.issue).toBe("PRODUCTO_AGOTADO");
    // Agotado igual tiene precio: el cliente lo ve y puede esperar.
    expect(result.lines[0]?.currentUnitPrice).toBe(1000);
  });

  it("debe marcar la variante que no existe sin tirar abajo la línea", async () => {
    const result = await validateCartLines(reader([product()]), [
      { productId: "p1", variantId: "v99" },
    ]);

    expect(result.lines[0]?.issue).toBe("VARIANTE_NO_DISPONIBLE");
    expect(result.lines[0]?.isInCatalog).toBe(true);
  });

  it("debe pedir los agotados también, para no reportarlos como inexistentes", async () => {
    const pedidos: unknown[] = [];
    const deps = {
      productRepository: {
        findPublishedProducts: async (options?: { readonly onlyAvailable?: boolean }) => {
          pedidos.push(options);
          return [product({ isAvailable: false })];
        },
      },
    };

    await validateCartLines(deps, [{ productId: "p1", variantId: null }]);

    // Si se pidieran solo los disponibles, un agotado sería
    // indistinguible de un producto que ya no existe.
    expect(pedidos).toEqual([undefined]);
  });
});
