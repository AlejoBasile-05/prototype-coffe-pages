"use client";

/**
 * Panel lateral con el carrito completo. Se monta una sola vez en el
 * layout público: el estado abierto vive en el store, así cualquier
 * botón lo abre.
 *
 * · Mientras dura la rehidratación muestra skeletons, nunca el estado
 *   vacío: `useCartHydration` distingue "cargando" de "vacío".
 *
 * · El botón "Ver el menú" del estado vacío CIERRA el Sheet: un botón
 *   que no cierra el panel deja al cliente encerrado en un Sheet
 *   vacío con el scroll del body trabado.
 *
 * · El botón "Continuar" navega a `/checkout` (Tarea 13); el handoff a
 *   WhatsApp pasa por el formulario, no por el panel.
 */
import Link from "next/link";

import { Sheet, Skeleton } from "@/components/ui";
import { useCartHydration } from "@/hooks/use-cart-hydration";
import { getLineKey } from "@/lib/cart/cart-rules";
import { useCartStore } from "@/store/cart-store";

import { CartLineItem } from "./CartLineItem";
import { CartTotals } from "./CartTotals";

export function CartSheet() {
  const lines = useCartStore((state) => state.lines);
  const isOpen = useCartStore((state) => state.isOpen);
  const setOpen = useCartStore((state) => state.setOpen);
  const hydrated = useCartHydration();

  const close = () => setOpen(false);

  return (
    <Sheet open={isOpen} onClose={close} title="Tu carrito">
      {!hydrated ? (
        <div className="flex flex-col gap-4" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : lines.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-10">
          <p className="text-ink-muted text-sm">Todavía no agregaste nada.</p>
          <button
            type="button"
            onClick={close}
            className="bg-crust-deep text-paper hover:bg-clay-deep rounded-control px-4 py-2 text-sm font-medium"
          >
            Ver el menú
          </button>
        </div>
      ) : (
        <>
          <ul className="divide-line divide-y">
            {lines.map((line) => (
              <CartLineItem key={getLineKey(line)} line={line} />
            ))}
          </ul>

          <div className="mt-4">
            <CartTotals />
          </div>

          <Link
            href="/checkout"
            onClick={close}
            className="bg-crust-deep text-paper hover:bg-clay-deep rounded-control mt-4 flex min-h-11 w-full items-center justify-center text-base font-medium transition-colors"
          >
            Continuar con el pedido
          </Link>
        </>
      )}
    </Sheet>
  );
}
