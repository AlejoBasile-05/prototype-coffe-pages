"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/ui";
import { Switch } from "@/components/arc/switch/switch";
import type { ProductAvailabilityActionResult } from "@/server/actions/product-availability.actions";
import { toggleProductAvailabilityAction } from "@/server/actions/product-availability.actions";
import { sanitizeNextPath } from "@/lib/validation/ruta-retorno";
import { useAvailabilityStore, useProductAvailability } from "@/store/availability-store";

/** Mensaje de éxito: nombra el producto para que el encargado sepa cuál. */
const mensajeDeExito = (productName: string, isAvailable: boolean): string =>
  isAvailable ? `${productName} volvió a estar disponible.` : `${productName} quedó agotado.`;

/**
 * Toggle de disponibilidad de un producto.
 *
 * ## El patrón optimista
 *
 * El store se escribe **antes** de llamar al servidor. Con 300 ms
 * de ida y vuelta entre el clic y la base, un toggle que espera la
 * respuesta se siente roto. La secuencia completa:
 *
 *   1. `applyAvailability(id, siguiente)`  → la interfaz responde en el mismo frame
 *   2. `await toggleProductAvailabilityAction(...)`
 *   3. `ok`    → se adopta el valor que confirmó el servidor
 *   4. `error` → `applyAvailability(id, anterior)` + toast
 *
 * ## Dos caminos de escritura, un orden (Tarea 15 §6.7)
 *
 * El switch lee el valor del store (`useProductAvailability`), no del
 * estado local: así un cambio hecho desde otra pestaña aparece acá sin
 * recargar. El conflicto lo resuelve el orden temporal: la action
 * escribe primero y el evento de Realtime confirma después (el evento
 * solo se emite cuando la transacción hizo commit). Si el evento
 * difiere, gana la base: un switch que muestra algo que la base no
 * tiene es peor que uno que tarda 300 ms en corregirse.
 *
 * ## Por qué el switch se bloquea durante el vuelo
 *
 * `isSaving` deshabilita el control. Un segundo clic antes de que vuelva
 * la primera respuesta mandaría el valor contrario con una base que
 * todavía tiene el primero. Con `disabled` no hay dos peticiones en
 * vuelo sobre la misma fila, y el `aria-busy` le avisa al lector de
 * pantalla que algo está pasando.
 */
export function AvailabilitySwitch({
  productId,
  productName,
  isAvailable,
}: {
  readonly productId: string;
  readonly productName: string;
  readonly isAvailable: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { show } = useToast();
  // ⛔ Fuente de verdad para el control: el store. El `isAvailable` de la
  //    prop es el snapshot del servidor; el store lo pisa en cuanto llega
  //    un evento de Realtime (Tarea 15 §6.7).
  const applyAvailability = useAvailabilityStore((state) => state.applyAvailability);
  const actual = useProductAvailability(productId, isAvailable);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Qué hacer con la falla, según el código estable que devuelve la action.
   * Cada rama es una decisión de navegación, no una lectura del texto.
   */
  const manejarFalla = (resultado: Extract<ProductAvailabilityActionResult, { ok: false }>) => {
    if (resultado.code === "UNAUTHORIZED") {
      // El layout no corrió, porque esta petición nació de un cliente que
      // ya estaba en la página. `pathname` viene del router de Next, no de
      // la URL, así que no puede ser inyectado; igual se sanea con la
      // MISMA función que usa el proxy y el login, porque el destino de
      // una redirección nunca se arma a mano dos veces (open redirect).
      show(resultado.error, "error");
      router.replace(`/login?next=${encodeURIComponent(sanitizeNextPath(pathname))}`);
      return;
    }

    show(resultado.error, "error");

    if (resultado.code === "RESOURCE_NOT_FOUND") {
      // La fila es un fantasma: el producto se archivó o se borró desde
      // otra pestaña. Refresh y que la tabla decida qué hacer.
      router.refresh();
    }
  };

  const handleChange = async (siguiente: boolean) => {
    if (isSaving) return;

    const anterior = actual;
    applyAvailability(productId, siguiente); // 1. optimista
    setIsSaving(true);

    try {
      const resultado = await toggleProductAvailabilityAction({
        id: productId,
        isAvailable: siguiente,
      });

      if (resultado.ok) {
        // Se adopta lo que confirmó el servidor, no lo que el usuario
        // quiso: si alguien corrigió el valor desde otra pestaña entre
        // medio, la pantalla pasa a mostrar la verdad.
        applyAvailability(productId, resultado.data.isAvailable);
        show(mensajeDeExito(productName, resultado.data.isAvailable), "success");
        return;
      }

      applyAvailability(productId, anterior); // 2. rollback
      manejarFalla(resultado);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <span className="flex items-center gap-2">
      {/*
        Switch de Arc UI (Radix debajo: role="switch", aria-checked,
        teclado Space/Enter). El pulgar anima con un resorte crítico
        (sin overshoot) y respeta prefers-reduced-motion.
        El nombre accesible sale del texto visible de al lado.
      */}
      <Switch
        checked={actual}
        aria-busy={isSaving || undefined}
        disabled={isSaving}
        onCheckedChange={(siguiente) => void handleChange(siguiente)}
      />

      {/* El texto acompaña al color: `role="switch"` con `aria-checked` ya
          alcanza para un lector de pantalla, pero quien no distingue el
          verde del gris necesita la palabra. */}
      <span className="text-ink-muted text-xs">{actual ? "Disponible" : "Agotado"}</span>
    </span>
  );
}
