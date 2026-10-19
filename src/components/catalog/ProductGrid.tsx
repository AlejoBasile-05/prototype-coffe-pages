/**
 * Rejilla responsive de cards (Server Component).
 *
 * Solo decide columnas; NO conoce la forma de `ProductDTO`: recibe el
 * modelo de vista de la card (`ProductCardData`), que la prepara
 * `CatalogView`. `columns` es explícito y no se deduce del viewport:
 * la home usa 4 y el menú 3.
 */
import { joinClasses } from "@/lib/ui/classes";

import { ProductCard, type ProductCardData } from "./ProductCard";

interface ProductGridProps {
  products: readonly ProductCardData[];
  /** Cuántas imágenes son LCP probable. En el menú es 0: ahí la LCP es otra cosa. */
  priorityCount?: number;
  columns?: 2 | 3 | 4;
}

const COLUMN_CLASS: Record<NonNullable<ProductGridProps["columns"]>, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

export function ProductGrid({ products, priorityCount = 0, columns = 3 }: ProductGridProps) {
  return (
    <div className={joinClasses("grid gap-4", COLUMN_CLASS[columns])}>
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < priorityCount} />
      ))}
    </div>
  );
}
