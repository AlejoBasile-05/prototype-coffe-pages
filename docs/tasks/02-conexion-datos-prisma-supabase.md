# Tarea 02 — Conexión de Datos: Prisma ↔ Supabase

| Campo | Valor |
|---|---|
| **ID** | 02 |
| **Fase (DESIGN.md §8.3)** | Fase 1 — Cimientos y Modelado |
| **Depende de** | 01 |
| **Habilita** | 03, 04, 07 |
| **Tipo** | Acceso a Datos — infraestructura |
| **Esfuerzo est.** | 0.5 – 1 día |

---

## 1. Objetivo de la tarea

Conectar Prisma con la base de datos de Supabase de forma **correcta para un entorno serverless**, y resolver el punto de infraestructura que más causa caídas en producción: el agotamiento del pool de conexiones.

**Criterio de éxito verificable:** un script ejecutado desde el servidor de Vercel abre y cierra conexión a la base sin agotar el pool, y `prisma studio` funciona desde la máquina local.

---

## 2. Contexto y dependencias

Requiere la Tarea 01 completada (tsconfig estricto, alias `@/*`, scripts, ESLint con fronteras de capas).

**Prerrequisitos de entorno:**

- [ ] Proyecto creado en [supabase.com](https://supabase.com) (plan Free alcanza)
- [ ] Tarea 00 completada (al menos: el negocio existe y tiene datos)

**Credenciales a obtener del dashboard de Supabase → Project Settings → Database:**

| Dato | Dónde encontrarlo | Se usa para |
|---|---|---|
| **URI del pooler** (puerto `6543`) | Connection string → **Session pooler** | `DATABASE_URL` — runtime de la app |
| **URI directa** (puerto `5432`) | Connection string → **URI directa** | `DIRECT_DATABASE_URL` — solo migraciones |
| Project URL | API → Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` public key | API → Project API keys | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

> **⚠️ La distinction entre las dos connection strings es el 80% del riesgo de esta tarea.** Ver §4.

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `prisma/schema.prisma` | Placeholder mínimo **sin modelos** (los agrega la Tarea 03) |
| `src/server/infra/prisma.ts` | Cliente Prisma singleton con `server-only` |
| `src/server/infra/supabase/admin.ts` | Cliente Supabase con `service_role` para tareas de infraestructura |
| `src/app/api/health/route.ts` | Sonda de conexión (se queda en el proyecto) |
| `prisma/seed.ts` | Placeholder no-op, para que `migrate dev` no falle (Tarea 05 lo implementa) |
| `.env` | URLs de base de datos para el **CLI de Prisma** (nunca commiteado) |
| `.env.local` | Resto de credenciales para **Next.js** (nunca commiteado) |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `package.json` | Dependencias de Prisma + `postinstall` + scripts de DB |
| `.env.example` | Reemplazar placeholders por los nombres reales con ejemplos de Supabase |
| `docs/tasks/README.md` | Marcar Tarea 02 |

### 3.3 Eliminar

Ninguno.

---

## 4. Estructura N-Capas

### 4.1 Qué vive en esta capa

| Capa | Qué va en esta tarea | Qué NO va |
|---|---|---|
| 4 · Acceso a Datos | `infra/prisma.ts` (conexión), `infra/supabase/admin.ts` (cliente privilegiado) | Ninguna query de negocio. Las queries van en la Tarea 04. |
| 1 · Presentación | Nada | Nada de Prisma. Jamás. |
| 3 · Servicio | Nada | Nada todavía |

**`src/server/infra/` contiene exclusivamente infraestructura de conexión.** Es la capa más baja: no importa nada del proyecto salvo el cliente de la librería. Cualquier lógica que aparezca aquí es una señal de que la función pertenece a un repositorio o a un servicio.

### 4.2 Regla de dependencia

```
Repositorios  ──▶  infra/prisma.ts  ──▶  @prisma/client  ──▶  PgBouncer  ──▶  Postgres
```

`infra/` no importa repositorios, servicios, acciones ni componentes.

---

## 5. Convenciones de código

- `prisma.ts` es el **único** archivo del proyecto que instancia `PrismaClient`. Si aparece un segundo `new PrismaClient()`, es un bug.
- Toda lectura de `process.env.DATABASE_URL` ocurre dentro de Prisma (vía `env()` en el schema), **nunca** en código de aplicación.
- Errores de conexión: no capturar. Dejar que el error suba hasta el borde (Route Handler / Server Action), que es el único lugar que traduce a mensaje presentable. Capturar y tragarse errores de DB produce fallos silenciosos, que son peor que errores visibles.
- Variables de entorno: acceso directo a `process.env.NOMBRE`. Sin un wrapper tipo `env.ts` mientras el proyecto sea chico. Si se agrega la librería `zod` de validación de env (tarea 19), se evalúa entonces.

---

## 6. Pasos de implementación

### 6.1 Instalar Prisma

```bash
npm i @prisma/client
npm i -D prisma
```

> **No instalar `prisma` antes de que exista `schema.prisma`** si ya se agregó `postinstall: prisma generate` (ver §6.3): el `npm install` fallaría. En esta tarea se instalan juntos y se crea el schema inmediatamente después.

### 6.2 `prisma/schema.prisma` — placeholder

```prisma
// Los modelos se definen en la Tarea 03.
// Este datasource queda establecido desde ahora porque define la
// distinción pooler/directo, que es lo específico de esta tarea.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"

  // RUNTIME: pooler de Supabase en modo transaction (puerto 6543).
  // Obligatorio en serverless. Ver §6.4 para el porqué.
  url = env("DATABASE_URL")

  // MIGRACIONES: conexión directa, sin pooler (puerto 5432).
  // Prisma necesita una sesión persistente que PgBouncer no ofrece.
  directUrl = env("DIRECT_DATABASE_URL")
}
```

Generar el cliente con el schema vacío:

```bash
npx prisma generate
```

### 6.3 `package.json` — scripts y `postinstall`

```jsonc
{
  "scripts": {
    /* ... los de la Tarea 01 ... */

    /* Base de datos */
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:status": "prisma migrate status",
    "db:reset": "prisma migrate reset",
    "db:studio": "prisma studio",
    "db:seed": "prisma db seed"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

```jsonc
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

**Por qué `postinstall`:** Vercel corre `npm install` antes del build. Sin esto, `@prisma/client` no tendría el cliente generado y el build fallaría con un error confuso sobre tipos inexistentes. Con esto, la generación ocurre automáticamente en cada deploy.

**Instalar `tsx`** (ejecutor de TypeScript para el seed, Tarea 05):

```bash
npm i -D tsx
```

### 6.4 `src/server/infra/prisma.ts` — Singleton

```ts
/**
 * Cliente Prisma singleton.
 *
 * ⚠️ ESTE ES EL ÚNICO LUGAR DEL PROYECTO DONDE SE INSTANCIA PrismaClient.
 *
 * Dos decisiones críticas y no obvias:
 *
 * 1. `server-only` hace que el build de Next.js FALLE si este archivo llega
 *    al bundle del navegador. Prisma no puede ni debe correr en el cliente.
 *
 * 2. El bloque `globalThis` es para DESARROLLO, no para producción. En dev,
 *    Next.js hot-reload re-evalúa los módulos en cada cambio: sin el
 *    singleton, cada recarga abriría un pool nuevo de conexiones y
 *    agotaría el límite de Supabase (15 conexiones en plan Free) en minutos.
 *    En producción (serverless) cada invocación es un módulo nuevo, así que
 *    `globalThis` es inofensivo.
 *
 * Sobre pooler vs. conexión directa: la URL de runtime (pooler, puerto 6543)
 * multiplexa muchas conexiones de aplicación sobre pocas conexiones reales.
 * Es la única forma de sobrevivir en un entorno serverless donde cada
 * request puede crear su propio cliente. Ver DESIGN.md §4.5.
 */
import "server-only";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = (): PrismaClient =>
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

/**
 * @example
 * import { prisma } from "@/server/infra/prisma";
 *
 * const products = await prisma.product.findMany({ where: { status: "PUBLISHED" } });
 */
export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

> **Sobre `Prisma.Decimal`:** los queries que Devuelvan campos `Decimal` (como `price`) producen objetos `Prisma.Decimal`, que **React no puede serializar** al cruzar el límite servidor→cliente. La solución (`DTO` + `.toNumber()`) se implementa en la Tarea 08, §4.3. Anotarlo acá para que no se olvide.

### 6.5 `.env.local`

```bash
# ─── Supabase: Pooler (RUNTIME) ────────────────────────────────
# Dashboard → Project Settings → Database → Connection string
# → "Session pooler" / modo Transaction. Puerto 6543.
# En la URL, el usuario lleva el PROJECT_REF antes de los dos puntos.
DATABASE_URL="postgresql://postgres.abcdefghijklm:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"

# ─── Supabase: Directa (MIGRACIONES) ───────────────────────────
# → "URI" / conexión directa. Puerto 5432.
DIRECT_DATABASE_URL="postgresql://postgres:PASSWORD@db.abcdefghijklm.supabase.co:5432/postgres"

# ─── Supabase: API ────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL="https://abcdefghijklm.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# ─── Cloudinary (Tarea 06 los usa; se cargan ahora para tener
#     el .env.local completo) ─────────────────────────────────
CLOUDINARY_CLOUD_NAME="modo-miga"
CLOUDINARY_API_KEY="000000000000000"
CLOUDINARY_API_SECRET="PENDING"

# ─── Sitio ───────────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

> **PASSWORD con caracteres especiales:** si la contraseña de la base contiene `@`, `:`, `/`, `#` o `?`, debe ir **URL-encoded** en la connection string, o la URL se corta. Síntoma típico: `error: P1001 Can't reach database server`. Si aparece, aplicar `encodeURIComponent` sobre la contraseña.

### 6.6 Verificar la conexión

```bash
# 1. El cliente genera sin error
npx prisma generate

# 2. La conexión directa funciona (para migraciones)
echo "SELECT 1;" | npx prisma db execute --schema prisma/schema.prisma --stdin

# 3. Prisma Studio abre y muestra la base
npm run db:studio
```

> **`--schema` es obligatorio en `db execute` con Prisma 6.** Sin él, el comando
> falla con `Either --url or --schema must be provided`, aunque exista un
> `prisma/schema.prisma`. Los demás subcomandos (`generate`, `migrate`, `studio`)
> lo detectan solos.

**Si `db:studio` no conecta, el problema es casi siempre la URL.** Diagnóstico:

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Can't reach database server` | Contraseña sin URL-encoding | `encodeURIComponent` sobre la contraseña |
| `P1001` en Vercel pero funciona en local | Se está usando la URL directa en runtime | Cambiar `DATABASE_URL` al pooler (6543) |
| `too many connections` | Dos o más `new PrismaClient()` | Singleton mal hecho, o falta el bloque `globalThis` |
| `Error validating datasource` | Falta `directUrl` en el schema | Verificar `prisma/schema.prisma` |

### 6.7 `src/server/infra/supabase/admin.ts` — cliente privilegiado

```ts
/**
 * Cliente Supabase con `service_role`. Uso EXCLUSIVAMENTE en servidor
 * y para tareas administrativas puntuales.
 *
 * ⛔ `service_role` BYPASEA todas las políticas RLS. Es la llave maestra.
 *    Su filtración permite leer y escribir toda la base de datos, termasuk
 *    los productos en borrador.
 *
 * ⛔ Este archivo lleva `server-only`. Si se importa desde el cliente,
 *    el build falla. Esa es exactamente la garantía buscada.
 *
 * Cuándo usarlo (uso legítimo y acotado):
 *   - Crear el usuario administrador inicial (Tarea 07)
 *   - Ejecutar scripts de mantenimiento (Tarea 05, 21)
 *   - Backups programados
 *
 * Cuándo NO usarlo:
 *   - Para leer datos del catálogo. Para eso está el `anon` client
 *     (Tarea 15) o Prisma en los repositorios.
 *   - En cualquier Server Action. Nunca.
 */
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const createAdminClient = (): SupabaseClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const globalForSupabase = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined;
};

export const supabaseAdmin: SupabaseClient =
  globalForSupabase.supabaseAdmin ?? createAdminClient();

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.supabaseAdmin = supabaseAdmin;
}
```

### 6.8 Prueba de conexión desde el servidor

Crear temporalmente `src/app/api/health/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/server/infra/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "reachable",
      latencyMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    console.error("[health] Fallo la conexión a la base de datos:", error);
    return NextResponse.json(
      { status: "error", database: "unreachable" },
      { status: 503 },
    );
  }
}
```

```bash
npm run dev
curl http://localhost:3000/api/health
```

**Dejar este endpoint en el proyecto.** Se reutiliza en la Tarea 21 para el smoke test post-deploy y como uptime check externo. No expone datos: solo booleano y latencia.

---

## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `prisma: PrismaClient` | `src/server/infra/prisma.ts` | **Todos** los repositorios (Tarea 04 en adelante) |
| `supabaseAdmin: SupabaseClient` | `src/server/infra/supabase/admin.ts` | Tarea 05 (seed), 07 (crear admin), 21 (operación) |
| `GET /api/health` | `src/app/api/health/route.ts` | Smoke test manual y externo (Tarea 21) |
| `DATABASE_URL` / `DIRECT_DATABASE_URL` | `prisma/schema.prisma` | Prisma CLI y runtime |

**Contrato a respetar desde esta tarea:** el resto del proyecto **solo** importa `prisma` desde `@/server/infra/prisma`. Nunca importa `PrismaClient` directamente. Esto permite cambiar la configuración de conexión en un solo lugar.

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [x] `npx prisma generate` completa sin error
- [x] `npx prisma db execute` ejecuta `SELECT 1` sin error (conexión **directa**)
- [x] `npm run db:studio` abre y muestra la base vacía
- [x] `GET /api/health` devuelve `{ "status": "ok", "database": "reachable" }`
- [x] `npm run build` pasa con el endpoint de health incluido

### 8.2 Calidad

- [x] `npm run verify` en verde
- [x] `src/server/infra/prisma.ts` tiene `import "server-only"` en la primera línea
- [x] Existe **exactamente una** instancia de `new PrismaClient()` en todo el proyecto
- [x] El bloque `globalThis` está presente y condicionado a `NODE_ENV !== "production"`
- [x] `prisma.schema.prisma` tiene `url` (pooler) **y** `directUrl` (directa)

### 8.3 Arquitectura — verificación obligatoria

- [x] **Prueba negativa:** crear un Client Component que importe `@/server/infra/prisma` y ejecutar `npm run build` → **debe fallar**
- [x] `rg "new PrismaClient" src/` devuelve **exactamente 1** resultado, y está en `src/server/infra/prisma.ts`
- [x] `rg "from \"@prisma/client\"" src/app src/components` no devuelve resultados
- [x] `supabase/admin.ts` tiene `import "server-only"`

### 8.4 Seguridad

- [x] `.env.local` NO está trackeado por Git (`git status` no lo lista)
- [x] `.env.example` SÍ está trackeado, con placeholders y sin ningún valor real
- [x] `SUPABASE_SERVICE_ROLE_KEY` no aparece en ningún archivo trackeado
- [x] `git check-ignore -v .env.local` devuelve coincidencia
- [x] El bucket de `docs/assets/` (de la Tarea 00) no contiene credenciales

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado |
|---|---|
| Contraseña de la DB con `@` o `/` | URL-encoding obligatorio. Síntoma: `P1001`. |
| Cold start de una función serverless | Puede tardar 1–3 s la primera vez. El endpoint de health mide la latencia real: si es > 2 s de forma sostenida, considerar subir la región del pooler. |
| `DATABASE_URL` apunta a la URL directa en Vercel | **Falla en producción con `too many connections`** tras unos minutos de tráfico. Verificar en el dashboard de Vercel que la variable es la del pooler (puerto 6543). |
| `prisma migrate dev` pide reset de la base | Nunca hacer reset en una base con datos. `migrate dev` solo resetea si detecta drift. Usar `migrate deploy` en producción. |
| developer's `npm install` falla con error de Prisma | Falta `prisma/schema.prisma` o `postinstall` quedó sin schema. Ejecutar `npx prisma generate` manualmente. |
| Supabase pausa el proyecto por inactividad (plan Free) | La base se suspende a los 7 días sin actividad. Implica Cold Start de hasta 1 minuto en el primer request. Para este volumen, evaluar Upgrading or configurando un ping programado. Documentar en el runbook (Tarea 21). |
| `service_role` faltante en el entorno | El error explícito de `createAdminClient()` lo dice. No caer en un `undefined is not an object` más adelante. |
| Latencia alta intermitente | Verificar en el dashboard de Supabase → **Database → Connection Pooler** el estado de las conexiones. |

---

## 10. Pruebas

| Tipo | Verificación |
|---|---|
| Manual | `GET /api/health` responde `ok` con latencia registrada |
| Manual | `prisma studio` lista las tablas (vacías en este punto) |
| Integración (temporal) | Importar `prisma` desde un Route Handler y ejecutar `SELECT 1` |
| Arquitectura | Prueba negativa de `server-only` desde un Client Component |
| Estática | `rg "new PrismaClient" src/` → 1 resultado |

> **No escribir tests unitarios para `infra/`.** Un singleton y un cliente de red no tienen lógica de negocio que testear: se prueban ejecutándolos. La cobertura real empieza en la Tarea 04 (repositorios) y explota en la Tarea 20.

---

## 11. Definición de "Hecho" (Definition of Done)

- [x] Todos los criterios de §8 marcados
- [x] `npm run verify` + `npm run build` en verde
- [x] `.env.local` existe localmente y no está en Git
- [x] `.env.example` documenta todas las variables con ejemplos de Supabase
- [ ] Commits con referencia de tarea: `feat(02): conexion prisma-supabase via pooler`
- [ ] PR mergeada a `main`
- [x] `docs/tasks/README.md` actualizado

> Los tres ítems sin marcar son deliberados: no hay commit inicial en el repositorio y el usuario no
> autorizó commits. Ver §13.12 para lo que tampoco pudo verificarse sin credenciales de Supabase.

> **Antes de mergear:** verificar que el plan de Supabase usado tiene **connection pooling habilitado** (Free y Pro lo traen por defecto en el plan actual, pero confirmarlo en el dashboard). Sin él, la URL del pooler no existe.

---

## 12. Dependencias y bloqueos

**Habilita:** 03 (migraciones), 04 (repositorios), 07 (crear el usuario admin vía `supabaseAdmin`).

**Decisiones que esta tarea deja establecidas:**

1. `src/server/infra/prisma.ts` es el **único** lugar del proyecto que instancia `PrismaClient`.
2. `DATABASE_URL` = pooler 6543 (runtime). `DIRECT_DATABASE_URL` = directa 5432 (migraciones). **Esta distinción no se negocia.**
3. Toda la conexión a Supabase desde el servidor pasa por `server-only`.
4. El admin client usa `service_role` y queda reservado para scripts, nunca para Server Actions.
5. `Prisma.Decimal` no es serializable: la Tarea 08 debe definir DTOs con `.toNumber()`.
6. `GET /api/health` existe desde ahora y se reutiliza en el deploy.

---

## 13. Registro de ejecución y desviaciones

**Fecha:** 2026-09-29 · **Verificación:** Postgres 17.11 en Docker (no Supabase real) · `npm audit` 0 vulnerabilidades

### 13.1 Versiones instaladas (desviación de §6.1)

| Paquete | Versión | Motivo |
|---|---|---|
| `prisma` | `6.19.3` (dev) | Última estable de la major 6. `latest` es `8.0.0-rc.17`: una RC no es apta para un cimiento. |
| `@prisma/client` | `6.19.3` | Debe coincidir exactamente con el CLI. |
| `@supabase/supabase-js` | `2.117.2` | Sin conflicto con Prisma: usa la API REST, no la conexión SQL. |
| `tsx` | `4.23.15` (dev) | Ejecutor del seed. |

`DESIGN.md` fija Prisma 6, así que la major 6 es la coherente con el diseño.

### 13.2 `overrides` de `deepmerge-ts` (vulnerabilidad de seguridad)

Instalar Prisma 6.19.3 introdujo **3 vulnerabilidades high**
([GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)): agotamiento de pila al fusionar grafos
de objetos recursivos.

- **Dónde:** `prisma` (CLI, devDependency) → `@prisma/config@6.19.3` → `deepmerge-ts@7.1.5`, fijado de forma exacta.
  **No afecta a `@prisma/client`** ni al runtime de producción.
- **Parche disponible:** `8.0.2`.
- **Opción descartada:** `npm audit fix --force` degrada Prisma a `6.12.0`, perdiendo 7 parches de la major 6.
- **Opción aplicada:** `"overrides": { "deepmerge-ts": "8.0.2" }` en `package.json`.
- **Verificado:** `prisma generate`, `validate`, `db execute`, `migrate status` y `studio` funcionan con el override
  (los subcomandos que fusionan configuración son justamente los que ejercitan la librería). `npm audit` queda en 0.

> Riesgo aceptado: se sustituye una dependencia interna con pin exacto por una major mayor. Si una actualización
> futura de Prisma rompe el CLI, la primera suspects es este override.

### 13.3 Dos archivos de entorno, no uno (desviación de §6.5)

El CLI de Prisma lee `.env` y **`prisma/.env`**, pero **no lee `.env.local`**. Next.js lee ambos.
Como `prisma migrate` corre por CLI y el runtime por Next, la solución sin duplicar valores es:

| Archivo | Contiene | Lo leen |
|---|---|---|
| `.env` | `DATABASE_URL`, `DIRECT_DATABASE_URL` | Prisma CLI **y** Next |
| `.env.local` | Supabase API, Cloudinary, URL del sitio | Solo Next |

En Vercel no hay archivos: las variables se cargan en el panel con la misma distinción.

### 13.4 `globalThis` condicionado a `development`, no a `!== "production"`

El spec (§6.4) usa `NODE_ENV !== "production"`. Se implementó `NODE_ENV === "development"`, que es más
estricto: con la condición original, un proceso de test (`NODE_ENV=test`, o la variable ausente) cachearía
el pool en `globalThis` y arrastraría una conexión abierta entre suites. Solo el hot-reload de desarrollo
necesita el pool reutilizado.

### 13.5 `errorFormat: "minimal"` en producción

Añadido a `createPrismaClient()`. El valor por defecto (`pretty`) imprime cajas coloreadas, rutas absolutas
del filesystem y diffs de query completos. En los logs de una función serverless eso es ruido que además
revela estructura interna.

### 13.6 El health route necesita una excepción de frontera

`capas/rutas` de la Tarea 01 prohíbe `src/app/**` → `src/server/infra/**`, pero §6.8 exige que
`/api/health` importe el singleton. Meter la sonda en un servicio obligaría a inventar lógica cuyo único
propósito sería poder llamar a Prisma, así que se añadió una excepción **acotada a
`src/app/api/health/route.ts`** en `eslint.config.mjs`. Sigue prohibido importar el cliente crudo
(`@prisma/client`), lo que se verificó.

**Bug latente de la Tarea 01 encontrado y corregido:** el patrón `"prisma"` de `ORM_Y_TOOLING` usa
semántica gitignore, así que matcheaba **cualquier** specifier que terminara en ese segmento — incluido
nuestro `@/server/infra/prisma`. Eso hacía imposible escribir la excepción (la marcaba a sí misma) y
generaba un mensaje de error engañoso. Los patrones se anclaron con `/` inicial
(`["/@prisma/client", "/@prisma/*", "/prisma", "/prisma/*"]`) para que apunten al paquete real.

### 13.7 Endurecimientos del health route

- `Cache-Control: no-store` en ambas respuestas: un `503` cacheado por un CDN continuaría sirviéndose
  después de recuperar la base.
- El log del fallo se colapsa a **una línea**. Sin eso, un solo request fallido escribía **477 líneas**
  (el mensaje de Prisma viene multilínea con sugestões de "make sure your database is running"), partiendo
  la entrada en el agregador de logs e impidiendo alertar sobre ella.
- El log registra `nombre + mensaje`, nunca el objeto de error completo: el `meta` de Prisma puede incluir
  la connection string. **Verificado: 0 apariciones de la contraseña en el log.**

### 13.8 `prisma db execute` requiere `--schema`

El comando del spec (§6.6) falla en Prisma 6 sin `--schema`. Documentado en §6.6.

### 13.9 `prisma/seed.ts` placeholder

`package.json` registra `"prisma": { "seed": "tsx prisma/seed.ts" }` desde esta tarea, y `migrate dev` /
`migrate reset` ejecutan el seed al terminar. Sin el archivo, esas migraciones fallarían **al final** con un
error de script inexistente, sin relación aparente con la migración. Se creó un no-op que informa que la
carga real es de la Tarea 05.

### 13.10 `postinstall` no rompe un `npm ci` limpio

Riesgo de §9 ("`npm install` falla con error de Prisma") **verificado y descartado**: `prisma generate`
solo lee el schema y no necesita `DATABASE_URL` para generarse. Comprobado con las variables ausentes
(`exit 0`) y con un `npm ci` completo (465 paquetes, postinstall generó el cliente).

### 13.11 Estado de `package.json#prisma` (deprecación)

Prisma 6.19.3 avisa que `package.json#prisma` se elimina en Prisma 7 y pide un `prisma.config.ts`.
**Se mantiene a propósito:** migrar ahora obligaría a dejar de cargar `.env` automáticamente (el archivo
de config lo desactiva, y haría falta `dotenv` como dependencia nueva), rompiendo el flujo de §13.3.
La advertencia es de una major futura; el proyecto está fijado a la major 6.

### 13.12 Qué NO se pudo verificar

| Criterio | Motivo |
|---|---|
| Pooler de Supabase (6543) y `service_role` reales | No hay credenciales. Verificado contra Postgres 17.11 local. La distinción `url`/`directUrl` está declarada y validada por el schema, pero el comportamiento del pooler queda para cuando existan las credenciales. |
| Plan Free de 7 días y suspensión por inactividad (§9) | Requiere el proyecto real de Supabase. Anotado para la Tarea 21. |

### 13.13 Cómo repetir la verificación local

```bash
docker run -d --name modo-miga-db-probe \
  -e POSTGRES_PASSWORD=probe_local_no_produccion -e POSTGRES_DB=postgres \
  -p 55432:5432 postgres:17-alpine

npm run db:generate
echo "SELECT 1;" | npx prisma db execute --schema prisma/schema.prisma --stdin
npm run dev          # → curl http://localhost:3100/api/health

docker rm -f modo-miga-db-probe
```

> Las variables de `.env` apuntan a ese contenedor. Al reemplazarlas por las URLs reales de Supabase,
> la app deja de depender de Docker.
