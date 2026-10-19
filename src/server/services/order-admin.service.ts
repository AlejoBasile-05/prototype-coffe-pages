/**
 * Administración de comandas (Tarea 23): la transición de estado.
 *
 * La máquina de estados vive en `@/lib/domain/order` y se consulta acá,
 * ANTES de escribir. El repositorio además hace el chequeo atómico de
 * origen, así que dos encargados simultáneos no pueden pisarse.
 */
import "server-only";

import { ConflictError, ResourceNotFoundError, canTransitionOrder } from "@/lib/domain";
import type { OrderDTO, OrderStatus } from "@/lib/domain";
import type { OrderStatus as PrismaOrderStatus } from "@prisma/client";

/** Solo lo que la transición necesita del repositorio (ISP). */
export interface OrderStatusChanger {
  findOrderById(id: string): Promise<OrderDTO | null>;
  transitionOrderStatus(
    id: string,
    from: PrismaOrderStatus,
    to: PrismaOrderStatus,
  ): Promise<OrderDTO | null>;
}

/**
 * Mueve la comanda al estado destino.
 *
 * @throws ResourceNotFoundError si el id no existe.
 * @throws ConflictError si la transición no es válida o el estado cambió
 *         desde que se leyó la pantalla (otro encargado llegó primero).
 */
export const transitionOrder = async (
  dependencies: { readonly orderRepository: OrderStatusChanger },
  input: { readonly id: string; readonly to: OrderStatus },
): Promise<OrderDTO> => {
  const order = await dependencies.orderRepository.findOrderById(input.id);

  if (order === null) {
    throw new ResourceNotFoundError("Comanda", input.id);
  }

  if (!canTransitionOrder(order.status, input.to)) {
    throw new ConflictError(
      `No se puede pasar una comanda de "${order.status}" a "${input.to}".`,
    );
  }

  const updated = await dependencies.orderRepository.transitionOrderStatus(
    input.id,
    order.status,
    input.to,
  );

  if (updated === null) {
    // Perdimos la carrera: la fila ya no está en el estado que leímos.
    throw new ConflictError(
      "La comanda cambió de estado desde otra pantalla. Actualizá el tablero.",
    );
  }

  return updated;
};
