/**
 * Catálogo completo agrupado por categoría, con navegación sticky.
 *
 * El estado vacío es un párrafo con borde y fondo del sistema, no un
 * `EmptyState`: acá el caso es una sola frase y la primitiva grande sería
 * ruido visual con el mismo contenido.
 */
import type { Metadata } from "next";

import { CatalogView } from "@/components/catalog/CatalogView";
import { OpenStateBanner } from "@/components/catalog/OpenStateBanner";
import { PROTOTYPE_CONFIG, t } from "@/config/prototype";
import { getPublicCatalog } from "@/server/services";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: t("catalog"),
  description: `${PROTOTYPE_CONFIG.brand.name}: ${PROTOTYPE_CONFIG.brand.description}`,
};

export default async function MenuPage() {
  const catalog = await getPublicCatalog();

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <h1 className="text-ink font-display py-8 text-3xl">{t("catalog")}</h1>

      {/* El cartel de "cerrado" depende de la hora real del navegador,
          no del HTML cacheado: lo dibuja el banner cliente y solo cuando
          el local está efectivamente cerrado. Los precios y el catálogo
          se muestran siempre, abierto o cerrado. */}
      <OpenStateBanner variant="full" className="mb-4" />

      {catalog.sections.length === 0 ? (
        <p className="bg-paper text-ink-muted rounded-card border-line border p-6">
          {PROTOTYPE_CONFIG.messages.noProducts}
        </p>
      ) : (
        <CatalogView catalog={catalog} />
      )}
    </div>
  );
}
