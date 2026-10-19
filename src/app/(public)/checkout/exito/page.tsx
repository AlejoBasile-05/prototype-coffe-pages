import type { Metadata } from "next";

import { CheckoutSuccess } from "@/components/checkout";
import { getPublicBusinessSettings } from "@/server/services";

/**
 * `noindex` obligatorio: es una pantalla de transición, no una página
 * del sitio. Que un buscador la indexe no aporta nada.
 */
export const metadata: Metadata = {
  title: "Pedido listo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage() {
  const business = await getPublicBusinessSettings();

  return <CheckoutSuccess business={business} />;
}
