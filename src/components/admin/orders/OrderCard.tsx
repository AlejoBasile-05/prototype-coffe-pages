"use client";

/**
 * Tarjeta de comanda del tablero (Tarea 23).
 *
 * Mobile-first para el contexto real: una tablet o el celu del encargado
 * apoyados al lado de la plancha. Botones de transición de 48px (un
 * pulgar con la mano húmeda no apunta a 32px) y sin drag & drop: un
 * arrastre fallido en táctil mueve la comanda al estado equivocado, que
 * es peor que un toque de más.
 */
import { useState } from "react";

import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { formatARS } from "@/lib/format/currency";
import {
  formatOrderNumber,
  nextStatusesFor,
  ORDER_STATUS_LABELS,
} from "@/lib/domain";
import type { OrderDTO, OrderStatus } from "@/lib/domain";
import type { TransitionOrderActionResult } from "@/server/actions/comandas";
import { transitionOrderStatusAction } from "@/server/actions/comandas";

const STATUS_TONE: Readonly<Record<OrderStatus, BadgeTone>> = {
  PENDING: "warning",
  PREPARING: "info",
  READY: "success",
  CANCELLED: "danger",
};

/** Texto del botón de cada transición. El verbo es el de la cocina. */
const TRANSITION_LABELS: Readonly<Record<Exclude<OrderStatus, "PENDING">, string>> = {
  PREPARING: "Preparar",
  READY: "Listo para entregar",
  CANCELLED: "Cancelar",
};

/** Hora local corta. El `es-AR` fuerza 24 h en cualquier navegador. */
const horaLegible = (iso: string): string =>
  new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

const resumenDeItems = (order: OrderDTO): string =>
  order.items.map((item) => `${item.quantity}× ${item.productName}`).join(" · ");

export interface OrderCardProps {
  readonly order: OrderDTO;
  /**
   * Mutación controlada por el tablero: la tarjeta no se reescribe sola,
   * le avisa al padre con el DTO confirmado por el servidor.
   */
  readonly onTransitioned: (order: OrderDTO) => void;
  /** Con el estado de la acción el tablero decide si refresca. */
  readonly onTransitionFailed: (result: Extract<TransitionOrderActionResult, { ok: false }>) => void;
}

export function OrderCard({ order, onTransitioned, onTransitionFailed }: OrderCardProps) {
  const { show } = useToast();
  const [pendingTransition, setPendingTransition] = useState<OrderStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const destinations = nextStatusesFor(order.status);
  const numero = formatOrderNumber(order.orderNumber);

  const ejecutarTransicion = async (destino: OrderStatus): Promise<void> => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const resultado = await transitionOrderStatusAction({ id: order.id, to: destino });

      if (resultado.ok) {
        onTransitioned(resultado.data);
        show(`${numero} pasó a "${ORDER_STATUS_LABELS[destino]}".`, "success");
        return;
      }

      onTransitionFailed(resultado);
      show(resultado.error, "error");
      // El throw rompe el diálogo de confirmación si no lo capturamos
      // allá: ConfirmDialog muestra `error.message` adentro del modal.
      if (pendingTransition !== null) throw new Error(resultado.error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article
      aria-label={`Pedido ${numero}, ${ORDER_STATUS_LABELS[order.status]}`}
      className="rounded-card border-line bg-paper flex flex-col gap-3 border p-4"
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-ink text-lg tabular-nums">{numero}</p>
          <p className="text-ink-muted text-xs">{horaLegible(order.createdAt)}</p>
        </div>
        <Badge tone={STATUS_TONE[order.status]} size="sm">
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
      </header>

      <div>
        <p className="text-ink text-sm font-medium">{order.customerName}</p>
        <p className="text-ink-muted text-xs">
          {order.fulfillment === "DELIVERY" ? `Envío · ${order.address ?? ""}` : "Retira en el local"}
        </p>
      </div>

      <p className="text-ink text-sm">{resumenDeItems(order)}</p>

      {order.notes !== null && <p className="text-ink-muted text-xs">Nota: {order.notes}</p>}

      <p className="text-ink text-sm font-semibold tabular-nums">{formatARS(order.total)}</p>

      {/* Una acción por destino posible. READY y CANCELLED confirman con
          diálogo (son las irreversibles del turno); PREPARING entra
          directo porque equivocarse de columna ahí se corrige solo. */}
      {destinations.length > 0 && (
        <div className="mt-1 flex flex-col gap-2">
          {destinations
            .filter((destino) => destino !== "READY" && destino !== "CANCELLED")
            .map((destino) =>
              destino === "PREPARING" ? (
                <Button
                  key={destino}
                  variant="primary"
                  size="md"
                  className="min-h-12 w-full"
                  disabled={isSaving}
                  onClick={() => void ejecutarTransicion(destino)}
                >
                  {TRANSITION_LABELS.PREPARING}
                </Button>
              ) : null,
            )}
          {destinations.includes("READY") && (
            <Button
              variant="primary"
              size="md"
              className="min-h-12 w-full"
              disabled={isSaving}
              onClick={() => setPendingTransition("READY")}
            >
              {TRANSITION_LABELS.READY}
            </Button>
          )}
          {destinations.includes("CANCELLED") && (
            <Button
              variant="ghost"
              size="md"
              className="min-h-12 w-full"
              disabled={isSaving}
              onClick={() => setPendingTransition("CANCELLED")}
            >
              {TRANSITION_LABELS.CANCELLED}
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingTransition === "READY"}
        onClose={() => setPendingTransition(null)}
        onConfirm={() => ejecutarTransicion("READY")}
        title={`Cerrar ${numero}`}
        message="Confirmá que el pedido ya se entregó. Esta acción no se puede deshacer."
        confirmLabel="Sí, ya se entregó"
        consequence="neutral"
      />

      <ConfirmDialog
        open={pendingTransition === "CANCELLED"}
        onClose={() => setPendingTransition(null)}
        onConfirm={() => ejecutarTransicion("CANCELLED")}
        title={`Cancelar ${numero}`}
        message="La comanda sale del tablero. Usá esto solo si el cliente anuló por el chat o el pedido es falso."
        confirmLabel="Cancelar el pedido"
        consequence="destructive"
      />
    </article>
  );
}
