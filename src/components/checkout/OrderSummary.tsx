"use client";

/**
 * Resumen de solo lectura. Nunca edita el carrito: el carrito se edita
 * en el `CartSheet` (Tarea 11). Lo único que sí hace es **sacar** una
 * línea que ya no se puede pedir, que no es editar el carrito sino
 * arreglar un pedido imposible.
 *
 * El precio que se muestra es **el del carrito**, no el de la
 * revalidación: si el precio cambió, el cliente ve el tachado y el
 * nuevo, y el chat resuelve (§6.9). Cambiar el total en pantalla sin
 * cambiar el mensaje mandaría dos números distintos al encargado.
 */
import { useState } from "react";

import { Badge, Button } from "@/components/ui";
import { formatARS } from "@/lib/format/currency";
import { orderTotal } from "@/lib/whatsapp/message-contract";
import { useCartStore } from "@/store/cart-store";

import type { CartLineReview } from "./use-cart-validation";

interface OrderSummaryProps {
  /** `null` mientras no se sabe: no se muestra ni precio nuevo ni error. */
  readonly reviews: readonly CartLineReview[] | null;
}

const ISSUE_TEXT = {
  FUERA_DE_CATALOGO: "Ya no está en el menú",
  PRODUCTO_AGOTADO: "Se agotó",
  VARIANTE_NO_DISPONIBLE: "Esa variante no está disponible",
} as const;

export function OrderSummary({ reviews }: OrderSummaryProps) {
  const lines = useCartStore((state) => state.lines);
  const removeItem = useCartStore((state) => state.removeItem);
  const [isExpanded, setIsExpanded] = useState(false);

  if (lines.length === 0) return null;

  const findReview = (productId: string, variantId: string | null): CartLineReview | undefined =>
    reviews?.find((review) => review.productId === productId && review.variantId === variantId);

  const total = orderTotal(lines);

  return (
    <section
      aria-labelledby="resumen-del-pedido"
      className="border-line-strong bg-paper rounded-card border p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="resumen-del-pedido" className="font-display text-ink text-lg">
          Tu pedido
        </h2>
        <Badge tone="success">
          {lines.length} {lines.length === 1 ? "producto" : "productos"}
        </Badge>
      </div>

      {/* En mobile el resumen arranca plegado: el formulario es lo importante. */}
      <button
        type="button"
        onClick={() => setIsExpanded((open) => !open)}
        aria-expanded={isExpanded}
        aria-controls="resumen-lineas"
        className="text-crust-deep mt-3 text-sm font-medium underline sm:hidden"
      >
        {isExpanded ? "Ocultar el detalle" : "Ver el detalle"}
      </button>

      <ul
        id="resumen-lineas"
        className={`${isExpanded ? "flex" : "hidden"} mt-3 flex-col gap-3 sm:flex`}
      >
        {lines.map((line) => {
          const variantId = line.variantId ?? null;
          const review = findReview(line.productId, variantId);

          return (
            <li
              // La identidad de una línea es producto + variante.
              key={`${line.productId}:${variantId ?? "-"}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="text-ink truncate">
                  {line.quantity} x {line.name}
                  {line.variantName !== null && (
                    <span className="text-ink-muted"> ({line.variantName})</span>
                  )}
                </p>

                {review?.isPriceChanged === true && review.currentUnitPrice !== null && (
                  <p className="text-ink-muted mt-1 text-xs">
                    <span className="line-through">{formatARS(line.unitPrice)}</span>{" "}
                    <span className="text-ink font-medium">
                      {formatARS(review.currentUnitPrice)} c/u
                    </span>
                  </p>
                )}

                {review?.issue != null && (
                  <p role="alert" className="text-clay-deep mt-1 text-xs">
                    {ISSUE_TEXT[review.issue]}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-ink tabular-nums">
                  {formatARS(line.unitPrice * line.quantity)}
                </span>

                {review?.issue != null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(line.productId, variantId)}
                  >
                    Quitar
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="border-line-strong mt-4 flex items-baseline justify-between border-t pt-3">
        <span className="text-ink-muted text-sm">Total</span>
        <span className="font-display text-ink text-xl">{formatARS(total)}</span>
      </p>
    </section>
  );
}
