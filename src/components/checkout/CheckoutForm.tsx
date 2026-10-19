"use client";

/**
 * Orquestador del formulario: estado, validación y handoff.
 *
 * El mensaje NO se arma acá: se arma una sola vez en la pantalla de
 * éxito. Acá se valida con Zod, se guarda el snapshot de datos ya
 * validados en `sessionStorage` y se limpia el carrito **después**,
 * nunca antes: si algo falla, el cliente conserva su carrito.
 */
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui";
import { describirEstado, getOpenState } from "@/lib/domain";
import { orderTotal } from "@/lib/whatsapp/message-contract";
import { useCheckoutDraft } from "@/hooks/use-checkout-draft";
import {
  checkoutSchema,
  toFieldErrors,
  toWhatsAppCustomer,
} from "@/lib/validation/checkout.schema";
import { useCartStore } from "@/store/cart-store";
import { registerOrderAction } from "@/server/actions/pedidos";

import { AddressField } from "./AddressField";
import { CustomerFields } from "./CustomerFields";
import { FulfillmentPicker } from "./FulfillmentPicker";
import { NotesField } from "./NotesField";
import { saveHandoffSnapshot } from "./handoff-snapshot";
import { useCartValidation } from "./use-cart-validation";
import { WhatsAppHandoff } from "./WhatsAppHandoff";

/** Errores por campo, para pasarle un string a cada `Input`. */
type FieldErrors = Readonly<Record<string, readonly string[]>>;

const firstError = (errors: FieldErrors, field: string): string | undefined => errors[field]?.[0];

interface CheckoutFormProps {
  readonly business: import("@/lib/domain").BusinessSettingsDTO;
}

export function CheckoutForm({ business }: CheckoutFormProps) {
  const router = useRouter();
  const { show } = useToast();
  const lines = useCartStore((state) => state.lines);
  const clearCart = useCartStore((state) => state.clear);
  const { draft, update, clear } = useCheckoutDraft();
  const { reviews, hasBlockingIssues, isValidating } = useCartValidation();

  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Honeypot anti-bots (Tarea 23): invisible para el humano; si viene con
  // texto, la action descarta el registro sin que el bot lo advierta.
  const honeypotRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    // El control principal es un `<button type="submit">`, así que el
    // clic nunca navega: por eso el `preventDefault` va primero, siempre.
    event.preventDefault();

    // Doble clic: mientras se arma el pedido no se vuelve a enviar.
    if (isSubmitting) return;

    // Guarda de horario (Zero-Trust del cliente: el local pudo haber
    // cerrado mientras el usuario llenaba el carrito). Se computa con el
    // reloj de AHORA, no con el estado cacheado del store.
    const estadoLocal = getOpenState(business.openingHours, new Date());
    if (estadoLocal?.estado === "cerrado") {
      show(`El local está cerrado: ${describirEstado(estadoLocal)}.`, "error");
      return;
    }
    setIsSubmitting(true);

    const parsed = checkoutSchema.safeParse(draft);

    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error);
      setErrors(fieldErrors);

      // El foco va al primer control con error: un mensaje de error que
      // no recibe el foco es invisible para quien navega con teclado.
      const firstField = Object.keys(fieldErrors)[0];
      if (firstField !== undefined) {
        formRef.current?.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus();
      }

      setIsSubmitting(false);
      return;
    }

    setErrors({});

    // Un producto que ya no se puede comprar hace el pedido imposible
    // de cumplir: se corta acá, no en el chat (§6.9).
    if (hasBlockingIssues) {
      show("Hay productos del carrito que ya no están disponibles. Revisá el resumen.", "error");
      setIsSubmitting(false);
      return;
    }

    void (async () => {
      /**
       * Tarea 23: se registra la comanda ANTES del handoff, para que entre
       * al tablero del local ni bien el cliente confirma.
       *
       * ⛔ El resultado NUNCA bloquea el handoff: si el registro falla,
       *    el pedido igual sale por WhatsApp (el canal sagrado) y el
       *    número de comanda simplemente no se muestra. La cocina pierde
       *      una tarjeta; el negocio no pierde el pedido.
       */
      let orderNumber: number | null = null;
      try {
        const registro = await registerOrderAction({
          customer: parsed.data,
          items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
          company: honeypotRef.current?.value ?? "",
        });
        // `orderNumber: 0` es la respuesta-cebo del honeypot: no es una
        // comanda real y no se muestra.
        orderNumber = registro.ok && registro.data.orderNumber > 0 ? registro.data.orderNumber : null;
      } catch (error) {
        console.error("[checkout] el registro de la comanda falló; el handoff sigue", error);
      }

      // El snapshot viaja a la pantalla de éxito por `sessionStorage`, con
      // `parsed.data` (ya validado y normalizado), nunca con `draft`.
      saveHandoffSnapshot({
        items: lines,
        customer: toWhatsAppCustomer(parsed.data),
        total: orderTotal(lines),
        orderNumber,
      });

      // El carrito se limpia recién acá. Si algo falla entre este punto y
      // el chat, el cliente todavía tiene su carrito.
      clearCart();
      clear();
      router.push("/checkout/exito");
    })();
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {/*
        Honeypot: fuera de viewport y fuera del árbol accesible. NO es
        `type="hidden"`: los bots aprendieron a no llenar esos. El CSS lo
        saca de la pantalla y `tabIndex={-1}` lo saca del teclado.
      */}
      <input
        ref={honeypotRef}
        type="text"
        name="company"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        defaultValue=""
      />

      <CustomerFields
        fullName={draft.fullName}
        phone={draft.phone}
        onFullNameChange={(value) => update({ fullName: value })}
        onPhoneChange={(value) => update({ phone: value })}
        errors={errors}
      />

      <FulfillmentPicker
        value={draft.fulfillment}
        onChange={(value) => update({ fulfillment: value })}
      />

      {draft.fulfillment === "delivery" && (
        <AddressField
          value={draft.address}
          onChange={(value) => update({ address: value })}
          error={firstError(errors, "address")}
        />
      )}

      <NotesField
        value={draft.notes}
        onChange={(value) => update({ notes: value })}
        error={firstError(errors, "notes")}
      />

      {/* Botón fijo abajo en mobile: es la única acción de la pantalla y
          tiene que estar visible sin hacer scroll (§6.14). */}
      <div className="border-line-strong bg-paper/95 fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        {/* `env(safe-area-inset-bottom)` evita que el botón quede bajo el
            gesto de "ir al inicio" del iPhone. */}
        <div className="mx-auto w-full max-w-5xl pb-[env(safe-area-inset-bottom)] sm:pb-0">
          <WhatsAppHandoff
            business={business}
            lines={lines}
            customer={toWhatsAppCustomer(draft)}
            total={orderTotal(lines)}
            reviews={reviews}
            isValidating={isValidating}
            disabled={isSubmitting}
          />
        </div>
      </div>
    </form>
  );
}
