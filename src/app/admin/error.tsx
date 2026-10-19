"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ui";

/**
 * Frontera de error del panel.
 *
 * `"use client"` es obligatorio: recibe `reset`, que es un handler, y un
 * Server Component no puede tener handlers.
 *
 * Un `try/catch` en el layout convertiría un fallo de base en un panel en
 * blanco sin explicación. Acá se muestra qué pasó y se ofrece recargar.
 *
 * ⛔ El mensaje va al registro del servidor, nunca a la pantalla: puede
 *    traer nombres de tabla, de columna y del host.
 *
 * ⚠️ No captura los errores del layout que la contiene (el redirect por
 *    sesión inválida): si `verifyAdminSession` falla, la respuesta es un
 *    307 a `/login`, no una pantalla de error.
 */
export default function AdminError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  return (
    <ErrorState
      title="No se pudo cargar el panel"
      message="Hubo un problema al leer los datos. Probá de nuevo."
      onRetry={reset}
    />
  );
}
