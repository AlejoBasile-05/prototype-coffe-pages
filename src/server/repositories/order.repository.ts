/**
 * Acceso a datos de comandas (Tarea 23).
 *
 * Misma regla que el resto de la capa: traduce la base, no la interpreta.
 * La máquina de estados vive en `@/lib/domain/order` y la aplica el
 * servicio; este repositorio escribe lo que le piden, sin decidir.
 */
import "server-only";

import { Prisma, type OrderStatus } from "@prisma/client";

import { prisma } from "@/server/infra/prisma";
import { ResourceNotFoundError } from "@/lib/domain";
import type { OrderDTO, OrderFulfillment } from "@/lib/domain";

import { ORDER_SELECT, toOrderDTO } from "./mappers/order.mapper";

/** Línea ya cotizada por el servidor. NUNCA viaja el precio del cliente. */
export interface CreateOrderItemInput {
  readonly productId: string | null;
  readonly productName: string;
  readonly variantName: string | null;
  readonly unitPrice: number;
  readonly quantity: number;
}

export interface CreateOrderInput {
  readonly customerName: string;
  readonly customerPhone: string;
  readonly fulfillment: OrderFulfillment;
  readonly address: string | null;
  readonly notes: string | null;
  readonly total: number;
  readonly items: readonly CreateOrderItemInput[];
}

/**
 * Crea la comanda con sus líneas en una sola transacción.
 *
 * La transacción no es un refinamiento: una comanda sin líneas (o con la
 * mitad) entraría al tablero de cocina como un pedido válido y pidiendo
 * cobrar un total que no cierra.
 */
export const createOrder = async (input: CreateOrderInput): Promise<OrderDTO> => {
  const order = await prisma.order.create({
    data: {
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      fulfillment: input.fulfillment,
      address: input.address,
      notes: input.notes,
      total: input.total,
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          variantName: item.variantName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
      },
    },
    select: ORDER_SELECT,
  });

  return toOrderDTO(order);
};

/**
 * Las comandas del tablero: las ACTIVAS de hoy.
 *
 * ⚠️ READY y CANCELLED "de hoy" también entran: el encargado necesita
 *    ver que el pedido se cerró, y la columna "Listos" funciona como la
 *    memoria del turno. El filtro por fecha es del día en la zona del
 *    servidor (Vercel corre en UTC; el negocio está en UTC-3 — se pasa
 *    el borde del día como parámetro para que el servicio lo calcule con
 *    la hora del local, no con la del datacenter).
 */
export const findOrdersForBoard = async (options: {
  readonly dayStartUtc: Date;
  readonly limit?: number;
}): Promise<OrderDTO[]> => {
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: options.dayStartUtc } },
    select: ORDER_SELECT,
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 100,
  });

  return orders.map(toOrderDTO);
};

/** Una comanda por id. `null` si no existe: la decisión de error es del servicio. */
export const findOrderById = async (id: string): Promise<OrderDTO | null> => {
  const order = await prisma.order.findUnique({ where: { id }, select: ORDER_SELECT });
  return order ? toOrderDTO(order) : null;
};

/**
 * Transición de estado con chequeo ATÓMICO de origen.
 *
 * ⛔ No es `update({ where: { id } })` a secas: dos encargados con la
 *    tablet y el celu pueden intentar mover la misma comanda a la vez.
 *    `updateMany` con el estado de ORIGEN en el `where` hace que el
 *    segundo pierda (`count: 0`) en vez de pisar al primero, y la fila
 *    nunca pasa por un estado que la máquina de dominio no permitió en
 *    el orden en que se resolvieron las escrituras.
 *
 * Devuelve `null` si la fila no existe o ya no estaba en `from`: el
 * servicio lo traduce a conflicto o a not-found leyendo de nuevo.
 */
export const transitionOrderStatus = async (
  id: string,
  from: OrderStatus,
  to: OrderStatus,
): Promise<OrderDTO | null> => {
  try {
    const result = await prisma.order.updateMany({
      where: { id, status: from },
      data: { status: to, updatedAt: new Date() },
    });

    if (result.count === 0) return null;

    return await findOrderById(id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ResourceNotFoundError("Comanda", id);
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
};
