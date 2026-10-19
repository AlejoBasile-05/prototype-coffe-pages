import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * Frontera de capas N (ver DESIGN.md §4 y docs/tasks/01 §6.3).
 *
 * Estas reglas dan feedback temprano en el editor y en `npm run lint`.
 * La GARANTÍA DURA de que la capa de servidor no viaja al cliente es
 * `import "server-only"`, que hace fallar `npm run build`.
 */

/**
 * Única excepción a la frontera cliente↔servidor: los módulos marcados
 * con `"use server"` (Server Actions). Next los compila como referencias
 * RPC en el bundle del cliente, nunca como código de servidor real.
 * Es exactamente el patrón que el mensaje de abajo recomienda cuando un
 * Client Component necesita cruzar la frontera.
 *
 * El regex negativo es deliberado: permite solo los entrypoints de acción
 * (`@/server/actions/**`, `@/server/auth/actions`, y cualquier
 * `@/server/**\/actions`) y sigue bloqueando `infra`, `repositories`,
 * `services` y demás código de servidor.
 */
const SERVIDOR_INTERNO_REGEX = "^@/server(?!/actions(?:/|$)|/auth/actions$|/.*/actions(?:\\.|$))";

/**
 * Segunda excepción, acotada a `src/hooks/**` (Tarea 15): el cliente de
 * navegador de Supabase vive físicamente en `src/server/infra/supabase/`,
 * pero su contrato es exclusivo del navegador — está marcado `"use client"`,
 * solo exporta `NEXT_PUBLIC_*` y su único uso es la suscripción Realtime.
 * Moverlo a otra capa solo por el nombre de la carpeta obligaría a
 * cortar el árbol de dominios en un punto artificial.
 *
 * El regex sigue bloqueando TODO lo demás del servidor: ` repositories`,
 * `services`, `server.ts`, `admin.ts` y el resto de `infra/`.
 */
const SERVIDOR_INTERNO_EXCEPTO_REALTIME =
  "^@/server(?!/actions(?:/|$)|/auth/actions$|/.*/actions(?:\\.|$)|/infra/supabase/client$)";

/** Capa de acceso a datos: únicamente servicios e infra conocen Prisma y Supabase. */
const ACCESO_A_DATOS = [
  "@/server/repositories/*",
  "@/server/repositories/**",
  "@/server/infra/*",
  "@/server/infra/**",
];

/**
 * Herramientas de infraestructura prohibidas fuera de la capa de datos.
 *
 * Los patrones van ANCLADOS con `/` inicial (semántica gitignore) a propósito.
 * Sin anclar, un patrón como `"prisma"` matchea CUALQUIER specifier que
 * termine en ese segmento, incluido nuestro propio `@/server/infra/prisma`.
 * Eso producía dos falsos positivos: la regla de rutas señalaba el singleton
 * que justamente debe usar, y la excepción de la sonda de salud era
 * imposible de escribir. Anclado, el patrón solo matchea el paquete real.
 */
const ORM_Y_TOOLING = ["/@prisma/client", "/@prisma/*", "/prisma", "/prisma/*"];

const PROHIBIDO_EN_CLIENTE =
  "⛔ Capa de Presentación: los Client Components no pueden importar código de servidor. " +
  "Usá una Server Action (src/server/actions) o un Route Handler (src/app/api) para cruzar la frontera.";

const PROHIBIDO_EN_RUTAS =
  "⛔ Las rutas y Server Actions deben consumir la CAPA DE SERVICIO (src/server/services), " +
  "no la capa de acceso a datos directamente. Encapsulá la consulta en un servicio.";

const PROHIBIDO_EN_SERVICIOS =
  "⛔ La capa de Servicio no depende del framework de presentación. " +
  "Extraé la lógica a un módulo puro en src/lib o tipala como parámetro de entrada.";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "node_modules/**",
    "next-env.d.ts",
    "public/**",
    /* Código vendor de Arc UI (uiarc.dev): se instala con el CLI de
       shadcn y no se edita a mano. Lint y typecheck estricto solo
       aplican al código propio; los arc/*.tsx llevan @ts-nocheck. */
    "src/components/arc/**",
  ]),

  /* ── CAPA 1 · Presentación: componentes reutilizables y estado de cliente ── */
  {
    name: "capas/presentacion",
    files: ["src/components/**/*.{ts,tsx}", "src/store/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: SERVIDOR_INTERNO_REGEX, message: PROHIBIDO_EN_CLIENTE },
            { group: ORM_Y_TOOLING, message: PROHIBIDO_EN_CLIENTE },
            {
              group: ["../../server/*", "../server/*"],
              message:
                "Usá el alias '@/server/*' en lugar de rutas relativas: hace auditable la frontera de capas.",
            },
          ],
        },
      ],
    },
  },

  /* ── CAPA 1 · Hooks: mismas fronteras + excepción Realtime documentada ── */
  {
    name: "capas/hooks",
    files: ["src/hooks/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: SERVIDOR_INTERNO_EXCEPTO_REALTIME, message: PROHIBIDO_EN_CLIENTE },
            { group: ORM_Y_TOOLING, message: PROHIBIDO_EN_CLIENTE },
            {
              group: ["../../server/*", "../server/*"],
              message:
                "Usá el alias '@/server/*' en lugar de rutas relativas: hace auditable la frontera de capas.",
            },
          ],
        },
      ],
    },
  },

  /* ── CAPA 1/2 · Rutas: pueden usar servicios, NO acceso a datos ── */
  {
    name: "capas/rutas",
    files: ["src/app/**/*.{ts,tsx}"],
    ignores: ["src/app/api/health/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ACCESO_A_DATOS, message: PROHIBIDO_EN_RUTAS },
            { group: ORM_Y_TOOLING, message: PROHIBIDO_EN_RUTAS },
          ],
        },
      ],
    },
  },

  /* ── Excepción acotada: la sonda de salud de la base de datos ──
   *
   * `/api/health` es infraestructura, no una ruta de negocio: verifica que
   * la conexión vive. No tiene servicio que la encapsule — meterla en uno
   * obligaría a inventar lógica cuyo único propósito sería poder llamar a
   * Prisma — y no lee ni escribe datos del negocio.
   *
   * La excepción es EXCLUSIVA de este archivo. Cualquier otra ruta que
   * necesite tocar `src/server/infra/**` debe hablar con la CAPA DE SERVICIO. */
  {
    name: "excepcion/sonda-de-salud",
    files: ["src/app/api/health/route.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ORM_Y_TOOLING, message: PROHIBIDO_EN_RUTAS },
            {
              group: ["@/server/repositories/*", "@/server/repositories/**"],
              message: PROHIBIDO_EN_RUTAS,
            },
          ],
        },
      ],
    },
  },

  /* ── CAPA 3 · Servicios: no conocen React ni Next ── */
  {
    name: "capas/servicios",
    files: ["src/server/services/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // `next/cache` está permitido: el ISR con `unstable_cache`
              // solo funciona en la capa de servicio (Tarea 08 §4.5) y no
              // hay una alternativa en otra capa que no rompa la arquitectura.
              regex: "^react$|^react/|^next/(?!cache$)|^@/app/|^@/components/|^@/server/actions/",
              message: PROHIBIDO_EN_SERVICIOS + " (Excepción única: `next/cache`.)",
            },
          ],
        },
      ],
    },
  },
]);
