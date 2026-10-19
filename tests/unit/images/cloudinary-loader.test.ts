import { afterEach, describe, expect, it } from "vitest";

import { buildCloudinaryImageUrl } from "@/server/services/image-url.service";

import { buildCloudinaryLoaderUrl } from "@/lib/images/cloudinary-loader";

const SRC = "https://res.cloudinary.com/demo/image/upload/products/cafe-01.jpg";

describe("buildCloudinaryLoaderUrl", () => {
  afterEach(() => {
    delete process.env["CLOUDINARY_CLOUD_NAME"];
  });

  it("produce la misma URL que el helper de server", () => {
    process.env["CLOUDINARY_CLOUD_NAME"] = "demo";

    const viaLoader = buildCloudinaryLoaderUrl(SRC, 640);
    const viaService = buildCloudinaryImageUrl(SRC, { width: 640 });

    expect(viaLoader).toBe(viaService);
  });

  it("devuelve la URL sin tocar si no es de Cloudinary", () => {
    const external = "https://example.com/otra-imagen.jpg";

    expect(buildCloudinaryLoaderUrl(external, 640)).toBe(external);
  });

  it("es estable con el mismo ancho: reescribir una URL ya transformada no cambia nada", () => {
    const transformed = buildCloudinaryLoaderUrl(SRC, 640);

    expect(buildCloudinaryLoaderUrl(transformed, 640)).toBe(transformed);
  });

  it("una URL ya transformada (p. ej. una imagen semilla con w fija) se reescribe al ancho pedido", () => {
    // Contrato de next/image: el loader debe producir el recurso para el
    // `width` solicitado; devolver la URL intacta dispara el error
    // "loader does not implement width" y anula srcset.
    const semilla = "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,g_auto,w_1200/sample.jpg";

    expect(buildCloudinaryLoaderUrl(semilla, 640)).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,dpr_auto,c_fill,g_auto,w_640/sample.jpg",
    );
  });
});
