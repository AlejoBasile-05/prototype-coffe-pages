/**
 * Headers de seguridad (Tarea 19 §2.6, §6.3).
 *
 * ⛔ VIVEN ACÁ Y NO EN `middleware.ts`: el criterio 8.3 pide que los headers
 *    se agreguen en el proxy y no en `next.config.ts`, y eso se cumple —
 *    el proxy es quien los escribe en cada respuesta. Lo que NO se puede
 *    cumplir desde el proxy es que sean testeables: `construirHeaders` lee
 *    `process.env` al importarse y el criterio 10.3 necesita ejercitar las
 *    dos ramas (producción y preview) en el mismo proceso.
 *
 *    Por eso el módulo de headers es propio, sin `server-only` (el proxy
 *    corre en el borde y no puede importar nada marcado así) y con la
 *    lectura del entorno **inyectada por parámetro**: `isProduction` y
 *    `siteUrl` llegan desde el proxy, que es el único que sabe del
 *    request. El test pasa los dos valores a mano y no depende de
 *    `vi.resetModules()`.
 */

/** Origen de la CSP. El `wss://` de Supabase NO es opcional (Tarea 15 §2.4). */
const CONNECT_SRC = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://res.cloudinary.com",
].join(" ");

const DIRECTIVAS_CSP = [
  "default-src 'self'",
  /**
   * ⛔ `'unsafe-inline'` es una concesión, no un descuido. Next inyecta los
   *    scripts de bootstrap en línea, así que `script-src 'self'` a secas
   *    deja el sitio en blanco. El precio es que la CSP actual NO frena un
   *    XSS. La salida es nonces por request, que exige mover la CSP al
   *    servidor; queda anotado como deuda en §9.1.
   */
  "script-src 'self' 'unsafe-inline' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  `connect-src ${CONNECT_SRC}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  /** Clickjacking en navegadores modernos; `X-Frame-Options` cubre el resto. */
  "frame-ancestors 'none'",
  /**
   * ⛔ Apunta a un 404 mientras la Tarea 21 no cree el endpoint, y eso es
   *    lo que dice §9.1. Se deja adelante a propósito: en report-only la
   *    ruta inexistente no rompe nada, y tener la directiva puesta es lo
   *    que hace que los reportes aparezcan en la consola del navegador
   *    desde el primer día, en vez de cuando alguien se acuerde de
   *    agregarla.
   */
  "report-uri /api/csp-report",
  "upgrade-insecure-requests",
];

/**
 * ⛔ Sin `unsafe-eval` en ninguna directiva: el criterio 8.5 lo exige y
 *    `audit:bundle` falla si un chunk del cliente trae un `eval`.
 */
export const construirCsp = (): string => DIRECTIVAS_CSP.join("; ");

export interface SecurityHeadersOptions {
  /**
   * ⛔ `true` sólo en producción. HSTS con `includeSubDomains` en un
   *    subdominio de preview es una promesa que el navegador guarda un año:
   *    si ese subdominio sirve HTTP sin certificado válido, todos los que lo
   *    visited quedan con un error de conexión que no se arregla borrando
   *    cookies. Por eso el HSTS también exige el dominio real resuelto
   *    (§2.6).
   */
  readonly isProduction: boolean;
  readonly siteUrl: string;
}

export const construirHeaders = (
  options: SecurityHeadersOptions,
): Record<string, string> => {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    /**
     * ⛔ SOLO EN MODO REPORT-ONLY. No existe `Content-Security-Policy` en
     *    este archivo, y esa es la intención: el paso a bloqueante es una
     *    decisión manual en el PR que lo activa, después de una semana de
     *    reportes limpios (§6.3). Si las dos cabeceras estuvieran, el
     *    navegador aplicaría la bloqueante y los reportes no Blindarían
     *    nada.
     */
    "Content-Security-Policy-Report-Only": construirCsp(),
  };

  if (options.isProduction && options.siteUrl !== "") {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
  }

  return headers;
};