import { Skeleton } from "@/components/ui";

/**
 * Skeleton de la ficha con la misma geometría que su destino: la misma
 * proporción de imagen (aspect-4/3) y los mismos altos de texto, así el
 * contenido no salta cuando llega.
 */
export default function ProductLoading() {
  return (
    <div aria-hidden="true" className="mx-auto max-w-6xl px-4 py-8">
      <Skeleton className="h-4 w-64" />

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <Skeleton className="rounded-card aspect-4/3 w-full" />

        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="rounded-card h-20 w-full" />
        </div>
      </div>
    </div>
  );
}
