import { ImageResponse } from "next/og";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/config/seo";
import { SITE_NAME } from "@/config/site";

export const alt = `${SITE_NAME} · Sándwiches de miga en San Rafael`;
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = "image/png";

/**
 * Imagen de Open Graph **de respaldo** del sitio.
 *
 * ⛔ No hay un archivo equivalente en `producto/[slug]/`: la foto del
 *    producto va en `generateMetadata` como URL de Cloudinary, que es una
 *    URL estática que cualquier crawler puede pedir sin tocar nuestro
 *    servidor. Este archivo cubre la home y `/menu`, que no tienen foto
 *    propia (§2.6).
 *
 * ⛔ Sin fuentes externas: `next/og` trae la suya. Pedir una por la red
 *    hace que la imagen falle si el CDN está caído, y el preview de un
 *    link es justo lo que no puede fallar.
 *
 * ⛔ Los colores están como literales: `next/og` renderiza fuera del
 *    navegador y no lee `var(--color-crust)`. Es la única excepción del
 *    proyecto a "los colores vienen de los tokens".
 */
export default function OgImage(): unknown {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        backgroundColor: "#FAF6F0",
        color: "#241611",
        padding: 60,
      }}
    >
      <div style={{ color: "#B85C38", fontSize: 36, letterSpacing: 1 }}>San Rafael · Mendoza</div>
      <div style={{ fontSize: 96, fontWeight: 700, marginTop: 24 }}>{SITE_NAME}</div>
      <div style={{ color: "#5C7A5E", fontSize: 44, marginTop: 24 }}>
        Sándwiches de miga, todos los días
      </div>
    </div>,
    { ...size },
  );
}
