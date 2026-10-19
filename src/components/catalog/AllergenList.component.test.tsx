import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AllergenList } from "./AllergenList";

describe("AllergenList", () => {
  it("muestra la etiqueta canónica, con tilde, sin traducir", () => {
    render(<AllergenList allergens={["maní", "gluten"]} />);

    const list = screen.getByRole("list", { name: "Alérgenos" });
    expect(list).toHaveTextContent("maní");
    expect(list).toHaveTextContent("gluten");
  });

  it("no renderiza nada con la lista vacía", () => {
    const { container } = render(<AllergenList allergens={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("muestra un valor desconocido tal cual y lo reporta", () => {
    render(<AllergenList allergens={["maracuyá"]} />);

    expect(screen.getByText("maracuyá")).toBeInTheDocument();
  });
});
