"use client";

import { ToastStack } from "@/components/arc/toast-stack/toast-stack";

/**
 * Viewport global de notificaciones (toast-stack de Arc UI).
 *
 * bottom-center: el 95 % del tráfico es móvil y el pulgar vive abajo.
 * Se monta una sola vez, dentro de ToastProvider, desde el layout raíz.
 */
export function ToastViewport() {
  return <ToastStack label="Notificaciones" position="bottom-center" visibleToasts={3} />;
}
