"use client";

/**
 * Envuelve el checkout y resuelve los dos estados que no son del
 * formulario: la hidratación del carrito y el carrito vacío.
 *
 * Vive en un componente aparte porque `useRouter` y `useEffect` obligan
 * a que el archivo sea cliente, y el Server Component de la ruta tiene
 * que poder seguir siendo servidor.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui";
import { useCartHydration } from "@/hooks/use-cart-hydration";
import type { BusinessSettingsDTO } from "@/lib/domain";
import { useCartStore } from "@/store/cart-store";

import { CheckoutForm } from "./CheckoutForm";
import { OrderSummary } from "./OrderSummary";
import { useCartValidation } from "./use-cart-validation";

export function CheckoutClient({ business }: { readonly business: BusinessSettingsDTO }) {
  const router = useRouter();
  const { show } = useToast();
  const lines = useCartStore((state) => state.lines);
  const isHydrated = useCartHydration();
  const { reviews } = useCartValidation();

  useEffect(() => {
    // Antes de hidratar no se sabe si el carrito está vacío: redirigir
    // en ese momento manda al menú a un cliente que sí tenía productos.
    if (!isHydrated) return;

    if (lines.length === 0) {
      show("Tu carrito está vacío. Elegí algo del menú para hacer el pedido.", "info");
      // `replace` y no `push`: el checkout vacío no debe quedar en el
      // historial; el botón atrás tiene que caer en el carrito.
      router.replace("/menu");
    }
  }, [isHydrated, lines.length, router, show]);

  if (!isHydrated || lines.length === 0) {
    return <CheckoutSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-40 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <CheckoutForm business={business} />
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <OrderSummary reviews={reviews} />
        </aside>
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6" aria-busy="true" role="status">
      <span className="sr-only">Cargando tu pedido…</span>
      <div className="bg-cream rounded-control h-8 w-56 animate-pulse" />
      <div className="bg-cream rounded-card mt-6 h-40 animate-pulse" />
    </div>
  );
}
