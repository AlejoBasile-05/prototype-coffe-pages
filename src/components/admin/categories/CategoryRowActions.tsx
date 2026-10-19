"use client";

/**
 * Acciones de la fila de la tabla de categorías: visibilidad, editar,
 * borrar (Tarea 17 §6.10).
 *
 * ⛔ Client Component único de la fila: contiene el estado (`open` del
 *    diálogo) porque abrir un diálogo es un comportamiento y un Server
 *    Component no lo puede tener.
 *
 * El switch de visibilidad recibe el valor destino y muestra el rollback
 * si falla la operación (§5.3). El botón de borrar desaparece con
 * productos — `§5.4` el diálogo lo explica igual, pero el click no llega
 * a la base.
 */
import { useState, useTransition } from "react";

import { useToast } from "@/components/ui";
import { setCategoryVisibilityAction } from "@/server/actions/categorias";
import type { CategoryRow } from "@/lib/domain";

import { CategoryDeleteDialog } from "./CategoryDeleteDialog";
import { CategoryFormDialog } from "./CategoryFormDialog";

export interface CategoryRowActionsProps {
  readonly fila: CategoryRow;
}

export function CategoryRowActions({ fila }: CategoryRowActionsProps) {
  const { show } = useToast();
  const [optimista, setOptimista] = useState(fila.isVisible);
  const [pendiente, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  const alternarVisibilidad = (destino: boolean) => {
    const anterior = optimista;
    startTransition(async () => {
      const resultado = await setCategoryVisibilityAction({
        id: fila.id,
        isVisible: destino,
      });
      if (!resultado.ok) {
        setOptimista(anterior);
        if (resultado.error) {
          show(resultado.error, "error");
        }
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      {/* Switch. El label acompaña al texto, no lo reemplaza: para un
          lector de pantalla el estado lo dice el rol `switch` y el
          texto queda como redundancia accesible. */}
      <button
        type="button"
        role="switch"
        aria-checked={optimista}
        aria-busy={pendiente}
        disabled={pendiente}
        onClick={() => alternarVisibilidad(!optimista)}
        className="bg-line-strong relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className="bg-paper absolute top-0.5 size-5 rounded-full transition-transform"
          style={{ transform: optimista ? "translate-x-[22px]" : "translate-x-0.5" }}
        />
      </button>
      <span className="text-ink-muted text-xs">{optimista ? "Visible" : "Oculta"}</span>

      <button
        type="button"
        onClick={() => setEditando(true)}
        aria-label={`Editar ${fila.nombre}`}
        className="border-line-strong text-ink hover:bg-cream hover:border-crust-deep rounded-control min-h-11 border px-3 text-sm transition-colors"
      >
        Editar
      </button>

      {/* ⛔ El botón de borrar se deshabilita con productos: el diálogo
          lo explica igual, pero el click no llega a la action. */}
      <button
        type="button"
        onClick={() => setBorrando(true)}
        disabled={fila.productCount > 0}
        className="border-line-strong text-ink hover:bg-clay/10 hover:border-clay rounded-control min-h-11 border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {fila.productCount > 0 ? "Borrar (con productos)" : "Borrar"}
      </button>

      {editando && <CategoryFormDialog fila={fila} onClose={() => setEditando(false)} />}
      {borrando && <CategoryDeleteDialog fila={fila} onClose={() => setBorrando(false)} />}
    </div>
  );
}
