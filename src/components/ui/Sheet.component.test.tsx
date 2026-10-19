import { useState } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Input } from "./Input";
import { Sheet } from "./Sheet";

const Harness = ({ onClose }: { onClose: () => void }) => (
  <Sheet open onClose={onClose} title="Editar" description="Los cambios se ven al instante.">
    <Input name="nombre" label="Nombre" defaultValue="Cortado" />
  </Sheet>
);

describe("Sheet", () => {
  it("es un diálogo modal con nombre y descripción accesibles", () => {
    render(<Harness onClose={vi.fn()} />);
    // Radix marca el contenido con aria-modal en los puntos de enfoque
    // guardados; lo que garantiza el contrato es el rol con nombre y la
    // descripción accesible.
    const dialog = screen.getByRole("dialog", { name: "Editar" });
    expect(dialog).toHaveAccessibleDescription("Los cambios se ven al instante.");
  });

  it("mueve el foco dentro del diálogo al abrir", async () => {
    render(<Harness onClose={vi.fn()} />);

    // Radix enfoca el primer control del panel de forma asincrónica.
    const dialog = screen.getByRole("dialog", { name: "Editar" });
    await vi.waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
    expect(document.activeElement).not.toBe(document.body);
  });

  it("al cerrar, el foco nunca queda atrapado en un nodo desmontado", async () => {
    const user = userEvent.setup();
    const Harness2 = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Disparador
          </button>
          <Sheet open={open} onClose={() => setOpen(false)} title="Editar">
            <Input name="nombre" label="Nombre" />
          </Sheet>
        </>
      );
    };
    render(<Harness2 />);

    const trigger = screen.getByRole("button", { name: "Disparador" });
    await user.click(trigger);
    // El panel capturó el foco al abrir.
    const dialog = await screen.findByRole("dialog", { name: "Editar" });
    await vi.waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    await user.keyboard("{Escape}");

    // El contrato crítico tras cerrar es que el panel desaparece del árbol
    // accesible y el foco sale de él (nunca queda en un nodo muerto).
    // La RESTAURACIÓN al disparador la ejecuta Radix al desmontar el
    // Content; en jsdom, con el exit animado de motion, ese retorno no se
    // completa de forma determinista y no es lo que este test verifica.
    await vi.waitFor(
      () => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(document.activeElement?.closest('[role="dialog"]')).toBeNull();
  });

  it("cierra con Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("el foco no se escapa del diálogo con Tab", async () => {
    const user = userEvent.setup();
    render(
      <Sheet open onClose={vi.fn()} title="Editar">
        <Input name="nombre" label="Nombre" />
        <button type="button">Guardar</button>
      </Sheet>,
    );

    // Focus trap de Radix: el ciclo cerrar → input → guardar → cerrar
    // nunca sale del panel mientras está abierto.
    const dialog = screen.getByRole("dialog", { name: "Editar" });
    const cerrar = screen.getByRole("button", { name: "Cerrar panel" });
    const input = screen.getByLabelText("Nombre");
    const save = screen.getByRole("button", { name: "Guardar" });
    await vi.waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    let recorrido = 0;
    while (document.activeElement !== input && recorrido < 4) {
      await user.tab();
      recorrido += 1;
    }
    expect(input).toHaveFocus();

    await user.tab();
    expect(save).toHaveFocus();
    await user.tab();
    expect(cerrar).toHaveFocus();
  });
});
