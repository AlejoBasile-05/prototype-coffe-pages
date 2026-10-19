/**
 * Integración del repositorio de comandas (Tarea 23), contra la base
 * REAL y aislada de tests (ver tests/setup-entorno.ts).
 *
 * Lo que importa acá no es que Prisma funcione, sino las promesas del
 * diseño: snapshot de precios congelado en las líneas, número de comanda
 * autoincremental y transición de estado con chequeo atómico de origen.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createOrder,
  findOrderById,
  findOrdersForBoard,
  transitionOrderStatus,
} from "@/server/repositories/order.repository";
import { disconnectDatabase, resetDatabase } from "../setup";

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

const buildOrder = (overrides: Partial<Parameters<typeof createOrder>[0]> = {}) => ({
  customerName: "Ana Prueba",
  customerPhone: "5492615551234",
  fulfillment: "PICKUP" as const,
  address: null,
  notes: null,
  total: 7600,
  items: [
    {
      productId: "prd_1",
      productName: "Miga de Jamón Crudo y Rúcula",
      variantName: null,
      unitPrice: 3800,
      quantity: 2,
    },
  ],
  ...overrides,
});

describe("order.repository", () => {
  it("crea la comanda con sus líneas y un número legible autoincremental", async () => {
    const primera = await createOrder(buildOrder());
    const segunda = await createOrder(buildOrder());

    expect(primera.status).toBe("PENDING");
    expect(primera.items).toHaveLength(1);
    expect(primera.items[0]?.unitPrice).toBe(3800);
    expect(segunda.orderNumber).toBe(primera.orderNumber + 1);
    expect(primera.total).toBe(7600); // number, nunca Decimal
  });

  it("la línea es un snapshot: la comanda no depende del producto", async () => {
    const orden = await createOrder(buildOrder({ items: [{ ...buildOrder().items[0]!, productId: null }] }));

    expect(orden.items[0]?.productName).toBe("Miga de Jamón Crudo y Rúcula");
  });

  it("findOrdersForBoard devuelve las del día, más nuevas primero", async () => {
    await createOrder(buildOrder({ customerName: "Primera" }));
    await createOrder(buildOrder({ customerName: "Segunda" }));

    const board = await findOrdersForBoard({ dayStartUtc: new Date(Date.now() - 60_000) });

    expect(board).toHaveLength(2);
    expect(board[0]?.customerName).toBe("Segunda");
  });

  it("findOrdersForBoard excluye las anteriores al borde del día", async () => {
    await createOrder(buildOrder());

    const board = await findOrdersForBoard({ dayStartUtc: new Date(Date.now() + 60_000) });

    expect(board).toEqual([]);
  });

  it("transitionOrderStatus mueve la comanda cuando el origen coincide", async () => {
    const orden = await createOrder(buildOrder());

    const actualizada = await transitionOrderStatus(orden.id, "PENDING", "PREPARING");

    expect(actualizada?.status).toBe("PREPARING");
  });

  it("transitionOrderStatus NO escribe cuando el origen ya cambió (carrera)", async () => {
    const orden = await createOrder(buildOrder());
    await transitionOrderStatus(orden.id, "PENDING", "PREPARING");

    // Un segundo encargado intenta moverla desde el estado viejo.
    const perdedora = await transitionOrderStatus(orden.id, "PENDING", "CANCELLED");

    expect(perdedora).toBeNull();
    expect((await findOrderById(orden.id))?.status).toBe("PREPARING");
  });
});
