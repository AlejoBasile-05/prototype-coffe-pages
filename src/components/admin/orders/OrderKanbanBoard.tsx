"use client";

/**
 * Tablero de comandas: tres columnas, una sola dirección (Tarea 23).
 *
 * Flujo de datos:
 *   · El Server Component trae el snapshot del turno (`initialOrders`).
 *   · Las transiciones se aplican OPTIMISTAS en el estado local y se
 *     confirman con el DTO que devuelve la action.
 *   · Los cambios de OTROS dispositivos llegan por `useOrdersRealtime`,
 *     que dispara `router.refresh()`: el servidor re-renderiza y el
 *     efecto de sincronización adopta la nueva lista.
 *
 * ⛔ Cuando el servidor trae una versión NUEVA de una comanda que el
 *    tablero acaba de mover, gana el servidor.
 */
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/ui";
import { BOARD_STATUSES, ORDER_STATUS_LABELS } from "@/lib/domain";
import type { OrderDTO, OrderStatus } from "@/lib/domain";
import { useOrdersRealtime, type BoardSyncMode } from "@/hooks/use-orders-realtime";
import { sanitizeNextPath } from "@/lib/validation/ruta-retorno";

import { OrderCard } from "./OrderCard";
import type { TransitionOrderActionResult } from "@/server/actions/comandas";

/** Columna: las del día, más viejas arriba (la cocina trabaja en orden). */
const ordersOfStatus = (orders: readonly OrderDTO[], status: OrderStatus): OrderDTO[] =>
  orders
    .filter((order) => order.status === status)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

const SYNC_LABELS: Readonly<Record<BoardSyncMode, string>> = {
  realtime: "Actualización en vivo",
  polling: "Actualización cada 10 segundos",
};

export function OrderKanbanBoard({ initialOrders }: { readonly initialOrders: OrderDTO[] }) {
  const router = useRouter();
  const [orders, setOrders] = useState<readonly OrderDTO[]>(initialOrders);
  const [syncMode, setSyncMode] = useState<BoardSyncMode>("realtime");

  // El servidor es la verdad: cada refresh adopta su lista. Es el patrón
  // de "estado derivado en el render" de React (comparar props previas y
  // ajustar en el mismo render), NO un setState dentro de un efecto: el
  // lint lo prohíbe y con razón — un efecto encadenaría un render extra
  // con la lista vieja visible.
  const [prevInitialOrders, setPrevInitialOrders] = useState(initialOrders);
  if (prevInitialOrders !== initialOrders) {
    setPrevInitialOrders(initialOrders);
    setOrders(initialOrders);
  }

  const handleModeChange = useCallback((mode: BoardSyncMode) => setSyncMode(mode), []);
  useOrdersRealtime(handleModeChange);

  const applyTransition = useCallback((updated: OrderDTO) => {
    setOrders((current) =>
      current.map((order) => (order.id === updated.id ? updated : order)),
    );
  }, []);

  const handleTransitionFailed = useCallback(
    (result: Extract<TransitionOrderActionResult, { ok: false }>) => {
      if (result.code === "UNAUTHORIZED") {
        router.replace(`/login?next=${encodeURIComponent(sanitizeNextPath("/admin/comandas"))}`);
        return;
      }
      if (result.code === "RESOURCE_NOT_FOUND" || result.code === "CONFLICT") {
        // La fila desapareció o la movió otro dispositivo: la verdad
        // la tiene el servidor, así que el tablero se recarga.
        router.refresh();
      }
    },
    [router],
  );

  return (
    <div aria-busy={false}>
      <p role="status" className="text-ink-muted mb-4 text-xs">
        {SYNC_LABELS[syncMode]}
      </p>

      <div className="grid items-start gap-4 md:grid-cols-3">
        {BOARD_STATUSES.map((status) => {
          const columnOrders = ordersOfStatus(orders, status);

          return (
            <section
              key={status}
              aria-label={ORDER_STATUS_LABELS[status]}
              className="rounded-card bg-cream/60 flex flex-col gap-3 p-3"
            >
              <h2 className="font-display text-ink text-base">
                {ORDER_STATUS_LABELS[status]}
                <span className="text-ink-muted ml-2 text-sm font-normal tabular-nums">
                  {columnOrders.length}
                </span>
              </h2>

              {columnOrders.length === 0 ? (
                <div className="py-4">
                  <EmptyState
                    title="Sin pedidos"
                    message={
                      status === "PENDING"
                        ? "Los pedidos que confirman en la web llegan acá."
                        : "Cuando muevas un pedido a esta columna, aparece acá."
                    }
                  />
                </div>
              ) : (
                columnOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onTransitioned={applyTransition}
                    onTransitionFailed={handleTransitionFailed}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
