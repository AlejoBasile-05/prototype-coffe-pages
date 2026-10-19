import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConflictError, ResourceNotFoundError, ValidationError } from "@/lib/domain";
import type { CategoryDTO, CategoryRow, ProductDTO } from "@/lib/domain";
import {
  createCategoryFromAdmin,
  deleteCategoryFromAdmin,
  getCategoriesForAdmin,
  setCategoryVisibilityFromAdmin,
  updateCategoryFromAdmin,
  camposEditadosDeCategoria,
} from "@/server/services/category-admin.service";
import type {
  CategoryAdminLister,
  CategoryAdminWriter,
  ProductAdminReader,
} from "@/server/services/repository-ports";
import type { CategoriaEdicionInput } from "@/server/schemas/categorias.schema";

/**
 * ⛔ Repositorios en memoria, no `vi.mock`. El servicio recibe sus
 *    dependencias por parámetro (§4.1), así que el doble es un objeto con
 *    la forma del puerto. Con un mock de módulo, un test que pasa sólo
 *    demuestra que el código llama a lo que el test le dijo que llamara;
 *    acá el slug congelado, el `ConflictError` del borrado y el conteo
 *    cruzado se ejecutan de verdad.
 */
/**
 * ⛔ Los dobles se tipan contra los PUERTOS, no contra `typeof vi.fn()`.
 *    `vi.fn()` pelado infiere `Mock<Procedure | Constructable>`, que no es
 *    asignable a un método del puerto y rompe el `type-check`: el test
 *    compila sólo hasta que el puerto cambia de firma.
 */
type RepositorioDeCategorias = CategoryAdminLister & CategoryAdminWriter;

interface Falso extends ProductAdminReader {
  categorias: CategoryDTO[];
  createCategory: ReturnType<typeof vi.fn<CategoryAdminWriter["createCategory"]>>;
  updateCategory: ReturnType<typeof vi.fn<CategoryAdminWriter["updateCategory"]>>;
  deleteCategory: ReturnType<typeof vi.fn<CategoryAdminWriter["deleteCategory"]>>;
}

const deps = (
  falso: Falso,
): { categoryRepository: RepositorioDeCategorias; productRepository: ProductAdminReader } => ({
  categoryRepository: {
    findAllCategoriesForAdmin: async () => falso.categorias,
    createCategory: falso.createCategory,
    updateCategory: falso.updateCategory,
    deleteCategory: falso.deleteCategory,
  },
  productRepository: falso,
});

const CATEGORIA_SIN_PRODUCTOS = "cat-a";
const CATEGORIA_CON_PRODUCTOS = "cat-b";

/**
 * Producto mínimo y completo: el conteo cruzado sólo lee `categoryId`, pero
 * el puerto devuelve `ProductDTO` entero y `vi.fn` no ensancha la firma.
 */
const PRODUCTO_BASE: ProductDTO = {
  id: "prod_base",
  name: "Classic",
  slug: "classic",
  description: "Vientre de leche con jamón cocido y queso gouda.",
  price: 1450.5,
  imageUrl: "https://res.cloudinary.com/modo-miga/image/upload/x.jpg",
  imagePublicId: "modo-miga/products/classic",
  isAvailable: true,
  status: "PUBLISHED",
  isFeatured: false,
  sortOrder: 0,
  allergens: ["gluten", "lactosa"],
  categoryId: CATEGORIA_SIN_PRODUCTOS,
  variants: [],
};

const crearFalso = (): Falso => {
  const categorias: CategoryDTO[] = [
    {
      id: CATEGORIA_CON_PRODUCTOS,
      name: "Sandwiches",
      slug: "sandwiches",
      description: "De masa madre",
      position: 1,
      isVisible: true,
    },
    {
      id: CATEGORIA_SIN_PRODUCTOS,
      name: "Bebidas frías",
      slug: "bebidas-frias",
      description: null,
      position: 2,
      isVisible: true,
    },
  ];

  const products: ProductDTO[] = [
    { ...PRODUCTO_BASE, id: "prod_1", categoryId: CATEGORIA_CON_PRODUCTOS },
    { ...PRODUCTO_BASE, id: "prod_2", categoryId: CATEGORIA_CON_PRODUCTOS },
    { ...PRODUCTO_BASE, id: "prod_3", categoryId: CATEGORIA_CON_PRODUCTOS },
  ];

  return {
    categorias,
    findAllProductsForAdmin: async () => products,
    createCategory: vi.fn<CategoryAdminWriter["createCategory"]>(async (input) => {
      const creada: CategoryDTO = { id: "cat-nueva", ...input };
      categorias.push(creada);
      return creada;
    }),
    updateCategory: vi.fn<CategoryAdminWriter["updateCategory"]>(async (id, input) => {
      const indice = categorias.findIndex((categoria) => categoria.id === id);
      if (indice === -1) throw new Error("P2022: la categoría no existe");
      const anterior: CategoryDTO = categorias[indice] as CategoryDTO;
      // `exactOptionalPropertyTypes` hace que un spread de un input con
      // props opcionales produzca `string | undefined`. El merge se escribe
      // campo por campo para que `description: null` (dejar vacío) siga
      // siendo distinto de "novenir en el payload".
      const actualizada: CategoryDTO = {
        id: anterior.id,
        name: input.name ?? anterior.name,
        slug: input.slug ?? anterior.slug,
        description: input.description === undefined ? anterior.description : input.description,
        position: input.position ?? anterior.position,
        isVisible: input.isVisible ?? anterior.isVisible,
      };
      categorias[indice] = actualizada;
      return actualizada;
    }),
    deleteCategory: vi.fn<CategoryAdminWriter["deleteCategory"]>(async (id) => {
      const indice = categorias.findIndex((categoria) => categoria.id === id);
      categorias.splice(indice, 1);
    }),
  };
};

let falso: Falso;

beforeEach(() => {
  falso = crearFalso();
});

describe("getCategoriesForAdmin", () => {
  it("debe cruzar el conteo de productos y congelar el slug de las que tienen", async () => {
    const filas = await getCategoriesForAdmin(deps(falso));

    expect(filas.map((fila) => fila.id)).toEqual([
      CATEGORIA_CON_PRODUCTOS,
      CATEGORIA_SIN_PRODUCTOS,
    ]);
    expect(filas[0]).toEqual({
      id: CATEGORIA_CON_PRODUCTOS,
      nombre: "Sandwiches",
      slug: "sandwiches",
      descripcion: "De masa madre",
      isVisible: true,
      productCount: 3,
      isSlugEditable: false,
    });
    expect(filas[1]?.productCount).toBe(0);
    expect(filas[1]?.isSlugEditable).toBe(true);
  });

  it("debe mostrar el nombre del dominio, no el de la base", async () => {
    // El repositorio habla inglés (`name`) y la fila del panel habla
    // español (`nombre`). Si el mapeo se olvida, el panel muestra `undefined`
    // y el type-check no lo detecta porque el DTO los declara a los dos.
    const filas = await getCategoriesForAdmin(deps(falso));

    expect(filas.every((fila) => fila.nombre !== undefined)).toBe(true);
  });
});

describe("createCategoryFromAdmin", () => {
  it("debe derivar el slug del nombre y mandar la categoría al final", async () => {
    const creada = await createCategoryFromAdmin(deps(falso), {
      nombre: "Tortas de la casa",
      descripcion: "De vuelta",
      isVisible: true,
    });

    expect(creada).toEqual({
      id: "cat-nueva",
      nombre: "Tortas de la casa",
      slug: "tortas-de-la-casa",
      descripcion: "De vuelta",
      isVisible: true,
      productCount: 0,
      isSlugEditable: true,
    });
    expect(falso.createCategory).toHaveBeenCalledWith({
      name: "Tortas de la casa",
      slug: "tortas-de-la-casa",
      description: "De vuelta",
      position: 3,
      isVisible: true,
    });
  });

  it("debe rechazar un nombre que no genera un identificador usable", async () => {
    await expect(
      createCategoryFromAdmin(deps(falso), {
        nombre: "!!!",
        descripcion: null,
        isVisible: true,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(falso.createCategory).not.toHaveBeenCalled();
  });
});

describe("updateCategoryFromAdmin y el slug congelado", () => {
  const edicion = (over: Partial<CategoriaEdicionInput> = {}): CategoriaEdicionInput => ({
    id: CATEGORIA_CON_PRODUCTOS,
    nombre: "Sandwiches de la casa",
    descripcion: "De masa madre",
    isVisible: true,
    ...over,
  });

  it("debe ignorar el slug pedido si la categoría tiene productos, y avisarlo", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const actualizada = await updateCategoryFromAdmin(
      deps(falso),
      edicion({ slug: "otro-identificador" }),
    );

    // ⛔ La parte que vale: el slug NO va en el payload de escritura, y el
    //    panel ve `isSlugEditable: false` para desactivar el campo.
    expect(falso.updateCategory).toHaveBeenCalledWith(CATEGORIA_CON_PRODUCTOS, {
      name: "Sandwiches de la casa",
      description: "De masa madre",
    });
    expect(actualizada.slug).toBe("sandwiches");
    expect(actualizada.isSlugEditable).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it("debe aceptar el slug del formulario si la categoría no tiene productos", async () => {
    const actualizada = await updateCategoryFromAdmin(
      deps(falso),
      edicion({ id: CATEGORIA_SIN_PRODUCTOS, nombre: "Bebidas frías", slug: "bebidas-frias" }),
    );

    expect(falso.updateCategory).toHaveBeenCalledWith(CATEGORIA_SIN_PRODUCTOS, {
      name: "Bebidas frías",
      description: "De masa madre",
      slug: "bebidas-frias",
    });
    expect(actualizada.isSlugEditable).toBe(true);
  });

  it("debe derivar el slug del nombre cuando el envío no trae ninguno", async () => {
    await updateCategoryFromAdmin(
      deps(falso),
      edicion({ id: CATEGORIA_SIN_PRODUCTOS, nombre: "Jugos naturados" }),
    );

    expect(falso.updateCategory).toHaveBeenCalledWith(
      CATEGORIA_SIN_PRODUCTOS,
      expect.objectContaining({ slug: "jugos-naturados" }),
    );
  });

  it("debe rechazar un slug con espacios si la categoría no tiene productos", async () => {
    await expect(
      updateCategoryFromAdmin(
        deps(falso),
        edicion({ id: CATEGORIA_SIN_PRODUCTOS, slug: "con espacios" }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(falso.updateCategory).not.toHaveBeenCalled();
  });

  it("debe fallar si la categoría ya no existe", async () => {
    await expect(
      updateCategoryFromAdmin(deps(falso), edicion({ id: "cat-fantasma" })),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});

describe("setCategoryVisibilityFromAdmin", () => {
  it("debe aplicar el valor destino y no alternar el actual", async () => {
    // ⛔ El test que más pagaría de toda la suite: dos clics simultáneos
    //    sobre el mismo switch. Si el servicio alternara, el segundo
    //    click dejaría la categoría como estaba y el panel mentiría.
    const fila = await setCategoryVisibilityFromAdmin(deps(falso), {
      id: CATEGORIA_CON_PRODUCTOS,
      isVisible: false,
    });

    expect(falso.updateCategory).toHaveBeenCalledWith(CATEGORIA_CON_PRODUCTOS, {
      isVisible: false,
    });
    expect(fila.isVisible).toBe(false);
  });

  it("debe devolver el conteo de productos junto al valor nuevo", async () => {
    const fila = await setCategoryVisibilityFromAdmin(deps(falso), {
      id: CATEGORIA_CON_PRODUCTOS,
      isVisible: false,
    });

    expect(fila.productCount).toBe(3);
    expect(fila.isSlugEditable).toBe(false);
  });
});

describe("deleteCategoryFromAdmin", () => {
  it("debe negarse a borrar una categoría con productos y no tocar la base", async () => {
    await expect(
      deleteCategoryFromAdmin(deps(falso), CATEGORIA_CON_PRODUCTOS),
    ).rejects.toBeInstanceOf(ConflictError);

    // ⛔ El chequeo va ANTES del borrado (§5.4): un cliente manipulado
    //    podría mandar el id, y si el borrado llegara a ejecutarse la
    //    base rechazaría el borrado con la FK y el mensaje sería técnico.
    expect(falso.deleteCategory).not.toHaveBeenCalled();
  });

  it("debe borrar una categoría vacía", async () => {
    await deleteCategoryFromAdmin(deps(falso), CATEGORIA_SIN_PRODUCTOS);

    expect(falso.deleteCategory).toHaveBeenCalledWith(CATEGORIA_SIN_PRODUCTOS);
  });

  it("debe fallar si la categoría no existe", async () => {
    await expect(deleteCategoryFromAdmin(deps(falso), "cat-fantasma")).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
    expect(falso.deleteCategory).not.toHaveBeenCalled();
  });
});

describe("camposEditadosDeCategoria", () => {
  const guardada: CategoryRow = {
    id: CATEGORIA_SIN_PRODUCTOS,
    nombre: "Bebidas frías",
    slug: "bebidas-frias",
    descripcion: null,
    isVisible: true,
    productCount: 0,
    isSlugEditable: true,
  };

  it("debe listar sólo los campos que de verdad cambiaron", () => {
    // ⛔ El formulario manda la categoría entera aunque el encargado haya
    //    tocado una letra. Con `Object.keys(input)` el log diría "editó
    //    nombre, descripción, visibilidad y slug" en cada guardado, y el
    //    registro dejaría de servir para reconstruir qué pasó (Tarea 19 §7.1).
    expect(
      camposEditadosDeCategoria(guardada, {
        id: CATEGORIA_SIN_PRODUCTOS,
        nombre: "Bebidas frías",
        descripcion: "Limonada y jugos",
        isVisible: true,
        slug: "bebidas-frias",
      }),
    ).toEqual(["descripcion"]);
  });

  it("debe devolver una lista vacía cuando no cambió nada", () => {
    expect(
      camposEditadosDeCategoria(guardada, {
        id: CATEGORIA_SIN_PRODUCTOS,
        nombre: "Bebidas frías",
        descripcion: null,
        isVisible: true,
        slug: "bebidas-frias",
      }),
    ).toEqual([]);
  });

  it("debe reportar el slug cuando el servicio lo ignoró por tener productos", () => {
    // ⚠️ El envío intentó cambiarlo y eso también es un hecho auditable.
    const conProductos: CategoryRow = { ...guardada, productCount: 4, isSlugEditable: false };

    expect(
      camposEditadosDeCategoria(conProductos, {
        id: CATEGORIA_SIN_PRODUCTOS,
        nombre: "Bebidas frías",
        descripcion: null,
        isVisible: true,
        slug: "identificador-pedido",
      }),
    ).toEqual(["slug"]);
  });
});
