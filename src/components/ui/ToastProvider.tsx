"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { ToastStackProvider, useToastStack } from "@/components/arc/toast-stack/toast-stack";

export type ToastTone = "success" | "error" | "info";

export type Toast = {
  id: string;
  tone: ToastTone;
  message: string;
};

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Traduce la API histórica del sitio (`show(message, tone)`) al
 * toast-stack de Arc UI, que aporta apilado con motion, swipe para
 * cerrar, pausa al enfocar y duración extendida para errores.
 *
 * El bridge existe para NO reescribir los ~12 call-sites: ellos siguen
 * llamando `useToast().show(...)` y no saben que el motor cambió.
 */
function ToastBridge({ children }: { children: ReactNode }) {
  // Se desestructuran los métodos en vez de guardar el objeto que
  // devuelve `useToastStack`: ese objeto es nuevo en cada render (incluye
  // `count`), y como `count` cambia al apilar un toast, `show` cambiaba
  // de identidad y re-disparaba efectos que dependen de él (bucle de
  // revalidación del carrito). `toast` y `dismiss` son estables.
  const { toast, dismiss: dismissToast } = useToastStack();

  const show = useCallback(
    (message: string, tone: ToastTone = "info") => {
      toast({ title: message, type: tone });
    },
    [toast],
  );

  const dismiss = useCallback(
    (id: string) => {
      dismissToast(id);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return <ToastContext value={value}>{children}</ToastContext>;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    // Duración base 4.5 s; los errores duran 1.6× (regla del stack de Arc).
    // Límite 3: una mutación que falla en ráfaga no tapa la pantalla.
    <ToastStackProvider duration={4500} limit={3}>
      <ToastBridge>{children}</ToastBridge>
    </ToastStackProvider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  // Hook sin provider: error en desarrollo, no pantalla en blanco.
  if (!context) throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  return context;
}
