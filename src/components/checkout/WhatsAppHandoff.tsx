"use client";

/**
 * El control que cierra el pedido.
 *
 * Un `<button type="submit">` y nada más: valida, avisa y manda a la
 * pantalla de éxito. Toda la lógica de la URL vive allá, porque acá el
 * pedido todavía no está validado. ⛔ No hay un `<a href="wa.me/…">`:
 * un enlace no dispara `onSubmit` y el formulario vacío mandaría un
 * pedido sin nombre ni teléfono.
 */
import { useState } from "react";

import { Button } from "@/components/ui";
import { formatCurrency, t } from "@/config/prototype";
import { ValidationError } from "@/lib/domain";
import type { BusinessSettingsDTO } from "@/lib/domain";
import type { WhatsAppCartLine, WhatsAppCustomer } from "@/lib/whatsapp/message-contract";
import { buildWhatsAppOrder } from "@/lib/whatsapp/whatsapp-message.service";

import type { CartLineReview } from "./use-cart-validation";

export interface WhatsAppHandoffProps {
  readonly business: BusinessSettingsDTO;
  /** `CartLine` de la Tarea 11, asignable a `WhatsAppCartLine` (§2.2). */
  readonly lines: readonly WhatsAppCartLine[];
  /** Datos a medio cargar: solo los usa el preview, que captura el error. */
  readonly customer: WhatsAppCustomer;
  readonly total: number;
  readonly reviews: readonly CartLineReview[] | null;
  readonly isValidating: boolean;
  readonly disabled?: boolean;
}

export function WhatsAppHandoff(props: WhatsAppHandoffProps) {
  const { business, lines, customer, total, reviews, isValidating, disabled = false } = props;
  const [showPreview, setShowPreview] = useState(false);

  if (lines.length === 0) return null;

  const priceChanges = reviews?.filter((review) => review.isPriceChanged) ?? [];
  const blocking = reviews?.filter((review) => review.issue !== null) ?? [];

  return (
    <div className="flex flex-col gap-3">
      {isValidating && (
        <p role="status" className="text-ink-muted text-sm">
          Verificando disponibilidad y precios...
        </p>
      )}

      {priceChanges.length > 0 && (
        <p
          role="status"
          className="border-amber/40 bg-amber/10 text-ink rounded-control border px-3 py-2 text-sm"
        >
          {priceChanges.length === 1
            ? "Un producto cambió de precio. Te mandamos el precio de hoy."
            : `${priceChanges.length} productos cambiaron de precio. Te mandamos los precios de hoy.`}
        </p>
      )}

      {blocking.length > 0 && (
        <p
          role="alert"
          className="border-clay/35 bg-clay/8 text-ink rounded-control border px-3 py-2 text-sm"
        >
          Hay productos del carrito que ya no se pueden pedir. Quitalos del pedido para continuar.
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" disabled={disabled} className="w-full">
        {t("whatsappCTA")} — {formatCurrency(total)}
      </Button>

      <details
        className="text-ink-muted text-sm"
        onToggle={(event) => setShowPreview(event.currentTarget.open)}
      >
        <summary className="cursor-pointer select-none">Ver el mensaje que se va a enviar</summary>
        {showPreview && <OrderPreview lines={lines} customer={customer} business={business} />}
      </details>
    </div>
  );
}

function OrderPreview({
  lines,
  customer,
  business,
}: {
  readonly lines: readonly WhatsAppCartLine[];
  readonly customer: WhatsAppCustomer;
  readonly business: BusinessSettingsDTO;
}) {
  // ⛔ Sin `useMemo`: el preview se abre a mano, se calcula una vez y
  // no tiene un costo que valga memoizar.
  // ⛔ Sin JSX dentro del try/catch: React no renderiza al ejecutar el
  // constructor del JSX, así que el catch no atraparía errores de
  // render. Acá solo se EJECUTA la función pura y se captura su texto.
  let text: string;
  try {
    text = buildWhatsAppOrder({
      items: lines,
      customer,
      business: { name: business.name, whatsappPhone: business.whatsappPhone },
    }).text;
  } catch (error) {
    // El preview es una cortesía: si los datos no dan todavía, se dice y
    // el checkout sigue. No se renderiza el texto crudo de la excepción:
    // un mensaje interno en pantalla es una fuga de información.
    const message =
      error instanceof ValidationError
        ? "Completá tus datos para ver el mensaje."
        : "No pudimos armar el mensaje.";

    return <p className="text-ink-muted mt-2 text-sm">{message}</p>;
  }

  return (
    <pre className="bg-cream rounded-control mt-2 max-h-64 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">
      {text}
    </pre>
  );
}
