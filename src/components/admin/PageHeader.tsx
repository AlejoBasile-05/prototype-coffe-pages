import type { ReactNode } from "react";

/**
 * Encabezado de página del panel.
 *
 * Server Component sin lógica: recibe el título ya escrito y lo pinta.
 * Todas las rutas del panel lo usan igual, y por eso el margen entre el
 * encabezado y el contenido es el mismo en el dashboard y en la tabla.
 *
 * El margen vive acá y no en cada página: si la distancia entre el
 * título y la tabla fuera una decisión de cada ruta, el mismo cambio de
 * espaciado se aplicaría cinco veces y una se olvidaría.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-ink text-2xl">{title}</h1>
        {description !== undefined && <p className="text-ink-muted mt-1 text-sm">{description}</p>}
      </div>
      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
