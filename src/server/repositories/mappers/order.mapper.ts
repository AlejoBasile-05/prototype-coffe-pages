/**
 * Traducción de la fila de Prisma al DTO del dominio (Tarea 23).
 *
 * ⛔ `Prisma.Decimal` NO cruza el límite servidor→cliente: acá se aplica
 *    `.toNumber()` sobre cada precio, igual que en `product.mapper`
 *    (Tarea 08 §4.3). Un Decimal serializado llega como objeto y la
 *    tarjeta del tablero mostraría "[object Object]".
 */
import type { Prisma } from "@prisma/client";

import type { OrderDTO, OrderFulfillment, OrderStatus } from "@/lib/domain";

export const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  customerName: true,
  customerPhone: true,
  fulfillment: true,
  address: true,
  notes: true,
  total: true,
  createdAt: true,
  items: {
    select: {
      productName: true,
      variantName: true,
      unitPrice: true,
      quantity: true,
    },
    orderBy: { id: "asc" as const },
  },
} satisfies Prisma.OrderSelect;

export type OrderWithItems = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;

export const toOrderDTO = (order: OrderWithItems): OrderDTO => ({
  id: order.id,
  orderNumber: order.orderNumber,
  status: order.status as OrderStatus,
  customerName: order.customerName,
  customerPhone: order.customerPhone,
  fulfillment: order.fulfillment as OrderFulfillment,
  address: order.address,
  notes: order.notes,
  total: order.total.toNumber(),
  items: order.items.map((item) => ({
    productName: item.productName,
    variantName: item.variantName,
    unitPrice: item.unitPrice.toNumber(),
    quantity: item.quantity,
  })),
  createdAt: order.createdAt.toISOString(),
});
