import { describe, expect, it } from "vitest";

import {
  ALLOWED_UPLOAD_FORMATS,
  MAX_IMAGE_PIXELS,
  buildSignedUploadParams,
} from "@/server/infra/cloudinary";
import { MAX_IMAGE_BYTES } from "@/lib/validation/imagen";
import { buildImagePublicId, signProductImageUpload } from "@/server/services/image.service";

/**
 * Los límites de la subida (Tarea 19 §2.9).
 *
 * ⛔ Lo que se testea es que los límites ESTÉN EN LO FIRMADO. Una allowlist
 *    que se calcula y no se manda es decorativa: Cloudinary valida que el
 *    conjunto de parámetros que recibe sea el que la firma cubre, así que
 *    un `allowed_formats` fuera del `FormData` no restringe nada y además
 *    rompe la firma. Estos tests existen para que nadie los saque del
 *    camino firmado.
 */
describe("buildSignedUploadParams", () => {
  it("incluye la allowlist y los DOS límites en lo que se firma", () => {
    const params = buildSignedUploadParams({
      publicId: "prototype/products/jamon-y-queso",
      timestamp: 1700000000,
    });

    expect(params.allowed_formats).toBe(ALLOWED_UPLOAD_FORMATS);
    expect(params.max_file_size).toBe(MAX_IMAGE_BYTES);
    // El tope de bytes y el de píxeles son cosas distintas: un PNG de 1 KB
    // puede tener 100 megapíxeles y el límite de peso no lo ve.
    expect(params.max_image_size).toBe(MAX_IMAGE_PIXELS);
    expect(params.max_image_size).not.toBe(MAX_IMAGE_BYTES);
  });

  it("es una allowlist, no una blacklist: SVG y video quedan afuera", () => {
    // ⛔ La lista es corta a propósito. Si algún día crece, tiene que ser
    //    porque algo la necesita de verdad, no porque "también serve".
    expect(ALLOWED_UPLOAD_FORMATS).toBe("jpg,jpeg,png,webp");
    expect(ALLOWED_UPLOAD_FORMATS).not.toContain("svg");
    expect(ALLOWED_UPLOAD_FORMATS).not.toContain("mp4");
    expect(ALLOWED_UPLOAD_FORMATS).not.toContain("psd");
  });

  it("usa los nombres de la API, en snake_case", () => {
    const params = buildSignedUploadParams({ publicId: "x", timestamp: 1700000000 });

    // La firma se calcula sobre los nombres exactos que Cloudinary valida.
    expect(Object.keys(params).sort()).toEqual([
      "allowed_formats",
      "max_file_size",
      "max_image_size",
      "overwrite",
      "public_id",
      "timestamp",
    ]);
  });

  it("el public_id lleva la carpeta adentro y NO manda `folder` aparte", () => {
    // Cloudinary arma la ruta como `folder` + "/" + `public_id`: mandar los
    // dos duplica el prefijo y deja los assets en
    // `prototype/products/prototype/products/<slug>`.
    const params = buildSignedUploadParams({
      publicId: buildImagePublicId("Jamón y Queso"),
      timestamp: 1700000000,
    });

    expect(params.public_id).toBe("prototype/products/jamon-y-queso");
    expect(params).not.toHaveProperty("folder");
  });
});

describe("signProductImageUpload", () => {
  it("devuelve al navegador todo lo que tiene que ir en el FormData", () => {
    process.env["CLOUDINARY_CLOUD_NAME"] = "prototype";
    process.env["CLOUDINARY_API_KEY"] = "123456789012345";
    process.env["CLOUDINARY_API_SECRET"] = "el-secret-no-sale-de-aqui";

    const firma = signProductImageUpload("Jamón y Queso");

    // El cliente arma el `FormData` con esto. Si un campo falta acá, la
    // subida se rechaza por firma incompleta y no por contenido.
    expect(firma.publicId).toBe("prototype/products/jamon-y-queso");
    expect(firma.overwrite).toBe("true");
    expect(firma.allowedFormats).toBe(ALLOWED_UPLOAD_FORMATS);
    expect(firma.maxFileSize).toBe(MAX_IMAGE_BYTES);
    expect(firma.maxImageSize).toBe(MAX_IMAGE_PIXELS);
    expect(firma.apiKey).toBe("123456789012345");
  });

  it("nunca devuelve el secret", () => {
    process.env["CLOUDINARY_CLOUD_NAME"] = "prototype";
    process.env["CLOUDINARY_API_KEY"] = "123456789012345";
    process.env["CLOUDINARY_API_SECRET"] = "el-secret-no-sale-de-aqui";

    const firma = signProductImageUpload("Producto");

    expect(JSON.stringify(firma)).not.toContain("el-secret-no-sale-de-aqui");
    expect(Object.keys(firma)).not.toContain("secret");
  });
});