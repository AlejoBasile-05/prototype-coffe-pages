import { describe, expect, it } from "vitest";

import { ResourceNotFoundError } from "@/lib/domain";
import type { CategoryDTO } from "@/lib/domain";
import {
  getCategoryForAdmin,
  getVisibleCategories,
  orderCategories,
} from "@/server/services/category.service";

const buildCategory = (overrides: Partial<CategoryDTO> = {}): CategoryDTO => ({
  id: "cat_1",
  name: "Clásicos",
  slug: "clasicos",
  description: null,
  position: 0,
  isVisible: true,
  ...overrides,
});

describe("orderCategories", () => {
  it("debe ordenar por position y desempatar por nombre en español", () => {
    const ordenadas = orderCategories([
      buildCategory({ id: "c3", name: "Zapatitos", position: 2 }),
      buildCategory({ id: "c1", name: "Bebidas", position: 0 }),
      buildCategory({ id: "c2", name: "Álbones", position: 0 }),
    ]);

    expect(ordenadas.map((c) => c.name)).toEqual(["Álbones", "Bebidas", "Zapatitos"]);
  });

  it("no debe mutar el array recibido", () => {
    const original = [
      buildCategory({ name: "Z", position: 1 }),
      buildCategory({ name: "A", position: 0 }),
    ];
    const copia = [...original];

    orderCategories(original);

    expect(original).toEqual(copia);
  });
});

describe("getVisibleCategories", () => {
  it("debe devolver solo las visibles, ya ordenadas", async () => {
    const categorias = await getVisibleCategories({
      categoryRepository: {
        findVisibleCategories: async () => [
          buildCategory({ id: "c2", name: "Premium", position: 1 }),
          buildCategory({ id: "c1", name: "Clásicos", position: 0 }),
        ],
      },
    });

    expect(categorias.map((c) => c.name)).toEqual(["Clásicos", "Premium"]);
  });
});

describe("getCategoryForAdmin", () => {
  it("debe lanzar ResourceNotFoundError cuando la categoría no existe", async () => {
    await expect(
      getCategoryForAdmin(
        { categoryRepository: { findCategoryById: async () => null } },
        "no-existe",
      ),
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it("debe devolver la categoría cuando existe", async () => {
    const categoria = await getCategoryForAdmin(
      { categoryRepository: { findCategoryById: async () => buildCategory() } },
      "cat_1",
    );

    expect(categoria.name).toBe("Clásicos");
  });
});
