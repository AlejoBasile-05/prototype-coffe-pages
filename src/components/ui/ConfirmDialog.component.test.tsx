import { useState } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";

/** Promesa que nunca resuelve: simula la mutación en vuelo. */
const neverSettles = () => new Promise<void>(() => {});

function Harness({ onConfirm = neverSettles }: { onConfirm?: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Eliminar
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
        title="Eliminar elemento"
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
      />
    </>
  );
}

describe("ConfirmDialog", () => {
  it("es un alertdialog, no un dialog común", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    // alertdialog: interrumpe para confirmar una acción destructiva.
    const dialog = screen.getByRole("alertdialog", { name: "Eliminar elemento" });
    expect(dialog).toHaveAccessibleDescription("Esta acción no se puede deshacer.");
  });

  it("no se cierra con Escape mientras la mutación está en vuelo", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Se abre desde el botón de la página, no desde el del diálogo.
    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    const confirm = within(screen.getByRole("alertdialog")).getByRole("button", {
      name: /^Eliminar$/,
    });
    await user.click(confirm);

    // La mutación está en vuelo.
    expect(screen.getByRole("button", { name: /Confirmando/ })).toBeDisabled();

    await user.keyboard("{Escape}");
    // Si se cerrara, el usuario perdería el resultado de la mutación.
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("muestra el error dentro del diálogo y no lo cierra", async () => {
    const user = userEvent.setup();
    render(<Harness onConfirm={() => Promise.reject(new Error("No se pudo eliminar"))} />);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: /^Eliminar$/ }),
    );

    expect(await screen.findByText("No se pudo eliminar")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    // El botón vuelve a estar utilizable para reintentar.
    expect(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: /^Eliminar$/ }),
    ).toBeEnabled();
  });
});
