import { joinClasses } from "@/lib/ui/classes";

/**
 * Placeholder de carga. No es un spinner: el skeleton reserva el espacio
 * exacto que va a ocupar el contenido, así el layout no salta cuando
 * llegan los datos. En una lista densa eso es la diferencia entre
 * "está cargando" y "se rompió".
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      // aria-hidden: el placeholder no es contenido. El estado de carga lo
      // comunica el contenedor con role="status".
      aria-hidden="true"
      className={joinClasses("rounded-card bg-ink/5", "motion-safe:animate-pulse", className)}
    />
  );
}

/** Variante de una línea, para textos que aún no llegaron. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={joinClasses("space-y-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          // La última línea más corta: imita un párrafo real.
          className={index === lines - 1 ? "h-3 w-2/3" : "h-3 w-full"}
        />
      ))}
    </div>
  );
}
