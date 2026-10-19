/**
 * Loader isomórfico de `next/image` para Cloudinary.
 *
 * Existe porque `buildCloudinaryImageUrl` (Tarea 06) vive en la capa de
 * servicio con `server-only` y lee `process.env`: no puede ejecutarse en
 * el navegador, que es donde corre un `ImageLoader`. En cambio de portar
 * esa función, el loader reescribe la URL de entrega ya guardada en
 * `products.imageUrl` insertando las transformaciones de entrega.
 *
 * Dos reglas que importan:
 *
 * · **Pass-through:** una URL que no es una entrega de Cloudinary (sin
 *   `/upload/`) se devuelve intacta. Insertar transformaciones en un
 *   host ajeno produce un 404 silencioso.
 *
 * · **Equivalencia contractual:** la receta de transformaciones es la
 *   MISMA y en el MISMO orden que `image-url.service.ts`
 *   (`f_auto,q_auto,dpr_auto,c_fill,g_auto,w_*`). El test
 *   `cloudinary-loader.test.ts` compara contra el helper de servidor:
 *   si la Tarea 06 cambia la receta, este loader falla el test en vez
 *   de servir imágenes deformadas en producción.
 *
 * ⛔ Una URL ya transformada NO se devuelve intacta: el contrato de
 *    `next/image` exige que el loader produzca el recurso para el
 *    `width` pedido, así que el segmento de transformación existente
 *    (p. ej. el `w_1200` fijo de las imágenes semilla) se REEMPLAZA por
 *    la receta canónica con el ancho solicitado.
 */
import type { ImageLoaderProps } from "next/image";

/** Marca de una URL de entrega de Cloudinary. */
const DELIVERY_MARKER = "/upload/";

/**
 * Un segmento de Cloudinary es de transformación si empieza en minúscula
 * y su primera clave es una operación conocida (misma regla que usa
 * `image-url.service.ts` al parsear: si el helper cambia el criterio,
 * este también tiene que cambiar).
 */
const TRANSFORM_SEGMENT = /^[a-z][^/]*(?:f_|q_|c_|g_|w_|h_|dpr_|e_)/;

const buildTransformSegment = (width: number): string =>
  ["f_auto", "q_auto", "dpr_auto", "c_fill", "g_auto", `w_${Math.round(width)}`].join(",");

/**
 * Reescribe `src` pidiendo la transformación a Cloudinary para el ancho
 * `width` que `next/image` calculó a partir de `sizes`.
 *
 * Forma resultante:
 * `https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,dpr_auto,c_fill,g_auto,w_<width>/<public_id>`
 */
export function buildCloudinaryLoaderUrl(src: string, width: number): string {
  const indice = src.indexOf(DELIVERY_MARKER);
  if (indice === -1) return src;

  const prefixo = src.slice(0, indice + DELIVERY_MARKER.length);
  const segmentos = src.slice(indice + DELIVERY_MARKER.length).split("/");

  if (TRANSFORM_SEGMENT.test(segmentos[0] ?? "")) {
    segmentos[0] = buildTransformSegment(width);
  } else {
    segmentos.unshift(buildTransformSegment(width));
  }

  return prefixo + segmentos.join("/");
}

export default function cloudinaryLoader({ src, width }: ImageLoaderProps): string {
  return buildCloudinaryLoaderUrl(src, width);
}
