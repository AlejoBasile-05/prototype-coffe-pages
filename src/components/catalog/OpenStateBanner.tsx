"use client";

/**
 * Banner de "el local está cerrado" (estado del día, no aviso editorial).
 *
 * Lee el `open-state-store` (lo alimenta `OpenStateBridge`, montado en el
 * layout público). Mientras el estado no está computado (`null`) no
 * renderiza nada: mostrar "cerrado" por duda frena ventas sin motivo.
 *
 * Cuando está CERRADO:
 *  · el banner destaca, dice cuándo vuelve a abrir y aclara que el menú
 *    y los precios se pueden mirar igual;
 *  · el carrito no acepta agregados (eso lo hace `AddToCartButton`
 *    leyendo el mismo store — misma fuente de verdad, cero drift).
 *
 * `role="status"` viene del Alert de Arc: se anuncia sin interrumpir la
 * lectura en curso.
 */
import { Alert } from "@/components/arc/alert/alert";
import { PROTOTYPE_CONFIG } from "@/config/prototype";
import { cn } from "@/lib/utils";
import { useOpenStateStore } from "@/store/open-state-store";

interface OpenStateBannerProps {
  /** `full` (menú) destaca más; `compact` (home) ocupa menos. */
  readonly variant?: "full" | "compact";
  readonly className?: string;
}

export function OpenStateBanner({ variant = "full", className }: OpenStateBannerProps) {
  const estado = useOpenStateStore((state) => state.estado);

  if (estado === null || estado.estado === "abierto") return null;

  const titulo =
    estado.motivo === "dia_completo" ? "Hoy no abrimos" : "Ahora estamos cerrados";

  return (
    <Alert
      tone="warning"
      title={titulo}
      className={cn(variant === "full" && "text-base", className)}
    >
      {/* El mensaje vive en PROTOTYPE_CONFIG.messages.closed: adaptar al
          negocio es cambiar la config, no este componente. */}
      {PROTOTYPE_CONFIG.messages.closed}
    </Alert>
  );
}
