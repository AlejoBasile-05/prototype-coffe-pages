"use client";

/**
 * Diálogo de confirmación del archivado (Tarea 16 §6.8).
 *
 * ⛔ No hay `deleteProductAction`: archivar es un gesto con nombre y
 *    consecuencias. Un diálogo que no nombra al producto sería
 *    "¿Está seguro?" y el encargado no podría saber qué está firmando.
 */
import { useToast } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { archiveProductAction } from "@/server/actions/productos";

interface ArchiveProductDialogProps {
  /** El nombre y el id se nombran: diálogo con nombre = gesto con nombre. */
  readonly producto: { id: string; name: string };
  readonly open: boolean;
  readonly onOpenChange: (abierto: boolean) => void;
}

export const ArchiveProductDialog = ({
  producto,
  open,
  onOpenChange,
}: ArchiveProductDialogProps) => {
  const { show } = useToast();

  const handleConfirm = async () => {
    const resultado = await archiveProductAction(producto.id);

    if (!resultado.ok) {
      // Al lanzar, el `ConfirmDialog` muestra el mensaje dentro del
      // diálogo y mantiene la opción de reintentar. Cerrar el diálogo con
      // un toast invisible dejaría al encargado sin poder leer qué pasó.
      throw new Error(resultado.error);
    }

    show(`${producto.name} se archivó.`, "success");
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={() => onOpenChange(false)}
      onConfirm={handleConfirm}
      title={`¿Archivar ${producto.name}?`}
      message="Deja de aparecer en el menú. El link que ya compartiste sigue funcionando y la foto no se borra. No se puede deshacer desde acá."
      confirmLabel="Archivar"
      consequence="destructive"
    />
  );
};
