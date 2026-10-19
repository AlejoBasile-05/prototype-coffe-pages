/**
 * Constructor de la URL de entrega optimizada de Cloudinary.
 *
 * Archivo separado de `image.service.ts` para que ninguno de los dos
 * supere el límite de 150 líneas de los servicios (Tarea 06 §5/§6.4.1).
 * El contrato de importación se mantiene por el re-export del servicio.
 *
 * Lee `process.env.CLOUDINARY_CLOUD_NAME`, así que no es una función
 * pura de `src/lib/`: vive en la capa de servicio a propósito.
 */
import "server-only";

/**
 * Transformaciones aplicadas en la entrega.
 *
 * · `f_auto` — WebP o AVIF según lo que entienda el navegador.
 * · `q_auto` — calidad según el contenido de la imagen.
 * · `dpr_auto` — sube la resolución en pantallas densas sin servir el
 *   doble de píxeles a teléfonos viejos.
 * · `c_fill,g_auto` — recorta alrededor del sujeto detectado, no del
 *   centro geométrico (que cortaría el sándwich a la mitad).
 */
export interface ImageTransform {
  readonly width: number;
  readonly height?: number;
  readonly quality?: "auto" | "auto:best" | "auto:good" | number;
  readonly format?: "auto" | "webp" | "avif" | "jpg";
}

/**
 * Construye la URL optimizada de una imagen.
 *
 * Acepta las dos formas que existen en el sistema: un `public_id` plano
 * o una URL de entrega de Cloudinary ya guardada en `products.imageUrl`.
 * La segunda forma existe porque la Tarea 05 siembra URLs de la nube
 * `demo` con `imagePublicId = null`; si el helper solo aceptara el id,
 * el catálogo de desarrollo se caería entero. Una URL que NO es de
 * Cloudinary se devuelve intacta: no se inventa un proxy para un host
 * ajeno.
 */
export const buildCloudinaryImageUrl = (
  publicIdOrUrl: string,
  transform: ImageTransform,
): string => {
  const cloudName = process.env["CLOUDINARY_CLOUD_NAME"];
  if (cloudName === undefined || cloudName === "") {
    throw new Error("Falta CLOUDINARY_CLOUD_NAME en el entorno.");
  }

  const source = extractDeliverySource(publicIdOrUrl, cloudName);
  if (source === null) return publicIdOrUrl;

  const params = [
    `f_${transform.format ?? "auto"}`,
    `q_${transform.quality ?? "auto"}`,
    "dpr_auto",
    "c_fill",
    "g_auto",
    `w_${transform.width}`,
    ...(transform.height === undefined ? [] : [`h_${transform.height}`]),
  ].join(",");

  return `https://res.cloudinary.com/${cloudName}/image/upload/${params}/${source}`;
};

/**
 * Saca el `public_id` de una URL de entrega de Cloudinary, o `null` si la
 * URL no es de Cloudinary. Si la URL no trae transformaciones, el primer
 * segmento ya es el `public_id` completo.
 */
const extractDeliverySource = (value: string, cloudName: string): string | null => {
  if (!value.startsWith("http")) return value;

  const marcador = `/${cloudName}/image/upload/`;
  const indice = value.indexOf(marcador);
  if (indice === -1) return null;

  const resto = value.slice(indice + marcador.length);
  const [transformaciones, ...restoDelId] = resto.split("/");
  const publicId = restoDelId.join("/");

  const esSegmentoDeTransformacion = (segmento: string): boolean =>
    /^[a-z]/.test(segmento) && /^(?:f_|q_|c_|g_|w_|h_|dpr_|e_)/.test(segmento);

  return esSegmentoDeTransformacion(transformaciones ?? "") && publicId.length > 0
    ? publicId
    : resto;
};
