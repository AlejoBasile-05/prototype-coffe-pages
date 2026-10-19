import type { ReactNode } from "react";

import { Badge as ArcBadge } from "@/components/arc/badge/badge";

/** Tonos del negocio. Coinciden 1:1 con los tonos semánticos de Arc. */
export type BadgeTone = "success" | "warning" | "danger";

/**
 * Fachada del Badge de Arc UI.
 *
 * El componente real vive en `src/components/arc/badge` (código vendor);
 * acá solo se congela la API que el negocio conoce: `<Badge tone="success">`.
 * El punto de estado y el padding los dibuja Arc con los tokens de marca.
 */
export function Badge({
  tone = "success",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    // data-tone: contrato testeable y estilizable; el componente Arc
    // no expone el tono como atributo.
    <ArcBadge tone={tone} size="sm" className={className} data-tone={tone}>
      {children}
    </ArcBadge>
  );
}
