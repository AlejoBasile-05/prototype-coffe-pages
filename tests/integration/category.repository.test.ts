import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createCategory,
  deleteCategory,
  findAllCategoriesForAdmin,
  findCategoryById,
  findVisibleCategories,
  updateCategory,
} from "@/server/repositories/category.repository";
import { createProduct } from "@/server/repositories/product.repository";
import { ConflictError, ResourceNotFoundError } from "@/lib/domain";
import { disconnectDatabase, resetDatabase } from "../setup";

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

const buildCategory = (overrides: Partial<Parameters<typeof createCategory>[0]> = {}) => ({
  name: "Clásicos",
  slug: "clasicos",
  description: null,
  position: 0,
  isVisible: true,
  ...overrides,
});

describe("category.repository", () => {
  it("debe rechazar el borrado de una categoría con productos y explicar cuántos hay", async () => {
    const category = await createCategory(buildCategory());
    await createProduct({
      name: "Jamón y Queso",
      slug: "jamon-y-queso",
      description: null,
      price: 1450,
      imageUrl: "https://res.cloudinary.com/demo/image/upload/x.jpg",
      imagePublicId: null,
      categoryId: category.id,
      status: "PUBLISHED",
      isFeatured: false,
      isAvailable: true,
      allergens: [],
      sortOrder: 0,
    });

    const error = await deleteCategory(category.id).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).message).toMatch(/productos asignados/);
    expect((error as ConflictError).details).toMatchObject({ productCount: 1 });
  });

  it("debe borrar una categoría vacía", async () => {
    const category = await createCategory(buildCategory());

    await deleteCategory(category.id);

    expect(await findCategoryById(category.id)).toBeNull();
  });

  it("debe lanzar ResourceNotFoundError al borrar una categoría inexistente", async () => {
    await expect(deleteCategory("no-existe")).rejects.toThrow(ResourceNotFoundError);
  });

  it("debe excluir las categorías ocultas de la lectura pública", async () => {
    await createCategory(buildCategory({ name: "Visible", slug: "visible" }));
    await createCategory(
      buildCategory({ name: "Oculta", slug: "oculta", position: 1, isVisible: false }),
    );

    const categories = await findVisibleCategories();

    expect(categories).toHaveLength(1);
    expect(categories[0]?.name).toBe("Visible");
  });

  it("debe listar TODAS las categorías para el admin y ordenarlas por position", async () => {
    await createCategory(buildCategory({ name: "Segunda", slug: "segunda", position: 1 }));
    await createCategory(
      buildCategory({ name: "Primera", slug: "primera", position: 0, isVisible: false }),
    );

    const categories = await findAllCategoriesForAdmin();

    expect(categories.map((c) => c.name)).toEqual(["Primera", "Segunda"]);
  });

  it("debe lanzar ConflictError ante un slug duplicado", async () => {
    await createCategory(buildCategory());

    await expect(createCategory(buildCategory({ name: "Otra" }))).rejects.toThrow(ConflictError);
  });

  it("debe actualizar una categoría y traducir el slug duplicado", async () => {
    const a = await createCategory(buildCategory());
    await createCategory(buildCategory({ name: "B", slug: "b" }));

    await expect(updateCategory(a.id, { slug: "b" })).rejects.toThrow(ConflictError);

    const renombrada = await updateCategory(a.id, { name: "Clásicos del mes" });
    expect(renombrada.name).toBe("Clásicos del mes");
  });

  it("debe lanzar ResourceNotFoundError al actualizar una categoría inexistente", async () => {
    await expect(updateCategory("no-existe", { name: "X" })).rejects.toThrow(ResourceNotFoundError);
  });
});
