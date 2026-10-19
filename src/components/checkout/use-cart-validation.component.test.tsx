import { renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider, ToastViewport } from "@/components/ui";
import { useCartStore } from "@/store/cart-store";

import { useCartValidation } from "./use-cart-validation";

/**
 * Tests del hook de revalidación.
 *
 * El CheckoutForm los mockea a ellos (`CheckoutForm.component.test.tsx`) y
 * el route handler tiene sus propios tests: este archivo mide el contrato
 * entre ambos, que es exactamente donde se escapó el bug del `:` final.
 */

// `fetch` no existe en jsdom y es el único límite real del hook: se dobla.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const VALID_LINES = (): unknown[] => [
  {
    productId: "p1",
    variantId: null,
    isInCatalog: true,
    isAvailable: true,
    currentUnitPrice: 2900,
    issue: null,
  },
  {
    productId: "p2",
    variantId: "v2",
    isInCatalog: true,
    isAvailable: true,
    currentUnitPrice: 1500,
    issue: null,
  },
];

const setCartLines = (): void => {
  useCartStore.setState({
    lines: [
      {
        productId: "p1",
        slug: "miga",
        name: "Miga",
        variantId: null,
        variantName: null,
        unitPrice: 2900,
        quantity: 1,
        imageUrl: null,
        available: true,
      },
      {
        productId: "p2",
        slug: "cafe",
        name: "Café",
        variantId: "v2",
        variantName: "Chico",
        unitPrice: 1500,
        quantity: 1,
        imageUrl: null,
        available: true,
      },
    ],
  });
};

const Wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>
    {children}
    <ToastViewport />
  </ToastProvider>
);

const renderHookInProvider = () =>
  renderHook(() => useCartValidation(), { wrapper: Wrapper });

beforeEach(() => {
  useCartStore.setState({ lines: [] });
  fetchMock.mockReset();
});

describe("useCartValidation", () => {
  it("arma la query sin dos puntos final para una línea sin variante", async () => {
    setCartLines();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, lines: VALID_LINES(), hasBlockingIssues: false }),
    });

    renderHookInProvider();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cart/validate?line=p1&line=p2%3Av2",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("con respuesta ok setea los reviews y no avisa nada", async () => {
    setCartLines();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, lines: VALID_LINES(), hasBlockingIssues: false }),
    });

    const { result } = renderHookInProvider();

    await waitFor(() => expect(result.current.isValidating).toBe(false));
    expect(result.current.reviews).toHaveLength(2);
    expect(result.current.hasBlockingIssues).toBe(false);
    expect(result.current.hasPriceChanges).toBe(false);

    expect(screen.queryByText(/No pudimos confirmar precios/)).not.toBeInTheDocument();
  });

  it("ante un error de red avisa una sola vez (fail-open) y no re-dispara el fetch", async () => {
    setCartLines();
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false }) });

    const { result } = renderHookInProvider();

    // Fail-open: el envío queda habilitado, aunque no haya reviews.
    expect(await screen.findByText(/No pudimos confirmar precios y stock/)).toBeInTheDocument();
    expect(result.current.reviews).toBeNull();
    expect(result.current.hasBlockingIssues).toBeFalsy();

    // El aviso apila un toast → ToastBridge re-renderiza. Si `show`
    // cambiara de identidad, el efecto re-ejecutaría y llamaría a fetch
    // de nuevo. El bug era ese bucle: acá se exige UNA sola llamada.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("no muestra el aviso cuando el fetch se cancela por abort", async () => {
    setCartLines();
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted.", "AbortError"));

    const { unmount } = renderHookInProvider();

    // Un abort deliberado (cambió el carrito o se desmontó) no es un
    // fallo: mostrarlo como error sería un aviso fantasma.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.queryByText(/No pudimos confirmar precios/)).not.toBeInTheDocument();

    unmount();
  });

  it("no genera una segunda request cuando el carrito no cambia pero el hook re-renderiza", async () => {
    setCartLines();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, lines: VALID_LINES(), hasBlockingIssues: false }),
    });

    const { rerender } = renderHookInProvider();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});