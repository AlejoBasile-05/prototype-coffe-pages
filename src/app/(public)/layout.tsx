/**
 * Layout del grupo público: envuelve `/`, `/menu` y `/producto/[slug]`
 * sin agregar segmento a la URL.
 *
 * Es `async` porque lee los ajustes del local (header y footer). Los
 * metadatos globales (`metadataBase`, template de título) los define el
 * layout raíz (Tarea 01); acá no se repiten.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CartSheet } from "@/components/cart/CartSheet";
import { AvailabilityRealtimeBridge } from "@/components/catalog/AvailabilityRealtimeBridge";
import { BusinessFooter } from "@/components/catalog/BusinessFooter";
import { BusinessHeader } from "@/components/catalog/BusinessHeader";
import { OpenStateBridge } from "@/components/catalog/OpenStateBridge";
import { PROTOTYPE_CONFIG } from "@/config/prototype";
import { getPublicBusinessSettings } from "@/server/services";
import { CartHydrator } from "@/store/cart-hydrator";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: PROTOTYPE_CONFIG.brand.name,
    template: `%s | ${PROTOTYPE_CONFIG.brand.name}`,
  },
  description: "Sándwiches de miga artesanales en San Rafael, Mendoza. Pedí por WhatsApp.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: PROTOTYPE_CONFIG.brand.name,
    locale: "es_AR",
  },
  // ⛔ `summary_large_image` y no `summary`: sin esto WhatsApp e
  //    Instagram muestran una miniatura de 200 px al lado del link.
  twitter: {
    card: "summary_large_image",
    title: PROTOTYPE_CONFIG.brand.name,
    description: "Sándwiches de miga artesanales en San Rafael, Mendoza.",
  },
};

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const settings = await getPublicBusinessSettings();

  return (
    <div className="bg-cream text-ink flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="bg-paper text-ink rounded-control sr-only px-4 py-2 focus:not-sr-only focus:absolute focus:z-50 focus:m-2"
      >
        Saltar al contenido
      </a>
      <BusinessHeader settings={settings} />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <BusinessFooter settings={settings} />
      {/* El carrito se monta una sola vez en el layout: el estado
          abierto vive en el store, así cualquier botón lo abre. */}
      <CartHydrator />
      <CartSheet />
      {/* Una sola suscripción a disponibilidad por pestaña, no una por
          card. Solo el grupo público abre el canal: `/admin` lo abre por
          su propio layout y `/login` no lo necesita (Tarea 15 §4.5). */}
      <AvailabilityRealtimeBridge />
      {/* El estado abierto/cerrado se computa en el navegador (el HTML
          puede salir de una ISR de hace una hora); los horarios son el
          dato estático que el servidor sí puede inyectar. */}
      <OpenStateBridge hours={settings.openingHours} />
    </div>
  );
}
