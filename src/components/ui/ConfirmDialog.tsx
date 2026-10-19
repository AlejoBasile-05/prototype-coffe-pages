"use client";

import { useState } from "react";

import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Button } from "./Button";

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** consequence cambia el color del botón de confirmar. */
  consequence?: "destructive" | "neutral";
};

/**
 * Fachada del Dialog de Arc UI (Radix debajo: focus trap, Escape,
 * retorno de foco y entrada con resorte, todo con reduced-motion).
 *
 * La lógica de confirmación — no cerrar mientras la mutación está en
 * vuelo y mostrar el error DENTRO del diálogo — es del negocio y se
 * conserva tal cual.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  consequence = "destructive",
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setConfirmError(null);
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      // El error se muestra DENTRO del diálogo y no se cierra: el usuario
      // necesita leer qué pasó y reintentar.
      setConfirmError(
        error instanceof Error ? error.message : "No se pudo completar la operación.",
      );
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Mientras se confirma, cerrar deja al usuario sin ver ni el
        // resultado ni el error: se bloquea la salida.
        if (!nextOpen && !isConfirming) onClose();
      }}
    >
      <DialogContent
        title={title}
        description={message}
        // role alertdialog: esta ventana interrumpe para confirmar una
        // acción destructiva; el lector de pantalla la anuncia con urgencia.
        role="alertdialog"
        onPointerDownOutside={(event) => {
          if (isConfirming) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (isConfirming) event.preventDefault();
        }}
      >
        {confirmError && (
          <p
            role="alert"
            className="rounded-control mt-3 border border-clay/35 bg-clay/10 px-3 py-2 text-sm text-clay-deep"
          >
            {confirmError}
          </p>
        )}

        {/* flex-col-reverse en móvil: el botón de acción queda abajo del
            todo, que es donde está el pulgar; el de cancelar arriba, que
            es el que no se toca por error. En sm: vuelve al orden visual
            de lectura. */}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button
            variant={consequence === "destructive" ? "danger" : "primary"}
            onClick={handleConfirm}
            isLoading={isConfirming}
            loadingLabel="Confirmando…"
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
