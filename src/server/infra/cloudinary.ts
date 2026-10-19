/**
 * Cliente HTTP de Cloudinary.
 *
 * ⛔ ESTA CAPA NO DECIDE NADA. Solo firma, arma el `FormData` y hace el
 *    cuerpo `API`. Las reglas ("qué MIME se acepta", "debo destruir el
 *    asset anterior") viven en `@/server/services/image.service`. Ver
 *    Tarea 06 §4.2.
 *
 * ⛔ `CLOUDINARY_API_SECRET` nunca sale de acá.
 *
 * No se usa el SDK de Cloudinary a propósito: la firma es un SHA-1 de
 * parámetros ordenados, cinco líneas de `crypto`, y el SDK arrastra
 * dependencias que solo hacen falta para URL firmadas —que acá no se usan,
 * porque las imágenes del catálogo son públicas por definición.
 */
import "server-only";

import { createHash } from "node:crypto";

import { ExternalServiceError } from "@/lib/domain";
import {
  ALLOWED_IMAGE_FORMATS_CSV,
  MAX_IMAGE_BYTES,
} from "@/lib/validation/imagen";

/** Carpeta donde viven todas las fotos de producto. */
export const PRODUCT_IMAGE_FOLDER = "prototype/products";

/**
 * ⛔ ALLOWLIST, no blacklist (Tarea 19 §2.9). Cloudinary acepta `mp4`,
 *    `mov`, `pdf`, `psd`, `tiff`, `heic` y formatos RAW de cámara si no se
 *    los limita: un `.psd` de 200 MB en la misma cuenta que las fotos de
 *    producto es un costo y un vector. Estos cuatro son los que el
 *    optimizador y el `next/image` del proyecto saben mostrar.
 *
 * 📍 La lista vive en `@/lib/validation/imagen` y no acá. Este módulo tiene
 *    `import "server-only"`, así que cuando la lista estaba acá, la
 *    validación del navegador no podía verla: las dos se apartaron —el
 *    `accept` del campo y esta lista dijeron `jpeg,png,webp`, y sólo la
 *    validación aceptó AVIF— sin que ninguna pragma gritara. Reexportar la
 *    de capa 0 mantiene un solo lugar donde se puede cambiar el contrato.
 */
export const ALLOWED_UPLOAD_FORMATS = ALLOWED_IMAGE_FORMATS_CSV;

/**
 * ⛔ Tope de PÍXELES, distinto del tope de bytes.
 *
 * Un PNG de 1 KB puede ser de 100 megapíxeles: `max_file_size` no lo ve y
 * el worker de Cloudinary se lo come. 24 MP cubre una foto de teléfono
 * grande de sobra y deja outside el caso patológico.
 */
export const MAX_IMAGE_PIXELS = 24_000_000;

/**
 * Valores firmados que Cloudinary espera. Todos se hashean, incluso los
 * que no son obligatorios, porque la firma cubre exactamente lo que se
 * envía: si el navegador altera un parámetro, la firma deja de coincidir.
 */
export type CloudinarySignableParams = Readonly<Record<string, string | number | boolean>>;

/**
 * Firma SHA-1 de los parámetros.
 *
 * El algoritmo, según la documentación de Cloudinary:
 *   1. Se toman TODOS los parámetros que se envían (más `api_key`).
 *   2. Se ordenan por clave, alfabéticamente.
 *   3. Se arman como `clave=valor` unidos por `&`.
 *   4. Se concatena el `api_secret` **sin ningún separador**.
 *   5. SHA-1 en hexadecimal.
 *
 * El paso 4 es el que más se olvida y es el que más falla:
 * `sha1(params + secret)`, nunca `sha1(params) + secret`,
 * nunca `sha1(params + "&" + secret)`.
 */
export const signCloudinaryParams = (params: CloudinarySignableParams): string => {
  const apiSecret = process.env["CLOUDINARY_API_SECRET"];
  if (apiSecret === undefined || apiSecret === "") {
    throw new Error("Falta CLOUDINARY_API_SECRET en el entorno.");
  }

  const conApiKey: CloudinarySignableParams = {
    ...params,
    api_key: process.env["CLOUDINARY_API_KEY"] ?? "",
  };

  const payload = Object.keys(conApiKey)
    .sort()
    .map((clave) => `${clave}=${String(conApiKey[clave])}`)
    .join("&");

  return createHash("sha1")
    .update(payload + apiSecret)
    .digest("hex");
};

/**
 * Metadatos que devuelve Cloudinary al subir.
 *
 * Son la **fuente de verdad** sobre el archivo, no el `File` del
 * navegador. Cloudinary inspecciona los bytes reales: si alguien sube un
 * `script.svg` renombrado a `.jpg`, acá llega `format: "svg"`. Por eso
 * la validación autoritativa corre sobre este tipo y no sobre el `File`
 * del cliente.
 */
export interface CloudinaryUploadResult {
  readonly publicId: string;
  readonly secureUrl: string;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly bytes: number;
}

/**
 * Los parámetros que viajan firmados y que Cloudinary exige recibir.
 *
 * ⛔ Las claves son las DE LA API, en `snake_case`, y no las del proyecto:
 *    la firma se calcula sobre los nombres exactos que Cloudinary valida, y
 *    un `publicId` camelCase firmado acá would arrive como un parámetro que
 *    la API no reconoce. Por eso la traducción a camelCase la hace el
 *    servicio, no esta capa.
 *
 * ⛔ NO va `folder`: el `public_id` del proyecto ya lo incluye
 *    (`prototype/products/<slug>`, contrato de la Tarea 06 §6.8). Mandar
 *    los dos produce `prototype/products/prototype/products/<slug>`.
 *
 * ⛔ Es un `type` y no una `interface` a propósito: un alias de objeto
 *    tiene firma de índice implícita y se puede pasar tal cual a
 *    `signCloudinaryParams`, que no acepta una interface.
 */
export type SignedUploadParams = {
  readonly timestamp: number;
  readonly public_id: string;
  readonly overwrite: "true";
  readonly allowed_formats: string;
  readonly max_file_size: number;
  readonly max_image_size: number;
};

/**
 * ⛔ Los tres límites (`allowed_formats`, `max_file_size`, `max_image_size`)
 *    van DENTRO de lo firmado, no afuera. Cloudinary valida que el conjunto
 *    de parámetros que recibe sea exactamente el que la firma cubre: si el
 *    navegador los manda sin firmar, la subida se rechaza, y si no se
 *    mandan, no existen y el allowlist es decorativo.
 */
export const buildSignedUploadParams = (input: {
  readonly publicId: string;
  readonly timestamp: number;
}): SignedUploadParams => ({
  timestamp: input.timestamp,
  public_id: input.publicId,
  overwrite: "true",
  allowed_formats: ALLOWED_UPLOAD_FORMATS,
  max_file_size: MAX_IMAGE_BYTES,
  max_image_size: MAX_IMAGE_PIXELS,
});

const CLOUDINARY_UPLOAD_ENDPOINT = "image/upload";

const buildUploadUrl = (): string => {
  const cloudName = process.env["CLOUDINARY_CLOUD_NAME"];
  if (cloudName === undefined || cloudName === "") {
    throw new Error("Falta CLOUDINARY_CLOUD_NAME en el entorno.");
  }
  return `https://api.cloudinary.com/v1_1/${cloudName}/${CLOUDINARY_UPLOAD_ENDPOINT}`;
};

/**
 * Sube un archivo (de la foto del producto).
 *
 * En deuda explícita de la Tarea 06 §9: un `fetch` fallido por red
 * típica se propagará en lugar de quedar como `ExternalServiceError`;
 * se adapta a esto cuando exista un test contra el caso (ver §9.2).
 */
export const uploadImageAsset = async (input: {
  readonly file: File;
  readonly publicId: string;
}): Promise<CloudinaryUploadResult> => {
  const params = buildSignedUploadParams({
    publicId: input.publicId,
    timestamp: Math.floor(Date.now() / 1000),
  });

  const body = new FormData();
  body.append("file", input.file);
  body.append("api_key", process.env["CLOUDINARY_API_KEY"] ?? "");
  // ⛔ Se mandan TODOS los parámetros firmados, en el mismo `FormData` que
  //    firma la API. Mandar la firma de un conjunto y los parámetros de
  //    otro es un `400` de Cloudinary, no un allowlist: es el mismo camino
  //    que usa el navegador en `ProductImageField`.
  for (const [clave, valor] of Object.entries(params)) {
    body.append(clave, String(valor));
  }
  body.append("signature", signCloudinaryParams(params));

  const respuesta = await fetch(buildUploadUrl(), { method: "POST", body });
  if (!respuesta.ok) {
    const texto = await respuesta.text();
    throw new ExternalServiceError("Cloudinary", `HTTP ${respuesta.status}: ${texto}`);
  }

  const data = (await respuesta.json()) as Record<string, unknown>;

  return {
    publicId: String(data["public_id"]),
    secureUrl: String(data["secure_url"]),
    width: Number(data["width"]),
    height: Number(data["height"]),
    format: String(data["format"]),
    bytes: Number(data["bytes"]),
  } satisfies CloudinaryUploadResult;
};

/**
 * Destruye un asset. SÓLO se llama si el asset está referenciado: si la
 * subida ya falló, el error que revienta uno no tiene que dañar a otro.
 */
export const destroyImageAsset = async (publicId: string): Promise<void> => {
  const cloudName = process.env["CLOUDINARY_CLOUD_NAME"];
  const apiKey = process.env["CLOUDINARY_API_KEY"];
  if (cloudName === undefined || apiKey === undefined) return;

  // ⛔ Un solo `timestamp` para firmar y para mandar: si se calculan por
  //    separado y cruzan un segundo, la firma no cubre el parámetro
  //    recibido y Cloudinary responde "invalid signature".
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = signCloudinaryParams({ public_id: publicId, timestamp });
  await fetch(`https://res.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    body: new URLSearchParams({
      public_id: publicId,
      signature,
      api_key: apiKey,
      timestamp: String(timestamp),
    }),
  }).catch(() => {
    // El asset huérfano lo limpia la Tarea 21.
  });
};