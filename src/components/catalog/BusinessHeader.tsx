/**
 * Cabecera pública (Server Component): nombre del local, navegación y
 * el botón del carrito (Client Component de la Tarea 11).
 */
import Link from "next/link";

import { CartButton } from "@/components/cart/CartButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { BusinessSettingsDTO } from "@/lib/domain";

interface BusinessHeaderProps {
  settings: BusinessSettingsDTO;
}

const NAV_LINKS = [{ href: "/menu" }] as const;

/** Texto fijo de marca: el header no muestra el nombre configurado en la base. */
const BRAND_LABEL = "Tu Negocio";

export function BusinessHeader(_props: BusinessHeaderProps) {
  return (
    <header className="bg-cream/90 border-line sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-ink font-display text-lg">
          {BRAND_LABEL}
        </Link>

        <div className="flex items-center gap-4">
          <nav aria-label="Principal">
            <ul className="flex items-center gap-4 text-sm">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-ink-muted hover:text-ink">
                    {BRAND_LABEL}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <ThemeToggle />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
