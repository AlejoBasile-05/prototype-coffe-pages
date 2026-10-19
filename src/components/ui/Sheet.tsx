"use client";

import type { ReactNode } from "react";

import { Drawer, DrawerContent } from "@/components/arc/drawer/drawer";
import { cn } from "@/lib/utils";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** El contenido scrollea pero el footer queda siempre visible. */
  footer?: ReactNode;
  size?: "sm" | "md";
};

/**
 * Fachada del Drawer de Arc UI (bottom sheet arrastrable).
 *
 * Reemplaza al Sheet casero: Arc aporta drag-to-dismiss con física de
 * resorte, focus trap y retorno de foco al disparador (Radix), todo con
 * prefers-reduced-motion respetado. La API pública no cambió.
 *
 * El footer va pegado abajo del panel, fuera del área scrolleable, para
 * que el total del carrito y la acción principal nunca se escondan.
 */
export function Sheet({ open, onClose, title, description, children, footer }: SheetProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DrawerContent
        title={title}
        // exactOptionalPropertyTypes: pasar `description={undefined}`
        // no es lo mismo que no pasarla; el spread condicional lo resuelve.
        {...(description !== undefined ? { description } : {})}
        side="bottom"
        // max-h generoso: el carrito puede crecer, pero nunca tapa el
        // header del sitio (siempre queda aire para tocar fuera y cerrar).
        className={cn("max-h-[85dvh]")}
      >
        <div className="flex max-h-[calc(85dvh-6rem)] flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          {footer && <footer className="border-line bg-cream border-t pt-4">{footer}</footer>}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
