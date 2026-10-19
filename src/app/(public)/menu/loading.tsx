import { ProductCardSkeleton } from "@/components/catalog/ProductCardSkeleton";
import { Skeleton } from "@/components/ui";

export default function MenuLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <div className="h-10 w-40 py-8">
        <Skeleton className="size-full" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
