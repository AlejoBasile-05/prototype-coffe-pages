"use client";

/**
 * Celda de acciones por fila (editar / archivar).
 *
 * ⛔ No va en la tabla puramente renderizadora porque el diálogo de
 *    archivado tiene estado local (`open`). Una celda por fila que no
 *    lo tenga obligaría al encargado a buscar la fila anterior para
 *    confirmar "la que recién moví".
 */
import { useState } from "react";

import { buttonClassName } from "@/components/ui";
import Link from "next/link";

import { ArchiveProductDialog } from "./ArchiveProductDialog";

interface ProductRowActionsProps {
  readonly productId: string;
  readonly productName: string;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export const ProductRowActions = ({ productId, productName, status }: ProductRowActionsProps) => {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/productos/${productId}/editar`}
        className={buttonClassName("secondary", "sm")}
      >
        Editar
      </Link>

      {/* No se puede archivar un producto archivado: el gesto no existe
          y el botón queda deshabilitado en vez de desaparecer. */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        disabled={status === "ARCHIVED"}
        className={buttonClassName("danger", "sm")}
      >
        Archivar
      </button>

      <ArchiveProductDialog
        producto={{ id: productId, name: productName }}
        open={abierto}
        onOpenChange={setAbierto}
      />
    </div>
  );
};
