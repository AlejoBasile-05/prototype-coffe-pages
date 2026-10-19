/**
 * Sección de una categoría (Server Component): ancla + `<h2>` + grid.
 *
 * El `id` usa el slug de la categoría, que es ASCII: un `id` con tilde o
 * eñe rompe el `href="#…"` en algunos navegadores.
 *
 * `scroll-mt-28` no es decorativo: sin él, el índice sticky deja el
 * encabezado de la sección tapado debajo del header al navegar al ancla.
 */
import { ProductCard, type ProductCardData } from "./ProductCard";

interface CategorySectionProps {
  /** Slug, nombre y cards ya preparadas por `CatalogView`. */
  section: {
    readonly slug: string;
    readonly name: string;
    readonly products: readonly ProductCardData[];
  };
}

export function CategorySection({ section }: CategorySectionProps) {
  const headingId = `${section.slug}-titulo`;

  return (
    <section id={section.slug} aria-labelledby={headingId} className="scroll-mt-28 py-8">
      <h2 id={headingId} className="text-ink font-display text-2xl">
        {section.name}
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {section.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
