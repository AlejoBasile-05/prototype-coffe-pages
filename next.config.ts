import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * Loader de Cloudinary global (Tarea 10): `next/image` es un Client
     * Component y NO puede recibir una función `loader` desde un Server
     * Component. Con `loaderFile` el loader se aplica por configuración y
     * sirve para las imágenes renderizadas en servidor y en cliente.
     * El propio loader hace pass-through de URLs ajenas a Cloudinary.
     */
    loader: "custom",
    loaderFile: "./src/lib/images/cloudinary-loader.ts",

    /**
     * ⛔ Lista explícita de hosts. SVG nunca habilitado en el optimizador
     *    (el flag de Next que lo permite queda prohibido por diseño, y
     *    greppeado en CI por la Tarea 19) ni comodín de dominio: cada host
     *    que se agrega es una superficie abierta del optimizador de
     *    imágenes. Cloudinary es el único origen de imágenes del proyecto
     *    (la nube propia y la `demo` del seed comparten el host y se
     *    distinguen por el path).
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],

    /**
     * AVIF primero: ~30% menos de peso que WebP a calidad equivalente.
     * `next/image` decide por el `Accept` del navegador.
     */
    formats: ["image/avif", "image/webp"],

    /**
     * 1 hora: las fotos de producto no cambian seguido y un TTL mayor
     * invalidaría el cacheo de Cloudinary en cada cambio de precio.
     */
    minimumCacheTTL: 3600,
  },

  /**
   * ⛔ `/_next/static` NO pasa por `src/proxy.ts`: el matcher excluye los
   *    assets estáticos a propósito (no hay sesión que refrescar ahí y el
   *    proxy es una función por request). Por eso `nosniff` se declara acá:
   *    un `.js` de la build servido como `text/plain` o con un MIME adivinado
   *    es la base de los ataques de XSS vía chain de scripts.
   *
   * ⚠️ Sólo `nosniff`, y a propósito: la CSP y el resto de los headers los
   *    manda el proxy, que los ve por ruta. Duplicarlos acá produce dos
   *    cabeceras iguales en la respuesta y una que gana sin que se sepa cuál.
   */
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
  },
};

export default nextConfig;
