import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/cart/validate/route";
import type { CartLineReference, CartValidationResult } from "@/lib/domain";
import { validatePublicCartLines } from "@/server/services";

// La ruta compone servicio y repositorio a través del composition root:
// el límite del handler es ese módulo, no el repositorio directo.
vi.mock("@/server/services", () => ({
  validatePublicCartLines: vi.fn(),
}));

const call = (query: string): Promise<Response> =>
  GET(new Request(`https://modo-miga.test/api/cart/validate?${query}`));

const stubService = (result: Partial<CartValidationResult> = {}): void => {
  vi.mocked(validatePublicCartLines).mockResolvedValue({
    lines: [],
    hasBlockingIssues: true,
    ...result,
  });
};

beforeEach(() => {
  vi.mocked(validatePublicCartLines).mockReset();
});

describe("GET /api/cart/validate", () => {
  it("debe responder 200 con no-store y el estado de cada línea", async () => {
    stubService();

    const response = await call("line=p1");
    const body = (await response.json()) as { ok: boolean; hasBlockingIssues: boolean };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(body.ok).toBe(true);
    expect(body.hasBlockingIssues).toBe(true);
  });

  it("debe pasar una línea sin variante como variantId null", async () => {
    stubService();

    const response = await call("line=p1");

    expect(response.status).toBe(200);
    expect(validatePublicCartLines).toHaveBeenCalledWith<[CartLineReference[]]>([
      { productId: "p1", variantId: null },
    ]);
  });

  it("debe normalizar el formato legacy `p1:` a variantId null", async () => {
    stubService();

    const response = await call("line=p1:");

    expect(response.status).toBe(200);
    expect(validatePublicCartLines).toHaveBeenCalledWith<[CartLineReference[]]>([
      { productId: "p1", variantId: null },
    ]);
  });

  it("debe pasar una línea con variante como productId:variantId", async () => {
    stubService();

    const response = await call("line=p1:v1");

    expect(response.status).toBe(200);
    expect(validatePublicCartLines).toHaveBeenCalledWith<[CartLineReference[]]>([
      { productId: "p1", variantId: "v1" },
    ]);
  });

  it("debe rechazar con 400 una request sin líneas", async () => {
    expect((await call("")).status).toBe(400);
  });

  it("debe rechazar con 400 más de 30 líneas", async () => {
    const query = Array.from({ length: 31 }, (_, i) => `line=p${i}`).join("&");

    expect((await call(query)).status).toBe(400);
  });

  it("debe rechazar con 400 un id con formato inválido antes de tocar la base", async () => {
    stubService();
    const response = await call("line=p1&line=${DROP TABLE}&variant=x");

    expect(response.status).toBe(400);
    expect(validatePublicCartLines).not.toHaveBeenCalled();
  });

  it("debe responder 500 si el servicio revienta, sin filtrar el error", async () => {
    vi.mocked(validatePublicCartLines).mockRejectedValue(
      new Error("connection string: user:pass@host"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await call("line=p1");
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    // El mensaje del cliente es genérico: la connection string no sale.
    expect(body.error).not.toContain("user:pass");
  });
});
