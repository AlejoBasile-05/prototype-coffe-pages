import { describe, expect, it, vi, type Mock } from "vitest";

import { ResourceNotFoundError, ValidationError } from "@/lib/domain";
import type { ProductoAltaInput, ProductoEdicionInput } from "@/lib/validation/producto-admin";
import {
  archiveProductFromAdmin,
  createProductFromAdmin,
  updateProductFromAdmin,
} from "@/server/services/product-admin.service";

interface Doples {
  productRepository: {
    createProduct: Mock;
    updateProduct: Mock;
    archiveProduct: Mock;
    findProductByIdForAdmin: Mock;
  };
  imageService: {
    uploadProductImage: Mock;
    replaceProductImage: Mock;
  };
}

// Dobles escritos a mano: implementan solo la forma del puerto, no del
// repositorio. Sobreviven a que el repositorio cambie por dentro.
const crearDoples = (): Doples => ({
  productRepository: {
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    archiveProduct: vi.fn(),
    findProductByIdForAdmin: vi.fn(),
  },
  imageService: {
    uploadProductImage: vi.fn(),
    replaceProductImage: vi.fn(),
  },
});

const PRODUCTO_NUEVO = {
  name: "Café con Leche",
  slug: "cafe-con-leche",
  description: "Espresso con leche caliente",
  price: 1450.5,
  imageUrl: "https://res.cloudinary.com/demo/image/upload/modo-miga/products/cafe.jpg",
  imagePublicId: "modo-miga/products/cafe",
  categoryId: "cat_1",
  status: "DRAFT",
  isFeatured: false,
  isAvailable: true,
  allergens: ["lactosa"],
  sortOrder: 0,
};

const PRODUCTO_EXISTENTE = {
  ...PRODUCTO_NUEVO,
  id: "prod_1",
  description: "ya existe",
  status: "PUBLISHED",
  imagePublicId: "modo-miga/products/viejo",
};

const ARCHIVO = new File(["bytes"], "cafe.jpg", { type: "image/jpeg" });

const SUBIDA_NUEVA = {
  imageUrl: "https://res.cloudinary.com/demo/image/upload/modo-miga/products/cafe.jpg",
  imagePublicId: "modo-miga/products/cafe",
};

describe("createProductFromAdmin", () => {
  it("debe subir la imagen antes de crear el producto", async () => {
    const deps = crearDoples();
    const orden: string[] = [];

    deps.imageService.uploadProductImage.mockImplementation(async () => {
      orden.push("imagen");
      return SUBIDA_NUEVA;
    });
    deps.productRepository.createProduct.mockImplementation(async () => {
      orden.push("producto");
      return PRODUCTO_NUEVO;
    });

    await createProductFromAdmin(deps, datosAlta, ARCHIVO);

    // ⛔ El orden es la regla de negocio: `imageUrl` es NOT NULL y
    //    subir antes es la forma de no dejar un producto sin foto.
    expect(orden).toEqual(["imagen", "producto"]);
  });

  it("debe forzar DRAFT aunque el input pida lo contrario", async () => {
    const deps = crearDoples();
    deps.imageService.uploadProductImage.mockResolvedValue(SUBIDA_NUEVA);
    deps.productRepository.createProduct.mockResolvedValue(PRODUCTO_NUEVO);

    await createProductFromAdmin(deps, datosAlta, ARCHIVO);

    expect(deps.productRepository.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DRAFT" }),
    );
  });

  it("debe derivar el slug del nombre (y no confiar en el input)", async () => {
    const deps = crearDoples();
    deps.imageService.uploadProductImage.mockResolvedValue(SUBIDA_NUEVA);
    deps.productRepository.createProduct.mockResolvedValue(PRODUCTO_NUEVO);

    await createProductFromAdmin(deps, datosAlta, ARCHIVO);

    expect(deps.productRepository.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "cafe-con-leche" }),
    );
  });

  it("debe fallar si no hay imagen en el input", async () => {
    const deps = crearDoples();

    await expect(createProductFromAdmin(deps, datosAltaSinImagen, null)).rejects.toThrow(
      ValidationError,
    );
    expect(deps.productRepository.createProduct).not.toHaveBeenCalled();
    expect(deps.imageService.uploadProductImage).not.toHaveBeenCalled();
  });
});

describe("updateProductFromAdmin", () => {
  const edicionSinImagenNueva = {
    ...edicionLista,
    imagen: undefined,
  };

  it("debe lanzar cuando el producto no existe", async () => {
    const deps = crearDoples();
    deps.productRepository.findProductByIdForAdmin.mockResolvedValue(null);

    await expect(updateProductFromAdmin(deps, edicionLista, null)).rejects.toThrow(
      ResourceNotFoundError,
    );
  });

  it("debe no seguir si el producto está en ARCHIVED", async () => {
    const deps = crearDoples();
    deps.productRepository.findProductByIdForAdmin.mockResolvedValue({
      ...PRODUCTO_EXISTENTE,
      status: "ARCHIVED",
    });

    await expect(updateProductFromAdmin(deps, edicionLista, null)).rejects.toThrow(ValidationError);
    expect(deps.productRepository.updateProduct).not.toHaveBeenCalled();
    expect(deps.imageService.replaceProductImage).not.toHaveBeenCalled();
  });

  it("debe conservar la imagen si no se manda una nueva", async () => {
    const deps = crearDoples();
    deps.productRepository.findProductByIdForAdmin.mockResolvedValue(PRODUCTO_EXISTENTE);
    deps.productRepository.updateProduct.mockResolvedValue(PRODUCTO_EXISTENTE);

    await updateProductFromAdmin(deps, edicionSinImagenNueva, null);

    expect(deps.imageService.replaceProductImage).not.toHaveBeenCalled();
    expect(deps.productRepository.updateProduct).toHaveBeenCalledWith(
      "prod_1",
      expect.objectContaining({ imagePublicId: PRODUCTO_EXISTENTE.imagePublicId }),
    );
  });

  it("debe reemplazar la imagen cuando se manda una nueva", async () => {
    const deps = crearDoples();
    deps.productRepository.findProductByIdForAdmin.mockResolvedValue(PRODUCTO_EXISTENTE);
    deps.imageService.replaceProductImage.mockResolvedValue({
      imageUrl: "https://res.cloudinary.com/nuevo.jpg",
      imagePublicId: "modo-miga/products/nuevo",
    });
    deps.productRepository.updateProduct.mockResolvedValue(PRODUCTO_EXISTENTE);

    await updateProductFromAdmin(deps, edicionLista, ARCHIVO);

    expect(deps.imageService.replaceProductImage).toHaveBeenCalledWith({
      file: ARCHIVO,
      slug: PRODUCTO_EXISTENTE.slug,
      previousPublicId: PRODUCTO_EXISTENTE.imagePublicId,
    });
    expect(deps.productRepository.updateProduct).toHaveBeenCalledWith(
      "prod_1",
      expect.objectContaining({
        imageUrl: "https://res.cloudinary.com/nuevo.jpg",
        imagePublicId: "modo-miga/products/nuevo",
      }),
    );
  });

  it("debe no guardar un producto publicado sin foto", async () => {
    const deps = crearDoples();
    deps.productRepository.findProductByIdForAdmin.mockResolvedValue({
      ...PRODUCTO_EXISTENTE,
      // El esquema no lo puede saber, porque en la edición la imagen es
      // opcional: el service es el backend de la regla.
      imageUrl: "",
      status: "DRAFT",
    });

    await expect(
      updateProductFromAdmin(deps, { ...edicionLista, status: "PUBLISHED" }, null),
    ).rejects.toThrow(ValidationError);
  });
});

describe("archiveProductFromAdmin", () => {
  it("debe delegar en el repositorio y confirmar el resultado", async () => {
    const deps = crearDoples();
    deps.productRepository.archiveProduct.mockResolvedValue({
      ...PRODUCTO_EXISTENTE,
      status: "ARCHIVED",
    });

    await archiveProductFromAdmin(deps, "prod_1");

    expect(deps.productRepository.archiveProduct).toHaveBeenCalledWith("prod_1");
  });

  it("debe fallar si el repositorio devuelve algo que no es ARCHIVED", async () => {
    const deps = crearDoples();
    deps.productRepository.archiveProduct.mockResolvedValue({
      ...PRODUCTO_EXISTENTE,
      status: "PUBLISHED",
    });

    await expect(archiveProductFromAdmin(deps, "prod_1")).rejects.toThrow(
      "El archivado no se aplicó",
    );
  });
});

// El nombre `datosAlta` documenta que el objeto viene del formulario y
// está validado por `ProductoAltaSchema`.
const datosAlta: ProductoAltaInput = {
  nombre: "Café con Leche",
  descripcion: "Espresso con leche caliente",
  precio: 1450.5,
  categoryId: "cat_1",
  allergens: ["lactosa"],
  isFeatured: false,
  imagen: SUBIDA_NUEVA,
};

const datosAltaSinImagen: ProductoAltaInput = {
  ...datosAlta,
  imagen: { imageUrl: "", imagePublicId: "" },
};

const edicionLista: ProductoEdicionInput = {
  id: "prod_1",
  nombre: "Café con Leche",
  descripcion: "Espresso con leche caliente",
  precio: 1450.5,
  categoryId: "cat_1",
  allergens: ["lactosa"],
  isFeatured: false,
  status: "PUBLISHED",
};
