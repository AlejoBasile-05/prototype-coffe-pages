/**
 * Reglas de negocio de las imágenes.
 *
 * La infra (`@/server/infra/cloudinary`) solo hace llamadas HTTP. Las
 * decisiones —qué se acepta, cómo se deriva el `public_id`, si hay que
 * destruir el asset anterior— viven acá (Tarea 06 §4.2).
 *
 * Las validaciones puras NO están acá: viven en `@/lib/validation/imagen`
 * (capa 0, sin I/O, testeable sin levantar nada). Ver §6.4.1 de la tarea.
 */
import "server-only";

import { buildSlug } from "@/lib/validation/slug";
import { assertUploadedImageIsUsable, validateImageFile } from "@/lib/validation/imagen";
import {
  PRODUCT_IMAGE_FOLDER,
  buildSignedUploadParams,
  destroyImageAsset,
  signCloudinaryParams,
  uploadImageAsset,
} from "@/server/infra/cloudinary";

/**
 * `public_id` del asset de un producto.
 *
 * ⚠️ Determinístico a propósito: sale del `buildSlug` del proyecto
 *    (Tarea 05 §6.8), no de una normalización propia. Así la identidad del
 *    asset y la del producto no pueden divergir, y re-subir la foto del mismo
 *    producto reemplaza el asset en lugar de abandonar otro en la cuenta.
 *
 * ⛔ Lleva la carpeta ADENTRO y por eso no se manda además un `folder`
 *    (Tarea 19 §2.9): Cloudinary arma la ruta como `folder` + `/` +
 *    `public_id`, y enviar los dos daba
 *    `prototype/products/prototype/products/<slug>`.
 */
export const buildImagePublicId = (productSlug: string): string =>
  `${PRODUCT_IMAGE_FOLDER}/${buildSlug(productSlug)}`;

/**
 * Lo que el Route Handler de firma devuelve al navegador.
 *
 * ⛔ `allowedFormats`, `maxFileSize` y `maxImageSize` NO son adorno: son
 *    parte del conjunto firmado y el navegador tiene que mandarlos en el
 *    `FormData`. Si el servidor los firma y el cliente no los envía,
 *    Cloudinary rechaza la subida y el allowlist no existe. El
 *    `ProductImageField` los convierte a `snake_case` porque así los nombra
 *    la API.
 */
export type ProductImageUploadSignature = {
  readonly signature: string;
  readonly timestamp: number;
  readonly publicId: string;
  readonly cloudName: string;
  readonly apiKey: string;
  readonly overwrite: "true";
  readonly allowedFormats: string;
  readonly maxFileSize: number;
  readonly maxImageSize: number;
};

/**
 * Parámetros firmados para que el navegador suba directo a Cloudinary.
 *
 * El Route Handler de firma (`/api/admin/images/sign`) habla con el
 * SERVICIO, no con la infra: la regla de capas prohíbe que las rutas
 * conozcan `@/server/infra` (eslint `no-restricted-imports`).
 *
 * Devuelve todo lo que el cliente necesita para armar el `FormData`,
 * excepto el secret, que jamás sale del servidor.
 */
export const signProductImageUpload = (slug: string): ProductImageUploadSignature => {
  const params = buildSignedUploadParams({
    publicId: buildImagePublicId(slug),
    timestamp: Math.floor(Date.now() / 1000),
  });
  const cloudName = process.env["CLOUDINARY_CLOUD_NAME"];
  const apiKey = process.env["CLOUDINARY_API_KEY"];
  if (cloudName === undefined || apiKey === undefined) {
    throw new Error("Faltan credenciales de Cloudinary en el entorno.");
  }

  return {
    signature: signCloudinaryParams(params),
    timestamp: params.timestamp,
    publicId: params.public_id,
    cloudName,
    apiKey,
    overwrite: params.overwrite,
    allowedFormats: params.allowed_formats,
    maxFileSize: params.max_file_size,
    maxImageSize: params.max_image_size,
  };
};

/**
 * Subida de la foto de un producto nuevo (no hay asset anterior).
 *
 * La foto se sube y DESPUÉS se chequea con sus metadatos reales: si no
 * sirve, destruir el asset en el catch es la diferencia entre un
 * huérfano de 2 MB y ninguno.
 */
export const uploadProductImage = async (input: {
  readonly file: File;
  readonly slug: string;
}): Promise<{ readonly imageUrl: string; readonly imagePublicId: string }> => {
  validateImageFile(input.file);

  const publicId = buildImagePublicId(input.slug);
  const result = await uploadImageAsset({ file: input.file, publicId });

  try {
    assertUploadedImageIsUsable(result);
  } catch (error) {
    await destroyImageAsset(publicId);
    throw error;
  }

  return { imageUrl: result.secureUrl, imagePublicId: result.publicId };
};

/**
 * Reemplaza la foto de un producto existente.
 *
 * ⛔ ORDEN CRÍTICO: primero sube, recién después destruye el anterior.
 *    Si se destruyera primero y la subida fallara, el producto queda sin
 *    `imageUrl` —y `imageUrl` es NOT NULL en el schema (Tarea 03 §9).
 *
 * Con el `public_id` determinístico, Cloudinary reemplaza el asset cuando
 * el slug no cambió; el `destroy` posterior es la red de seguridad para
 * el caso en que el slug sí cambió. Un fallo de ese destroy NO revierte
 * el guardado: el huérfano se limpia en la Tarea 21.
 */
export const replaceProductImage = async (input: {
  readonly file: File;
  readonly slug: string;
  readonly previousPublicId: string | null;
}): Promise<{ readonly imageUrl: string; readonly imagePublicId: string }> => {
  const subido = await uploadProductImage({ file: input.file, slug: input.slug });

  if (input.previousPublicId !== null && input.previousPublicId !== subido.imagePublicId) {
    try {
      await destroyImageAsset(input.previousPublicId);
    } catch (error) {
      console.error("[image] No se pudo destruir el asset anterior", error);
    }
  }

  return subido;
};

// El constructor de URL de entrega vive en su propio módulo (límite de
// 150 líneas por servicio, Tarea 06 §5/§6.4.1) y se reexporta acá para
// que el contrato de la Tarea 16 (`@/server/services/image.service`) no
// cambie por la partición.
export { buildCloudinaryImageUrl, type ImageTransform } from "./image-url.service";
