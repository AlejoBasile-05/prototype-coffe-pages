import { beforeEach, describe, expect, it } from "vitest";

import { signCloudinaryParams } from "@/server/infra/cloudinary";

/**
 * Vector conocido, calculado A MANO y pegado como constante.
 *
 * params   = { api_key: "123", folder: "modo-miga/products", public_id: "x", timestamp: 1700000000 }
 * payload  = "api_key=123&folder=modo-miga/products&public_id=x&timestamp=1700000000"
 * secret   = "secreto-de-prueba"
 * sha1(payload + secret) = 13ef8a043dd511aeb46723f931cf518cf6cde494
 *
 * ⚠️ El test NO usa la propia función para generar el valor esperado:
 *    eso probaría que sha1(x) === sha1(x).
 */
const VECTOR_ESPERADO = "13ef8a043dd511aeb46723f931cf518cf6cde494";

describe("signCloudinaryParams", () => {
  beforeEach(() => {
    process.env["CLOUDINARY_API_KEY"] = "123";
    process.env["CLOUDINARY_API_SECRET"] = "secreto-de-prueba";
  });

  it("coincide con el vector conocido", () => {
    const firma = signCloudinaryParams({
      folder: "modo-miga/products",
      public_id: "x",
      timestamp: 1700000000,
    });

    expect(firma).toBe(VECTOR_ESPERADO);
  });

  it("el orden de los parámetros de entrada no cambia el resultado (se ordenan dentro)", () => {
    const ordenA = signCloudinaryParams({
      timestamp: 1700000000,
      public_id: "x",
      folder: "modo-miga/products",
    });
    const ordenB = signCloudinaryParams({
      folder: "modo-miga/products",
      public_id: "x",
      timestamp: 1700000000,
    });

    expect(ordenA).toBe(ordenB);
    expect(ordenA).toBe(VECTOR_ESPERADO);
  });

  it("los tipos primitivos se stringifican antes de firmar (los booleanos incluidos)", () => {
    const firma = signCloudinaryParams({
      folder: "modo-miga/products",
      public_id: "x",
      timestamp: 1700000000,
      overwrite: true,
    });

    // El payload ahora incluye `overwrite=true` antes de `public_id`:
    // api_key=123&folder=…&overwrite=true&public_id=x&timestamp=…
    expect(firma).toMatch(/^[0-9a-f]{40}$/);
    expect(firma).not.toBe(VECTOR_ESPERADO);
  });

  it("sin CLOUDINARY_API_SECRET lanza con mensaje que nombra la variable", () => {
    delete process.env["CLOUDINARY_API_SECRET"];

    expect(() => signCloudinaryParams({ public_id: "x" })).toThrow(/CLOUDINARY_API_SECRET/);
  });
});
