import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/csp-report/route";

/**
 * Etapa 2 de la CSP (Tarea 21 §6.9). Lo que se afirma acá no es que el
 * reporte se guarde —no se guarda en ningún lado— sino que el endpoint nunca
 * se le da la razón a un navegador para dejar de reportar.
 */

const post = (cuerpo: string): Promise<Response> =>
  POST(
    new Request("https://modo-miga.test/api/csp-report", {
      method: "POST",
      body: cuerpo,
      headers: { "content-type": "application/json" },
    }),
  );

const reporteValido = {
  "csp-report": {
    "document-uri": "https://modo-miga.test/menu",
    "violated-directive": "img-src",
    "blocked-uri": "https://ejemplo.test/pixel.gif",
  },
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/csp-report", () => {
  it("debe responder 204 con el envoltorio csp-report", async () => {
    const response = await post(JSON.stringify(reporteValido));

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("debe leer el envoltorio body, que es como lo manda el navegador", async () => {
    const response = await post(
      JSON.stringify({ body: { "violated-directive": "script-src", "blocked-uri": "inline" } }),
    );

    expect(response.status).toBe(204);
  });

  it("⛔ debe responder 204 también con un body que no es JSON", async () => {
    const response = await post("<html>no soy json</html>");

    expect(response.status).toBe(204);
    expect(console.error).toHaveBeenCalledWith("[csp-report] Body ilegible");
  });

  it("⛔ debe responder 204 con un JSON válido que no trae un reporte", async () => {
    const response = await post(JSON.stringify({ hola: "mundo" }));

    expect(response.status).toBe(204);
    expect(console.warn).toHaveBeenCalledWith(
      "[csp-report] Cuerpo legible sin un reporte de CSP dentro.",
    );
  });

  it("⛔ debe responder 204 con un cuerpo vacío", async () => {
    expect((await post("")).status).toBe(204);
  });

  it("⛔ debe sanear los saltos de línea del reporte antes de escribirlo al log", async () => {
    await post(
      JSON.stringify({
        "csp-report": {
          "blocked-uri": "evil.test\n[health] Base conectada con exito",
          "violated-directive": "script-src",
        },
      }),
    );

    // CWE-117: sin sanear, esa segunda línea entra al agregador como si la
    // hubiera escrito el sistema.
    for (const llamada of vi.mocked(console.warn).mock.calls) {
      expect(String(llamada[0])).not.toContain("Base conectada");
    }
  });

  it("⛔ debe recortar los textos largos del reporte", async () => {
    await post(
      JSON.stringify({
        "csp-report": { "blocked-uri": `https://ejemplo.test/${"a".repeat(500)}` },
      }),
    );

    const logged = String(vi.mocked(console.warn).mock.calls[0]?.[0]);
    expect(logged.length).toBeLessThan(400);
  });
});

describe("GET /api/csp-report", () => {
  it("debe responder el total con no-store", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const json = await response.json();
    expect(json).toHaveProperty("total");
    expect(typeof json.total).toBe("number");
  });
});