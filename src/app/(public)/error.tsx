"use client";

/**
 * Frontera de error del grupo público.
 *
 * `"use client"` es obligatorio: recibe `onClick` y un Server Component
 * no puede tener handlers. Esta frontera NO captura errores del layout
 * que la contiene, solo de los segmentos hijos: por eso el header y el
 * footer siguen visibles cuando aparece esta pantalla.
 *
 * En desarrollo, el overlay de Next es más útil que esta vista y la
 * reemplaza solo ahí.
 */
import { useEffect } from "react";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-20">
      <h1 className="text-ink font-display text-3xl">Algo se rompió de nuestro lado</h1>

      <p className="text-ink-muted max-w-prose">La página no se pudo cargar. Podés reintentar.</p>

      <button
        type="button"
        onClick={reset}
        className="bg-crust text-paper rounded-control px-5 py-3 font-medium"
      >
        Reintentar
      </button>

      {error.digest !== undefined && (
        <p className="text-ink-muted text-xs">Código: {error.digest}</p>
      )}
    </div>
  );
}
