import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ToastProvider, ToastViewport } from "@/components/ui";
import { useAvailabilityStore } from "@/store/availability-store";

import { ProductCard, type ProductCardData } from "./ProductCard";

/**
 * Prueba de integración del comportamiento visible (Tarea 15 §10.3).
 *
 * El evento de Realtime NO se simula ni se dobla: se escribe el MISMO
 * store por el que pasaría, con `applyAvailability`. Así la aserción
 * mira el comportamiento final (card, botón, badge) y no la plomería
 * de Supabase —eso ya está en `use-availability-realtime.component.test`.
 */
const AVAILABLE: ProductCardData = {
  id: "prod-1",
  slug: "jdq-clasico",
  name: "Jamón y queso clásico",
  description: "Jamón natural, queso y pan de miga de la casa.",
  price: 4500,
  available: true,
  imageUrl: "",
};

const renderCard = (product: ProductCardData) =>
  render(
    <ToastProvider>
      <ProductCard product={product} />
      <ToastViewport />
    </ToastProvider>,
  );

/** Escribe el store dentro de `act`, no al voleo: sin esto React no llega
 * a aplicar el `set` de Zustand antes de que el test pregunte. */
const emitir = (id: string, isAvailable: boolean) => {
  act(() => useAvailabilityStore.getState().applyAvailability(id, isAvailable));
};

beforeEach(() => {
  useAvailabilityStore.getState().clearAvailability();
});

describe("ProductCard + disponibilidad en tiempo real", () => {
  it("debe respetar el snapshot del servidor antes de cualquier evento", () => {
    renderCard(AVAILABLE);

    // El HTML del servidor dice "disponible": la card no debe esperar
    // el canal para pintar algo coherente.
    expect(screen.getByRole("button", { name: "Agregar" })).toBeInTheDocument();
    expect(screen.queryByText("Sin stock")).not.toBeInTheDocument();
  });

  it("debe pasar a estado agotado cuando llega el evento de la propia card", () => {
    renderCard(AVAILABLE);

    emitir("prod-1", false);

    // En el mismo tick: el botón desaparece y la card queda atenuada.
    // Sin spinner ni estado intermedio, porque el store ya tenía el
    // snapshot del servidor.
    expect(screen.queryByRole("button", { name: "Agregar" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Sin stock")).toHaveLength(2);
  });

  it("no debe reaccionar al evento de otra card", () => {
    renderCard(AVAILABLE);

    // Un evento para otro producto: la deduplicación y el selector por
    // clave evitan que esta card re-renderice ni cambie.
    emitir("prod-99", false);

    expect(screen.getByRole("button", { name: "Agregar" })).toBeInTheDocument();
  });

  it("debe volver a habilitar la card si el producto vuelve a estar disponible", () => {
    renderCard({ ...AVAILABLE, available: false });

    emitir("prod-1", true);

    // La acción del evento corre en ambas direcciones: un producto que
    // vuelve a estar en stock se puede agregar sin recargar.
    expect(screen.getByRole("button", { name: "Agregar" })).toBeInTheDocument();
    expect(screen.queryByText("Sin stock")).not.toBeInTheDocument();
  });
});