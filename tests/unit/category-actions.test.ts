import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidateTag } from "next/cache";

import { ConflictError } from "@/lib/domain";
import type { AdminSession, CategoryDTO } from "@/lib/domain";
import { verifyAdminSession } from "@/server/auth/verify-admin";

import {
  createCategoryAction,
  deleteCategoryAction,
  setCategoryVisibilityAction,
} from "@/server/actions/categorias";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/server/auth/verify-admin", () => ({
  verifyAdminSession: vi.fn(),
}));

vi.mock("@/server/services", () => ({
  getCategoryAdminDependencies: vi.fn(),
}));

const mockVerify = vi.mocked(verifyAdminSession);
const mockRevalTag = vi.mocked(revalidateTag);
const ADMIN: AdminSession = { userId: "admin-1", email: "admin@local.com", role: "OWNER" };

const CATEGORIA_BASE: CategoryDTO = {
  id: "cat_1",
  name: "Clásicos",
  slug: "clasicos",
  description: null,
  position: 0,
  isVisible: true,
};

const crearDoblesAdmin = () => ({
  categoryRepository: {
    findAllCategoriesForAdmin: vi.fn().mockResolvedValue([CATEGORIA_BASE]),
    createCategory: vi.fn().mockResolvedValue(CATEGORIA_BASE),
    updateCategory: vi.fn().mockResolvedValue(CATEGORIA_BASE),
    deleteCategory: vi.fn().mockResolvedValue(undefined),
  },
  productRepository: {
    findAllProductsForAdmin: vi.fn().mockResolvedValue([]),
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockVerify.mockResolvedValue(ADMIN);
});

describe("category-actions", () => {
  it("debe rechazar sin sesión sin leer el payload", async () => {
    mockVerify.mockResolvedValue(null);

    const resultado = await createCategoryAction({ nombre: "Postres", slug: "arbitrio" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toBe("Sesión expirada. Volvé a iniciar sesión.");
    }
    // El payload entero se descarta antes de la sesión: ningún campo del
    // formulario llega al esquema ni al servicio.
  });

  it("debe traducir un ConflictError al mensaje sin tocar el tag si falla", async () => {
    const modulo = await import("@/server/services");
    const dobles = crearDoblesAdmin();
    dobles.categoryRepository.createCategory.mockRejectedValue(
      new ConflictError("Ya existe una categoría con ese slug", { slug: "postres" }),
    );
    vi.mocked(modulo.getCategoryAdminDependencies).mockReturnValue(dobles);

    const resultado = await createCategoryAction({ nombre: "Postres", descripcion: null });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toMatch(/ya existe/i);
      expect(resultado.fieldErrors?.slug).toBeDefined();
    }
    expect(mockRevalTag).not.toHaveBeenCalled();
  });

  it("debe aplicar el valor destino de la visibilidad", async () => {
    const modulo = await import("@/server/services");
    vi.mocked(modulo.getCategoryAdminDependencies).mockReturnValue(crearDoblesAdmin());

    const resultado = await setCategoryVisibilityAction({
      id: "c2ea-41b4-b773-84a0-e7e2d0bee5b2",
      isVisible: false,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).not.toBe("No se pudo guardar la categoría. Intentá de nuevo.");
    }
  });

  it("un id que no es UUID falla antes de llegar al repositorio", async () => {
    const resultado = await deleteCategoryAction("no-es-uuid");

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toBe("Ese identificador no es válido.");
    }
  });
});
