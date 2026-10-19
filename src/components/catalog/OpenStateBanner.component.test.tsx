import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { OpenStateBanner } from "./OpenStateBanner";
import { useOpenStateStore } from "@/store/open-state-store";

describe("OpenStateBanner", () => {
  beforeEach(() => {
    useOpenStateStore.getState().aplicar(null);
  });

  it("no renderiza nada mientras el estado no está computado", () => {
    const { container } = render(<OpenStateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("no renderiza nada cuando el local está abierto", () => {
    useOpenStateStore.getState().aplicar({ estado: "abierto", cierra: "20:30" });
    const { container } = render(<OpenStateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("día cerrado completo: título y mensaje genérico", () => {
    useOpenStateStore.getState().aplicar({
      estado: "cerrado",
      motivo: "dia_completo",
      proximaApertura: { diaLabel: "Mañana", hora: "08:30" },
    });
    render(<OpenStateBanner />);

    // role="status" (del Alert): se anuncia sin interrumpir la lectura.
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Hoy no abrimos");
    expect(banner).toHaveTextContent("Estamos cerrados por ahora. Volvé más tarde.");
  });

  it("fuera de horario: título y mensaje genérico", () => {
    useOpenStateStore.getState().aplicar({
      estado: "cerrado",
      motivo: "fuera_de_horario",
      proximaApertura: { diaLabel: "Hoy", hora: "08:30" },
    });
    render(<OpenStateBanner variant="compact" />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Ahora estamos cerrados");
    expect(banner).toHaveTextContent("Estamos cerrados por ahora. Volvé más tarde.");
  });
});