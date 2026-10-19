"use client";

/**
 * Diálogo de borrado de categoría (Tarea 17 §6.10).
 *
 * ⛔ Nombra la categoría y el conteo de productos. Sin ese detalle el
 *    gesto sería "¿Está seguro?" genérico y el encargado no sabría qué
 *    está firmando (§6.8 y §5.4).
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui";
import { deleteCategoryAction } from "@/server/actions/categorias";
import type { CategoryRow } from "@/lib/domain";

export function CategoryDeleteDialog({
  fila,
  onClose,
}: {
  readonly fila: CategoryRow;
  readonly onClose: () => void;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pendiente, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const resultado = await deleteCategoryAction(fila.id);

      if (!resultado.ok) {
        // El fallo se muestra acá y el diálogo queda abierto: la
        // opción de reintentar sin recargar la página.
        show(resultado.error ?? "No se pudo borrar la categoría.", "error");
        return;
      }

      show(`"${fila.nombre}" se borró del menú.`, "success");
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="rounded-panel border-line-strong bg-paper shadow-lifted fixed inset-4 z-50 m-auto max-w-md border p-6">
      <h2 className="font-display text-ink text-xl">¿Borrar {fila.nombre}?</h2>
      <p className="text-ink-muted mt-2 text-sm">
        {fila.productCount > 0
          ? `Tiene ${fila.productCount} producto${fila.productCount === 1 ? "" : "s"} asignado${fila.productCount === 1 ? "" : "s"}. Reasignalos primero.`
          : "No hay productos asignados. Se puede borrar sin perder nada del menú."}
      </p>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pendiente}
          className="border-line-strong text-ink hover:bg-cream rounded-control min-h-11 border px-4 text-sm"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pendiente}
          className="bg-clay text-paper hover:bg-clay-deep rounded-control min-h-11 px-4 text-sm"
        >
          {pendiente ? "Borrando…" : "Borrar"}
        </button>
      </div>
    </div>
  );
}
