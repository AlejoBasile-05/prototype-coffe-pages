/**
 * Fallback de recovery por hash (Tarea 24). La red y el router son los
 * límites: se mockean, no se testean (convención del repo).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

import { HashRecovery } from "./HashRecovery";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const setHash = (hash: string) => {
  window.location.hash = hash;
};

beforeEach(() => {
  replace.mockReset();
  fetchMock.mockReset();
});

afterEach(() => {
  window.location.hash = "";
});

describe("HashRecovery", () => {
  it("canjea un hash de recovery válido y navega a la pantalla de cambio", async () => {
    setHash("#access_token=tok_access&refresh_token=tok_refresh&token_type=bearer&type=recovery");
    fetchMock.mockResolvedValue({ ok: true });
    render(<HashRecovery />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: "tok_access", refresh_token: "tok_refresh" }),
      });
      expect(replace).toHaveBeenCalledWith("/nueva-contrasena");
    });
  });

  it("con un hash que no es de recovery, vuelve al login con error", async () => {
    setHash("#access_token=tok&type=signup");
    render(<HashRecovery />);

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith("/login?error=link-invalido");
    });
  });

  it("si el canje falla en el servidor, informa link inválido", async () => {
    setHash("#access_token=tok_access&refresh_token=tok_refresh&type=recovery");
    fetchMock.mockResolvedValue({ ok: false });
    render(<HashRecovery />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?error=link-invalido");
    });
  });

  it("si la red cae, tampoco deja al usuario colgado", async () => {
    setHash("#access_token=tok_access&refresh_token=tok_refresh&type=recovery");
    fetchMock.mockRejectedValue(new Error("network down"));
    render(<HashRecovery />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?error=link-invalido");
    });
  });

  it("sin hash, no llama a la red y vuelve al login", async () => {
    render(<HashRecovery />);

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith("/login?error=link-invalido");
    });
  });
});
