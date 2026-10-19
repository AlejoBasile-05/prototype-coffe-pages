/**
 * Reglas puras de validación de imágenes (capa 0).
 *
 * No hay I/O acá: ni `fetch`, ni `process.env`, ni Prisma. Por eso estas
 * funciones se testean sin levantar nada y por eso este archivo **no**
 * lleva `server-only` (partición de la Tarea 06 §6.4.1).
 *
 * Hay dos validaciones, y las dos importan por separado:
 *
 *   1. `validateImageFile` — sobre el `File` del navegador. ADVISORIA:
 *      evita subir 20 MB para que el servidor los rechace, pero el
 *      `file.type` lo declara el navegador y puede mentir.
 *   2. `assertUploadedImageIsUsable` — sobre los metadatos que Cloudinary
 *      reportó de los bytes reales. Es la AUTORITATIVA.
 */
import { ValidationError } from "@/lib/domain";

/** Tope del archivo. 6 MB es holgado para una foto de teléfono. */
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/**
 * Lado mayor mínimo, en píxeles.
 *
 * El catálogo muestra tarjetas de hasta 800 px de ancho y la ficha de
 * producto hasta 1200. Menos de 1200 del lado mayor se ve borroso en
 * pantallas grandes, y `c_fill,g_auto` no inventa detalle que no está.
 */
export const MIN_IMAGE_SIDE = 1200;

/**
 * ⛔ ALLOWLIST, no blacklist (Tarea 19 §2.9). Cloudinary acepta `mp4`,
 *    `mov`, `pdf`, `psd`, `tiff`, `heic` y formatos RAW de cámara si no se
 *    los limita: un `.psd` de 200 MB en la misma cuenta que las fotos de
 *    producto es un costo y un vector. Estos cuatro son los que el
 *    optimizador y el `next/image` del proyecto saben mostrar.
 *
 * 📍 Vive en capa 0 y no en `server/infra/cloudinary.ts` a propósito. La
 *    lista del proveedor tiene `import "server-only"`, así que cuando
 *    estaba ahí, la validación del navegador no podía verla: las dos
 *    listas se apartaron sin que ninguna pragma gritara. Una lista
 *    compartida que ninguna de las dos capas puede leer no es una
 *    garantía, es una coincidencia.
 */
export const ALLOWED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp"] as const;

export type AllowedImageFormat = (typeof ALLOWED_IMAGE_FORMATS)[number];

/**
 * MIME aceptados en la frontera del navegador.
 *
 * ⛔ `image/svg+xml` NO está y no se agrega. Un SVG es código que el
 *    navegador ejecuta. Aunque se sirva desde `res.cloudinary.com` (otro
 *    origen, sin nuestras cookies), un SVG con `<script>` o
 *    `<foreignObject>` sigue siendo un vector si alguien lo abre directo.
 *    No hay ganancia real: las fotos del catálogo son raster.
 *
 * ⛔ AVIF tampoco está. Se acepta acá lo que Cloudinary tiene permitido en
 *    `allowed_formats`, que es lo que va firmado: si el navegador dejara
 *    pasar un `.avif`, la validación_ADMINISTRATIVA lo aprobaría, la
 *    subida llegaría al proveedor y Cloudinary la rechazaría con un `400`
 *    opaco en vez de un mensaje que diga "esa imagen no va". El `accept`
 *    del campo de producto ya era `jpeg,png,webp`: esta lista era el
 *    único lado que se había apartado del contrato.
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

const isAllowedMimeType = (mimeType: string): mimeType is AllowedImageMimeType =>
  (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);

/** Nombres de formato que Cloudinary usa en `allowed_formats`. */
export const ALLOWED_IMAGE_FORMATS_CSV = ALLOWED_IMAGE_FORMATS.join(",");

/**
 * Metadatos de una imagen ya subida, tal como los ve el servicio.
 * No es el tipo de la infra de Cloudinary a propósito: la capa 0 no
 * depende de la capa 4. El servicio lo arma desde el resultado HTTP.
 */
export interface ImagenSubidaMetadata {
  readonly format: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

/**
 * Chequeo previo, sobre el `File` del navegador.
 *
 * ⚠️ ADVISORIO. `file.type` puede mentir (un `.svg` renombrado a `.jpg`
 *    se anuncia como `image/jpeg`). La que decide es
 *    `assertUploadedImageIsUsable`. Esta función solo evita subir un
 *    archivo que ya sabemos que no va a pasar.
 */
export const validateImageFile = (file: File): void => {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ValidationError(
      { file: [`La imagen supera el máximo de ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`] },
      "La imagen es demasiado pesada",
    );
  }

  // Defensa explícita además de la lista: deja escrito en el código que
  // SVG está descartado a propósito, no por olvido.
  if (file.type === "image/svg+xml" || file.type.endsWith("+xml")) {
    throw new ValidationError({ file: ["SVG no se admite. Subí una foto JPG, PNG o WebP."] });
  }

  if (!isAllowedMimeType(file.type)) {
    throw new ValidationError(
      { file: ["Formato no admitido. Usá JPG, PNG o WebP."] },
      "Formato de imagen no admitido",
    );
  }

  if (file.size === 0) {
    throw new ValidationError({ file: ["El archivo está vacío."] });
  }
};

/**
 * Chequeo autoritativo, sobre lo que el proveedor dice de los bytes reales.
 *
 * ⚠️ Se llama "autoritativa" porque ve los bytes, no porque sea la única
 *    que decide: `allowed_formats` ya bloquea en la API. Esta es la
 *    segunda red, y existe para que el rechazo llegue como un mensaje de
 *    formulario en vez de como un error del proveedor.
 */
export const assertUploadedImageIsUsable = (meta: ImagenSubidaMetadata): void => {
  if (meta.format === "svg" || meta.format.endsWith("+xml")) {
    throw new ValidationError(
      { file: ["El archivo es un SVG, no una foto. No se admite."] },
      "Formato de imagen no admitido",
    );
  }

  if (!(ALLOWED_IMAGE_FORMATS as readonly string[]).includes(meta.format)) {
    throw new ValidationError(
      { file: [`Cloudinary devolvió el formato "${meta.format}", que no está en la lista de formatos admitidos.`] },
      "Formato de imagen no admitido",
    );
  }

  if (Math.max(meta.width, meta.height) < MIN_IMAGE_SIDE) {
    throw new ValidationError(
      {
        file: [
          `La imagen mide ${meta.width}x${meta.height}px. Necesita al menos ${MIN_IMAGE_SIDE}px del lado mayor.`,
        ],
      },
      "La imagen es muy chica",
    );
  }

  if (meta.bytes > MAX_IMAGE_BYTES) {
    throw new ValidationError({ file: ["La imagen supera el máximo permitido."] });
  }
};
