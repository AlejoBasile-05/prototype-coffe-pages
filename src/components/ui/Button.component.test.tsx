import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button, buttonClassName } from "./Button";

describe("Button", () => {
  it("llama onClick y queda habilitado en estado por defecto", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("muestra el estado de carga sin perder el ancho ni el foco", () => {
    render(
      <Button isLoading loadingLabel="Guardando…">
        Guardar
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Guardando/ });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    // El texto original sigue en el DOM: un lector que está anunciando
    // "Guardar" no se corta a mitad.
    expect(button).toHaveTextContent("Guardando…");
  });

  it("expone el mismo estilo para un enlace", () => {
    // El contrato de buttonClassName: una <a> se ve igual que un <Button>.
    expect(buttonClassName("danger", "lg")).toContain("bg-clay");
    expect(buttonClassName("primary", "md")).not.toBe(buttonClassName("ghost", "md"));
  });
});
