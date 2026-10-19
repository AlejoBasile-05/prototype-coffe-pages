import { ProductCardSkeleton } from "@/components/catalog/ProductCardSkeleton";
import { Skeleton } from "@/components/ui";

/**
 * Skeleton de la home: hero de dos líneas + grilla de 4 destacados.
 * Comparte `ProductCardSkeleton` con el del menú.
 */
export default function HomeLoading() {
  return (
    <div aria-hidden="true" className="mx-auto max-w-6xl px-4 py-16">
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="mt-4 h-6 w-full max-w-prose" />
      <Skeleton className="rounded-control mt-8 h-12 w-40" />

      <Skeleton className="mt-12 h-8 w-40" />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
