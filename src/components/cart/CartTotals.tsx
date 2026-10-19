"use client";

/**
 * Totales del carrito: cantidad de artículos, subtotal, aviso de que
 * el envío se coordina por WhatsApp y la acción de vaciar.
 *
 * · El subtotal sale de `calculateCartSubtotal(lines)` en el render:
 *   el store no guarda valores derivados.
 *
 * · "Vaciar carrito" pide confirmación con `ConfirmDialog`: es la
 *   única acción destructiva de la interfaz y no se puede revertir.
 */
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui";
import { calculateCartSubtotal, getCartItemCount } from "@/lib/cart/cart-rules";
import { formatARS } from "@/lib/format/currency";
import { useCartStore } from "@/store/cart-store";

export function CartTotals() {
  const lines = useCartStore((state) => state.lines);
  const clear = useCartStore((state) => state.clear);
  const [confirming, setConfirming] = useState(false);

  const units = getCartItemCount({ lines });
  const subtotal = calculateCartSubtotal({ lines });

  const handleClear = async () => {
    clear();
  };

  return (
    <div className="border-line flex flex-col gap-3 border-t pt-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-muted">
          {units} {units === 1 ? "artículo" : "artículos"}
        </span>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-ink-muted hover:text-clay text-xs underline-offset-2 hover:underline"
        >
          Vaciar carrito
        </button>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-ink-muted text-sm">Subtotal</span>
        <span className="font-display text-ink text-2xl">{formatARS(subtotal)}</span>
      </div>

      <p className="text-ink-muted text-xs">
        El envío y el pago se coordinan por WhatsApp. Te confirmamos el total antes de preparar el
        pedido.
      </p>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleClear}
        title="Vaciar el carrito"
        message="Se quitan todos los productos del pedido. No se puede deshacer."
        confirmLabel="Vaciar"
        cancelLabel="Volver"
        consequence="destructive"
      />
    </div>
  );
}
