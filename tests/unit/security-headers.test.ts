import { describe, expect, it } from "vitest";

import { construirCsp, construirHeaders } from "@/server/infra/security-headers";

/**
 * Los headers del proxy (Tarea 19 §6.3).
 *
 * ⛔ La CSP va en modo REPORT-ONLY a propósito y esto es una decisión, no
 *    una deuda consciente: bloqueante rompe la aplicación entera en el primer
 *    `script-src` mal calculado (un inline de un tercero, un blob de un
 *    worker) y un sitio caído no es un sitio seguro. Report-only deja
 *    acumularse los reportes reales antes de activar el bloqueo; el
 *    endpoint que los recibe es la Tarea 21.
 */
describe("construirHeaders", () => {
  const enProduccion = construirHeaders({
    isProduction: true,
    siteUrl: "https://modomiga.com.ar",
  });
  const enPrevia = construirHeaders({ isProduction: false, siteUrl: "" });

  it("manda los seis headers de §6.3 en producción", () => {
    expect(Object.keys(enProduccion).sort()).toEqual([
      "Content-Security-Policy-Report-Only",
      "Permissions-Policy",
      "Referrer-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
    ]);
  });

  it("los valores son los de la tabla de §6.3, no aproximaciones", () => {
    expect(enProduccion["X-Content-Type-Options"]).toBe("nosniff");
    expect(enProduccion["X-Frame-Options"]).toBe("DENY");
    expect(enProduccion["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(enProduccion["Permissions-Policy"]).toBe(
      "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    );
    expect(enProduccion["Strict-Transport-Security"]).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
  });

  it("la CSP va en Report-Only, nunca en modo bloqueante", () => {
    expect(enProduccion).not.toHaveProperty("Content-Security-Policy");
    expect(enProduccion["Content-Security-Policy-Report-Only"]).toContain("default-src 'self'");
  });

  it("la CSP permite Supabase por HTTPS y por WebSocket", () => {
    const csp = construirCsp();

    // ⛔ Sin `wss://` el panel se conecta y nunca recibe el evento de
    //    disponibilidad: es el fallo de la Tarea 15 que más cuesta
    //    diagnosticar porque no lanza ningún error.
    expect(csp).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co");
  });

  it("la CSP no habilita `unsafe-eval`", () => {
    // `unsafe-eval` con report-only no rompe nada hoy, pero dejarla escrita
    // hace que activarla el día de mañana sea un detalle más de la lista.
    expect(construirCsp()).not.toContain("unsafe-eval");
  });

  it("sin HSTS en desarrollo ni en previa: es la única condición que lo separa", () => {
    // ⛔ Un HSTS servido sobre http://localhost queda cacheado y el
    //    navegador empieza a rechazar el http. Es la forma más rápida de
    //    romper el desarrollo de todo el equipo.
    expect(enPrevia).not.toHaveProperty("Strict-Transport-Security");
  });

  it("en producción sin `siteUrl` no manda HSTS", () => {
    const sinUrl = construirHeaders({ isProduction: true, siteUrl: "" });

    // Sin el dominio no hay un HSTS que valga, y mandarlo igual es peor
    // que no mandarlo: el `includeSubDomains` affecta al dominio entero.
    expect(sinUrl).not.toHaveProperty("Strict-Transport-Security");
  });
});