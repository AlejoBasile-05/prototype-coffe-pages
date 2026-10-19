/**
 * Geometría de la card en Skeleton. La comparten los tres `loading.tsx`
 * del grupo público: copiarla en cada uno garantizaría que un ajuste de
 * la card rompa dos skeletons y el layout salte al llegar el contenido.
 *
 * `aspect-4/3` y los anchos tienen que coincidir EXACTAMENTE con
 * `ProductCard`; si no, el skeleton pierde su propósito.
 */
import { Skeleton } from "@/components/ui";

export function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-paper rounded-card border-line flex flex-col overflow-hidden border"
    >
      <Skeleton className="aspect-4/3 w-full rounded-none" />

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />

        <div className="mt-auto flex items-center justify-between pt-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="rounded-control h-9 w-24" />
        </div>
      </div>
    </div>
  );
}
