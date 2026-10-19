/**
 * Geometría de la tabla en `Skeleton`.
 *
 * ⛔ Replica el `min-w-3xl`, las cinco columnas y el `rounded-control` de
 *    la imagen de `ProductTable`. Un bloque genérico que no se parece a
 *    nada produce un salto de layout cuando el contenido llega, y el
 *    salto se lee como "la página va lento" aunque la carga haya sido
 *    rápida (CLS).
 *
 * Por eso NO se exportan clases de `ProductTable` para compartirlas con
 * acá: si un día el número de columnas cambia, un `rows={8}` con la
 *    forma vieja se nota en la primera carga. La única constante que se
 *    comparte es la cantidad de filas visibles, que decide cuánto alto
 *    ocupa el placeholder.
 */
import { Skeleton } from "@/components/ui";

export function ProductTableSkeleton({ rows = 8 }: { readonly rows?: number }) {
  return (
    <div
      // El estado de carga lo anuncia el contenedor del `loading.tsx`
      // con `role="status"`; acá los bloques son decorativos.
      aria-hidden="true"
      className="rounded-card border-line bg-paper overflow-x-auto border"
    >
      <div className="w-full min-w-3xl">
        <div className="border-line text-ink-muted grid grid-cols-[minmax(0,3fr)_1fr_1fr_1fr_auto] items-center gap-4 border-b px-4 py-3">
          {["Producto", "Categoría", "Precio", "Estado", "Disponible"].map((columna) => (
            <Skeleton key={columna} className="h-3 w-20" />
          ))}
        </div>

        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="border-line grid grid-cols-[minmax(0,3fr)_1fr_1fr_1fr_auto] items-center gap-4 border-b px-4 py-3 last:border-0"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="rounded-control size-12 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
