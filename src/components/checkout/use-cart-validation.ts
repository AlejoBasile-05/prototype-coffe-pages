"use client";

/**
 * Revalidación de precios y disponibilidad contra `/api/cart/validate`.
 *
 * Decisión (§6.9): **falla abierta** — si el endpoint da error o el
 * cuerpo no matchea el contrato, el envío se habilita igual con los
 * precios del carrito. Un problema de red no puede impedir una venta. Un
 * cuerpo inválido NO es "todo bien": mostrar un precio viejo con sello
 * verde es peor que no avisar.
 */
import { useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui";
import { serializeCartLineRef } from "@/lib/domain";
import type { ValidatedCartLine } from "@/lib/domain";
import { useCartStore } from "@/store/cart-store";

interface ValidationResponse {
  readonly ok: boolean;
  readonly lines: readonly ValidatedCartLine[];
  readonly hasBlockingIssues: boolean;
}

const isValidationResponse = (value: unknown): value is ValidationResponse => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.ok === true && Array.isArray(record.lines);
};

/**
 * `controller.abort()` rechaza el `fetch` en vuelo con `AbortError`. Ese
 * rechazo es una cancelación deliberada (cambió el carrito o se
 * desmontó), no un fallo: mostrarlo como error sería mentirle al cliente.
 */
const isAbortError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";

/** Líneas del cliente con el precio vigente y el motivo del bloqueo. */
export interface CartLineReview {
  readonly productId: string;
  readonly variantId: string | null;
  readonly currentUnitPrice: number | null;
  readonly isPriceChanged: boolean;
  readonly issue: ValidatedCartLine["issue"];
}

export function useCartValidation() {
  const lines = useCartStore((state) => state.lines);
  const { show } = useToast();

  // `show` cambia de identidad cuando se apila un toast. Si estuviera en
  // las dependencias del efecto, cada aviso dispararía una revalidación
  // nueva → otro aviso → un bucle de requests. El ref le da al efecto la
  // versión más reciente sin volver a dispararlo.
  const showRef = useRef(show);
  useEffect(() => {
    showRef.current = show;
  }, [show]);

  const [reviews, setReviews] = useState<readonly CartLineReview[] | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (lines.length === 0) return;

    const controller = new AbortController();
    let isActive = true;
    const query = lines
      .map((line) => `line=${encodeURIComponent(serializeCartLineRef(line))}`)
      .join("&");

    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicio de una request de red: es el uso legítimo que documenta la regla
    setIsValidating(true);

    fetch(`/api/cart/validate?${query}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("http"))))
      .then((payload: unknown) => {
        if (!isActive) return;
        if (!isValidationResponse(payload)) throw new Error("contrato");

        // La comparación de precios la hace el navegador: son dos
        // números y no hay nada en que confiar. El endpoint nunca ve el
        // precio del cliente (§6.2).
        setReviews(
          payload.lines.map((line) => {
            const snapshot = lines.find(
              (item) =>
                item.productId === line.productId && (item.variantId ?? null) === line.variantId,
            );
            return {
              productId: line.productId,
              variantId: line.variantId,
              currentUnitPrice: line.currentUnitPrice,
              isPriceChanged:
                line.currentUnitPrice !== null && snapshot !== undefined
                  ? line.currentUnitPrice !== snapshot.unitPrice
                  : false,
              issue: line.issue,
            };
          }),
        );
      })
      .catch((error: unknown) => {
        // Cancelación deliberada o respuesta de una request vieja: no es
        // un fallo y no debe avisar nada.
        if (!isActive || isAbortError(error)) return;

        // Falla abierta: `reviews` queda en `null`, que significa "no
        // sabemos" — la UI no muestra ni ok ni warnings.
        setReviews(null);
        showRef.current(
          "No pudimos confirmar precios y stock. Enviás los precios del carrito y el local los confirma por WhatsApp.",
          "info",
        );
      })
      .finally(() => {
        if (isActive) setIsValidating(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [lines]);

  return {
    reviews,
    isValidating,
    /** Hay una línea que no se puede comprar. Bloquea el envío. */
    hasBlockingIssues: reviews?.some((review) => review.issue !== null) ?? false,
    /** Hay al menos un precio distinto al del carrito. No bloquea. */
    hasPriceChanges: reviews?.some((review) => review.isPriceChanged) ?? false,
  };
}
