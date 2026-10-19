/** DTO de categoría (capa 0 · dominio). */

export interface CategoryDTO {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  /** Orden manual de aparición en el menú. Menor = primero. */
  readonly position: number;
  readonly isVisible: boolean;
}

/**
 * La fila que ve la tabla de categorías del panel.
 *
 * ⛔ Vive en `src/lib/domain/` y no en `category-admin.service.ts` porque
 *    la usan Client Components para tipar sus props (§5.10).
 */
export interface CategoryRow {
  readonly id: string;
  readonly nombre: string;
  readonly slug: string;
  readonly descripcion: string | null;
  readonly isVisible: boolean;
  readonly productCount: number;
  /** Con productos, el slug queda congelado (§2.4, §5.3). */
  readonly isSlugEditable: boolean;
}
