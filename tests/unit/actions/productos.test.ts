import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath, revalidateTag } from "next/cache";

import type { AdminSession, ProductDTO } from "@/lib/domain";
import { ConflictError, ResourceNotFoundError } from "@/lib/domain";
import { verifyAdminSession } from "@/server/auth/verify-admin";

import { archiveProductAction, createProductAction, updateProductAction } from "@/server/actions/productos";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/server/auth/verify-admin", () => ({
  verifyAdminSession: vi.fn(),
}));

vi.mock("@/server/services", () => ({
  createProductFromAdmin: vi.fn(),
  updateProductFromAdmin: vi.fn(),
  archiveProductFromAdmin: vi.fn(),
}));

const mockVerify = vi.mocked(verifyAdminSession);
const mockRevalTag = vi.mocked(revalidateTag);
const mockRevalPath = vi.mocked(revalidatePath);

const PRODUCTO_EXISTENTE: ProductDTO = {
  id: "prod_1",
  name: "Café con leche",
  slug: "cafe-con-leche",
  description: null,
  price: 1450,
  imageUrl: "https://res.cloudinary.com/demo/image/upload/cafe.jpg",
  imagePublicId: null,
  isAvailable: true,
  status: "PUBLISHED",
  isFeatured: false,
  sortOrder: 0,
  allergens: [],
  categoryId: "cat_1",
  variants: [],
};

const ADMIN: AdminSession = { userId: "admin-1", email: "admin@local.com", role: "OWNER" };

beforeEach(async () => {
  vi.clearAllMocks();
  mockVerify.mockResolvedValue(ADMIN);
  const svc = await import("@/server/services");
  (svc.createProductFromAdmin as unknown as ReturnType<typeof vi.fn>).mockReset();
  (svc.updateProductFromAdmin as unknown as ReturnType<typeof vi.fn>).mockReset();
  (svc.archiveProductFromAdmin as unknown as ReturnType<typeof vi.fn>).mockReset();
  mockRevalTag.mockClear();
  mockRevalPath.mockClear();
});

describe("createProductAction", () => {
  it("sin sesión, devuelve UNAUTHORIZED y nunca toca la base", async () => {
    const svc = await import("@/server/services");
    mockVerify.mockResolvedValue(null);

    const resultado = await createProductAction(datosAltaCompletos, null);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.code).toBe("UNAUTHORIZED");
      expect(resultado.error).toBe("Tu sesión expiró. Volvé a entrar.");
    }
    expect(svc.createProductFromAdmin).not.toHaveBeenCalled();
  });

  it("con datos válidos, delega y revalida el tag de productos", async () => {
    const svc = await import("@/server/services");
    vi.mocked(svc.createProductFromAdmin).mockResolvedValue(PRODUCTO_EXISTENTE);

    const resultado = await createProductAction(datosAltaCompletos, null);

    expect(resultado.ok).toBe(true);
    // La action valida el shape con Zod y después delega el RESULTADO
    // transformado, no el número de la request: la regla del precio (la
    // comma se convierte a número) ya aplicó.
    expect(vi.mocked(svc.createProductFromAdmin)).toHaveBeenCalledWith(
      expect.objectContaining({ precio: 1450.5 }),
      null,
    );
    expect(mockRevalTag).toHaveBeenCalledWith("products", "max");
    expect(mockRevalPath).toHaveBeenCalledWith("/admin/productos");
  });

  it("con datos inválidos, el primer mensaje de Zod no toca la base", async () => {
    const svc = await import("@/server/services");

    const resultado = await createProductAction({ nombre: "a" }, null);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.code).toBe("VALIDATION_ERROR");
    }
    expect(svc.createProductFromAdmin).not.toHaveBeenCalled();
  });

  it("cuando el slug está duplicado, devuelve CONFLICT con el mensaje del servicio", async () => {
    const svc = await import("@/server/services");
    vi.mocked(svc.createProductFromAdmin).mockRejectedValue(
      new ConflictError("Ese identificador ya lo usa otro producto"),
    );

    const resultado = await createProductAction(datosAltaCompletos, null);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.code).toBe("CONFLICT");
      expect(resultado.error).toBe("Ese identificador ya lo usa otro producto");
    }
  });

  it("ante un error inesperado, no se filtra el mensaje original", async () => {
    // La causa de la rama (`Error('relation … does not exist')`) sale del
    // ORM y NO puede aparecer en la pantalla: solo el mensaje genérico.
    const svc = await import("@/server/services");
    vi.mocked(svc.createProductFromAdmin).mockRejectedValue(
      new Error('relation "products" does not exist'),
    );

    const resultado = await createProductAction(datosAltaCompletos, null);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.code).toBe("UNKNOWN");
      expect(resultado.error).toBe("No se pudo crear el producto. Intentá de nuevo.");
    }
  });
});

describe("updateProductAction", () => {
  const edicionMinima = {
    id: "prod_1",
    nombre: "Café nuevo",
    descripcion: "Otra",
    precio: "2000",
    categoryId: "cat_1",
    allergens: [] as string[],
    isFeatured: false,
    status: "PUBLISHED" as const,
  };

  it("sin sesión, devuelve UNAUTHORIZED", async () => {
    mockVerify.mockResolvedValue(null);
    const svc = await import("@/server/services");

    const resultado = await updateProductAction(edicionMinima, null);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.code).toBe("UNAUTHORIZED");
    }
    expect(svc.updateProductFromAdmin).not.toHaveBeenCalled();
  });

  it("cuando el producto no existe, devuelve el código de not-found", async () => {
    const svc = await import("@/server/services");
    vi.mocked(svc.updateProductFromAdmin).mockRejectedValue(
      new ResourceNotFoundError("Producto", "prod_1"),
    );

    const resultado = await updateProductAction(edicionMinima, null);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.code).toBe("RESOURCE_NOT_FOUND");
      expect(resultado.error).toBe("Ese producto ya no existe.");
    }
  });

  it("cuando la base contradice el slug, el servicio lanza ConflictError", async () => {
    const svc = await import("@/server/services");
    vi.mocked(svc.updateProductFromAdmin).mockRejectedValue(
      new ConflictError("Ese identificador ya lo usa otro producto"),
    );

    const resultado = await updateProductAction(edicionMinima, null);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.code).toBe("CONFLICT");
    }
  });
});

describe("archiveProductAction", () => {
  it("sin sesión, devuelve UNAUTHORIZED", async () => {
    mockVerify.mockResolvedValue(null);
    const svc = await import("@/server/services");

    const resultado = await archiveProductAction("prod_1");

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.code).toBe("UNAUTHORIZED");
    }
    expect(svc.archiveProductFromAdmin).not.toHaveBeenCalled();
  });

  it("un id en blanco es VALIDATION_ERROR y no llega a la base", async () => {
    const svc = await import("@/server/services");

    const resultado = await archiveProductAction("   ");

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.code).toBe("VALIDATION_ERROR");
    }
    expect(svc.archiveProductFromAdmin).not.toHaveBeenCalled();
  });

  it("cuando el repositorio confirma, revalida el tag de productos", async () => {
    const svc = await import("@/server/services");
    vi.mocked(svc.archiveProductFromAdmin).mockResolvedValue({
      ...PRODUCTO_EXISTENTE,
      status: "ARCHIVED",
    });

    const resultado = await archiveProductAction("prod_1");

    expect(resultado.ok).toBe(true);
    expect(mockRevalTag).toHaveBeenCalledWith("products", "max");
    expect(mockRevalPath).toHaveBeenCalledWith("/admin/productos");
  });
});

// Se guarda en el describe del día para ser referencia en cada `it`.
const datosAltaCompletos = {
  nombre: "Café con leche",
  descripcion: "Espresso con leche caliente",
  precio: "1450,50",
  categoryId: "cat_1",
  allergens: ["lactosa"],
  isFeatured: false,
  imagen: {
    imageUrl: "https://res.cloudinary.com/demo/image/upload/modo-miga/products/cafe.jpg",
    imagePublicId: "modo-miga/products/cafe",
  },
};
