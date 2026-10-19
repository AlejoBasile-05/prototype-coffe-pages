import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// `ToastViewport` va montado aparte: es el comprobante de los avisos. En
// la app vive en el layout raíz, así que sin él acá los toasts no se ven.
import { ToastProvider, ToastViewport } from "@/components/ui";
import type { ProductAvailabilityActionResult } from "@/server/actions/product-availability.actions";
import { toggleProductAvailabilityAction } from "@/server/actions/product-availability.actions";
import { useAvailabilityStore } from "@/store/availability-store";

import { AvailabilitySwitch } from "./AvailabilitySwitch";

const replace = vi.fn();
const refresh = vi.fn();

// El router y la red son los límites del componente: se mockean, no se testean.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  usePathname: () => "/admin/productos",
}));

vi.mock("@/server/actions/product-availability.actions", () => ({
  toggleProductAvailabilityAction: vi.fn(),
}));

const mockAction = vi.mocked(toggleProductAvailabilityAction);

const ok = (isAvailable: boolean): ProductAvailabilityActionResult => ({
  ok: true,
  data: { id: "prd_1", isAvailable },
});

/** Los códigos se toman del resultado real: si mañana se agrega uno, el test compila. */
type ActionErrorCode = Extract<ProductAvailabilityActionResult, { ok: false }>["code"];

const fallo = (
  code: ActionErrorCode,
  error = "No se pudo cambiar la disponibilidad.",
): ProductAvailabilityActionResult => ({ ok: false, code, error });

const renderSwitch = (isAvailable = true) =>
  render(
    <ToastProvider>
      <AvailabilitySwitch productId="prd_1" productName="Jamón y Queso" isAvailable={isAvailable} />
      <ToastViewport />
    </ToastProvider>,
  );

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  mockAction.mockReset();
  // El switch lee el store de disponibilidad: si no se limpia entre
  // tests, un evento de un test anterior aparece en el siguiente como
  // un valor "que nadie pidió".
  useAvailabilityStore.getState().clearAvailability();
});

describe("AvailabilitySwitch", () => {
  it("debe reflejar el valor que le pasó el servidor sin llamar a la action", () => {
    renderSwitch(true);

    const control = screen.getByRole("switch");
    expect(control).toBeChecked();
    expect(screen.getByText("Disponible")).toBeInTheDocument();
    expect(mockAction).not.toHaveBeenCalled();
  });

  it("debe pintar el valor nuevo antes de que la action responda", async () => {
    const user = userEvent.setup();
    // Promesa pendiente: el clic todavía no tiene respuesta.
    mockAction.mockReturnValue(new Promise(() => {}));
    renderSwitch(true);

    await user.click(screen.getByRole("switch"));

    expect(screen.getByRole("switch")).not.toBeChecked();
    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(mockAction).toHaveBeenCalledWith({ id: "prd_1", isAvailable: false });
  });

  it("debe adoptar el valor confirmado por el servidor y avisar", async () => {
    const user = userEvent.setup();
    mockAction.mockResolvedValue(ok(false));
    renderSwitch(true);

    await user.click(screen.getByRole("switch"));

    expect(await screen.findByText(/quedó agotado/)).toBeInTheDocument();
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("debe volver al valor anterior y avisar cuando la action falla", async () => {
    const user = userEvent.setup();
    mockAction.mockResolvedValue(fallo("UNKNOWN"));
    renderSwitch(true);

    await user.click(screen.getByRole("switch"));

    await waitFor(() => expect(screen.getByRole("switch")).toBeChecked());
    expect(await screen.findByText(/No se pudo cambiar la disponibilidad/)).toBeInTheDocument();
  });

  it("debe refrescar la tabla cuando el producto ya no existe", async () => {
    const user = userEvent.setup();
    mockAction.mockResolvedValue(fallo("RESOURCE_NOT_FOUND", "Ese producto ya no existe."));
    renderSwitch(true);

    await user.click(screen.getByRole("switch"));

    expect(refresh).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Ese producto ya no existe/)).toBeInTheDocument();
  });

  it("debe llevar al login cuando la sesión expiró", async () => {
    const user = userEvent.setup();
    mockAction.mockResolvedValue(fallo("UNAUTHORIZED", "Tu sesión expiró."));
    renderSwitch(true);

    await user.click(screen.getByRole("switch"));

    expect(replace).toHaveBeenCalledWith("/login?next=%2Fadmin%2Fproductos");
  });

  it("debe ignorar el segundo clic mientras la primera respuesta sigue en vuelo", async () => {
    const user = userEvent.setup();
    mockAction.mockReturnValue(new Promise(() => {}));
    renderSwitch(true);

    const control = screen.getByRole("switch");
    await user.click(control);
    await user.click(control);

    expect(mockAction).toHaveBeenCalledOnce();
    expect(control).toBeDisabled();
  });
});
