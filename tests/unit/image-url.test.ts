import { beforeEach, describe, expect, it } from "vitest";

import { buildCloudinaryImageUrl, buildImagePublicId } from "@/server/services/image.service";

const CLOUD = "prototype";

describe("buildImagePublicId", () => {
  it("deriva el public_id del slug usando buildSlug (nada de normalización propia)", () => {
    expect(buildImagePublicId("Jamón y Queso")).toBe("prototype/products/jamon-y-queso");
    expect(buildImagePublicId("Salmón y Palta")).toBe("prototype/products/salmon-y-palta");
  });
});

describe("buildCloudinaryImageUrl", () => {
  beforeEach(() => {
    process.env["CLOUDINARY_CLOUD_NAME"] = CLOUD;
  });

  it("aplica las transformaciones f_auto,q_auto,dpr_auto,c_fill,g_auto,w_", () => {
    const url = buildCloudinaryImageUrl("prototype/products/jamon-y-queso", { width: 800 });

    expect(url).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,c_fill,g_auto,w_800/prototype/products/jamon-y-queso`,
    );
  });

  it("acepta una URL de entrega con transformaciones previas y las reemplaza", () => {
    const previa = `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,w_1200/prototype/products/jamon-y-queso`;

    expect(buildCloudinaryImageUrl(previa, { width: 400 })).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,c_fill,g_auto,w_400/prototype/products/jamon-y-queso`,
    );
  });

  it("acepta una URL de entrega sin transformaciones (caso del seed, nube demo)", () => {
    const delSeed =
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,g_auto,w_1200/cld-sample.jpg";

    // La nube es "demo", no la del env: no es de la cuenta, la URL se
    // devuelve intacta en lugar de re-firmar un host ajeno.
    expect(buildCloudinaryImageUrl(delSeed, { width: 640 })).toBe(delSeed);
  });

  it("una URL que no es de Cloudinary se devuelve intacta", () => {
    const ajena = "https://example.com/foto.jpg";

    expect(buildCloudinaryImageUrl(ajena, { width: 800 })).toBe(ajena);
  });

  it("sin height no aparece h_ en la URL; con height aparece", () => {
    const sinH = buildCloudinaryImageUrl("prototype/products/x", { width: 800 });
    const conH = buildCloudinaryImageUrl("prototype/products/x", { width: 800, height: 600 });

    expect(sinH).not.toContain("h_");
    expect(conH).toContain("h_600");
  });

  it("sin CLOUDINARY_CLOUD_NAME lanza nombrando la variable", () => {
    delete process.env["CLOUDINARY_CLOUD_NAME"];

    expect(() => buildCloudinaryImageUrl("x", { width: 800 })).toThrow(/CLOUDINARY_CLOUD_NAME/);
  });
});