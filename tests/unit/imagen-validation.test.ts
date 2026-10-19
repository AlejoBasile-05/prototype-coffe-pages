import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/domain";
import {
  ALLOWED_IMAGE_FORMATS_CSV,
  ALLOWED_IMAGE_MIME_TYPES,
  type AllowedImageMimeType,
  MAX_IMAGE_BYTES,
  assertUploadedImageIsUsable,
  validateImageFile,
} from "@/lib/validation/imagen";

const buildFile = (input: { readonly sizeBytes: number; readonly type: string }): File =>
  new File([new Uint8Array(input.sizeBytes)], "foto.jpg", { type: input.type });

describe("validateImageFile (advisoria, sobre el File)", () => {
  it("acepta un JPG chico", () => {
    expect(() =>
      validateImageFile(buildFile({ sizeBytes: 1024, type: "image/jpeg" })),
    ).not.toThrow();
  });

  it("rechaza un archivo por encima del máximo", () => {
    const grande = buildFile({ sizeBytes: MAX_IMAGE_BYTES + 1, type: "image/jpeg" });

    expect(() => validateImageFile(grande)).toThrow(ValidationError);
    expect(() => validateImageFile(grande)).toThrow(/demasiado pesada/);
  });

  it("rechaza un MIME fuera de la lista", () => {
    expect(() =>
      validateImageFile(buildFile({ sizeBytes: 1024, type: "application/pdf" })),
    ).toThrow("Formato de imagen no admitido");
  });

  it("rechaza SVG aunque lo declaren como tal", () => {
    expect(() => validateImageFile(buildFile({ sizeBytes: 1024, type: "image/svg+xml" }))).toThrow(
      ValidationError,
    );
  });

  it("rechaza el archivo vacío", () => {
    const vacio = buildFile({ sizeBytes: 0, type: "image/jpeg" });

    expect(() => validateImageFile(vacio)).toThrow(ValidationError);
    try {
      validateImageFile(vacio);
      expect.unreachable("debió lanzar");
    } catch (error) {
      // El detalle específico vive en fieldErrors; el message es el resumen.
      expect((error as ValidationError).fieldErrors["file"]).toContain("El archivo está vacío.");
    }
  });

  it("la lista es exactamente JPG, PNG y WebP", () => {
    expect(ALLOWED_IMAGE_MIME_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it("un AVIF se rechaza en el navegador con un mensaje que no miente", () => {
    // El `accept` del campo nunca ofreció AVIF y Cloudinary lo tiene fuera
    // de `allowed_formats`. Si el navegador lo admitiera, la subida pasaría
    // la validación y moriría con un 400 del proveedor.
    try {
      validateImageFile(buildFile({ sizeBytes: 1024, type: "image/avif" }));
      expect.unreachable("debió lanzar");
    } catch (error) {
      expect((error as ValidationError).fieldErrors["file"]).toContain(
        "Formato no admitido. Usá JPG, PNG o WebP.",
      );
    }
  });

  it("ningún MIME admitido queda fuera de los formatos que Cloudinary va a permitir", () => {
    // El invariante que faltaba: las dos listas son el mismo contrato y
    // no pueden estar en módulos distintos sin verse. El `accept` del
    // componente y la lista de Cloudinary ya decían lo mismo; sólo la
    // validación se había apartado, y ningún test lo notó porque cada una
    // comparaba su propia lista contra una constante escrita al lado.
    const formatoPorMime: Record<AllowedImageMimeType, string> = {
      "image/jpeg": "jpeg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const permitidosPorCloudinary = new Set(ALLOWED_IMAGE_FORMATS_CSV.split(","));

    for (const mime of ALLOWED_IMAGE_MIME_TYPES) {
      const formato = formatoPorMime[mime];
      expect(permitidosPorCloudinary.has(formato), `${mime} no está en allowed_formats`).toBe(true);
    }

    // Y al revés: un formato que Cloudinary admite y el navegador no
    // puede validar es el mismo bug del otro lado. `jpg` es el alias que
    // Cloudinary acepta para un JPEG, así que no necesita MIME propio.
    for (const formato of permitidosPorCloudinary) {
      const conMime = Object.entries(formatoPorMime).some(([, f]) => f === formato);
      const jpegAlias = formato === "jpg";
      expect(conMime || jpegAlias, `allowed_formats admite "${formato}" y nadie lo puede subir`).toBe(
        true,
      );
    }
  });
});

describe("assertUploadedImageIsUsable (autoritativa, sobre bytes reales)", () => {
  const base = { width: 1600, height: 1200, bytes: 500_000 };

  it("un format svg reportado por Cloudinary se rechaza aunque el File se anunciara como JPEG", () => {
    expect(() => assertUploadedImageIsUsable({ ...base, format: "svg" })).toThrow(
      "Formato de imagen no admitido",
    );
  });

  it("1200x900 pasa (el criterio es el lado mayor)", () => {
    expect(() =>
      assertUploadedImageIsUsable({ format: "jpg", width: 1200, height: 900, bytes: 100 }),
    ).not.toThrow();
  });

  it("1199x800 falla por tamaño", () => {
    expect(() =>
      assertUploadedImageIsUsable({ format: "jpg", width: 1199, height: 800, bytes: 100 }),
    ).toThrow(/muy chica/);
  });

  it("una vertical 900x1600 pasa igual", () => {
    expect(() =>
      assertUploadedImageIsUsable({ format: "jpg", width: 900, height: 1600, bytes: 100 }),
    ).not.toThrow();
  });

  it("un asset que vuelve más pesado que el tope se rechaza aunque haya pasado la validación previa", () => {
    expect(() =>
      assertUploadedImageIsUsable({
        format: "jpg",
        width: 2000,
        height: 1500,
        bytes: MAX_IMAGE_BYTES + 1,
      }),
    ).toThrow(ValidationError);
  });
});
