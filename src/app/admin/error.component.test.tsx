import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AdminError from "./error";

beforeEach(() => {
  // El archivo registra el error a propósito (`console.error`), y el guardián
  // de `vitest.setup.ts` trata cualquier `console.error` como fallo del test.
  // Acá el spy se reemplaza para poder además *afirmar* el log.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("admin/error.tsx", () => {
  it("debe explicar la falla con un mensaje genérico y registrar el detalle", () => {
    // ⛔ Se pasa un error con detalle interno a propósito: nada de eso puede
    // llegar a pantalla, y el mensaje real sí tiene que quedar registrado.
    const error = new Error('relation "products" does not exist at 10.0.0.4:5432');

    render(<AdminError error={error} reset={vi.fn()} />);

    expect(screen.getByText(/No se pudo cargar el panel/)).toBeInTheDocument();
    expect(screen.queryByText(/products/)).toBeNull();
    expect(screen.queryByText(/10\.0\.0\.4/)).toBeNull();
    expect(console.error).toHaveBeenCalledWith("[admin]", error);
  });

  it("debe llamar a reset cuando se reintenta", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<AdminError error={new Error("boom")} reset={reset} />);

    await user.click(screen.getByRole("button", { name: /Reintentar|Intentar de nuevo/ }));

    expect(reset).toHaveBeenCalledOnce();
  });
});
