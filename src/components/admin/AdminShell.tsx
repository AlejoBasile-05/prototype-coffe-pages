import type { ReactNode } from "react";

import { AdminNav } from "./AdminNav";

/**
 * Marco del panel: navegación persistente y área de contenido.
 *
 * ⛔ `AdminNav` (el de mobile) se monta acá y no dentro de
 *    `AdminSidebar` a propósito. En desktop la barra lateral es fija y
 *    siempre visible; en mobile el mismo contenido vive en un `Sheet` que
 *    se abre desde la cabecera. Si el `nav` estuviera dentro del `aside`,
 *    habría que duplicarlo en dos ramas del `md:` y las dos copias se
 *    desincronizarían al agregar una sección.
 *
 * ⚠️ El contenedor raíz es `flex-row` desde `md`: en esa línea la barra
 *    lateral y el contenido son hermanos horizontales. Con dos bloques
 *    apilados, el contenido caería DEBAJO de la barra.
 *
 * `<main>` (y no un `<div id="contenido">`) porque el layout raíz no
 * declara un landmark de contenido: el panel tiene que aporta el suyo.
 */
export function AdminShell({
  sidebar,
  businessName,
  children,
}: {
  readonly sidebar: ReactNode;
  readonly businessName: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="bg-cream flex min-h-dvh flex-col md:flex-row">
      <a
        href="#contenido"
        className="bg-paper text-ink rounded-control focus:shadow-card sr-only px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Saltar al contenido
      </a>

      <div className="hidden md:block">
        <aside className="border-line bg-paper sticky top-0 h-dvh w-72 shrink-0 overflow-y-auto border-r">
          {sidebar}
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="md:hidden">
          <AdminNav variant="sheet" businessName={businessName} />
        </div>

        <main id="contenido" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
