/**
 * Imagen de producto (Server Component).
 *
 * Envuelve `next/image`; el loader de Cloudinary se aplica por
 * configuración global (`images.loaderFile` en `next.config.ts`), porque
 * un Server Component no puede pasar una función a un Client Component.
 * La entrega optimizada (f_auto, q_auto, dpr_auto) la resuelve Cloudinary, no el optimizador
 * de Next. El `sizes` es obligatorio: sin él `next/image` asume el
 * viewport más ancho y descarga hasta cinco veces lo necesario.
 *
 * El estado agotado se comunica también en la imagen (desaturada) pero
 * SIEMPRE acompañado del badge con texto: el color no es el único
 * portador del significado.
 */
import Image from "next/image";

import { joinClasses } from "@/lib/ui/classes";

interface ProductImageProps {
  src: string;
  /** La card es un enlace informativo: el alt no puede ser vacío. */
  alt: string;
  available: boolean;
  sizes: string;
  priority?: boolean;
}

export function ProductImage({ src, alt, available, sizes, priority = false }: ProductImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      fetchPriority={priority ? "high" : "auto"}
      className={joinClasses(
        "object-cover transition-transform duration-300 motion-safe:group-hover:scale-105",
        !available && "opacity-60 grayscale",
      )}
    />
  );
}
