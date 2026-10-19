/**
 * Servicio de registro de comandas (Tarea 23), con puertos inyectados:
 * corre sin base de datos (misma regla que el resto de los unit tests).
 *
 * Lo que se fija acá es la promesa de seguridad de la feature: el precio
 * LO PONE EL SERVIDOR, y un pedido con un producto agotado no entra al
 * tablero aunque el payload esté perfectamente armado.
 */
import { describe, expect, it } from "vitest";

import { ConflictError, ValidationError } from "@/lib/domain";
import type { ProductDTO } from "@/lib/domain";
import { registerCheckoutOrder } from "@/server/services/order.service";
import type { CreateOrderInput } from "@/server/repositories/order.repository";
import type { WhatsAppCustomer } from "@/lib/whatsapp/message-contract";

const producto = (overrides: Partial<ProductDTO> = {}): ProductDTO => ({
  id: "prd_1",
  name: "Miga de Jamón Crudo y Rúcula",
  slug: "miga-jamon-crudo-rucula",
  description: null,
  price: 3800,
  imageUrl: "https://res.cloudinary.com/demo/image/upload/x.jpg",
  imagePublicId: null,
  isAvailable: true,
  status: "PUBLISHED",
  isFeatured: false,
  sortOrder: 0,
  allergens: [],
  categoryId: "cat_1",
  variants: [],
  ...overrides,
});

const cliente: WhatsAppCustomer = {
  fullName: "Ana Prueba",
  phone: "5492615551234",
  fulfillment: "pickup",
  address: null,
  notes: null,
};

const registrarCon = (products: ProductDTO[]) => {
  const registradas: CreateOrderInput[] = [];
  const deps = {
    productRepository: {
      findPublishedProducts: async () => products,
    },
    orderRepository: {
      createOrder: async (input: CreateOrderInput) => {
        registradas.push(input);
        return {
          id: "ord_1",
          orderNumber: 45,
          status: "PENDING" as const,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          fulfillment: input.fulfillment,
          address: input.address,
          notes: input.notes,
          total: input.total,
          items: input.items.map((item) => ({
            productName: item.productName,
            variantName: item.variantName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          })),
          createdAt: new Date().toISOString(),
        };
      },
    },
  };
  return { deps, registradas };
};

describe("registerCheckoutOrder", () => {
  it("registra la comanda con el precio VIGENTE en base, no con el del cliente", async () => {
    const { deps, registradas } = registrarCon([producto({ price: 4200 })]);

    const orden = await registerCheckoutOrder(deps, {
      items: [{ productId: "prd_1", quantity: 2 }],
      customer: cliente,
    });

    expect(orden.orderNumber).toBe(45);
    expect(registradas).toHaveLength(1);
    expect(registradas[0]?.items[0]?.unitPrice).toBe(4200);
    expect(registradas[0]?.total).toBe(8400);
  });

  it("rechaza el pedido si un producto está agotado (issue bloqueante)", async () => {
    const { deps, registradas } = registrarCon([producto({ isAvailable: false })]);

    const error = await registerCheckoutOrder(deps, {
      items: [{ productId: "prd_1", quantity: 1 }],
      customer: cliente,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(registradas).toHaveLength(0);
  });

  it("rechaza el pedido si el producto no está publicado", async () => {
    const { deps } = registrarCon([]); // el repo solo devuelve publicados

    const error = await registerCheckoutOrder(deps, {
      items: [{ productId: "prd_inexistente", quantity: 1 }],
      customer: cliente,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
  });

  it("rechaza un pedido sin ítems", async () => {
    const { deps } = registrarCon([producto()]);

    const error = await registerCheckoutOrder(deps, {
      items: [],
      customer: cliente,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
  });

  it("traduce fulfillment del contrato del mensaje al enum de la base", async () => {
    const { deps, registradas } = registrarCon([producto()]);

    await registerCheckoutOrder(deps, {
      items: [{ productId: "prd_1", quantity: 1 }],
      customer: { ...cliente, fulfillment: "delivery", address: "Calle Falsa 123" },
    });

    expect(registradas[0]?.fulfillment).toBe("DELIVERY");
    expect(registradas[0]?.address).toBe("Calle Falsa 123");
  });
});
