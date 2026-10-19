"use client";

/**
 * Card del grid de catálogo. Client Component: el botón "Agregar" es el
 * `AddToCartButton` de la Tarea 11, conectado al store del carrito.
 *
 * Decisiones no negociables:
 *
 * · El `<Link>` que cubre la card es HERMANO absoluto del botón, no su
 *   padre: un `<button>` dentro de un `<Link>` es HTML inválido (dos
 *   interactivos anidados, foco duplicado).
 *
 * · El `alt` de la imagen es el nombre del producto: la card completa es
 *   un enlace con información, así que la imagen no es decorativa.
 */
import Link from "next/link";

import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { formatCurrency, t } from "@/config/prototype";
import { useProductAvailability } from "@/store/availability-store";

import { AvailabilityBadge } from "./AvailabilityBadge";
import { ProductImage } from "./ProductImage";

/**
 * Vista reducida de `ProductDTO`: la card usa siete campos y no conoce
 * el resto. La conversión vive en `CatalogView`, en un solo lugar.
 */
export interface ProductCardData {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly price: number;
  readonly available: boolean;
  readonly imageUrl: string;
}

interface ProductCardProps {
  product: ProductCardData;
  /** Solo las primeras imágenes visibles: marcar todas anula la priorización. */
  priority?: boolean;
}

const DESCRIPTION_LIMIT = 120;

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;

  return `${text.slice(0, limit).trimEnd()}…`;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  // ⛔ `product.available` es el snapshot del HTML del servidor. El
  //    selector pisa ese valor en cuanto llega un evento por Realtime,
  //    y re-renderiza SOLO esta card (Tarea 15 §4.3).
  const isAvailable = useProductAvailability(product.id, product.available);

  return (
    <article className="group bg-paper hover:shadow-card rounded-card border-line relative flex flex-col overflow-hidden border transition-shadow">
      <div className="bg-cream relative aspect-4/3 w-full overflow-hidden">
        {product.imageUrl !== "" ? (
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            available={isAvailable}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            priority={priority}
          />
        ) : (
          <div aria-hidden="true" className="size-full" />
        )}

        {!isAvailable && (
          <div className="absolute top-3 left-3">
            <AvailabilityBadge available={false} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-ink text-base font-semibold">{product.name}</h3>

        {product.description !== null && product.description !== "" && (
          <p className="text-ink-muted line-clamp-2 text-sm">
            {truncate(product.description, DESCRIPTION_LIMIT)}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-ink font-display text-lg">{formatCurrency(product.price)}</span>

          {isAvailable ? (
            <AddToCartButton
              line={{
                productId: product.id,
                slug: product.slug,
                name: product.name,
                variantId: null,
                variantName: null,
                unitPrice: product.price,
                imageUrl: product.imageUrl !== "" ? product.imageUrl : null,
                available: isAvailable,
              }}
            />
          ) : (
            <span className="text-ink-muted text-sm">{t("unavailable")}</span>
          )}
        </div>
      </div>

      <Link
        href={`/producto/${product.slug}`}
        className="absolute inset-0"
        // Queda DEBAJO del botón en el flujo interactivo: el foco del
        // botón lo decide el DOM, no el z-index.
      >
        <span className="sr-only">
          {t("product")}: {product.name}
        </span>
      </Link>
    </article>
  );
}
