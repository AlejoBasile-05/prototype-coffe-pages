import { describe, expect, it } from "vitest";

import { ResourceNotFoundError } from "@/lib/domain";
import type { BusinessSettingsDTO, CategoryDTO, ProductDTO } from "@/lib/domain";
import {
  buildCatalogDTO,
  getFeaturedProductsForPublic,
  getProductBySlugForPublic,
  readCatalogSections,
} from "@/server/services/catalog.service";
import type { CatalogContentReaders } from "@/server/services/catalog.service";

const buildCategory = (overrides: Partial<CategoryDTO> = {}): CategoryDTO => ({
  id: "cat_clasicos",
  name: "Clásicos",
  slug: "clasicos",
  description: null,
  position: 0,
  isVisible: true,
  ...overrides,
});

const buildProduct = (overrides: Partial<ProductDTO> = {}): ProductDTO => ({
  id: "prod_jamon",
  name: "Jamón y Queso",
  slug: "jamon-y-queso",
  description: null,
  price: 1450,
  imageUrl: "https://res.cloudinary.com/demo/image/upload/jq.jpg",
  imagePublicId: null,
  isAvailable: true,
  status: "PUBLISHED",
  isFeatured: false,
  sortOrder: 0,
  allergens: [],
  categoryId: "cat_clasicos",
  variants: [],
  ...overrides,
});

const buildSettings = (): BusinessSettingsDTO => ({
  name: "Mi Negocio",
  whatsappPhone: "5492615551234",
  address: null,
  instagramUrl: null,
  openingHours: {},
  closingMessage: null,
  legalNotice: null,
});

/** Doble de repositorio. Solo implementa lo que el puerto declara. */
const buildReaders = (
  categories: readonly CategoryDTO[],
  products: readonly ProductDTO[],
): CatalogContentReaders => ({
  categoryRepository: { findVisibleCategories: async () => [...categories] },
  productRepository: {
    findPublishedProducts: async () => [...products],
    findPublishedProductBySlug: async (slug) =>
      products.find((product) => product.slug === slug) ?? null,
    findFeaturedProducts: async (limit = 4) => products.filter((p) => p.isFeatured).slice(0, limit),
  },
});

describe("catalog.service", () => {
  describe("readCatalogSections", () => {
    it("debe excluir un producto DRAFT aunque el repositorio lo haya traído", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [buildProduct(), buildProduct({ id: "prod_borrador", slug: "borrador", status: "DRAFT" })],
      );

      const sections = await readCatalogSections(readers);

      expect(sections).toHaveLength(1);
      expect(sections[0]?.products.map((p) => p.slug)).toEqual(["jamon-y-queso"]);
    });

    it("debe excluir también un producto ARCHIVED", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [buildProduct(), buildProduct({ id: "prod_archivado", status: "ARCHIVED" })],
      );

      const sections = await readCatalogSections(readers);

      expect(sections[0]?.products).toHaveLength(1);
    });

    it("debe excluir un producto ARCHIVED de la lista de destacados", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [buildProduct({ isFeatured: true, status: "ARCHIVED" })],
      );

      expect(await getFeaturedProductsForPublic(readers)).toHaveLength(0);
    });

    it("no debe construir una sección para una categoría visible sin publicados", async () => {
      const readers = buildReaders(
        [buildCategory(), buildCategory({ id: "cat_postres", name: "Postres", position: 1 })],
        [buildProduct()],
      );

      const sections = await readCatalogSections(readers);

      expect(sections).toHaveLength(1);
      expect(sections[0]?.category.name).toBe("Clásicos");
    });

    it("debe excluir los productos de una categoría oculta, no dejarlos sueltos", async () => {
      const readers = buildReaders(
        [buildCategory({ id: "cat_visible", name: "Clásicos" })],
        [buildProduct({ categoryId: "cat_oculta" })],
      );

      expect(await readCatalogSections(readers)).toHaveLength(0);
    });

    it("debe ordenar los productos por sortOrder y desempatar por nombre", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [
          buildProduct({ id: "p3", name: "Zapallito", sortOrder: 2 }),
          buildProduct({ id: "p1", name: "Bife", sortOrder: 0 }),
          buildProduct({ id: "p2", name: "Americana", sortOrder: 0 }),
        ],
      );

      const sections = await readCatalogSections(readers);

      expect(sections[0]?.products.map((p) => p.name)).toEqual(["Americana", "Bife", "Zapallito"]);
    });

    it("debe devolver un producto sin descripción, sin variantes y sin imagen pública", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [
          buildProduct({
            description: null,
            imagePublicId: null,
            variants: [],
            allergens: [],
          }),
        ],
      );

      const [section] = await readCatalogSections(readers);
      const product = section?.products[0];

      expect(product?.description).toBeNull();
      expect(product?.imagePublicId).toBeNull();
      expect(product?.variants).toEqual([]);
      expect(product?.allergens).toEqual([]);
    });

    it("debe devolver precios como number, nunca Prisma.Decimal", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [
          buildProduct({
            price: 1450.5,
            variants: [
              { id: "v1", name: "Doble", priceDelta: 450, isAvailable: true, sortOrder: 0 },
            ],
          }),
        ],
      );

      const [section] = await readCatalogSections(readers);
      const product = section?.products[0];

      expect(typeof product?.price).toBe("number");
      expect(product?.price).toBe(1450.5);
      expect(typeof product?.variants[0]?.priceDelta).toBe("number");
    });

    it("debe devolver un producto sin variantes sin inventar una variante única", async () => {
      const readers = buildReaders([buildCategory()], [buildProduct({ variants: [] })]);

      const [section] = await readCatalogSections(readers);

      expect(section?.products[0]?.variants).toEqual([]);
    });
  });

  describe("buildCatalogDTO", () => {
    it("debe marcar que no hay disponibilidad cuando todos los productos están agotados", async () => {
      const readers = buildReaders([buildCategory()], [buildProduct({ isAvailable: false })]);

      const sections = await readCatalogSections(readers);
      const catalog = buildCatalogDTO(sections, buildSettings());

      expect(catalog.hasAnyAvailableProduct).toBe(false);
      // Los agotados siguen estando: se muestran desaturados (DESIGN.md §10.3).
      expect(catalog.sections[0]?.products).toHaveLength(1);
    });

    it("debe marcar que hay disponibilidad si un solo producto está disponible", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [
          buildProduct({ id: "p1", isAvailable: false }),
          buildProduct({ id: "p2", sortOrder: 1, isAvailable: true }),
        ],
      );

      const catalog = buildCatalogDTO(await readCatalogSections(readers), buildSettings());

      expect(catalog.hasAnyAvailableProduct).toBe(true);
    });

    it("debe devolver un catálogo vacío sin lanzar cuando no hay nada publicado", async () => {
      const catalog = buildCatalogDTO([], buildSettings());

      expect(catalog.sections).toEqual([]);
      expect(catalog.hasAnyAvailableProduct).toBe(false);
      expect(catalog.settings.name).toBe("Mi Negocio");
    });
  });

  describe("getProductBySlugForPublic", () => {
    it("debe lanzar ResourceNotFoundError si el slug no existe", async () => {
      const readers = buildReaders([buildCategory()], []);

      await expect(getProductBySlugForPublic(readers, "no-existe")).rejects.toThrow(
        ResourceNotFoundError,
      );
    });

    it("debe lanzar ResourceNotFoundError si el slug apunta a un DRAFT o ARCHIVED", async () => {
      const readers = buildReaders([buildCategory()], [buildProduct({ status: "DRAFT" })]);

      await expect(getProductBySlugForPublic(readers, "jamon-y-queso")).rejects.toThrow(
        ResourceNotFoundError,
      );
    });

    it("debe devolver el producto cuando el slug es de un PUBLISHED", async () => {
      const readers = buildReaders([buildCategory()], [buildProduct()]);

      const product = await getProductBySlugForPublic(readers, "jamon-y-queso");

      expect(product.name).toBe("Jamón y Queso");
    });
  });

  describe("getFeaturedProductsForPublic", () => {
    it("debe acotar el límite a un rango razonable", async () => {
      const readers = buildReaders(
        [buildCategory()],
        Array.from({ length: 20 }, (_, index) =>
          buildProduct({ id: `p${index}`, slug: `p-${index}`, isFeatured: true }),
        ),
      );

      expect(await getFeaturedProductsForPublic(readers, 999)).toHaveLength(12);
      expect(await getFeaturedProductsForPublic(readers, 0)).toHaveLength(1);
    });
  });
});
