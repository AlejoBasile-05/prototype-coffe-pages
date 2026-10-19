/**
 * Acceso a datos de productos.
 *
 * ⚠️ Esta capa NO conoce reglas de negocio: traduce la base, no la
 * interpreta (Tarea 04 §4.2). "Mostrar un agotado desaturado" es una
 * decisión del servicio (Tarea 08), no del `where` de este repositorio.
 *
 * Única excepción: el filtro `status: "PUBLISHED"` de las lecturas
 * públicas. No es una regla de negocio, es una barrera de seguridad
 * (DESIGN.md §4.7): Prisma bypasea RLS, así que un `DRAFT` no puede salir
 * de la base por una lectura pública bajo ninguna circunstancia.
 */
import "server-only";

import { Prisma, type ProductStatus } from "@prisma/client";

import { prisma } from "@/server/infra/prisma";
import { ConflictError, ResourceNotFoundError } from "@/lib/domain";
import type { ProductDTO } from "@/lib/domain";

import { PRODUCT_SELECT, toProductDTO } from "./mappers/product.mapper";
import type { ProductWithRelations } from "./mappers/product.mapper";

/** Payload de creación. `id`, `createdAt` y `updatedAt` los pone la base. */
export interface CreateProductInput {
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly price: number;
  readonly imageUrl: string;
  readonly imagePublicId: string | null;
  readonly categoryId: string;
  readonly status: ProductStatus;
  readonly isFeatured: boolean;
  readonly isAvailable: boolean;
  readonly allergens: readonly string[];
  readonly sortOrder: number;
}

/**
 * Payload de actualización parcial.
 *
 * Cada propiedad admite `undefined` explícito porque con
 * `exactOptionalPropertyTypes: true` un `Partial<>` plano no es asignable
 * al input de Prisma (que tipa sus campos opcionales como `T | undefined`).
 * Mantener la unicidad del slug también en el borrado lógico: por eso
 * `slug` sigue siendo actualizable aunque es inmutable en el flujo editorial.
 */
export type UpdateProductInput = {
  [K in keyof Omit<CreateProductInput, "slug">]?: CreateProductInput[K] | undefined;
} & { readonly slug?: string };

/** Traduce los errores conocidos de Prisma de escritura a errores de dominio. */
const toDomainWriteError = (error: unknown, resourceId?: string): Error => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return new ConflictError("Ya existe un producto con ese slug", {
        slug: error.meta ? String(error.meta["target"] ?? "") : undefined,
        ...(resourceId ? { id: resourceId } : {}),
      });
    }
    if (error.code === "P2025") {
      return new ResourceNotFoundError("Producto", resourceId ?? "desconocido");
    }
  }
  return error instanceof Error ? error : new Error(String(error));
};

// ────────────────────────── Lecturas ─────────────────────────────

/**
 * Productos para el catálogo público (siempre `PUBLISHED`, nunca borradores
 * ni archivados).
 *
 * `onlyAvailable` NO controla la visibilidad editorial: solo filtra los
 * agotados cuando la capa que llama pide esa vista reducida.
 */
export const findPublishedProducts = async (
  options: { readonly onlyAvailable?: boolean } = {},
): Promise<ProductDTO[]> => {
  const products: ProductWithRelations[] = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      ...(options.onlyAvailable === true ? { isAvailable: true } : {}),
    },
    select: PRODUCT_SELECT,
    orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
  });

  return products.map(toProductDTO);
};

export const findPublishedProductsByCategory = async (
  categoryId: string,
): Promise<ProductDTO[]> => {
  const products: ProductWithRelations[] = await prisma.product.findMany({
    where: { status: "PUBLISHED", categoryId },
    select: PRODUCT_SELECT,
    orderBy: { sortOrder: "asc" },
  });

  return products.map(toProductDTO);
};

/**
 * Devuelve `null` si el slug no existe o no está publicado.
 * El 404 se decide más arriba (Tarea 08), no acá.
 */
export const findPublishedProductBySlug = async (slug: string): Promise<ProductDTO | null> => {
  const product = await prisma.product.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: PRODUCT_SELECT,
  });

  return product ? toProductDTO(product) : null;
};

/** Listado completo para el panel admin. Incluye DRAFT y ARCHIVED. */
export const findAllProductsForAdmin = async (): Promise<ProductDTO[]> => {
  const products: ProductWithRelations[] = await prisma.product.findMany({
    select: PRODUCT_SELECT,
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
  });

  return products.map(toProductDTO);
};

export const findProductByIdForAdmin = async (id: string): Promise<ProductDTO | null> => {
  const product = await prisma.product.findUnique({
    where: { id },
    select: PRODUCT_SELECT,
  });

  return product ? toProductDTO(product) : null;
};

export const findFeaturedProducts = async (limit = 4): Promise<ProductDTO[]> => {
  const products: ProductWithRelations[] = await prisma.product.findMany({
    where: { status: "PUBLISHED", isFeatured: true },
    select: PRODUCT_SELECT,
    orderBy: { sortOrder: "asc" },
    take: limit,
  });

  return products.map(toProductDTO);
};

// ───────────────────────── Escrituras ────────────────────────────

export const createProduct = async (input: CreateProductInput): Promise<ProductDTO> => {
  try {
    const product = await prisma.product.create({
      data: { ...input, allergens: [...input.allergens] },
      select: PRODUCT_SELECT,
    });
    return toProductDTO(product);
  } catch (error) {
    throw toDomainWriteError(error);
  }
};

export const updateProduct = async (id: string, input: UpdateProductInput): Promise<ProductDTO> => {
  try {
    // Con `exactOptionalPropertyTypes: true` no vale un spread del input:
    // una propiedad "presente pero undefined" es inválida para Prisma.
    // Se construye el payload campo a campo, sin casts.
    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (input.name !== undefined) data["name"] = input.name;
    if (input.slug !== undefined) data["slug"] = input.slug;
    if (input.description !== undefined) data["description"] = input.description;
    if (input.price !== undefined) data["price"] = input.price;
    if (input.imageUrl !== undefined) data["imageUrl"] = input.imageUrl;
    if (input.imagePublicId !== undefined) data["imagePublicId"] = input.imagePublicId;
    if (input.categoryId !== undefined) data["categoryId"] = input.categoryId;
    if (input.status !== undefined) data["status"] = input.status;
    if (input.isFeatured !== undefined) data["isFeatured"] = input.isFeatured;
    if (input.isAvailable !== undefined) data["isAvailable"] = input.isAvailable;
    if (input.allergens !== undefined) data["allergens"] = [...input.allergens];
    if (input.sortOrder !== undefined) data["sortOrder"] = input.sortOrder;
    const product = await prisma.product.update({
      where: { id },
      data,
      select: PRODUCT_SELECT,
    });
    return toProductDTO(product);
  } catch (error) {
    throw toDomainWriteError(error, id);
  }
};

/**
 * Alterna la disponibilidad (stock). Operación atómica de un solo campo:
 * recibe el valor DESTINO en lugar de leer el actual, lo que evita
 * condiciones de carrera cuando dos admins hacen clic simultáneamente
 * sobre el mismo producto (Tarea 04 §7).
 */
export const toggleProductAvailability = async (
  id: string,
  isAvailable: boolean,
): Promise<ProductDTO> => {
  try {
    const product = await prisma.product.update({
      where: { id },
      data: { isAvailable },
      select: PRODUCT_SELECT,
    });
    return toProductDTO(product);
  } catch (error) {
    throw toDomainWriteError(error, id);
  }
};

/**
 * Borrado lógico. Nunca borra físicamente: la URL del producto puede estar
 * compartida por clientes y el asset de Cloudinary quedaría huérfano.
 */
export const archiveProduct = async (id: string): Promise<ProductDTO> => {
  try {
    const product = await prisma.product.update({
      where: { id },
      data: { status: "ARCHIVED", isFeatured: false },
      select: PRODUCT_SELECT,
    });
    return toProductDTO(product);
  } catch (error) {
    throw toDomainWriteError(error, id);
  }
};

/**
 * Sitemap. Sólo se devuleve `updatedAt` para que la fila se reduzca a el
 * mínimo absoluto (candidato del PDF del sitemap).
 *
 * ⛔ Nunca se agrega el `updatedAt` a `ProductDTO`: ese contrato lo
 *    consulta el menú entero, y sumarle un campo que nadie usa es
 *    capturar deuda ineludible (§2.3).
 */
export const findPublishedProductsForSitemap = async (): Promise<
  readonly import("@/lib/domain").SitemapProductRecord[]
> => {
  const rows = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return rows;
};
