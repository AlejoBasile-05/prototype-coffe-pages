/**
 * Ficha pública de producto.
 *
 * · `params` es una Promise en Next 15+: `await params` es obligatorio.
 *
 * · `generateStaticParams` precarga los destacados del build y
 *   `dynamicParams = true` deja que el resto se genere bajo demanda:
 *   un producto creado en producción no da 404 hasta el próximo build.
 *
 * · `generateMetadata` y el render piden el producto dos veces: Next no
 *   comparte la promesa entre ambos. La segunda lectura es barata porque
 *   el catálogo está cacheado por tag en la capa de servicio.
 *
 * · El servicio lanza `ResourceNotFoundError` para un slug inexistente o
 *   no publicado, y la página lo traduce a `notFound()`: un producto
 *   inexistente es un 404, no una falla del servidor.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { AllergenList } from "@/components/catalog/AllergenList";
import { AvailabilityBadge } from "@/components/catalog/AvailabilityBadge";
import { ProductImage } from "@/components/catalog/ProductImage";
import { SITE_URL } from "@/config/site";
import { PROTOTYPE_CONFIG, formatCurrency, t } from "@/config/prototype";
import { ResourceNotFoundError, type ProductDTO } from "@/lib/domain";
import { getPublicCatalog, getPublicProductBySlug } from "@/server/services";

export const revalidate = 3600;

export const dynamicParams = true;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

/** Devuelve el producto o dispara el 404 del segmento. */
async function readProductOrNotFound(slug: string): Promise<ProductDTO> {
  try {
    return await getPublicProductBySlug(slug);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }
}

/** Categoría del producto para la miga de pan. Sale de las secciones ya cacheadas. */
function findCategoryOf(
  sections: Awaited<ReturnType<typeof getPublicCatalog>>["sections"],
  productId: string,
) {
  return sections.find((section) => section.products.some((product) => product.id === productId))
    ?.category;
}

export async function generateStaticParams() {
  const catalog = await getPublicCatalog();

  return catalog.sections.flatMap((section) =>
    section.products.map((product) => ({ slug: product.slug })),
  );
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await readProductOrNotFound(slug);
  const description = `${PROTOTYPE_CONFIG.brand.name}: ${product.description ?? product.name}`.slice(0, 160);

  return {
    title: product.name,
    description,
    alternates: { canonical: `/producto/${product.slug}` },
    openGraph: {
      type: "article",
      title: product.name,
      description,
      url: `${SITE_URL}/producto/${product.slug}`,
      images: product.imageUrl !== "" ? [{ url: product.imageUrl, alt: product.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await readProductOrNotFound(slug);
  const catalog = await getPublicCatalog();
  const category = findCategoryOf(catalog.sections, product.id);
  const whatsappPhone = catalog.settings.whatsappPhone;

  return (
    <article className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Miga de pan" className="text-ink-muted text-sm">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/menu" className="hover:text-ink">
              {t("catalog")}
            </Link>
          </li>
          {category !== undefined && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`/menu#${category.slug}`} className="hover:text-ink">
                  {category.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="bg-paper rounded-card relative aspect-4/3 overflow-hidden">
          {product.imageUrl !== "" && (
            <ProductImage
              src={product.imageUrl}
              alt={product.name}
              available={product.isAvailable}
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority
            />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-ink font-display text-3xl">{product.name}</h1>
            <AvailabilityBadge available={product.isAvailable} />
          </div>

          <p className="text-ink font-display text-2xl">{formatCurrency(product.price)}</p>

          {product.description !== null && product.description !== "" && (
            <p className="text-ink-muted max-w-prose">{product.description}</p>
          )}

          <AllergenList allergens={product.allergens} />

          {product.isAvailable ? (
            <div className="bg-paper rounded-card border-line mt-2 flex flex-col gap-3 border p-4">
              <AddToCartButton
                line={{
                  productId: product.id,
                  slug: product.slug,
                  name: product.name,
                  variantId: null,
                  variantName: null,
                  unitPrice: product.price,
                  imageUrl: product.imageUrl,
                  available: product.isAvailable,
                }}
                className="self-start"
              />
              {whatsappPhone !== "" && (
                <p className="text-ink-muted text-sm">
                  ¿Preferís pedir directo?{" "}
                  <a
                    href={`https://wa.me/${whatsappPhone}`}
                    className="text-crust-deep hover:underline"
                  >
                    {t("whatsappCTA")}
                  </a>
                  .
                </p>
              )}
            </div>
          ) : (
            <p className="bg-cream text-ink-muted rounded-card p-4 text-sm">
              {t("unavailable")}. {PROTOTYPE_CONFIG.brand.description}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
