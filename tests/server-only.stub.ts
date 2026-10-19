/**
 * Stub de `server-only` para Vitest.
 *
 * El paquete real lanza en su `index.js` apenas se importa fuera del
 * condicional `react-server` (que solo aplica el bundler de Next.js).
 * Vitest resolvería ese entry y rompería los tests de cualquier módulo
 * `server-only`. La protección de la frontera se verifica en build
 * (`vercel/next build` sí falla si este código viaja al cliente);
 * este stub solo desactiva el explosivo durante los tests.
 *
 * Referenciado desde `vitest.config.ts` → resolve.alias.
 */
export {};
