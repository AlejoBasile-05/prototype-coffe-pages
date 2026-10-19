import Link from "next/link";

import { AdminNav } from "./AdminNav";
import type { AdminRole } from "@/lib/domain";

const ROLE_LABEL: Record<AdminRole, string> = {
  OWNER: "Dueño",
  STAFF: "Encargado",
};

/**
 * Contenido de la barra lateral de desktop.
 *
 * Server Component a propósito: el nombre del local y el email de quien
 * entró se resuelven en servidor y viajan por el HTML. Si esto fuera un
 * Client Component, esos dos datos estarían en el bundle de JavaScript de
 * cada página del panel para no hacer nada con ellos.
 *
 * Recibe el logout ya montado (`logout`) y no el handler: este archivo no
 * sabe qué hace un `signOut`, y así el componente que sí lo sabe
 * (`LogoutButton`) se puede testear por separado.
 */
export function AdminSidebar({
  businessName,
  userEmail,
  userRole,
  logout,
}: {
  readonly businessName: string;
  readonly userEmail: string;
  readonly userRole: AdminRole;
  readonly logout: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-6 p-5">
      <Link href="/admin" className="block">
        <span className="text-ink-muted block text-xs tracking-wide uppercase">Panel</span>
        <span className="font-display text-ink block text-lg">{businessName}</span>
      </Link>

      <AdminNav variant="sidebar" businessName={businessName} />

      <div className="border-line mt-auto space-y-3 border-t pt-4">
        {/* El email es la identidad de la sesión activa: si el local
            comparte pantalla, hay que ver quién dejó abierto el panel. */}
        <p className="text-ink truncate text-sm">{userEmail}</p>
        <p className="text-ink-muted text-xs">{ROLE_LABEL[userRole]}</p>
        {logout}
      </div>
    </div>
  );
}
