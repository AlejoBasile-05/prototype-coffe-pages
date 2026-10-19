import type { BusinessSettingsDTO } from "./settings";
import type { CategoryDTO } from "./category";
import type { ProductDTO } from "./product";

/**
 * Una categoría y sus productos publicados, ya ordenados.
 *
 * ⛔ Regla estructural: `products` NUNCA es un array vacío. Una sección
 * vacía es un error de presentación, no un dato: si una categoría visible
 * no tiene publicados, no se construye la sección (Tarea 08, DESIGN.md
 * §10.5).
 */
export interface CatalogSection {
  readonly category: CategoryDTO;
  readonly products: readonly ProductDTO[];
}

/**
 * Ensamblaje completo que consume la capa de presentación.
 *
 * `settings` viaja dentro del catálogo a propósito: el header, el footer
 * y el botón de WhatsApp necesitan el nombre del local y el teléfono en
 * la misma lectura que el resto de la página, sin una segunda ida a la
 * base.
 */
export interface CatalogDTO {
  readonly sections: readonly CatalogSection[];
  readonly settings: BusinessSettingsDTO;
  /**
   * Snapshot de "¿hay algo para pedir?" al momento de generar el HTML.
   *
   * ⚠️ Es un valor inicial, no el estado final. Después de hidratar, la
   * fuente de verdad es el store de disponibilidad alimentado por Realtime
   * (Tarea 15), que recalcula este booleano con el mismo helper.
   */
  readonly hasAnyAvailableProduct: boolean;
}

/**
 * ¿Hay al menos un producto disponible en todo el catálogo?
 *
 * Función pura e isomórfica a propósito: la usa el servidor para el HTML
 * inicial y el cliente para recalcular cuando llega un push de Realtime.
 * Si el servidor y el cliente usaran fórmulas distintas, el botón de
 * WhatsApp aparecería deshabilitado para unos y habilitado para otros.
 */
export const hasAvailableProducts = (sections: readonly CatalogSection[]): boolean =>
  sections.some((section) => section.products.some((product) => product.isAvailable));

/** Total de productos publicados, contando los agotados. Lo usa la Tarea 14. */
export const countProducts = (sections: readonly CatalogSection[]): number =>
  sections.reduce((total, section) => total + section.products.length, 0);
