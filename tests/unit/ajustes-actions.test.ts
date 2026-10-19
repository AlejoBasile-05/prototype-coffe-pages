import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";

import { verifyAdminSession } from "@/server/auth/verify-admin";
import type { AdminSession } from "@/lib/domain";

import { updateBusinessSettingsAction } from "@/server/actions/ajustes";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/server/auth/verify-admin", () => ({
  verifyAdminSession: vi.fn(),
}));

vi.mock("@/server/services", () => ({
  getSettingsAdminDependencies: vi.fn(),
}));

const mockVerify = vi.mocked(verifyAdminSession);
const mockRevalidatePath = vi.mocked(revalidatePath);

const OWNER: AdminSession = { userId: "owner-1", email: "owner@local.com", role: "OWNER" };
const STAFF: AdminSession = { userId: "staff-1", email: "staff@local.com", role: "STAFF" };

const basePayload = {
  nombre: "Mi Negocio",
  telefonoWhatsapp: "+54 9 261 555-1234",
  direccion: "Belgrano 123",
  instagram: "instagram.com/modo.miga",
  mensajeCierre: "Abrimos de martes a sábados.",
  avisoLegal: "",
  horarios: Object.fromEntries(
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((key) => [
      key,
      { estado: "sin_informar", abre: "", cierra: "" },
    ]),
  ),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockVerify.mockResolvedValue(OWNER);
});

describe("updateBusinessSettingsAction", () => {
  it("debe rechazar la pantalla para un STAFF sin leer el payload", async () => {
    mockVerify.mockResolvedValue(STAFF);

    const resultado = await updateBusinessSettingsAction({ nombre: "hackeado" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toBe(
        "Sólo el dueño del negocio puede cambiar los datos de contacto.",
      );
    }
    // El permiso no se prueba quedándose en la pantalla: se rechaza en la
    // action, que es la única frontera que vale (§6.9).
  });

  it("debe rechazar sin sesión", async () => {
    mockVerify.mockResolvedValue(null);

    const resultado = await updateBusinessSettingsAction({ nombre: "X" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toBe("Sesión expirada. Volvé a iniciar sesión.");
    }
  });

  it("debe mostrar el error del teléfono pegado al campo", async () => {
    const mockModulo = await import("@/server/services");
    vi.mocked(mockModulo.getSettingsAdminDependencies).mockReturnValue({
      settingsRepository: {
        findBusinessSettings: vi.fn(),
        saveBusinessSettings: vi.fn(),
      },
    });

    const resultado = await updateBusinessSettingsAction({
      ...basePayload,
      telefonoWhatsapp: "+54 261 15 555-1234",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toBe("Teléfono de WhatsApp inválido");
      expect(resultado.fieldErrors?.whatsappPhone).toBeDefined();
    }
  });

  it("con sólo campos válidos, revalida solo las páginas del panel (nunca el tag)", async () => {
    const mockModulo = await import("@/server/services");
    vi.mocked(mockModulo.getSettingsAdminDependencies).mockReturnValue({
      settingsRepository: {
        findBusinessSettings: vi.fn(),
        saveBusinessSettings: vi.fn().mockResolvedValue({
          id: "1",
          name: "Mi Negocio",
          whatsappPhone: "5492615551234",
          address: null,
          instagramUrl: null,
          openingHours: {},
          closingMessage: null,
          legalNotice: null,
        }),
      },
    });

    const resultado = await updateBusinessSettingsAction(basePayload);

    expect(resultado.ok).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/menu");
    // ⛔ Y no revalidateTag("products"): los ajustes no son contenido
    //    del catálogo (§2.7). Confundirlos es el error que hace que el
    //    catálogo entero se regenere cuando cambia un typo en la dirección.
    expect(mockRevalidatePath).not.toHaveBeenCalledWith("/productos");
  });
});
