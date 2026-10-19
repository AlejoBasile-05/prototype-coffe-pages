import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, type ViteUserConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  // `server-only` lanza al importarse fuera del bundler de Next.js.
  // En Vitest se reemplaza por un no-op (ver tests/server-only.stub.ts).
  "server-only": fileURLToPath(new URL("./tests/server-only.stub.ts", import.meta.url)),
};

/**
 * Un proyecto declarado en línea NO hereda `plugins` ni `resolve` de la
 * raíz: Vitest los resuelve por proyecto, no por cascada. Por eso el
 * plugin de React, el alias `@/` y el stub de `server-only` se comparten
 * explícitamente en cada proyecto.
 */
const shared: ViteUserConfig = {
  plugins: [react()],
  resolve: { alias },
};

export default defineConfig({
  test: {
    // Sin `globals: true`: los 50 archivos de test importan de `vitest` de
    // forma explícita. Un global implícito es un global que nadie lee en el
    // import y que Rompe el editor de quien agreeable.
    projects: [
      {
        ...shared,
        // Dominio, utilidades, repositorios con puertos inyectados y
        // actions: nada de esto toca la base ni el DOM.
        test: {
          name: "unit",
          environment: "node",
          // ⛔ La unión de las dos rutas. `tests/unit/**` es donde vive la
          //    lógica pura y `src/**` lo que queda de tests colocados; los
          //    `.component.test.tsx` los toma el proyecto `ui`. Ver Tarea 20
          //    §2.3, conflicto 1.
          include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
          exclude: ["src/**/*.component.test.tsx"],
          /**
           * ⛔ SIN `setupFiles`. Un test de lógica pura no abre una
           *    conexión a Postgres para no usarla, y por eso este proyecto
           *    corre en CI sin un solo secreto. Ver Tarea 20 §2.3,
           *    conflicto 3, y §6.4.
           */
        },
      },
      {
        ...shared,
        // Repositorios y servicios contra una base REAL y AISLADA (la de
        // Docker local, vía TEST_DATABASE_URL, o la efímera de CI). Un mock
        // de Prisma verificaría que el código se llama como se escribió, no
        // que funcione (Tarea 04 §10). La base de desarrollo/demo queda
        // protegida por la guarda de tests/setup-entorno.ts.
        test: {
          name: "integracion",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          /**
           * Carga `.env.local` en `process.env` y falla al arrancar si
           * falta `DATABASE_URL`. `tests/setup.ts` NO va acá: expone
           * `resetDatabase`, que se importa como módulo desde cada test.
           */
          setupFiles: ["./tests/setup-entorno.ts"],
          /**
           * ⛔ Una sola base compartida y `TRUNCATE` en `beforeEach`: los
           *    archivos corren de a uno. En paralelo se borran la base
           *    mutuamente y el fallo se reporta como un `expect` que no
           *    cuadra, cuando el problema es el aislamiento. Ver Tarea 20
           *    §4.4.
           */
          fileParallelism: false,
          maxWorkers: 1,
          testTimeout: 20_000,
        },
      },
      {
        ...shared,
        // Componentes: DOM, cleanup y stubs de matchMedia/scrollTo.
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.component.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",

      /**
       * ⛔ Sólo estas dos carpetas se miden. Ver Tarea 20 §2.3, conflicto 2.
       *
       * Lo que queda afuera, y por qué:
       *  - `src/components/**` y `src/app/**`: presentación. Ya probada
       *    por la Tarea 09 con `.component.test.tsx`; medirla infla el
       *    número y baja el umbral real del módulo crítico.
       *  - `src/server/repositories/**`: no se puede probar sin base, y los
       *    tests de integración lo hacen. Incluirlo ataría el umbral a que
       *    la base esté levantada.
       *  - `src/server/infra/**`: conexión, singletons y firma de
       *    credenciales. No tienen lógica de negocio que testear.
       *  - `src/server/repositories/mappers/`: viven bajo `repositories`,
       *    que ya está afuera. Dejar la exclusión puesta sería una línea
       *    que no hace nada y que el próximo lee como si hiciera.
       */
      include: ["src/lib/**/*.ts", "src/server/services/**/*.ts"],
      exclude: ["**/*.d.ts", "**/index.ts", "**/*.config.*", "**/schemas/**"],

      /**
       * ⛔ `perFile: false` a propósito.
       *
       * Con `perFile: true`, un archivo de ocho líneas con cuatro
       * ramificaciones no alcanzaría 80% y el pipeline fallaría por un
       * archivo que nadie va a leer. El umbral es del conjunto: mide si el
       * módulo crítico está cubierto, no si cada helper tiene su test.
       *
       * ⛔ El 80 es un piso, no un objetivo. Si el número queda debajo, NO
       *    se baja el umbral: se escribe el test que falta. Ver Tarea 20
       *    §6.3.
       */
      thresholds: {
        lines: 80,
        functions: 85,
        branches: 80,
        statements: 80,
        perFile: false,
      },
    },
  },
});
