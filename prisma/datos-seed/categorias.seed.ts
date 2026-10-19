/**
 * Datos semilla de categorías.
 *
 * Provienen de `PROTOTYPE_CONFIG.defaultCategories` (src/config/prototype.ts):
 * cambiar la config cambia el seed. El orden del arreglo define la `position`.
 */

import { PROTOTYPE_CONFIG } from "@/config/prototype";

export interface CategoriaSeed {
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  /** Orden de aparición en el menú. Arranca en 1. */
  readonly position: number;
  readonly isVisible: boolean;
}

export const CATEGORIAS_SEED: readonly CategoriaSeed[] = PROTOTYPE_CONFIG.defaultCategories.map(
  (categoria, index) => ({
    name: categoria.name,
    slug: categoria.slug,
    description: categoria.description,
    position: index + 1,
    isVisible: true,
  }),
);
