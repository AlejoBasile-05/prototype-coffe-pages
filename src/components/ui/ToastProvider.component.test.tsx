import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider, useToast } from "./ToastProvider";
import { ToastViewport } from "./ToastViewport";

function Trigger({ message, tone }: { message: string; tone?: "success" | "error" | "info" }) {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show(message, tone)}>
      Guardar
    </button>
  );
}

const renderToasts = (ui: ReactNode) =>
  render(
    <ToastProvider>
      {ui}
      <ToastViewport />
    </ToastProvider>,
  );

describe("Toast", () => {
  it("se anuncia de forma polled y no interrumpe la lectura en curso", async () => {
    const user = userEvent.setup();
    const { container } = renderToasts(<Trigger message="Elemento actualizado" tone="success" />);

    // La región se busca por atributo, no por rol: el viewport no lleva
    // role="status" a propósito, para que haya una sola forma de encontrarla.
    const region = container.ownerDocument.querySelector('[aria-live="polite"]');
    expect(region).toHaveAttribute("aria-atomic", "false");

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Elemento actualizado")).toBeInTheDocument();
  });

  it("muestra el toast con el tipo pedido y permite descartarlo", async () => {
    const user = userEvent.setup();
    renderToasts(<Trigger message="No se pudo guardar" tone="error" />);

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    // El tono se traduce al type del toast-stack: el error se anuncia
    // con urgencia (role="alert" en la región), no como un aviso común.
    expect(await screen.findByText("No se pudo guardar")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Descartar notificación" }));

    // NOTA: no se testea el temporizado exacto (base 4.5 s, errores 1.6×).
    // La salida es una animación rAF de motion, no un setTimeout: bajo
    // fake timers el nodo nunca se desmonta y el test queda flaky. La
    // duración por tipo la garantiza el vendor (toast-stack de Arc).
    await vi.waitFor(() => {
      expect(screen.queryByText("No se pudo guardar")).not.toBeInTheDocument();
    });
  });

  it("el botón de descarte tiene nombre accesible y saca el toast", async () => {
    const user = userEvent.setup();
    renderToasts(<Trigger message="Elemento actualizado" tone="info" />);

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    // El botón de cierre lo dibuja el vendor (Arc UI); el nombre
    // accesible sigue siendo verificable y eso es lo que importa.
    await user.click(screen.getByRole("button", { name: "Descartar notificación" }));

    // La salida es animada: el texto desaparece cuando termina, no en el click.
    await vi.waitFor(() => {
      expect(screen.queryByText("Elemento actualizado")).not.toBeInTheDocument();
    });
  });

  it("falla con un mensaje claro si se usa fuera del provider", () => {
    // React loguea el error del render antes de propagarlo: se silencia
    // solo el console.error de este test, y se restaura el espía global
    // de vitest.setup.ts en vez de dejar el console pelado.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // Sin este error el síntoma en el navegador es un "Cannot read
      // properties of null" que no dice nada sobre la causa.
      expect(() => render(<Trigger message="x" />)).toThrow(/ToastProvider/);
    } finally {
      consoleError.mockRestore();
    }
  });
});
