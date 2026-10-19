"use client";

import dynamic from "next/dynamic";

/**
 * Wrapper para ToastViewport que evita hydration mismatch.
 *
 * ToastViewport usa createPortal(document.body) que no existe en el servidor.
 * Con dynamic(ssr: false) el componente solo se renderiza en el cliente,
 * evitando el mismatch de hidratación.
 */
const ToastViewport = dynamic(
  () => import("./ToastViewport").then((mod) => mod.ToastViewport),
  { ssr: false }
);

export { ToastViewport };