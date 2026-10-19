"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ADMIN_NAV_SECTIONS } from "@/config/admin-navigation";
import type { AdminNavSection } from "@/config/admin-navigation";
import { Button, Sheet } from "@/components/ui";
import { joinClasses } from "@/lib/ui/classes";

const LINK_BASE = "flex items-center gap-2 rounded-control px-3 py-2 text-sm";
const LINK_ACTIVE = "bg-crust/10 font-medium text-crust-deep";
const LINK_IDLE = "text-ink-muted hover:bg-cream hover:text-ink";

type AdminLink = AdminNavSection & { readonly isActive: boolean };

/**
 * La sección activa es **la coincidencia más larga**, no "la que calza".
 *
 * ⚠️ `/admin` es prefijo de `/admin/productos`. Un criterio por `startsWith`
 *    marca las dos a la vez y el resaltado miente sobre dónde está el
 *    encargado; al revés, un `===` deja sin marcar las secciones de nivel
 *    medio dentro de subrutas futuras (`/admin/productos/nuevo`).
 *
 * Con la coincidencia más larga `/admin` gana solo cuando la ruta es
 * `/admin` exacta, `/admin/productos` gana en `/admin/productos` y en sus
 * subrutas, y `ADMIN_NAV_SECTIONS` no necesita saber cuál es la raíz.
 */
const buildLinks = (pathname: string): readonly AdminLink[] => {
  const hrefActivo = ADMIN_NAV_SECTIONS.filter(
    (section) => pathname === section.href || pathname.startsWith(`${section.href}/`),
  ).reduce((largo, section) => (section.href.length > largo.length ? section.href : largo), "");

  return ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    isActive: section.href === hrefActivo,
  }));
};

/**
 * Enlaces del panel, con el estado activo resuelto en el cliente.
 *
 * ⚠️ Por qué Client Component: `usePathname()` no existe en el servidor.
 *    Con un Server Component habría que comparar el `href` contra algo
 *    que la ruta no expone, y la alternativa (`useSelectedLayoutSegment`)
 *    no cubre el caso de `/admin` exacto contra `/admin/productos`.
 *
 * Es el ÚNICO Client Component del marco: si todo fuera cliente, el
 * layout de `/admin` dejaría de ser un Server Component y el nombre del
 * local y el email de quien entró viajarían en el bundle de JavaScript
 * de cada página para no hacer nada con ellos.
 */
export function AdminNav({
  variant,
  businessName,
}: {
  readonly variant: "sidebar" | "sheet";
  /** Nombre del local para la cabecera de mobile. */
  readonly businessName: string;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const links = buildLinks(pathname);

  const list = (
    <nav aria-label="Secciones del panel">
      <ul className="flex flex-col gap-1">
        {links.map((link) => (
          <li key={link.href}>
            {link.isAvailable ? (
              <Link
                href={link.href}
                onClick={() => setIsOpen(false)}
                aria-current={link.isActive ? "page" : undefined}
                className={joinClasses(LINK_BASE, link.isActive ? LINK_ACTIVE : LINK_IDLE)}
              >
                {link.label}
              </Link>
            ) : (
              // No es un `<Link>`: un enlace a una ruta que no existe
              // devuelve un 404, y un 404 en el panel parece un error del
              // sistema en vez de "todavía no está".
              <span
                aria-disabled="true"
                className={joinClasses(LINK_BASE, "text-ink-muted/60 cursor-not-allowed")}
              >
                {link.label}
                <span className="text-ink-muted ml-auto text-xs">Próximamente</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );

  if (variant === "sidebar") return list;

  return (
    <>
      <div className="border-line bg-cream sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3">
        <Link href="/admin" className="font-display text-ink text-base">
          {businessName}
        </Link>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsOpen(true)}
          // `aria-haspopup` + `aria-expanded` alcanza: el Sheet se cierra
          // con Escape y con su botón, así que el control no depende de
          // un `aria-controls` que apunte a un id que él no controla.
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          Menú
        </Button>
      </div>

      <Sheet
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Panel"
        description="Secciones del panel de administración"
        size="sm"
      >
        {list}
      </Sheet>
    </>
  );
}
