# Tarea 01 — Bootstrap, Tooling y Frontera de Capas

| Campo | Valor |
|---|---|
| **ID** | 01 |
| **Fase (DESIGN.md §8.3)** | Fase 1 — Cimientos y Modelado |
| **Depende de** | — (arranque del proyecto) |
| **Habilita** | 02, 04, 06, 07, 08, 09 |
| **Tipo** | Infraestructura / scaffolding — sin lógica de negocio |
| **Esfuerzo est.** | 0.5 – 1 día |

---

## 1. Objetivo de la tarea

Dejar el proyecto Next.js inicializado, con **tipado estricto activo**, **las Quality Gates ejecutables** y, sobre todo, con la **frontera de la arquitectura N-capas ya impuesta por el compilador**.

Esta tarea no entrega funcionalidad visible al usuario. Entrega la **infraestructura que hace imposibles las jerarquías de dependencia incorrectas** en las 22 tareas siguientes. Si se saltea, cada tarea posterior tendrá que repetir el mismo trabajo de disciplina arquitectónica.

**Criterio de éxito verificable:** un Client Component que importe un módulo de la capa de servidor **falla el build de producción**, no la revisión de código.

---

## 2. Contexto y dependencias

No requiere tareas previas. Es el punto de entrada del proyecto.

**Prerrequisitos de entorno (verificar antes de empezar):**

- [ ] Node.js 22 LTS instalado (`node -v` ≥ 20.9)
- [ ] Git instalado y con `user.name` / `user.email` configurados
- [ ] Directorio de trabajo con `DESIGN.md` presente
- [ ] Acceso de lectura a la documentación de Next.js 15 (App Router)

> **Nota sobre el directorio no vacío:** el proyecto ya contiene `DESIGN.md`, y `create-next-app` falla sobre directorios con archivos en conflicto. Ver §6.1 para la secuencia exacta.

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `docs/tasks/README.md` | Índice de tareas y su grafo de dependencias |
| `src/lib/domain/errors.ts` | Jerarquía de errores de dominio (capa interna) |
| `src/lib/domain/index.ts` | Barrel de la capa de dominio |
| `src/server/infra/server-boundary.ts` | Centinela con `import "server-only"` |
| `src/server/actions/.gitkeep` | Capa Interfaz/Controlador |
| `src/server/services/.gitkeep` | Capa Servicio |
| `src/server/repositories/.gitkeep` | Capa Acceso a Datos |
| `src/server/schemas/.gitkeep` | Contratos de validación (frontera) |
| `src/components/ui/.gitkeep` | Capa Presentación — primitivas |
| `src/store/.gitkeep` | Estado de cliente |
| `.env.example` | Contrato de variables de entorno (documentado) |
| `.prettierrc.json` | Formateo consistente |
| `eslint.config.mjs` | ESLint + **reglas de frontera de capas** |
| `vitest.config.ts` | Runner de pruebas unitarias |
| `tests/unit/domain-errors.test.ts` | Prueba de humo de laQuality Gate |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `package.json` | Scripts de proyecto y Quality Gates |
| `tsconfig.json` | Endurecer opciones de compilador |
| `.gitignore` | Completar exclusiones (`.env`, `coverage`, artefactos) |
| `src/app/globals.css` | Dejar **solo** reset mínimo (el sistema de diseño es tarea 09) |
| `src/app/layout.tsx` | Metadata por defecto y lang `es-AR` |
| `src/app/page.tsx` | Placeholder mínimo; se reemplaza en tarea 10 |
| `README.md` | Reemplazar el README genérico de Next por el del proyecto |

### 3.3 Eliminar

| Ruta | Motivo |
|---|---|
| `src/app/page.module.css` (si se genera) | Se usarán tokens de diseño, no CSS Modules sueltos |

---

## 4. Estructura N-Capas

### 4.1 Mapa de capas y directorios

| # | Capa | Directorio | Puede importar | Regla dura |
|---|---|---|---|---|
| 1 | **Presentación** | `src/app/**`, `src/components/**` | Capa 2, y `src/lib/**` | **Nunca** Repositories, Prisma ni `src/server/infra` |
| 2 | **Interfaz / Controlador** | `src/server/actions/**` (`"use server"`), `src/app/api/**/route.ts` | Capa 3, `src/server/schemas/**` | **Nunca** Repositories ni Prisma. Valida entrada y authorize. |
| 3 | **Servicio (negocio)** | `src/server/services/**` | Capa 4, `src/lib/**` | **Nunca** acciones, componentes ni rutas. No conoce React ni Next. |
| 4 | **Acceso a Datos** | `src/server/repositories/**`, `src/server/infra/**` | Prisma, Supabase, Cloudinary | **Única** capa que conoce Prisma. Sin lógica de negocio. |
| 0 | **Dominio (transversal)** | `src/lib/domain/**`, `src/lib/format/**`, `src/lib/validation/**` | — | Sin dependencias. Ni interno, ni externo. |

```
src/
├── app/                    # CAPA 1 — Presentación (rutas)
│   ├── api/                # CAPA 2 — Route Handlers (controladores HTTP)
│   ├── admin/
│   ├── (public)/
│   ├── layout.tsx
│   ├── globals.css
│   └── page.tsx
│
├── components/             # CAPA 1 — Presentación (componentes)
│   ├── ui/                 #   primitivas sin conocimiento de negocio
│   ├── catalog/            #   (tarea 10)
│   ├── cart/               #   (tarea 11)
│   ├── checkout/           #   (tarea 13)
│   └── admin/              #   (tareas 14-17)
│
├── server/                 # ⛔ NUNCA importable desde el cliente
│   ├── actions/            # CAPA 2 — Server Actions ("use server")
│   ├── services/           # CAPA 3 — Lógica de negocio
│   ├── repositories/       # CAPA 4 — Acceso a datos (Prisma)
│   ├── schemas/            # Contratos Zod (frontera de entrada)
│   ├── realtime/           # Realtime server-side (tarea 15)
│   └── infra/              # prisma.ts, supabase/, cloudinary.ts
│
├── lib/                    # CAPA 0 — Isomórfico, puro, sin framework
│   ├── domain/             #   tipos, errores, entidades
│   ├── format/             #   formatters puros (ARS, teléfono, slug)
│   └── validation/         #   helpers de validación reutilizables
│
├── store/                  # Estado de cliente (Zustand)
├── hooks/
└── config/                 # Constantes de configuración del sitio
```

### 4.2 Regla de dependencia (se lee de arriba hacia abajo, nunca al revés)

```
Presentación ──▶ Controlador ──▶ Servicio ──▶ Repositorio ──▶ Prisma
     │                │              │              │
     └────────────────┴──────────────┴──────────────┘
                    CAPA 0 — Dominio
              (todos pueden importar hacia abajo)
```

Prohibido: `repositories → services`, `services → actions`, `actions → repositories`, y cualquier cosa → `components`.

### 4.3 Excepción documentada: Servicios de dominio puros

No todos los servicios llevan `import "server-only"`.

| Tipo de servicio | Ejemplos | `server-only` | Razón |
|---|---|---|---|
| **Servicio de I/O** | `product.service.ts`, `settings.service.ts`, `upload.service.ts` | ✅ Sí | Toca base de datos o APIs externas |
| **Servicio de dominio puro** | `whatsapp-message.service.ts`, `cart-rules.service.ts` | ❌ No | Cálculo determinista sin efectos: debe poder ejecutarse en el navegador **y** en tests sin mocks |

Esta distinción se materializa en las tareas 11 y 12. Regla general:

> Si un servicio no abre red, ni lee disco, ni consulta base de datos, **no lleva `server-only`**. Ponerle `server-only` a lógica pura la vuelve in testeable e in reutilizable.

### 4.4 Enforcement: dos mecanismos, distintosOSSCommerce

| Mecanismo | Alcance | Cuándo dispara | Rol |
|---|---|---|---|
| `import "server-only"` (paquete de Vercel) | Imports desde el bundle cliente | **Build de producción** | **Garantía dura.** No se puede negociar ni desactivar por descuido. |
| ESLint `no-restricted-imports` | Imports cliente y de rutas | Editor + `npm run lint` | Feedback temprano, mensaje explicativo. Capa de conveniencia. |

Ambos se configuran en esta tarea. El primero es el que se considera parte de la arquitectura.

---

## 5. Convenciones de código (Clean Code + SOLID)

Aplicar desde el primer archivo. No negociar en revisiones.

### 5.1 Tipado estricto

`tsconfig.json` endurecido respecto al generado por defecto:

| Opción | Efecto |
|---|---|
| `strict: true` | `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, etc. |
| `noUncheckedIndexedAccess: true` | `arr[0]` es `T \| undefined`. Obliga a validar antes de usar. Evita la clase de bug más común en código de carrito. |
| `noImplicitOverride: true` | Exige `override` explícito. |
| `noFallthroughCasesInSwitch: true` | Detecta `switch` sin `break`. Relevante en el formateo del mensaje de WhatsApp. |
| `noUnusedLocals` / `noUnusedParameters` | Código muerto no compila. |
| `exactOptionalPropertyTypes: true` | Opcional. Endurece `notes?: string` vs `notes?: string \| undefined`. **Activar solo si no genera fricción con tipos de terceros**; documentar la decisión en el README del proyecto. |

**Prohibiciones absolutas:**

- ❌ `any` explícito. Usar `unknown` + narrowing.
- ❌ `@ts-ignore` / `@ts-expect-error`. Si un tipo de terceros falla, envolver con un tipo propio en `src/lib/domain/`.
- ❌ `as` para silenciar al compilador. Solo permitido en la frontera de serialización de `Prisma.Decimal` (tarea 08), y siempre acompañado de un comentario explicando por qué.
- ❌ `!` (non-null assertion) en código de negocio.

### 5.2 Nomenclatura (declarativa, sin abreviaturas)

| Elemento | Convención | Ejemplo correcto | Ejemplo incorrecto |
|---|---|---|---|
| Archivo | kebab-case, sufijo por rol en la capa | `whatsapp-message.service.ts` | `utils.ts`, `helpers.ts` |
| Componente | PascalCase | `ProductCard.tsx` | `productCard.tsx` |
| Función/método | `verboPalabraClave` | `buildWhatsAppMessage()` | `getMsg()`, `doIt()` |
| Boolean | prefijo `is` / `has` / `can` | `isAvailable`, `hasVariants` | `available`, `flag` |
| Colección | plural | `products`, `lineItems` | `list`, `arr` |
| Constante | SCREAMING_SNAKE | `MAX_ITEMS_PER_PRODUCT` | `maxItems` |
| Callback | sustantivo, no verbo | `onProductClick` | `handleClickProduct` |

**Prohibido el archivo `utils.ts`.** Cualquier función auxiliar debe estar en un archivo con nombre que describa su responsabilidad única. Si dos archivos distintos necesitan lo mismo, se extrae a un módulo de dominio compartido con nombre propio.

### 5.3 Responsabilidad única

- Un archivo = una razón para cambiar.
- Una función = una razón para fallar.
- Si un archivo de servicio supera **150 líneas**, lo más probable es que contenga más de una responsabilidad: dividir.
- Si un componente de UI supera **200 líneas**, dividir en subcomponentes o extraer hook.

### 5.4 Errores

- `throw` solo con las clases de `src/lib/domain/errors.ts` (ver §7.4).
- Nunca `throw new Error("mensaje en español")` con lógica de negocio embebida.
- Los errores de dominio llevan **código estable** (`code: "CART_ITEM_NOT_FOUND"`), no un mensaje. Los mensajes se localizean en la capa de presentación.
- Los errores inesperados se registran en servidor y se traducen a un mensaje seguro para el usuario en el borde (Server Action / Route Handler).

---

## 6. Pasos de implementación

### 6.1 Inicializar el proyecto

```bash
# 1. Preservar DESIGN.md (create-next-app falla con archivos en conflicto)
mv DESIGN.md /tmp/DESIGN.md.bak

# 2. Inicializar en el directorio actual
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --turbopack \
  --import-alias "@/*"

# 3. Restaurar el documento de diseño
mv /tmp/DESIGN.md.bak DESIGN.md
```

```bash
# 4. Dependencias de esta tarea
npm i -D prettier prettier-plugin-tailwindcss
npm i -D vitest @vitest/coverage-v8 @vitejs/plugin-react
npm i server-only client-only
```

> `prisma` **no** se instala en esta tarea. Se agrega en la tarea 02, junto con el `postinstall` que lo requiere. Instalar `prisma generate` antes de que exista `schema.prisma` rompe el `npm install`.

### 6.2 `tsconfig.json` endurecido

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,

    /* --- Tipado estricto --- */
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    /* --- Módulos --- */
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "noEmit": true,

    /* --- Alias --- */
    "paths": { "@/*": ["./src/*"] },

    "plugins": [{ "name": "next" }]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

### 6.3 `eslint.config.mjs` — reglas de frontera de capas

```js
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: projectDirectory });

/** Rutas que solo la capa de servidor (y por tanto solo el servidor) puede tocar. */
const SERVER_ONLY_INTERNAL = ["@/server/*", "@/server/**"];
const DATA_ACCESS_INTERNAL = ["@/server/repositories/*", "@/server/repositories/**", "@/server/infra/*", "@/server/infra/**"];
const ORMANGE_TOOLING = ["@prisma/client", "prisma"];

const PROHIBIDO_EN_CLIENTE =
  "⛔ Capa de Presentación: los Client Components no pueden importar código de servidor. " +
  "Usá una Server Action (src/server/actions) o un Route Handler (src/app/api) para cruzar la frontera.";

const PROHIBIDO_EN_RUTAS =
  "⛔ Las rutas y Server Actions deben consumir la CAPA DE SERVICIO (src/server/services), " +
  "no la capa de acceso a datos directamente. Encapsulá la consulta en un servicio.";

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "next-env.d.ts"],
  },

  /* ── CAPA 1 · Presentación: componentes reutilizables ── */
  {
    files: ["src/components/**/*.{ts,tsx}", "src/store/**/*.ts", "src/hooks/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: SERVER_ONLY_INTERNAL, message: PROHIBIDO_EN_CLIENTE },
            { group: ORMANGE_TOOLING, message: PROHIBIDO_EN_CLIENTE },
            {
              group: ["../../server/*", "../server/*"],
              message: "Usá el alias '@/server/*' en lugar de rutas relativas: hace auditable la frontera de capas.",
            },
          ],
        },
      ],
    },
  },

  /* ── CAPA 1/2 · Rutas: pueden usar servicios, NO repositorios ── */
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: DATA_ACCESS_INTERNAL, message: PROHIBIDO_EN_RUTAS },
            { group: ORMANGE_TOOLING, message: PROHIBIDO_EN_RUTAS },
          ],
        },
      ],
    },
  },

  /* ── CAPA 3 · Servicios: no conocen React ni Next ── */
  {
    files: ["src/server/services/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "next/*", "@/app/*", "@/components/*", "@/server/actions/*"],
              message:
                "⛔ La capa de Servicio no depende del framework de presentación. " +
                "Extrae la lógica a un módulo puro en src/lib o tipala como parámetro de entrada.",
            },
          ],
        },
      ],
    },
  },
];
```

> **Verificar contra la versión instalada.** La API de configuración de ESLint y de `eslint-config-next` cambia entre versiones mayores de Next. Si `compat.extends("next/core-web-vitals")` falla, consultar la guía de ESLint de la versión de Next en uso y ajustar el archivo. La **lógica de las reglas `no-restricted-imports` no cambia** y es el objetivo real de esta sección.

### 6.4 Scripts en `package.json`

```jsonc
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",

    /* Quality Gates */
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "verify": "npm run lint && npm run typecheck && npm run test"
  }
}
```

**Regla de proceso:** `npm run verify` debe pasar **antes de cada commit**. Sin excepciones. En la tarea 02 se agregará `postinstall: prisma generate`, que también deberá ejecutarse antes de cada build en Vercel.

### 6.5 `.env.example`

```bash
# ─────────────────────────────────────────────────────────────
# SUPABASE — Base de datos y autenticación
# ─────────────────────────────────────────────────────────────
# Pooler (transaction mode, puerto 6543) → RUNTIME de la app.
# Obligatorio en serverless: una conexión directa por request
# agota el pool de Supabase en minutos.
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres"

# Conexión directa (puerto 5432) → SOLO migraciones de Prisma.
# Prisma necesita una sesión persistente que PgBouncer no ofrece.
DIRECT_DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"

# URL pública: SÍ puede exponerse al navegador (es pública por diseño).
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."

# ⛔ NUNCA exponer al cliente. Bypasea todas las políticas RLS.
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."

# ─────────────────────────────────────────────────────────────
# CLOUDINARY — Almacenamiento y optimización de imágenes
# ─────────────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME="modo-miga"
CLOUDINARY_API_KEY="000000000000000"
# ⛔ Se usa para firmar uploads. Su filtración permite subir imágenes ajenas.
CLOUDINARY_API_SECRET="REEMPLAZAR"

# ─────────────────────────────────────────────────────────────
# SITIO
# ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

```bash
cp .env.example .env.local
```

`.env.local` **no** se commitea. Verificar que `.gitignore` contiene `.env*` con excepción para `.env.example`.

### 6.6 `.gitignore` — bloqueo de artefactos y secretos

```gitignore
# Dependencias
node_modules/
.pnp
.pnp.js

# Build
/.next/
/out/
next-env.d.ts

# Secretos — la excepción final es la que importa: .env.example SÍ se versiona
.env*
!.env.example

# Prisma
prisma/*.db
prisma/*.db-journal

# Pruebas y análisis
/coverage

# TypeScript
*.tsbuildinfo

# Deploy
.vercel

# Sistema
.DS_Store
Thumbs.db
*.log
```

### 6.7 Capa de dominio: errores

`src/lib/domain/errors.ts`

```ts
/**
 * Errores de dominio.
 *
 * Son parte de la CAPA 0 y no dependen de nada externo: ni de Next,
 * ni de Prisma, ni de Supabase. Esto permite que los servicios lancen
 * errores tipados y que las capas superiores decidan cómo presentarlos.
 *
 * Convención: un error de dominio transporta un `code` ESTABLE para ser
 * comparado por código, y un `message` de contexto para logging.
 * El texto que ve el usuario final se define en la capa de presentación.
 */

export type DomainErrorCode =
  | "VALIDATION_ERROR"
  | "RESOURCE_NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "EXTERNAL_SERVICE_ERROR";

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  protected constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.details = Object.freeze({ ...details });
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends DomainError {
  readonly code = "VALIDATION_ERROR" as const;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(fieldErrors: Record<string, readonly string[]>, message = "Datos inválidos") {
    super(message, { fieldErrors });
    this.fieldErrors = Object.freeze({ ...fieldErrors });
  }
}

export class ResourceNotFoundError extends DomainError {
  readonly code = "RESOURCE_NOT_FOUND" as const;

  constructor(resource: string, identifier: string) {
    super(`${resource} no encontrado: ${identifier}`, { resource, identifier });
  }
}

export class UnauthorizedError extends DomainError {
  readonly code = "UNAUTHORIZED" as const;

  constructor(message = "Se requiere autenticación") {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  readonly code = "FORBIDDEN" as const;

  constructor(message = "No tenés permisos para realizar esta acción") {
    super(message);
  }
}

export class ConflictError extends DomainError {
  readonly code = "CONFLICT" as const;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class ExternalServiceError extends DomainError {
  readonly code = "EXTERNAL_SERVICE_ERROR" as const;
  readonly service: string;

  constructor(service: string, cause: unknown) {
    super(`Fallo la integración con ${service}`, { service, cause: String(cause) });
    this.service = service;
  }
}

/** Reduce un error desconocido a un mensaje presentable, sin filtrar detalles internos. */
export function toSafeErrorMessage(error: unknown): string {
  if (error instanceof DomainError) {
    switch (error.code) {
      case "VALIDATION_ERROR":
      case "RESOURCE_NOT_FOUND":
      case "CONFLICT":
        return error.message;
      default:
        return "Ocurrió un problema. Intentá de nuevo.";
    }
  }
  return "Ocurrió un problema inesperado. Intentá de nuevo.";
}
```

`src/lib/domain/index.ts`

```ts
export * from "./errors";
```

### 6.8 Centinela de frontera

`src/server/infra/server-boundary.ts`

```ts
/**
 * CENTINELA DE ARQUITECTURA — no es código de negocio.
 *
 * El paquete `server-only` hace que el build de Next.js FALLE si algún
 * archivo del bundle del navegador importa este módulo o cualquier módulo
 * que lo re-exporte. Es la garantía dura de que la capa de servidor
 * nunca viaja al cliente.
 *
 * No borrar este archivo. Es la red de seguridad de la arquitectura N-capas.
 */
import "server-only";

export const SERVER_BOUNDARY = Symbol.for("modo-miga.server-boundary");
```

### 6.9 `vitest.config.ts`

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts", "src/server/services/**/*.ts"],
      exclude: ["**/*.d.ts", "**/index.ts"],
    },
  },
});
```

> `environment: "node"` porque en esta tarea solo hay lógica pura. La tarea 09 agregará un proyecto Vitest adicional con `environment: "jsdom"` para componentes.

### 6.10 Prueba de humo de la Quality Gate

`tests/unit/domain-errors.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  DomainError,
  ResourceNotFoundError,
  ValidationError,
  toSafeErrorMessage,
} from "@/lib/domain";

describe("Jerarquía de errores de dominio", () => {
  it("debe conservar el code estable para comparisons por código", () => {
    const error = new ResourceNotFoundError("Producto", "prod_123");

    expect(error.code).toBe("RESOURCE_NOT_FOUND");
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
  });

  it("no debe filtrar el mensaje interno de errores no presentables", () => {
    const message = toSafeErrorMessage(new Error("connection to 10.0.0.5:5432 refused"));

    expect(message).not.toContain("10.0.0.5");
    expect(message).toBe("Ocurrió un problema inesperado. Intentá de nuevo.");
  });

  it("debe propagar los errores de campo de validación para el formulario", () => {
    const error = new ValidationError({ phone: ["Formato inválido"] });

    expect(error.fieldErrors.phone).toEqual(["Formato inválido"]);
    expect(toSafeErrorMessage(error)).toBe("Datos inválidos");
  });
});
```

### 6.11 `globals.css`, `layout.tsx` y `page.tsx` mínimos

El sistema de diseño completo (paleta, tipografía, tokens) es la **tarea 09**. Acá solo se deja lo indispensable para que el proyecto compile.

`src/app/layout.tsx`

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Mi Negocio", template: "%s | Mi Negocio" },
  description: "Sándwiches de miga artesanales en San Rafael, Mendoza.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: "#FAF6F0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh bg-cream text-ink antialiased">{children}</body>
    </html>
  );
}
```

> Los tokens `bg-cream` y `text-ink` se definen en la tarea 09. Si el build falla por clases inexistentes en Tailwind v4, usar `bg-white text-neutral-900` como temporal y reemplazarlo en la tarea 09.

`src/app/page.tsx`

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <div className="text-center">
        <p className="text-4xl font-black tracking-tight">Mi Negocio</p>
        <p className="mt-2 text-sm text-neutral-500">
          Catálogo en construcción — Tarea 01 completada.
        </p>
      </div>
    </main>
  );
}
```

### 6.12 `.prettierrc.json`

```json
{
  "semi": true,
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "trailingComma": "all",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### 6.13 `docs/tasks/README.md`

Índice con estado (`[ ]` / `[x]`), fase, dependencias y una línea de resultado por tarea. Es el tablero de progreso del proyecto.

---

## 7. Contratos y tipos

Esta tarea no define entidades de negocio. Define **contratos estructurales**:

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `DomainErrorCode` | `src/lib/domain/errors.ts` | Toda la aplicación. Es el vocabulary de errores compartido. |
| `DomainError` (abstracta) | idem | Servicios, repositorios |
| `ValidationError` | idem | Server Actions, Route Handlers |
| `ResourceNotFoundError` | idem | Servicios, repositorios |
| `UnauthorizedError` / `ForbiddenError` | idem | Capa de Controlador (tarea 07 en adelante) |
| `toSafeErrorMessage(unknown): string` | idem | Route Handlers, `error.tsx`, Server Actions |
| Reglas de frontera ESLint | `eslint.config.mjs` | Todo el equipo |
| Quality Gate `verify` | `package.json` | Proceso de integración |

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad / infraestructura

- [x] `npm install` completa sin errores ni warnings relevantes
- [x] `npm run dev` levanta el servidor y `/` renderiza la pantalla de constructor
- [x] `npm run build` termina con exit code 0
- [x] `npm start` sirve el build de producción correctamente
- [ ] El repositorio Git está inicializado con un commit inicial que contenga `DESIGN.md` y la estructura base
- [x] `README.md` describe el proyecto (no es el README genérico de Next.js)

### 8.2 Calidad

- [x] `npm run verify` (lint + typecheck + test) pasa sin errores **ni warnings**
- [x] `npm run format:check` pasa sobre todo el código generado
- [x] `tsc --noEmit` no reporta errores con `noUncheckedIndexedAccess` activo
- [x] No existe ningún `any` explícito en `src/`
- [x] No existe ningún archivo `utils.ts`, `helpers.ts` ni `misc.ts`

### 8.3 Arquitectura — **verificación obligatoria**

- [x] **Prueba negativa de la frontera:** crear temporalmente un Client Component que importe `@/server/infra/server-boundary` y ejecutar `npm run build`. **El build DEBE fallar** con un error de `server-only`. Revertir el archivo temporal después de verificar.
- [x] `src/components/**` y `src/store/**` no pueden importar `@/server/*` ni `@prisma/client` (verificado por ESLint)
- [x] `src/app/**` no puede importar `@/server/repositories/*` ni `@/server/infra/*` (verificado por ESLint)
- [x] `src/server/services/**` no puede importar `react`, `next/*`, `@/components/*` ni `@/app/*` (verificado por ESLint)
- [x] Todos los directorios de capa existen y contienen al menos su `.gitkeep`

### 8.4 Seguridad

- [x] `.env.local` **no** está trackeado por Git (`git status` no lo lista)
- [x] `.env.example` **sí** está trackeado y contiene placeholders, no secretos reales
- [x] `git check-ignore -v .env.local` devuelve coincidencia

### 8.5 Documentación

- [x] `docs/tasks/README.md` existe con el índice completo de las 23 tareas
- [x] Este documento (Tarea 01) está creado en `docs/tasks/01-bootstrap-y-herramientas.md`

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado |
|---|---|
| `npm ci` en una máquina limpia | Debe pasar sin variables de entorno definidas (aún no hay `postinstall: prisma generate`) |
| Importación de `@/server/**` desde un Client Component | **Error de build**, no warning |
| Importación de un repositorio desde una ruta | Error de lint con mensaje que indica usar la capa de servicio |
| Un `.ts` en `src/server/services/` que importa React | Error de lint |
| Archivo vacío en un directorio de capa | Git no lo trackea → se resolvió con `.gitkeep` |
| Variable `NEXT_PUBLIC_SITE_URL` ausente | `metadataBase` cae al valor por defecto sin romper el build |
| Versión de `eslint-config-next` incompatible con el config | El mensaje de error indica qué falta; consultar la guía de la versión instalada y ajustar. La lógica de las reglas no cambia |

---

## 10. Pruebas

| Tipo | Archivo | Qué verifica |
|---|---|---|
| Unit | `tests/unit/domain-errors.test.ts` | `code` estable, herencia de `Error`, inmutabilidad de `details`, y que `toSafeErrorMessage` **no filtra** detalles internos de infraestructura |
| Manual (build) | Script de verificación negativa de `server-only` | La frontera de capas realmente bloquea imports |
| Manual | `git check-ignore` | Los secretos están protegidos |

**Cobertura:** no fijar umbral numérico en esta tarea. El umbral meaningful se define en la tarea 20 sobre los módulos que concentran la lógica de negocio.

---

## 11. Definición de "Hecho" (Definition of Done)

Una tarea está terminada cuando **todas** las condiciones se cumplen simultáneamente:

1. Todos los criterios de aceptación de §8 están marcados.
2. `npm run verify` pasa.
3. `npm run build` pasa.
4. El código está commiteado en una rama con mensaje que referencia el ID de tarea (`feat(01): bootstrap y frontera de capas N-capas`).
5. Una pull request hacia `main` fue abierta y mergeada.
6. `docs/tasks/README.md` marca la tarea como completada.
7. La documentación de `README.md` refleja el estado real del proyecto.

> **Regla de proceso:** no se acumula trabajo entre tareas. La Tarea 02 comienza sobre `main` actualizado, con la Tarea 01 integrada. Esto evita conflictos de configuración y garantiza que la Quality Gate está verde para todos.

---

## 12. Registro de implementación (2026-09-29)

Tarea implementada. Este registro documenta las desviaciones respecto de lo especificado
arriba y la evidencia de cada criterio verificado.

### 12.1 Baseline: Next.js 16, no 15

`DESIGN.md §4.1` fijaba **Next.js 15**, y el scaffold de §6.1 (`create-next-app@latest`)
instala hoy **16.3.6**. Se resolvió explícitamente a favor de **Next 16.3.6** (major actual,
con Turbopack por defecto y flat config nativa de ESLint). `DESIGN.md §4.1` y el `README.md`
reflejan las versiones realmente instaladas.

Consecuencias:

| Tema | Next 15 (spec) | Next 16 (implementado) |
|---|---|---|
| ESLint | `FlatCompat` + `compat.extends("next/core-web-vitals")` | `defineConfig` + `eslint-config-next/core-web-vitals` nativo |
| `dev` script | `next dev --turbopack` | `next dev` (Turbopack es el default) |
| `tsconfig` `jsx` | `"preserve"` | `"react-jsx"` — **Next 16 lo reescribe obligatoriamente** en el primer build |
| `middleware` | `middleware.ts` | renombrado a `proxy.ts` (afecta a la Tarea 07) |
| Versiones reales | — | `next@16.3.6`, `react@19.2.8`, `typescript@5.9.3`, `tailwindcss@4.3.3`, `vitest@5.0.2`, `eslint@9.39.5` |

La **lógica** de las reglas `no-restricted-imports` —el objetivo real de §6.3— no cambió: se
conservaron los cuatro bloques de frontera, con los mismos mensajes.

### 12.2 Desviaciones de la spec, con motivo

| # | Spec | Implementado | Motivo |
|---|---|---|---|
| 1 | `FlatCompat` en `eslint.config.mjs` | Flat config nativa | `eslint-config-next@16.3.6` ya exporta arrays de config plana; `FlatCompat` es innecesario |
| 2 | `"jsx": "preserve"` | `"jsx": "react-jsx"` | Next 16 lo reescribe en el primer build; pelearse con él produce un diff en cada `build` |
| 3 | `ExternalServiceError` guardaba `cause: String(cause)` en `details` | Guarda `causeName` (el `name` de la causa) | Los drivers de conexión incluyen **credenciales y hosts internos** en el mensaje del error, y `details` es exactamente lo que se serializa a los logs. Es Information Disclosure (CWE-209). Cubierto por un test |
| 4 | Sin `.prettierignore` | `DESIGN.md` y `docs/` excluidos | `npm run format` reformatearía 32 000 líneas de Markdown escritas a mano y generaría un diff massif y ajeno al código |
| 5 | `exactOptionalPropertyTypes` opcional | **Activado** | La spec lo deja a criterio ("si no genera fricción"). Con el stack actual compila limpio, así que queda activo. Decidido en el `README.md` |
| 6 | `client-only@^0.1.0` implícito | `client-only@0.0.1` | La versión `0.1.0` no existe en el registro; `0.0.1` es la última publicada |
| 7 | ESLint sin versión fijada | `eslint@^9` | ESLint 10 no tiene soporte declarado, pero `eslint-plugin-react`, `eslint-plugin-import` y `eslint-plugin-jsx-a11y` (dentro de `eslint-config-next@16.3.6`) topean sus peers en ESLint 9. ESLint 10 genera `ERESOLVE` y peers `invalid`. Se acepta el warning de deprecación de `eslint@9.39.5` como deuda upstream |
| 8 | `npm run dev` en `:3000` | Verificado en `:3100` | El puerto 3000 del entorno está ocupado por un proceso ajeno (Express). No se intervino |

### 12.3 Evidencia de los gates

| Gate | Resultado |
|---|---|
| `npm install` | exit 0 · 0 vulnerabilidades · único warning: deprecación de `eslint@9.39.5` (ver 12.2 #7) |
| `npm run verify` | exit 0 · lint, typecheck y 5 tests en verde · **0 warnings** |
| `npm run format:check` | `All matched files use Prettier code style!` |
| `npm run build` | exit 0 · `/` y `/_not-found` prerenderizados como estáticos |
| `npm start` | HTTP 200 · `lang="es-AR"` · `<title>Mi Negocio</title>` |
| `npm run dev` | HTTP 200 · render de la pantalla de constructor |
| `npm audit` | `found 0 vulnerabilities` |

### 12.4 Evidencia de la frontera (sondas temporales, ya revertidas)

| Sonda | Resultado |
|---|---|
| Client Component → `@/server/infra/server-boundary` | **`npm run build` falla con exit 1**: `It should only be used from a Server Component`, con la traza `Client Component Browser: server-boundary.ts → boundary-probe.tsx → page.tsx`. Además ESLint lo marca con el mensaje de la Capa de Presentación |
| Ruta (`src/app/**`) → `@/server/repositories/*` | ESLint: `⛔ Las rutas y Server Actions deben consumir la CAPA DE SERVICIO` |
| Servicio (`src/server/services/**`) → `react`, `next/headers` | ESLint: `⛔ La capa de Servicio no depende del framework de presentación` (2 errores) |

Las tres sondas se eliminaron y el árbol quedó limpio: `lint` y `build` en verde.

### 12.5 Pendiente

- **Criterio §8.1 sin marcar:** el commit inicial. El repositorio fue inicializado
  (`git init -b main`) y `.gitignore` verificado con `git check-ignore -v .env.local`, pero
  **no se creó ningún commit**: eso queda a autorización explícita del responsable del
  proyecto.
- Los puntos 4 y 5 del §11 (rama + PR mergeada) siguen pendientes por lo mismo.

---

## 13. Dependencias y bloqueos

**Esta tarea no bloquea nada** (es la raíz del grafo).

**Habilita:**

| Tarea | Por qué la necesita |
|---|---|
| 02 — Conexión de datos | Necesita `tsconfig` estricto, el alias `@/*` y los scripts de `package.json` antes de agregar Prisma |
| 04 — Repositories | El sentinel `server-boundary` es el precursor directo del `import "server-only"` de la capa de datos |
| 07 — Auth | Necesita los errores `UnauthorizedError` / `ForbiddenError` y las reglas de frontera |
| 08 — Servicios de catálogo | Necesita el andamiaje de la capa de Servicio y el barrel de dominio |
| 09 — Fundamentos UI | Necesita Vitest configurado y el primer componente en `src/components/ui/` |
| 20 — Estrategia de pruebas | Hereda la configuración de Vitest y el criterio de cobertura |

**Reglas de arquitectura que esta tarea deja establecidas y que las demás deben respetar:**

1. `src/server/**` es territorio exclusivo del servidor.
2. Los servicios puros no llevan `server-only`.
3. Las rutas no hablan con Prisma: hablan con servicios.
4. Los errores de negocio son clases de dominio con `code` estable.
5. `npm run verify` antes de cada commit.
