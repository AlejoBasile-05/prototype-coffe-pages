/**
 * Mapper de producto: Prisma → DTO serializable.
 *
 * ⚠️ Función pura. No hace queries ni tiene efectos.
 *
 * ¿Por qué un mapper y no un `as`? Porque el mapeo DEBE ser explícito y
 * revisable: si mañana Prisma agrega un campo o cambia un tipo, el
 * compilador avisa acá en lugar de fallar en runtime con un error de
 * serialización en el cliente (`Decimal` no cruza el límite RSC→Cliente;
 * ver Tarea 04 §4.3).
 *
 * El `select` vive EN ESTE ARCHIVO a propósito: es el contrato de lectura
 * del mapeo. Si ambos divergen (se selecciona algo que el mapper no sabe
 * traducir, o el mapper lee algo que no se selecciona), el compilador lo
 * reclama en `ProductWithRelations`. Además así el repositorio no queda
 * en una importación circular con su propio mapper.
 */
import type { Prisma } from "@prisma/client";

import type { ProductDTO, ProductStatusDTO, ProductVariantDTO } from "@/lib/domain";

/** Contrato de lectura de un producto con sus relaciones. */
export const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  imageUrl: true,
  imagePublicId: true,
  isAvailable: true,
  status: true,
  isFeatured: true,
  sortOrder: true,
  allergens: true,
  categoryId: true,
  category: { select: { id: true, name: true, slug: true } },
  variants: {
    select: { id: true, name: true, priceDelta: true, isAvailable: true, sortOrder: true },
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.ProductSelect;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_SELECT;
}>;

/** Convierte el enum de Prisma a la union type del dominio. */
const toProductStatusDTO = (status: ProductWithRelations["status"]): ProductStatusDTO => status;

const toVariantDTO = (variant: ProductWithRelations["variants"][number]): ProductVariantDTO => ({
  id: variant.id,
  name: variant.name,
  // El punto crítico de la Tarea 04 §4.3: Decimal → number, SIEMPRE.
  priceDelta: variant.priceDelta.toNumber(),
  isAvailable: variant.isAvailable,
  sortOrder: variant.sortOrder,
});

export const toProductDTO = (product: ProductWithRelations): ProductDTO => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  description: product.description,
  price: product.price.toNumber(),
  imageUrl: product.imageUrl,
  imagePublicId: product.imagePublicId,
  isAvailable: product.isAvailable,
  status: toProductStatusDTO(product.status),
  isFeatured: product.isFeatured,
  sortOrder: product.sortOrder,
  allergens: product.allergens,
  categoryId: product.categoryId,
  variants: [...product.variants].sort((a, b) => a.sortOrder - b.sortOrder).map(toVariantDTO),
});
