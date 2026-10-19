import { ProductTableSkeleton } from "@/components/admin/ProductTableSkeleton";
import { Skeleton } from "@/components/ui";

/**
 * Skeleton del dashboard mientras resuelve el Server Component.
 *
 * Reserva la geometría de la pantalla real: encabezado + grilla de cuatro
 * contadores + tabla corta. Un bloque genérico produce un salto de layout
 * al llegar los datos, y el salto se lee como "la página va lento" aunque
 * la carga haya sido rápida.
 *
 * `role="status"` con el texto `sr-only`: el estado de carga se anuncia
 * una vez, sin que cada `Skeleton` (que es decorativo) repita nada.
 */
export default function AdminLoading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Cargando el panel…</span>

      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-card border-line bg-paper border p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-9 w-12" />
          </div>
        ))}
      </div>

      <div className="mt-8">
        <ProductTableSkeleton rows={4} />
      </div>
    </div>
  );
}
