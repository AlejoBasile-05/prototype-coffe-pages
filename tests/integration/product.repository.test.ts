import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  archiveProduct,
  createProduct,
  findAllProductsForAdmin,
  findFeaturedProducts,
  findProductByIdForAdmin,
  findPublishedProductBySlug,
  findPublishedProducts,
  findPublishedProductsByCategory,
  toggleProductAvailability,
  updateProduct,
} from "@/server/repositories/product.repository";
import type { CreateProductInput } from "@/server/repositories/product.repository";
import { createCategory } from "@/server/repositories/category.repository";
import { ConflictError, ResourceNotFoundError } from "@/lib/domain";
import { disconnectDatabase, resetDatabase } from "../setup";

const buildProduct = (
  overrides: Partial<CreateProductInput> & { categoryId: string },
): CreateProductInput => ({
  name: "Jamón y Queso",
  slug: "jamon-y-queso",
  description: "Jamón cocido y cheddar en pan de miga.",
  price: 1450,
  imageUrl: "https://res.cloudinary.com/demo/image/upload/modo-miga.jpg",
  imagePublicId: "modo-miga/products/jamon-y-queso",
  status: "PUBLISHED",
  isFeatured: false,
  isAvailable: true,
  allergens: ["gluten", "lactosa"],
  sortOrder: 0,
  ...overrides,
});

let categoryId: string;

beforeEach(async () => {
  await resetDatabase();
  // La categoría se crea DESPUÉS del reset: trunca todo, así que cualquier
  // fila creada en un beforeAll quedaría con una FK colgando.
  const category = await createCategory({
    name: "Clásicos",
    slug: "clasicos",
    description: null,
    position: 0,
    isVisible: true,
  });
  categoryId = category.id;
});

afterAll(disconnectDatabase);

describe("product.repository", () => {
  describe("findPublishedProducts", () => {
    it("debe excluir los productos que no están PUBLISHED", async () => {
      await createProduct(buildProduct({ categoryId }));
      await createProduct(
        buildProduct({ categoryId, name: "Borrador", slug: "borrador", status: "DRAFT" }),
      );
      await createProduct(
        buildProduct({ categoryId, name: "Archivado", slug: "archivado", status: "ARCHIVED" }),
      );

      const products = await findPublishedProducts();

      expect(products).toHaveLength(1);
      expect(products[0]?.slug).toBe("jamon-y-queso");
    });

    it("debe mapear Decimal a number, nunca devolver Prisma.Decimal", async () => {
      await createProduct(buildProduct({ categoryId, price: 1450.5 }));

      const [product] = await findPublishedProducts();

      expect(product?.price).toBe(1450.5);
      expect(typeof product?.price).toBe("number");
      expect(product?.price).not.toHaveProperty("toNumber");
    });

    it("debe filtrar por disponibilidad solo cuando se lo pide", async () => {
      await createProduct(buildProduct({ categoryId, isAvailable: true }));
      await createProduct(
        buildProduct({ categoryId, name: "Agotado", slug: "agotado", isAvailable: false }),
      );

      expect(await findPublishedProducts()).toHaveLength(2);
      expect(await findPublishedProducts({ onlyAvailable: true })).toHaveLength(1);
    });
  });

  describe("findPublishedProductBySlug", () => {
    it("debe devolver el producto si está publicado", async () => {
      await createProduct(buildProduct({ categoryId }));

      const product = await findPublishedProductBySlug("jamon-y-queso");

      expect(product?.name).toBe("Jamón y Queso");
    });

    it("debe devolver null (sin lanzar) si el slug no existe o no está publicado", async () => {
      await createProduct(buildProduct({ categoryId, status: "DRAFT" }));

      expect(await findPublishedProductBySlug("jamon-y-queso")).toBeNull();
      expect(await findPublishedProductBySlug("no-existe")).toBeNull();
    });
  });

  describe("findPublishedProductsByCategory", () => {
    it("debe devolver solo los publicados de esa categoría, ordenados", async () => {
      const otra = await createCategory({
        name: "Bebidas",
        slug: "bebidas",
        description: null,
        position: 1,
        isVisible: true,
      });
      await createProduct(buildProduct({ categoryId, sortOrder: 2, slug: "b", name: "B" }));
      await createProduct(buildProduct({ categoryId, sortOrder: 1, slug: "a", name: "A" }));
      await createProduct(buildProduct({ categoryId: otra.id, slug: "c", name: "C" }));

      const products = await findPublishedProductsByCategory(categoryId);

      expect(products.map((p) => p.name)).toEqual(["A", "B"]);
    });
  });

  describe("findAllProductsForAdmin y findProductByIdForAdmin", () => {
    it("debe incluir DRAFT y ARCHIVED en el listado del panel", async () => {
      await createProduct(buildProduct({ categoryId }));
      await createProduct(
        buildProduct({ categoryId, slug: "borrador", name: "B", status: "DRAFT" }),
      );

      expect(await findAllProductsForAdmin()).toHaveLength(2);
      expect(await findPublishedProducts()).toHaveLength(1);
    });

    it("debe devolver el producto por id o null si no existe", async () => {
      const created = await createProduct(buildProduct({ categoryId }));

      expect((await findProductByIdForAdmin(created.id))?.slug).toBe("jamon-y-queso");
      expect(await findProductByIdForAdmin("no-existe")).toBeNull();
    });
  });

  describe("findFeaturedProducts", () => {
    it("debe respetar el límite y solo traer destacados publicados", async () => {
      await createProduct(buildProduct({ categoryId, slug: "f1", name: "F1", isFeatured: true }));
      await createProduct(buildProduct({ categoryId, slug: "f2", name: "F2", isFeatured: true }));
      await createProduct(buildProduct({ categoryId, slug: "n1", name: "N1" }));
      await createProduct(
        buildProduct({ categoryId, slug: "f3", name: "F3", isFeatured: true, status: "DRAFT" }),
      );

      const featured = await findFeaturedProducts(1);

      expect(featured).toHaveLength(1);
      expect(featured[0]?.isFeatured).toBe(true);
    });
  });

  describe("slug duplicado", () => {
    it("debe lanzar ConflictError con un mensaje accionable", async () => {
      await createProduct(buildProduct({ categoryId }));

      await expect(createProduct(buildProduct({ categoryId }))).rejects.toThrow(ConflictError);
    });
  });

  describe("operaciones sobre un id inexistente", () => {
    it("debe lanzar ResourceNotFoundError, no un error crudo de Prisma", async () => {
      await expect(toggleProductAvailability("no-existe", false)).rejects.toThrow(
        ResourceNotFoundError,
      );
      await expect(archiveProduct("no-existe")).rejects.toThrow(ResourceNotFoundError);
      await expect(updateProduct("no-existe", { name: "X" })).rejects.toThrow(
        ResourceNotFoundError,
      );
    });
  });

  describe("toggleProductAvailability", () => {
    it("debe aplicar el valor destino, no alternar el actual", async () => {
      const created = await createProduct(buildProduct({ categoryId, isAvailable: true }));

      const agotado = await toggleProductAvailability(created.id, false);
      const idempotente = await toggleProductAvailability(created.id, false);
      const repuesto = await toggleProductAvailability(created.id, true);

      expect(agotado.isAvailable).toBe(false);
      expect(idempotente.isAvailable).toBe(false);
      expect(repuesto.isAvailable).toBe(true);
    });
  });

  describe("archiveProduct", () => {
    it("debe ser borrado lógico: el registro sigue existiendo", async () => {
      const created = await createProduct(buildProduct({ categoryId, isFeatured: true }));

      const archived = await archiveProduct(created.id);

      expect(archived.status).toBe("ARCHIVED");
      expect(archived.isFeatured).toBe(false);
      // Sigue en la base: no se borró físicamente.
      expect(await findAllProductsForAdmin()).toHaveLength(1);
      // Pero desaparece del catálogo público.
      expect(await findPublishedProducts()).toHaveLength(0);
    });
  });

  describe("producto sin variantes", () => {
    it("debe devolver `variants: []`, nunca null", async () => {
      await createProduct(buildProduct({ categoryId }));

      const [product] = await findPublishedProducts();

      expect(product?.variants).toEqual([]);
    });
  });
});
