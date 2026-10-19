/**
 * Acceso a datos de categorías.
 *
 * Sin reglas de negocio (Tarea 04 §4.2): `findVisibleCategories` filtra por
 * `isVisible` porque esa columna SOLO existe para esa lectura — es el
 * contrato de la tabla, no una interpretación.
 */
import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/server/infra/prisma";
import { ConflictError, ResourceNotFoundError } from "@/lib/domain";
import type { CategoryDTO } from "@/lib/domain";

export interface CreateCategoryInput {
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly position: number;
  readonly isVisible: boolean;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  position: true,
  isVisible: true,
} satisfies Prisma.CategorySelect;

type CategoryRecord = Prisma.CategoryGetPayload<{ select: typeof CATEGORY_SELECT }>;

const toCategoryDTO = (category: CategoryRecord): CategoryDTO => ({ ...category });

export const findVisibleCategories = async (): Promise<CategoryDTO[]> => {
  const categories: CategoryRecord[] = await prisma.category.findMany({
    where: { isVisible: true },
    select: CATEGORY_SELECT,
    orderBy: { position: "asc" },
  });
  return categories.map(toCategoryDTO);
};

export const findAllCategoriesForAdmin = async (): Promise<CategoryDTO[]> => {
  const categories: CategoryRecord[] = await prisma.category.findMany({
    select: CATEGORY_SELECT,
    orderBy: { position: "asc" },
  });
  return categories.map(toCategoryDTO);
};

export const findCategoryById = async (id: string): Promise<CategoryDTO | null> => {
  const category = await prisma.category.findUnique({
    where: { id },
    select: CATEGORY_SELECT,
  });
  return category ? toCategoryDTO(category) : null;
};

export const createCategory = async (input: CreateCategoryInput): Promise<CategoryDTO> => {
  try {
    return toCategoryDTO(
      await prisma.category.create({ data: { ...input }, select: CATEGORY_SELECT }),
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError(`Ya existe una categoría con el slug "${input.slug}"`);
    }
    throw error;
  }
};

export const updateCategory = async (
  id: string,
  input: UpdateCategoryInput,
): Promise<CategoryDTO> => {
  try {
    const category = await prisma.category.update({
      where: { id },
      data: { ...input },
      select: CATEGORY_SELECT,
    });
    return toCategoryDTO(category);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") throw new ResourceNotFoundError("Categoría", id);
      if (error.code === "P2002") {
        throw new ConflictError("Ya existe una categoría con ese slug", { id });
      }
    }
    throw error;
  }
};

/**
 * Elimina una categoría. La FK tiene `onDelete: Restrict`, así que
 * Postgres rechaza el borrado si tiene productos. Se traduce `P2003`
 * (violación de foreign key) a un error de dominio accionable, porque el
 * mensaje crudo de Prisma ("Foreign key constraint violated") no le dice
 * nada al encargado.
 */
export const deleteCategory = async (id: string): Promise<void> => {
  try {
    await prisma.category.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        const productCount = await prisma.product.count({ where: { categoryId: id } });
        throw new ConflictError(
          "No se puede eliminar: la categoría tiene productos asignados. Reasignalos o archivá la categoría.",
          { productCount },
        );
      }
      if (error.code === "P2025") throw new ResourceNotFoundError("Categoría", id);
    }
    throw error;
  }
};
