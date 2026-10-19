import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { AvailabilityRealtimeBridge } from "@/components/catalog/AvailabilityRealtimeBridge";
import { PROTOTYPE_CONFIG } from "@/config/prototype";
import { verifyAdminSession } from "@/server/auth/verify-admin";
import { getSettingsForAdmin } from "@/server/services";

export const metadata: Metadata = {
  title: { default: "Panel", template: `%s | ${PROTOTYPE_CONFIG.brand.name}` },
  // Un panel en el índice de Google es un panel en el índice de Google.
  robots: { index: false, follow: false },
};

/**
 * ⛔ `force-dynamic` explícito, aunque `verifyAdminSession` ya lee cookies
 *    y eso basta para que Next descarte el render estático. La constante
 *    está para que nadie tenga que saber eso: si mañana alguien cachea el
 *    layout por alguna razón, acá sigue diciendo que no.
 */
export const dynamic = "force-dynamic";

/**
 * ⛔ ⛔ ESTA ES LA FRONTERA DE SEGURIDAD DEL RENDER. ⛔ ⛔
 *
 * El proxy ya manda a `/login` a quien no tiene cookie. Eso es UX:
 * evita el destello de la página en blanco. Este `redirect` es lo que
 * responde cuando la cookie existe pero no autoriza: el token es
 * criptográficamente válido, `getClaims()` no lo impugna, y sin esta
 * llamada el usuario vería el panel vacío con un 200.
 *
 * Y aunque este layout existiera, la autorización **real** de cada
 * operación sigue estando en cada Server Action (Tarea 07 §4.2).
 *
 * Sin `next` a propósito: un layout de App Router no recibe
 * `searchParams`, así que no sabe en qué ruta estaba el usuario. La
 * preservación del deep link la aporta el proxy, que sí conoce la URL de
 * la petición.
 */
export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await verifyAdminSession();
  if (session === null) {
    redirect("/login");
  }

  // ⛔ Sin caché: los ajustes muestran el nombre y el WhatsApp del local.
  const settings = await getSettingsForAdmin();

  return (
    <AdminShell
      businessName={settings.name}
      sidebar={
        <AdminSidebar
          businessName={settings.name}
          userEmail={session.email}
          userRole={session.role}
          logout={<LogoutButton />}
        />
      }
    >
      {children}
      {/* El panel también escucha: un cambio hecho en otra pestaña llega
          a esta sin recargar (Tarea 15 §4.6). Mismo canal, una sola
          suscripción por pestaña. */}
      <AvailabilityRealtimeBridge />
    </AdminShell>
  );
}
