import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Única forma autorizada de componer clases en el proyecto.
 * Reemplaza a `joinClasses` (src/lib/ui/classes.ts): además de unir,
 * resuelve conflictos de utilidades Tailwind (la última gana), que es lo
 * que permiten las variantes de los componentes Arc.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
