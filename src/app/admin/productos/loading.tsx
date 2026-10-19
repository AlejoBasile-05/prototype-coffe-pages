import { ProductTableSkeleton } from "@/components/admin/ProductTableSkeleton";
import { Skeleton } from "@/components/ui";

/**
 * El skeleton tiene la geometría de la tabla real, con la misma cantidad
 * de filas visibles. Un bloque genérico que no se parece a nada produce
 * un salto de layout cuando el contenido llega, y el salto se lee como
 * "la página va lento" aunque la carga haya sido rápida.
 */
export default function ProductosLoading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Cargando los productos…</span>

      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <ProductTableSkeleton rows={8} />
    </div>
  );
}
