"use client";

/**
 * Botón "Agregar" de la card del catálogo y de la ficha de producto.
 * Punto de reemplazo del placeholder de la Tarea 10.
 *
 * · El store devuelve un resultado y el botón lo mapea a un toast: el
 *   store no conoce los toasts y por eso se puede probar aislado. El
 *   `Record` por status obliga a que cada resultado tenga mensaje: si
 *   `addItem` gana un estado nuevo, TypeScript falla acá, no en
 *   producción.
 *
 * · El cambio de texto a "Agregado" dura 1,2 s y es la única animación
 *   del componente: el toast ya confirma y el badge del header ya
 *   cambia; un check animado sería una tercera confirmación de lo
 *   mismo.
 */
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/ToastProvider";
import { describirEstado } from "@/lib/domain";
import type { CartLine } from "@/lib/cart/cart-types";
import { tapFeedback } from "@/lib/haptics";
import { useCartStore, type AddItemOutcome } from "@/store/cart-store";
import { useOpenStateStore } from "@/store/open-state-store";

interface AddToCartButtonProps {
  line: Omit<CartLine, "quantity">;
  quantity?: number;
  className?: string;
}

const MESSAGES: Record<AddItemOutcome["status"], { text: string; tone: "success" | "error" }> = {
  added: { text: "Agregado al carrito.", tone: "success" },
  merged: { text: "Actualizamos la cantidad.", tone: "success" },
  unavailable: { text: "Ese producto está agotado.", tone: "error" },
  "limit-reached": {
    text: "Tu carrito llegó al máximo de productos distintos.",
    tone: "error",
  },
};

const CONFIRM_MS = 1200;

export function AddToCartButton({ line, quantity = 1, className }: AddToCartButtonProps) {
  const { show } = useToast();
  const addItem = useCartStore((state) => state.addItem);
  // Local cerrado → no se agrega. El mismo banner lo anuncia; el botón
  // deshabilitado es la barrera física, no el cartel. `null` (estado sin
  // computar) no bloquea: presunción de abierto, el checkout revalida.
  const estadoLocal = useOpenStateStore((state) => state.estado);
  const estaCerrado = estadoLocal?.estado === "cerrado";
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const handleClick = () => {
    tapFeedback();
    const outcome = addItem({ ...line, quantity });
    const message = MESSAGES[outcome.status];
    show(message.text, message.tone);

    if (outcome.status === "added" || outcome.status === "merged") {
      setJustAdded(true);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => setJustAdded(false), CONFIRM_MS);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      onClick={handleClick}
      disabled={estaCerrado}
      // El título le da el "por qué" a quien puede verlo; el estado
      // deshabilitado se anuncia solo con `disabled` + el banner visible.
      title={estaCerrado ? describirEstado(estadoLocal) : undefined}
      className={className}
    >
      {estaCerrado ? "Cerrado ahora" : justAdded ? "Agregado" : "Agregar"}
    </Button>
  );
}
