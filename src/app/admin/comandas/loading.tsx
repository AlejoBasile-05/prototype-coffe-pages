import { PageHeader } from "@/components/admin/PageHeader";
import { Skeleton } from "@/components/ui";
import { t } from "@/config/prototype";

/**
 * Esqueleto del tablero: tres columnas con tarjetas fantasma. Reserva el
 * alto para que la llegada de los datos no mueva la pantalla (CLS ≈ 0).
 */
export default function ComandasLoading() {
  return (
    <>
      <PageHeader title={t("orders")} description="Cargando el tablero del turno…" />

      <div className="grid items-start gap-4 md:grid-cols-3">
        {[0, 1, 2].map((columna) => (
          <section
            key={columna}
            className="rounded-card bg-cream/60 flex flex-col gap-3 p-3"
            aria-hidden="true"
          >
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
          </section>
        ))}
      </div>
    </>
  );
}
