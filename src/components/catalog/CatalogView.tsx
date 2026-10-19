/**
 * Ensamblaje de la página de menú (Server Component): índice + secciones.
 *
 * Es el único lugar donde `ProductDTO` se convierte en `ProductCardData`.
 * Centralizarlo evita que cada ruta pase el DTO entero a una card que
 * solo usa siete campos.
 */
import type { CatalogDTO, ProductDTO } from "@/lib/domain";

import { CategoryNav } from "./CategoryNav";
import { CategorySection } from "./CategorySection";
import type { ProductCardData } from "./ProductCard";

interface CatalogViewProps {
  catalog: CatalogDTO;
}

function toCardData(product: ProductDTO): ProductCardData {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: product.price,
    available: product.isAvailable,
    imageUrl: product.imageUrl,
  };
}

export function CatalogView({ catalog }: CatalogViewProps) {
  const sections = catalog.sections.map((section) => ({
    slug: section.category.slug,
    name: section.category.name,
    products: section.products.map(toCardData),
  }));

  return (
    <>
      <CategoryNav categories={sections.map(({ slug, name }) => ({ slug, name }))} />

      <div className="flex flex-col">
        {sections.map((section) => (
          <CategorySection key={section.slug} section={section} />
        ))}
      </div>
    </>
  );
}
