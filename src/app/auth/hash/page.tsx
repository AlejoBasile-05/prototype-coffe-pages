import type { Metadata } from "next";

import { HashRecovery } from "@/components/admin/HashRecovery";

export const metadata: Metadata = {
  title: "Verificando link",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Destino del fallback de recovery por hash: `/auth/confirm` redirige acá
 * cuando el link llega sin query params, y el navegador propaga el
 * `#access_token=…` a través de la redirección.
 */
export default function AuthHashPage() {
  return <HashRecovery />;
}
