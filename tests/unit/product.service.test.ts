import { describe, expect, it } from "vitest";

import { ResourceNotFoundError } from "@/lib/domain";
import type { CategoryDTO, ProductDTO, ProductStatusDTO } from "@/lib/domain";
import { getProductsForAdmin, setProductAvailability } from "@/server/services/product.service";

const buildProduct = (overrides: Partial<ProductDTO> = {}): ProductDTO => ({
  id: "prd_1",
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

const buildCategory = (id: string, name: string): CategoryDTO => ({
  id,
  name,
  slug: name,
  description: null,
  position: 0,
  isVisible: true,
});

/**
 * Dobles escritos a mano, no `vi.mock`: implementan solo la forma del
 * puerto. Sobreviven a que el repositorio cambie por dentro (Tarea 08
 * §6.7).
 */
const dependenciasCon = (products: readonly ProductDTO[], categories: readonly CategoryDTO[]) => ({
  productRepository: { findAllProductsForAdmin: async () => [...products] },
  categoryRepository: { findAllCategoriesForAdmin: async () => [...categories] },
});

describe("getProductsForAdmin", () => {
  it("debe poner el nombre de la categoría en cada fila", async () => {
    const filas = await getProductsForAdmin(
      dependenciasCon([buildProduct()], [buildCategory("cat_clasicos", "Clásicos")]),
    );

    expect(filas[0]?.categoryName).toBe("Clásicos");
  });

  it("debe mostrar (sin categoría) cuando la categoría no está en la lista", async () => {
    const filas = await getProductsForAdmin(dependenciasCon([buildProduct()], []));

    expect(filas[0]?.categoryName).toBe("(sin categoría)");
  });

  it("debe incluir los borradores y los archivados sin filtrar", async () => {
    const filas = await getProductsForAdmin(
      dependenciasCon(
        [
          buildProduct({ id: "a", status: "DRAFT" as ProductStatusDTO }),
          buildProduct({ id: "b", status: "ARCHIVED" as ProductStatusDTO }),
        ],
        [buildCategory("cat_clasicos", "Clásicos")],
      ),
    );

    expect(filas).toHaveLength(2);
    expect(filas.map((fila) => fila.status)).toEqual(["DRAFT", "ARCHIVED"]);
  });

  it("debe conservar el orden en que las devuelve el repositorio", async () => {
    const filas = await getProductsForAdmin(
      dependenciasCon(
        [
          buildProduct({ id: "tercero", name: "Third" }),
          buildProduct({ id: "primero", name: "First" }),
          buildProduct({ id: "segundo", name: "Second" }),
        ],
        [buildCategory("cat_clasicos", "Clásicos")],
      ),
    );

    // El panel ordena por el criterio del repositorio (`status`, `sortOrder`).
    // Reordenar acá mezclaría el criterio de una futura columna de la tabla
    // con el del menú.
    expect(filas.map((fila) => fila.id)).toEqual(["tercero", "primero", "segundo"]);
  });

  it("debe proyectar solo los campos que la tabla usa", async () => {
    const [fila] = await getProductsForAdmin(
      dependenciasCon([buildProduct()], [buildCategory("cat_clasicos", "Clásicos")]),
    );

    // `description`, `variants`, `allergens` y `imagePublicId` no viajan:
    // son datos que la tabla no pinta y sí cuestan ancho de payload.
    expect(Object.keys(fila ?? {}).sort()).toEqual(
      [
        "categoryId",
        "categoryName",
        "id",
        "imageUrl",
        "isAvailable",
        "isFeatured",
        "name",
        "price",
        "slug",
        "sortOrder",
        "status",
      ].sort(),
    );
  });
});

describe("setProductAvailability", () => {
  it("debe aplicar el valor destino sin alternarlo", async () => {
    const recibido: Array<{ id: string; isAvailable: boolean }> = [];

    await setProductAvailability(
      {
        productRepository: {
          toggleProductAvailability: async (id, isAvailable) => {
            recibido.push({ id, isAvailable });
            return buildProduct({ id, isAvailable });
          },
        },
      },
      { id: "prd_1", isAvailable: false },
    );

    expect(recibido).toEqual([{ id: "prd_1", isAvailable: false }]);
  });

  it("debe propagar el ResourceNotFoundError sin envolverlo", async () => {
    // Si el servicio lo envolviera, la action perdería el código de dominio
    // y el switch no podría distinguir "no existe" de "se cayó la base".
    const productoInexistente = new ResourceNotFoundError("Producto", "prd_1");

    await expect(
      setProductAvailability(
        {
          productRepository: {
            toggleProductAvailability: async () => {
              throw productoInexistente;
            },
          },
        },
        { id: "prd_1", isAvailable: true },
      ),
    ).rejects.toBe(productoInexistente);
  });
});
