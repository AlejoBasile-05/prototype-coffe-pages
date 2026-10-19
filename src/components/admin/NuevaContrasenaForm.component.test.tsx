/**
 * Formulario de nueva contraseña (Tarea 24). La Server Action es el
 * límite del componente: se mockea, no se testea (convención del repo).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { AuthActionResult } from "@/server/auth/actions";
import { updatePasswordAction } from "@/server/auth/actions";

import { NuevaContrasenaForm } from "./NuevaContrasenaForm";

vi.mock("@/server/auth/actions", () => ({
  updatePasswordAction: vi.fn(),
}));

const mockAction = vi.mocked(updatePasswordAction);

const fallo = (error: string, fieldErrors?: Record<string, string[]>): AuthActionResult => ({
  ok: false,
  error,
  ...(fieldErrors !== undefined ? { fieldErrors } : {}),
});

beforeEach(() => {
  mockAction.mockReset();
});

describe("NuevaContrasenaForm", () => {
  it("envía password y confirmPassword a la action", async () => {
    const user = userEvent.setup();
    mockAction.mockResolvedValue(fallo("No se pudo cambiar la contraseña. Intentá de nuevo."));
    render(<NuevaContrasenaForm />);

    await user.type(screen.getByLabelText(/Contraseña nueva/), "RiverPlate1986");
    await user.type(screen.getByLabelText(/Repetí la contraseña/), "RiverPlate1986");
    await user.click(screen.getByRole("button", { name: /Guardar contraseña/ }));

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    const formData = mockAction.mock.calls[0]?.[1] as FormData;
    expect(formData.get("password")).toBe("RiverPlate1986");
    expect(formData.get("confirmPassword")).toBe("RiverPlate1986");
  });

  it("muestra el error de campo junto al control que falló", async () => {
    const user = userEvent.setup();
    mockAction.mockResolvedValue(
      fallo("Revisá los datos del formulario.", {
        confirmPassword: ["Las contraseñas no coinciden."],
      }),
    );
    render(<NuevaContrasenaForm />);

    await user.type(screen.getByLabelText(/Contraseña nueva/), "RiverPlate1986");
    await user.type(screen.getByLabelText(/Repetí la contraseña/), "OtraDistinta1");
    await user.click(screen.getByRole("button", { name: /Guardar contraseña/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("no coinciden");
  });

  it("muestra el error global cuando no hay errores por campo", async () => {
    const user = userEvent.setup();
    mockAction.mockResolvedValue(
      fallo("El link venció o ya se usó. Pedí uno nuevo desde «Olvidé mi contraseña»."),
    );
    render(<NuevaContrasenaForm />);

    await user.type(screen.getByLabelText(/Contraseña nueva/), "RiverPlate1986");
    await user.type(screen.getByLabelText(/Repetí la contraseña/), "RiverPlate1986");
    await user.click(screen.getByRole("button", { name: /Guardar contraseña/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/El link venció/);
  });
});
