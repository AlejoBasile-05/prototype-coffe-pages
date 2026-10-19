"use client";

/**
 * Pantalla de éxito: reconstruye el pedido desde el snapshot de
 * `sessionStorage` (el carrito ya está limpio cuando se llega acá) y
 * arma el mensaje UNA sola vez, con las funciones puras de la Tarea 12.
 */
import { useEffect, useRef, useState } from "react";

import { Button, buttonClassName, EmptyState, useToast } from "@/components/ui";
import { formatCurrency, t } from "@/config/prototype";
import { formatOrderNumber } from "@/lib/domain";
import type { BusinessSettingsDTO } from "@/lib/domain";
import { buildWhatsAppOrder } from "@/lib/whatsapp/whatsapp-message.service";
import { buildWhatsAppUrl } from "@/lib/whatsapp/whatsapp-url.service";

import {
  clearHandoffSnapshot,
  readHandoffSnapshot,
  type HandoffSnapshot,
} from "./handoff-snapshot";

interface CheckoutSuccessProps {
  readonly business: BusinessSettingsDTO;
}

export function CheckoutSuccess({ business }: CheckoutSuccessProps) {
  const { show } = useToast();
  const [snapshot, setSnapshot] = useState<HandoffSnapshot | null>(null);
  const [isPopupBlocked, setIsPopupBlocked] = useState(false);
  // "Montado en el cliente" sin setState en el cuerpo del efecto: el
  // ref-lo convierte el estado en render-efecto legal del lint de React.
  const [isRestored, setIsRestored] = useState(false);
  const isRestoredRef = useRef(false);

  useEffect(() => {
    // La lectura del storage se hace UNA vez, post-montaje, y solo
    // actualiza estado si el componente no se restauró aún.
    if (!isRestoredRef.current) {
      isRestoredRef.current = true;
      setSnapshot(readHandoffSnapshot());
      setIsRestored(true);
    }
  }, []);

  // El snapshot se borra cuando el cliente mandó el pedido, no antes:
  // si vuelve atrás con el botón del navegador, el pedido sigue ahí.
  // Vence a los 30 minutos para que un "atrás" de horas después no
  // remande un pedido viejo.
  useEffect(() => {
    if (snapshot === null) return;
    const timer = window.setTimeout(() => clearHandoffSnapshot(), 30 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [snapshot]);

  // `sessionStorage` no existe en el servidor: sin este early return el
  // primer render del Server Component revienta.
  if (!isRestored) return null;

  if (snapshot === null) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <EmptyState
          title="Tu pedido ya está en el chat"
          message="Si ya presionaste enviar, tu pedido llegó a WhatsApp. Si querés hacer otro, volvé al menú."
        />
        <a href="/menu" className={`${buttonClassName("primary", "md")} mt-4`}>
          Volver al {t("catalog")}
        </a>
      </div>
    );
  }

  // La única vez que se arma el mensaje en todo el flujo. Es una función
  // pura sobre un snapshot que el guard de arriba ya validó.
  const order = buildWhatsAppOrder({
    items: snapshot.items,
    customer: snapshot.customer,
    business: { name: business.name, whatsappPhone: business.whatsappPhone },
  });

  const url = buildWhatsAppUrl(business.whatsappPhone, order.text);

  const openInNewTab = (): void => {
    const opened = window.open(url, "_blank", "noopener,noreferrer");

    if (opened === null) {
      setIsPopupBlocked(true);
      show("Tu navegador bloqueó la ventana. Usá el enlace de arriba.", "info");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="font-display text-ink text-2xl">Pedido listo</h1>
      <p className="text-ink-muted mt-2">
        Te dejamos el pedido escrito. Revisalo en WhatsApp y presioná enviar: el local lo confirma
        por el mismo chat.
      </p>

      {/* Número de comanda (Tarea 23): solo si el registro salió bien. Si
          el tablero no estaba disponible, el pedido viaja igual y acá no
          se promete un número que no existe. */}
      {typeof snapshot.orderNumber === "number" && snapshot.orderNumber > 0 && (
        <p role="status" className="text-ink mt-2 text-sm">
          Tu pedido es el <strong>{formatOrderNumber(snapshot.orderNumber)}</strong>: con ese número
          el local lo busca en el tablero.
        </p>
      )}

      {order.isTruncated && (
        <p
          role="status"
          className="border-amber/40 bg-amber/10 text-ink rounded-control mt-4 border px-3 py-2 text-sm"
        >
          El mensaje es largo, así que se recortaron los comentarios y algunos productos. El total
          que figura es parcial: en el chat coordinamos el resto.
        </p>
      )}

      {isPopupBlocked && (
        <p
          role="alert"
          className="border-clay/35 bg-clay/8 text-ink rounded-control mt-4 border px-3 py-2 text-sm"
        >
          No pudimos abrir la ventana de WhatsApp. Tocá el enlace de arriba para enviar el pedido.
        </p>
      )}

      <pre className="bg-cream rounded-card mt-6 max-h-72 overflow-auto p-4 font-mono text-sm whitespace-pre-wrap">
        {order.text}
      </pre>

      {/*
        Control principal: enlace real, con la pinta de botón.

        ⛔ No es un `onClick` con `window.open` porque un `window.open`
        puede ser bloqueado y el cliente se queda sin salida. Un
        `<a target="_blank">` también nace del gesto del usuario, así que
        no lo bloquea ningún popup blocker, y el cliente ve a dónde lo
        lleva, lo puede copiar y volver a tocarlo.
      */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${buttonClassName("primary", "lg")} mt-6 w-full`}
      >
        Abrir WhatsApp con el pedido — {formatCurrency(snapshot.total)}
      </a>

      <Button variant="secondary" size="sm" onClick={openInNewTab} className="mt-3 w-full">
        Abrir en una ventana nueva
      </Button>

      <a href="/menu" className={`${buttonClassName("ghost", "sm")} mt-3 w-full`}>
        Volver al {t("catalog")}
      </a>
    </div>
  );
}
