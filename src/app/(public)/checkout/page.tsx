import type { Metadata } from "next";

import { CheckoutClient } from "@/components/checkout";
import { PROTOTYPE_CONFIG, t } from "@/config/prototype";
import { getPublicBusinessSettings } from "@/server/services";

export const metadata: Metadata = {
  title: t("checkout"),
  description: `${PROTOTYPE_CONFIG.brand.name}: ${PROTOTYPE_CONFIG.brand.description}`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // El punto de composición es el composition root de @/server/services
  // (Tarea 08 §12). La página no lee el carrito: vive en el navegador.
  const business = await getPublicBusinessSettings();

  return (
    <div>
      <h1 className="sr-only">{t("checkout")}</h1>
      <CheckoutClient business={business} />
    </div>
  );
}
