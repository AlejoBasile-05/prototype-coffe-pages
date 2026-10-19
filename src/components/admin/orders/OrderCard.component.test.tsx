/**
 * Tarjeta de comanda (Tarea 23). El router y la action son los límites:
 * se mockean, no se testean (misma convención que AvailabilitySwitch).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider, ToastViewport } from "@/components/ui";
import type { OrderDTO } from "@/lib/domain";
import type { TransitionOrderActionResult } from "@/server/actions/comandas";
import { transitionOrderStatusAction } from "@/server/actions/comandas";

import { OrderCard } from "./OrderCard";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  usePathname: () => "/admin/comandas",
}));

vi.mock("@/server/actions/comandas", () => ({
  transitionOrderStatusAction: vi.fn(),
}));

const mockAction = vi.mocked(transitionOrderStatusAction);

const comanda = (overrides: Partial<OrderDTO> = {}): OrderDTO => ({
  id: "ord_1",
  orderNumber: 45,
  status: "PENDING",
  customerName: "Ana Prueba",
  customerPhone: "5492615551234",
  fulfillment: "PICKUP",
  address: null,
  notes: null,
  total: 7600,
  items: [
    { productName: "Miga de Jamón Crudo y Rúcula", variantName: null, unitPrice: 3800, quantity: 2 },
  ],
  createdAt: new Date().toISOString(),
  ...overrides,
});

const renderCard = (order: OrderDTO) => {
  const onTransitioned = vi.fn();
  const onTransitionFailed = vi.fn();
  render(
    <ToastProvider>
      <OrderCard
        order={order}
        onTransitioned={onTransitioned}
        onTransitionFailed={onTransitionFailed}
      />
      <ToastViewport />
    </ToastProvider>,
  );
  return { onTransitioned, onTransitionFailed };
};

const confirmada = (order: OrderDTO): TransitionOrderActionResult => ({ ok: true, data: order });

beforeEach(() => {
  mockAction.mockReset();
  replace.mockReset();
  refresh.mockReset();
});

describe("OrderCard", () => {
  it("muestra número, cliente, ítems y total", () => {
    renderCard(comanda());

    expect(screen.getByText("#0045")).toBeInTheDocument();
    expect(screen.getByText("Ana Prueba")).toBeInTheDocument();
    expect(screen.getByText(/2× Miga de Jamón Crudo/)).toBeInTheDocument();
    expect(screen.getByText("Retira en el local")).toBeInTheDocument();
  });

  it("en PENDING ofrece «Preparar» y «Cancelar», nunca «Listo» directo", () => {
    renderCard(comanda());

    expect(screen.getByRole("button", { name: "Preparar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Listo para entregar" })).not.toBeInTheDocument();
  });

  it("«Preparar» confirma la transición sin diálogo y avisa al tablero", async () => {
    const user = userEvent.setup();
    const { onTransitioned } = renderCard(comanda());
    mockAction.mockResolvedValue(confirmada(comanda({ status: "PREPARING" })));

    await user.click(screen.getByRole("button", { name: "Preparar" }));

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledWith({ id: "ord_1", to: "PREPARING" });
      expect(onTransitioned).toHaveBeenCalledWith(
        expect.objectContaining({ status: "PREPARING" }),
      );
    });
  });

  it("en PREPARING, «Listo para entregar» pide confirmación antes de escribir", async () => {
    const user = userEvent.setup();
    renderCard(comanda({ status: "PREPARING" }));
    mockAction.mockResolvedValue(confirmada(comanda({ status: "READY" })));

    await user.click(screen.getByRole("button", { name: "Listo para entregar" }));

    // La action NO corrió todavía: el cierre exige confirmar en el diálogo.
    expect(mockAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sí, ya se entregó" }));

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledWith({ id: "ord_1", to: "READY" });
    });
  });

  it("una comanda READY no ofrece más acciones", () => {
    renderCard(comanda({ status: "READY" }));

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("ante un fallo de la action, lo reporta al tablero", async () => {
    const user = userEvent.setup();
    const { onTransitionFailed } = renderCard(comanda());
    mockAction.mockResolvedValue({
      ok: false,
      error: "La comanda cambió de estado desde otra pantalla.",
      code: "CONFLICT",
    });

    await user.click(screen.getByRole("button", { name: "Preparar" }));

    await waitFor(() => {
      expect(onTransitionFailed).toHaveBeenCalledWith(
        expect.objectContaining({ ok: false, code: "CONFLICT" }),
      );
    });
  });
});
