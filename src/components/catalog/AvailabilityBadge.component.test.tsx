import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AvailabilityBadge } from "./AvailabilityBadge";

describe("AvailabilityBadge", () => {
  it("anuncia 'Sin stock' con el tono de peligro", () => {
    const { container } = render(<AvailabilityBadge available={false} />);

    expect(screen.getByText("Sin stock")).toBeInTheDocument();
    // El estilo vive en el Badge de Arc (CSS modules): lo que se
    // verifica es el contrato accesible, no una clase utilitaria.
    expect(container.firstChild).toHaveAttribute("data-tone", "danger");
  });

  it("anuncia 'Disponible' con el tono de éxito", () => {
    render(<AvailabilityBadge available />);

    expect(screen.getByText("Disponible")).toBeInTheDocument();
  });
});