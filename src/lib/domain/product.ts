/**
 * DTOs de producto (capa 0 · dominio).
 *
 * Son los tipos SERIALIZABLES que cruzan el límite servidor→cliente:
 * nunca `Prisma.Decimal`, nunca `Date`, nunca enums de Prisma.
 * Ver Tarea 04 §4.3.
 */

export type ProductStatusDTO = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/**
 * Variante de un producto. El precio final es
 * `product.price + variant.priceDelta`.
 *
 * ⚠️ SIN USO EN v1 (decisión D-02): el tipo existe porque el modelo lo
 * refleja en la base, pero ningún servicio ni UI lo consume todavía.
 */
export interface ProductVariantDTO {
  readonly id: string;
  readonly name: string;
  /** Delta en pesos sobre el precio del producto. Puede ser 0. */
  readonly priceDelta: number;
  readonly isAvailable: boolean;
  readonly sortOrder: number;
}

export interface ProductDTO {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  /** En pesos. Nunca `Decimal`. */
  readonly price: number;
  readonly imageUrl: string;
  readonly imagePublicId: string | null;
  /** Stock en vivo. Lo alterna el encargado (Tarea 14). */
  readonly isAvailable: boolean;
  readonly status: ProductStatusDTO;
  readonly isFeatured: boolean;
  readonly sortOrder: number;
  /** Claves del glosario cerrado de alérgenos (Tarea 00 §5). */
  readonly allergens: readonly string[];
  readonly categoryId: string;
  /** Variantes ya ordenadas por `sortOrder`. Vacío si el producto no tiene. */
  readonly variants: readonly ProductVariantDTO[];
}

/**
 * Fila de la tabla de productos del panel (Tarea 14).
 *
 * ⛔ Proyección plana a propósito: el `ProductDTO` completo trae
 *    `variants`, `allergens` y `description`, que la tabla no usa. No
 *    hace falta serializar veinte descripciones para pintar cinco
 *    columnas, y `variants` no tiene por qué viajar al cliente.
 *
 * ⚠️ Vive en la CAPA 0 y no en `product.service.ts` (que es
 *    `server-only`) porque la tabla la recibe como prop desde un
 *    Server Component: los tipos que cruzan la frontera
 *    servidor→cliente son datos de dominio, igual que los DTO. Lo
 *    reexporta el servicio para quien importa desde
 *    `@/server/services`.
 *
 * `categoryName` ya viene resuelto: el `ProductDTO` solo trae
 * `categoryId`, y unir en el servicio evita que cada render de la
 * vista arme el mismo `Map`.
 */
export interface ProductRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly imageUrl: string;
  readonly price: number;
  /** Estado editorial. La tabla lo muestra, no lo escribe. */
  readonly status: ProductStatusDTO;
  /** Stock en vivo. Lo único que el switch de la tabla escribe. */
  readonly isAvailable: boolean;
  readonly isFeatured: boolean;
  readonly sortOrder: number;
  readonly categoryId: string;
  readonly categoryName: string;
}
