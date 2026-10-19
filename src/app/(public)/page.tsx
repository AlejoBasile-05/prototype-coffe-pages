/**
 * Home pública: hero, destacados y acceso al menú.
 *
 * Las dos lecturas son independientes y van en `Promise.all`. La decisión
 * "¿hay algo para pedir?" la toma `catalog.hasAnyAvailableProduct`, un
 * valor ya calculado por la capa de servicio: la home no cuenta
 * productos, consulta una decisión tomada.
 *
 * `priorityCount={1}`: una sola imagen marcada como LCP. Marcar las
 * cuatro le dice al navegador que todas son críticas, que es lo contrario
 * de priorizar.
 */
import Link from "next/link";

import { ProductGrid } from "@/components/catalog/ProductGrid";
import { OpenStateBanner } from "@/components/catalog/OpenStateBanner";
import { TextReveal } from "@/components/arc/text-reveal/text-reveal";
import { buttonClassName } from "@/components/ui";
import { PROTOTYPE_CONFIG, t } from "@/config/prototype";
import { getPublicCatalog, getPublicFeaturedProducts } from "@/server/services";

export const revalidate = 3600;

/** Texto fijo de marca: la home no muestra el nombre configurado en la base. */
const BRAND_LABEL = "Tu Negocio";

export default async function HomePage() {
  const [featured, catalog] = await Promise.all([getPublicFeaturedProducts(4), getPublicCatalog()]);

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-16">
        {/* Aviso discreto si el local está cerrado: aparece arriba del
            hero sin taparlo. */}
        <OpenStateBanner variant="compact" className="mb-6" />
        {/* Único momento coreografiado de la página: el nombre del local
            entra palabra por palabra. El resto del sitio no anima salvo
            en respuesta a una acción (regla de motion del proyecto). */}
        <TextReveal
          as="h1"
          text={BRAND_LABEL}
          className="text-ink font-display text-4xl text-balance sm:text-5xl"
        />

        <p className="text-ink-muted mt-4 max-w-prose text-lg">{PROTOTYPE_CONFIG.brand.tagline}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/menu" className={buttonClassName("primary", "lg")}>
            {t("catalog")}
          </Link>
        </div>
      </section>

      {featured.length > 0 && (
        <section aria-labelledby="destacados" className="mx-auto max-w-6xl px-4 pb-12">
          <h2 id="destacados" className="text-ink font-display text-2xl">
            {t("featured")}
          </h2>

          <div className="mt-4">
            <ProductGrid
              products={featured.map((product) => ({
                id: product.id,
                slug: product.slug,
                name: product.name,
                description: product.description,
                price: product.price,
                available: product.isAvailable,
                imageUrl: product.imageUrl,
              }))}
              columns={4}
              priorityCount={1}
            />
          </div>
        </section>
      )}

      {!catalog.hasAnyAvailableProduct && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <p className="bg-paper text-ink-muted rounded-card border-line border p-4">
            {PROTOTYPE_CONFIG.messages.noProducts}
          </p>
        </section>
      )}
    </>
  );
}
