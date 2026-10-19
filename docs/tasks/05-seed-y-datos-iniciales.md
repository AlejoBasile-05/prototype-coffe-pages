# Tarea 05 — Seed y Datos Iniciales

| Campo | Valor |
|---|---|
| **ID** | 05 |
| **Fase (DESIGN.md §8.3)** | Fase 1 — Cimientos y Modelado |
| **Depende de** | 03, 04 |
| **Habilita** | 10, 16 |
| **Tipo** | Acceso a Datos — datos iniciales |
| **Esfuerzo est.** | 0.5 – 1 día |

---

## 1. Objetivo de la tarea

Poblar la base con el menú real de Mi Negocio y dejar el sistema en un estado operable: categorías, productos, la fila única de `business_settings` y el usuario administrador con su fila en `staff_members`.

**Criterio de éxito verificable:** `npm run db:seed` se puede ejecutar dos veces seguidas y la segunda no crea ni una fila nueva; `prisma studio` muestra el menú completo; y el usuario administrador existe en `auth.users` **y** en `staff_members` con `role = OWNER`.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 03 (schema aplicado) y Tarea 04 (repositorios tipados).

**Estado del insumo de negocio:** `docs/menu-maestro.md` (Tarea 00) **todavía no existe**. Esta tarea incluye un juego de datos de reemplazo coherente con la paleta del proyecto. Cuando la Tarea 00 cierre, hay que reemplazar el contenido de `prisma/datos-seed/productos.seed.ts` por el menú real, sin tocar el resto del seed.

> - [ ] ¿Existe `docs/menu-maestro.md`? Si **no**: se usan los datos de ejemplo de §6.4 y queda marcado `DATO DE REEMPLAZO` en cada bloque.
> - [ ] ¿El local tiene productos con variantes (simple / doble / con.ruire)? Si **no**: sacar `ProductVariant` del schema (Tarea 03 §6.1 ya lo dejó condicionado) y no crear nada de variantes en el seed. Ver §9.
> - [ ] ¿Cuál es el número de WhatsApp confirmado por escrito, en E.164 sin `+` con prefijo 54? Si todavía no está: se siembra `5492610000000` y se cambia desde el panel (Tarea 17).

### 2.1 Decisión de diseño: ¿repositorios o `supabaseAdmin`?

El seed escribe en dos.googleapis.com dominios que se comportan distinto:

| Escritura | Herramienta | Por qué |
|---|---|---|
| `categories` | `createCategory` / `findAllCategoriesForAdmin` | Es un CRUD común. El repositorio ya traduce `P2002` a `ConflictError` y garantiza el formato del DTO. No hace falta una herramienta privilegiada. |
| `products` | `createProduct` / `findAllProductsForAdmin` | Ídem. Además pasar por el repositorio evita escribir `Prisma.Decimal` a mano. |
| `business_settings` | `saveBusinessSettings` | Es un `upsert` sobre `id = 1` ya implementado. |
| `staff_members` | `createStaffMember` | Idem. |
| **`auth.users`** | **`supabaseAdmin.auth.admin.createUser`** | **No hay otra opción.** El usuario vive en el esquema `auth` de Supabase, fuera del alcance de Prisma en este proyecto (el datasource apunta a `public`). La API de administración de Supabase es la única forma programática de crearlo. |

**Conclusión:** el seed usa **los repositorios para todo lo que está en `public`** y **`supabaseAdmin` únicamente para crear el usuario en `auth.users`**. Después de obtener el `id` del usuario recién creado, vuelve a los repositorios para escribir `staff_members`.

`supabaseAdmin` usa `service_role`, que **bypasea RLS**. Está justificado acá porque el seed corre en tu máquina, en un contexto controlado, una sola vez por ambiente. Nunca debe aparecer en una Server Action (Tarea 07 lo descarta explícitamente).

### 2.2 Idempotencia: qué significa "correr N veces sin duplicar"

Cada entidad tiene una clave natural estable:

| Entidad | Clave natural | Estrategia |
|---|---|---|
| `categories` | `slug` | Crear si no existe. |
| `products` | `slug` | Crear si no existe. |
| `product_variants` | — | No se crean en esta tarea (§9). |
| `business_settings` | `id = 1` | `upsert` (siempre escribe). |
| `staff_members` | `email` | Crear si no existe. |
| `auth.users` | `email` | Reutilizar el usuario si ya existe. |

**La clave es el `slug`, no el `id`.** Un `id` nuevo en cada ejecución duplicaría la fila sin chocar contra ningún `@unique`.

**El seed NO sobrescribe lo que ya existe.** Si el slug está, se omite y se informa. Motivo: el seed se corre una vez sobre una base vacía; cualquier corrida posterior significa que alguien ya cargó datos reales, y pisarlos sería peor que duplicar una línea de código. La única excepción es `business_settings`, que por diseño es un singleton de pocos campos que el admin puede re-editar en un minuto desde la UI (Tarea 17).

Esto es un **upsert laxo**: equivale a `update: {}` en Prisma. Si más adelante hace falta un seed que *sí* actualice precios, se agrega un flag explícito (`--fuerza`) y nunca se cambia el comportamiento por defecto.

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `prisma/seed.ts` | Punto de entrada. Carga de entorno, guardas de seguridad, orquestación y resumen |
| `prisma/datos-seed/categorias.seed.ts` | Las 5 categorías con su orden |
| `prisma/datos-seed/productos.seed.ts` | Productos de ejemplo (reemplazo del menú real) |
| `prisma/datos-seed/negocio.seed.ts` | Datos de `business_settings` y del usuario administrador |
| `src/lib/domain/allergens.ts` | Glosario cerrado de alérgenos (capa 0) — **se define en esta tarea** |
| `src/lib/validation/slug.ts` | Derivación y validación de `slug` (capa 0) — **se define en esta tarea** |
| `docs/menu-maestro.md` | Placeholder si la Tarea 00 no lo dejó. Verificar antes de escribir |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `package.json` | Campo `prisma.seed`: agregar `--conditions=react-server` a `tsx` (§6.2) |
| `src/lib/domain/index.ts` | Reexportar `./allergens` |
| `.env.example` | Agregar `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ALLOW_IN_PRODUCTION` |
| `docs/tasks/README.md` | Marcar Tarea 05 |

### 3.3 Eliminar

Ninguno.

---

## 4. Estructura N-Capas

### 4.1 Qué vive en esta capa

| Ubicación | Qué va | Qué NO va |
|---|---|---|
| `prisma/datos-seed/*.seed.ts` | **Datos literales.** Ni una query, ni una regla. Si un archivo de datos tiene un `if`, está mal diseñado. | Lógica de negocio, acceso a base |
| `prisma/seed.ts` | Orquestación, idempotencia, reporte | Reglas de negocio del catálogo |
| `src/lib/domain/allergens.ts` | El glosario cerrado y su normalización | Nada de lo anterior |
| `src/lib/validation/slug.ts` | Regla de construcción de `slug` | Nada de lo anterior |

### 4.2 Regla de dependencia

```
prisma/seed.ts ──▶ repositorios (capa 4) ──▶ prisma (infra)
       │
       └──▶ supabaseAdmin (infra) ──▶ auth.users
       └──▶ src/lib/domain, src/lib/validation (capa 0)
```

El seed es un **script de infraestructura**, no una capa de la aplicación. Habla con la capa 4 a través de sus funciones públicas, nunca con Prisma directo. La única excepción de alcance es `auth.users`, que Prisma no ve.

### 4.3 Reparto específico

| Necesidad | Dónde vive | Por qué no en otro lado |
|---|---|---|
| Datos del menú | `prisma/datos-seed/` | No es código de la app: no viaja al bundle, no se testea, no se importa desde `src/` |
| Glosario de alérgenos | `src/lib/domain/allergens.ts` | **Sí** es dominio: lo necesitan el formulario admin (16), el catálogo (10) y el seed |
| Construcción de `slug` | `src/lib/validation/slug.ts` | **Sí** es dominio: la usan el seed, el formulario admin y la derivación de `publicId` de Cloudinary (06) |

---

## 5. Convenciones de código (Clean Code + SOLID)

| Decisión | Detalle |
|---|---|
| **Datos > lógica** | Los archivos `.seed.ts` exportan constantes `readonly`. Un producto del menú es un dato, no un comportamiento. |
| **SRP** | Un archivo de datos por dominio (`categorias`, `productos`, `negocio`). Si el menú real crece a 60 productos, partir `productos.seed.ts` por categoría, no hacer un archivo gigante. |
| **Tipos explícitos** | Cada dato tiene su tipo (`readonly`). Un typo en un `slug` se detecta al compilar, no en producción. |
| **Sin `any`, sin `!`** | Igual que en el resto del proyecto. En `noUncheckedIndexedAccess`, acceder a un `Map.get()` devuelve `T | undefined` y hay que verificarlo. |
| **Idempotencia por lectura, no por `catch`** | No se captura `ConflictError` para "ignorar el duplicado". Se **pregunta antes** si existe. La diferencia: `catch` de `P2002` no distingue "ya existía" de "colisión con otra cosa", y esconde bugs reales. |
| **Reporte explícito** | El seed imprime cuántas filas creó y cuántas omitió. Un script silencioso en `npm run db:seed` es un script del que nadie confía. |

---

## 6. Pasos de implementación

### 6.1 Glosario de alérgenos

```ts
// src/lib/domain/allergens.ts

/**
 * Glosario cerrado de alérgenos (Tarea 00 §5).
 *
 * Es CERRADO a propósito: no se agrega una clave sin que el encargado la
 * confirme. Un alérgeno inventado en el menú es un problema legal y de
 * salud, no un detalle de contenido.
 *
 * ⛔ Las claves se guardan y se muestran **con tilde y con eñe**,
 *    exactamente como están acá: "maní", "sésamo".
 *    El sistemaInterno puede venir sin tilde; eso se resuelve con
 *    `toCanonicalAllergen`, que compara normalizada y devuelve la
 *    clave canónica. Ver `normalizeAllergenKey` más abajo.
 */
export const ALERGENOS = [
  "gluten",
  "lactosa",
  "huevo",
  "maní",
  "frutos secos",
  "sésamo",
  "soja",
] as const;

export type Allergen = (typeof ALERGENOS)[number];

const CANONICAL_BY_KEY: ReadonlyMap<string, Allergen> = new Map(
  ALERGENOS.map((allergen) => [normalizeAllergenKey(allergen), allergen]),
);

/**
 * Reduce un valor a la clave de comparación.
 *
 * Descompone en NFD y saca los diacríticos, de modo que "Maní", "MANÍ",
 * "maní " y "mani" colisionan en la misma clave. La ñ se descompone en
 * "n" + tilde combinante, así que "maní" y "mani" también.
 *
 * ⚠️ Consecuencia asumida: dos alérgenos distintos que solo difieran en
 * tildes serían indistinguibles. Con un glosario cerrado de 7 claves
 * eso no ocurre, y aun si occurriera se avisaría al agregar la clave.
 */
export const normalizeAllergenKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/** Traduce una entrada del usuario a la clave canónica, o `null` si no existe en el glosario. */
export const toCanonicalAllergen = (value: string): Allergen | null =>
  CANONICAL_BY_KEY.get(normalizeAllergenKey(value)) ?? null;

export const isAllergen = (value: string): value is Allergen =>
  CANONICAL_BY_KEY.has(normalizeAllergenKey(value));
```

```ts
// src/lib/domain/index.ts
export * from "./errors";
export * from "./product";
export * from "./category";
export * from "./settings";
export * from "./allergens"; // nuevo en la Tarea 05
```

### 6.2 Correr TypeScript fuera de Next: el problema de `server-only`

Los repositorios de la Tarea 04 arrancan con `import "server-only"`. Ese paquete **lanza una excepción al importarse** fuera del pipeline de Next:

```
Error: This module cannot be imported from a Client Component module.
It should only be used from a Server Component.
```

`tsx` resuelve el paquete con la condición `default`, que es la que lanza. La condición `react-server` resuelve al módulo vacío. Por eso el comando del seed lleva esa condición:

```jsonc
// package.json
{
  "prisma": {
    // Antes:  "seed": "tsx prisma/seed.ts"
    "seed": "tsx --conditions=react-server prisma/seed.ts"
  }
}
```

El script `db:seed` no cambia: sigue siendo `prisma db seed`, que lee el campo `prisma.seed`. Alternativa si `--conditions`/molesta a alguna herramienta: un `prisma/tsconfig.seed.json` con `"paths": { "server-only": ["./empty-server-only.ts"] }` y `tsx --tsconfig prisma/tsconfig.seed.json`. **No** agregar el alias al `tsconfig.json` raíz: ahí Next lo resolvería también y se perdería la protección real de `server-only`.

### 6.3 Carga de entorno en el orden correcto

`src/server/infra/prisma.ts` y `src/server/infra/supabase/admin.ts` leen `process.env` **en el momento de importarse**. Si el `import` es estático y el entorno todavía no está cargado, el módulo revienta con variables faltantes.

Por eso el seed carga el entorno primero y recién después importa la infraestructura de forma diferida:

```ts
// prisma/seed.ts
import { config as cargarEntorno } from "dotenv";

/**
 * Orden de carga: `.env.local` primero, `.env` después.
 *
 * `dotenv` NO pisa variables ya definidas, así que `.env.local` gana.
 * Es la convención de Next: `.env.local` pisa a `.env` y a `.env`.
 *
 * Por qué `dotenv` y no `--env-file`: el flag de Node **da prioridad al
 * entorno del proceso** sobre el archivo, o sea que `.env` (que carga el
 * CLI de Prisma) le ganaría a `.env.local`. Con dotenv el orden es
 * explícito y no depende de quién lanzó el proceso.
 */
cargarEntorno({ path: ".env.local" });
cargarEntorno();

const { ejecutarSeed } = await import("./datos-seed/ejecutar-semilla");
const { disconnectDatabase } = await import("../src/server/infra/prisma");

try {
  await ejecutarSeed();
} catch (error) {
  console.error("\n[seed] Falló la siembra de datos:\n", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
```

El `import type` y las constantes de datos sí pueden ser estáticos: no leen el entorno.

Instalación:

```bash
npm i -D dotenv
```

### 6.4 Datos de ejemplo

> **DATO DE REEMPLAZO.** `docs/menu-maestro.md` no existe. Estos productos sirven para que el catálogo se vea real mientras tanto. Cuando la Tarea 00 cierre, se reemplaza el archivo entero por el menú confirmado. **No** son precios reales: no publicar el sitio con estos valores.

```ts
// prisma/datos-seed/categorias.seed.ts

export interface CategoriaSeed {
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly position: number;
  readonly isVisible: boolean;
}

/** El orden es el de aparición en el menú. Menor `position` = primero. */
export const CATEGORIAS_SEED: readonly CategoriaSeed[] = [
  {
    name: "Clásicos",
    slug: "clasicos",
    description: "Los de siempre. Sin vueltas.",
    position: 0,
    isVisible: true,
  },
  {
    name: "Premium",
    slug: "premium",
    description: "Cortes seleccionados y más cantidad de filling.",
    position: 1,
    isVisible: true,
  },
  {
    name: "Combos",
    slug: "combos",
    description: "Sándwich + bebida. Mejor precio que por separado.",
    position: 2,
    isVisible: true,
  },
  {
    name: "Bebidas",
    slug: "bebidas",
    description: "Gaseosas, jugos y agua.",
    position: 3,
    isVisible: true,
  },
  {
    name: "Postres",
    slug: "postres",
    description: "Para terminar.",
    position: 4,
    isVisible: true,
  },
];
```

```ts
// prisma/datos-seed/productos.seed.ts

import type { CategoriaSeed } from "./categorias.seed";
import type { Allergen } from "../../src/lib/domain/allergens";

export interface ProductoSeed {
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly price: number;
  readonly categorySlug: CategoriaSeed["slug"];
  readonly allergens: readonly Allergen[];
  readonly isFeatured: boolean;
  readonly isAvailable: boolean;
  /** Editorial. Los DRAFT no salen del catálogo público. */
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  readonly imageSample: string;
  readonly sortOrder: number;
}

/**
 * Imágenes de relleno.
 *
 * ⛔ NO son fotos de los sándwiches reales (Tarea 00 §8: las fotos de
 * stock genéricas están prohibidas). Son imágenes de la nube `demo` de
 * Cloudinary para que el layout se vea completo. Las fotos reales se
 * suben en la Tarea 16.
 *
 * ⛔ `imagePublicId` va en `null` para TODOS los productos del seed, y no
 * por descuido. Si se inventara un `publicId`, la Tarea 06 intentaría
 * destruir un asset inexistente en el primer reemplazo de foto y el
 * error cortaría el guardado. `null` = "no hay asset que destruir".
 */
export const buildImagenDeRelleno = (imageSample: string): string =>
  `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,g_auto,w_1200/${imageSample}.jpg`;

/** DATO DE REEMPLAZO — ver cabecera de §6.4. */
export const PRODUCTOS_SEED: readonly ProductoSeed[] = [
  {
    name: "Jamón y Queso",
    slug: "jamon-y-queso",
    description: "Jamón cocido y queso cheddar en pan de miga casero.",
    price: 1450,
    categorySlug: "clasicos",
    allergens: ["gluten", "lactosa"],
    isFeatured: true,
    isAvailable: true,
    status: "PUBLISHED",
    imageSample: "cld-sample",
    sortOrder: 0,
  },
  {
    name: "Jamón y Queso Doble",
    slug: "jamon-y-queso-doble",
    description: "Doble de jamón y doble de queso.",
    price: 1850,
    categorySlug: "clasicos",
    allergens: ["gluten", "lactosa"],
    isFeatured: false,
    isAvailable: true,
    status: "PUBLISHED",
    imageSample: "cld-sample-2",
    sortOrder: 1,
  },
  {
    name: "Roast Beef",
    slug: "roast-beef",
    description: "Roast beef tibio, queso y mostaza suave.",
    price: 2100,
    categorySlug: "clasicos",
    allergens: ["gluten", "lactosa", "sésamo"],
    isFeatured: true,
    isAvailable: true,
    status: "PUBLISHED",
    imageSample: "cld-sample-3",
    sortOrder: 2,
  },
  {
    name: "Milanesa Completa",
    slug: "milanesa-completa",
    description: "Milanesa de corte, palta y mayonesa de la casa.",
    price: 2600,
    categorySlug: "premium",
    allergens: ["gluten", "huevo"],
    isFeatured: true,
    isAvailable: true,
    status: "PUBLISHED",
    imageSample: "cld-sample-4",
    sortOrder: 0,
  },
  {
    name: "Milanesa de Pollo",
    slug: "milanesa-de-pollo",
    description: "Milanesa de pollo crocante con alcaparras.",
    price: 2400,
    categorySlug: "premium",
    allergens: ["gluten", "huevo"],
    isFeatured: false,
    isAvailable: true,
    status: "PUBLISHED",
    imageSample: "cld-sample-5",
    sortOrder: 1,
  },
  {
    name: "Vegetariano",
    slug: "vegetariano",
    description: "Palta, tomate, cebolla morada y tela verde.",
    price: 1900,
    categorySlug: "premium",
    allergens: ["gluten", "sésamo"],
    isFeatured: false,
    isAvailable: true,
    status: "PUBLISHED",
    imageSample: "cld-sample",
    sortOrder: 2,
  },
  {
    name: "Combo Clásico + Bebida",
    slug: "combo-clasico-bebida",
    description: "Sándwich a elección de la línea clásica y una bebida de 500 ml.",
    price: 2350,
    categorySlug: "combos",
    allergens: ["gluten", "lactosa"],
    isFeatured: false,
    isAvailable: true,
    status: "PUBLISHED",
    imageSample: "cld-sample-2",
    sortOrder: 0,
  },
  {
    name: "Gaseosa 500 ml",
    slug: "gaseosa-500",
    description: "Descartable o retornable.",
    price: 900,
    categorySlug: "bebidas",
    allergens: [],
    isFeatured: false,
    isAvailable: true,
    status: "PUBLISHED",
    imageSample: "cld-sample-3",
    sortOrder: 0,
  },
  {
    name: "Agua Mineral",
    slug: "agua-mineral",
    description: "Botella de 500 ml, con o sin gas.",
    price: 800,
    categorySlug: "bebidas",
    allergens: [],
    isFeatured: false,
    isAvailable: true,
    status: "PUBLISHED",
    imageSample: "cld-sample-4",
    sortOrder: 1,
  },
  {
    name: "Jugo de Naranja",
    slug: "jugo-de-naranja",
    description: "Exprimido del día. 400 ml.",
    price: 1600,
    categorySlug: "bebidas",
    allergens: [],
    isFeatured: false,
    isAvailable: true,
    status: "PUBLISHED",
    imageSample: "cld-sample-5",
    sortOrder: 2,
  },
  {
    name: "Flan con dulce de leche",
    slug: "flan-con-dulce-de-leche",
    description: "Flan casero con dulce de leche y crema.",
    price: 1200,
    categorySlug: "postres",
    allergens: ["lactosa", "huevo"],
    isFeatured: false,
    isAvailable: true,
    status: "PUBLISHED",
    imageSample: "cld-sample",
    sortOrder: 0,
  },
  {
    name: "Alfajor de chocolate",
    slug: "alfajor-de-chocolate",
    description: "Chocolate negro y dulce de leche.",
    price: 950,
    categorySlug: "postres",
    allergens: ["gluten", "lactosa", "frutos secos"],
    isFeatured: false,
    isAvailable: true,
    status: "PUBLISHED",
    imageSample: "cld-sample-2",
    sortOrder: 1,
  },
  {
    name: "Sándwich del día",
    slug: "sandwich-del-dia",
    description: "Receta rotativa del día. Precio en definición.",
    price: 0,
    categorySlug: "clasicos",
    allergens: [],
    isFeatured: false,
    isAvailable: false,
    // DRAFT a propósito: demuestra el eje editorial separado del operativo.
    // Con precio sin confirmar nunca se publica (Tarea 03 §9).
    status: "DRAFT",
    imageSample: "cld-sample-3",
    sortOrder: 3,
  },
];
```

### 6.5 Datos del negocio y del administrador

```ts
// prisma/datos-seed/negocio.seed.ts

/**
 * Datos del negocio (Tarea 00).
 *
 * ⚠️ `whatsappPhone` y `address` son PROVISIONALES hasta que el encargado
 * confirme por escrito el número. Si el seed corre con este valor y se
 * publica el sitio, el link de WhatsApp lleva a un número equivocado.
 * Cambiar desde el panel (Tarea 17) o en este archivo.
 */
export const NEGOCIO_SEED = {
  name: "Mi Negocio",
  /** E.164 sin `+`, con prefijo 54 y área 261. Coincide con
   * `DEFAULT_BUSINESS_SETTINGS` del repositorio (Tarea 04 §6.5). */
  whatsappPhone: "5492610000000",
  address: "San Rafael, Mendoza",
  instagramUrl: null,
  /** Sin horarios cargados todavía. El local abre por fuera. */
  openingHours: {},
  closingMessage: null,
  legalNotice:
    "Mi Negocio · San Rafael, Mendoza. Precios en pesos argentinos. " +
    "No hacemos pagos online: el pedido se confirma por WhatsApp.",
} as const;

/**
 * Administrador inicial.
 *
 * El email **tiene que ser el del encargado**, no uno inventado. Si el
 * seed crea `admin@ejemplo.com`, en producción nadie va a poder entrar y
 * la única salida es entrar al panel de Supabase a mano.
 *
 * La contraseña es opcional a propósito:
 *   - Si está `SEED_ADMIN_PASSWORD`: se crea el usuario con contraseña
 *     y `email_confirm: true` (no se envía mail de confirmación).
 *   - Si NO está: se crea el usuario SIN contraseña, confirmado, para que
 *     entre por link mágico (Tarea 07). Es la opción recomendada para el
 *     primer arranque: nadie memoriza una contraseña de un sistema nuevo.
 */
export const leerAdminDelEntorno = (): {
  readonly email: string;
  readonly password: string | null;
} => {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  if (email === undefined || email === "") {
    throw new Error(
      "Falta SEED_ADMIN_EMAIL. Agregalo a .env.local con el email del encargado.",
    );
  }
  return { email, password: process.env.SEED_ADMIN_PASSWORD?.trim() ?? null };
};
```

`.env.local`:

```bash
# Datos de la siembra. No son secretos de la app: se pueden borrar después.
SEED_ADMIN_EMAIL=encargado@modomiga.com.ar
SEED_ADMIN_PASSWORD=

# Solo para sembrar en producción con datos reales. Ver §9.
SEED_ALLOW_IN_PRODUCTION=0
```

### 6.6 Orquestación del seed

```ts
// prisma/datos-seed/ejecutar-semilla.ts

import { toCanonicalAllergen, type Allergen } from "../../src/lib/domain/allergens";
import { createCategory, findAllCategoriesForAdmin } from "../../src/server/repositories/category.repository";
import { createProduct, findAllProductsForAdmin } from "../../src/server/repositories/product.repository";
import { saveBusinessSettings } from "../../src/server/repositories/settings.repository";
import { createStaffMember, findStaffByEmail } from "../../src/server/repositories/staff.repository";
import { supabaseAdmin } from "../../src/server/infra/supabase/admin";
import { CATEGORIAS_SEED } from "./categorias.seed";
import { PRODUCTOS_SEED, buildImagenDeRelleno } from "./productos.seed";
import { NEGOCIO_SEED, leerAdminDelEntorno } from "./negocio.seed";

/**
 * Reporte acumulado. Se imprime al final.
 * Un seed callado es un seed del que nadie confía.
 */
interface Reporte {
  readonly creados: string[];
  readonly omitidos: string[];
  readonly errores: string[];
}

const crearReporte = (): Reporte => ({ creados: [], omitidos: [], errores: [] });

const registrarError = (reporte: Reporte, paso: string, error: unknown): void => {
  const mensaje = error instanceof Error ? error.message : String(error);
  reporte.errores.push(`${paso}: ${mensaje}`);
  console.error(`[seed] ${paso} -> ${mensaje}`);
};
```

> Este archivo **no** lleva `import "server-only"`: corre bajo `tsx`, no bajo Next. Los repositorios que importa sí lo llevan, y por eso el comando del seed necesita `--conditions=react-server` (§6.2).

```ts
// prisma/datos-seed/ejecutar-semilla.ts (continuación)

/**
 * Normaliza los alérgenos del dato semilla.
 *
 * Si el menú llegara con "Maní" o "MANI", acá se guarda "maní". Si una
 * clave no está en el glosario, se descarta y se avisa: es preferible un
 * alérgeno faltante en el dato de ejemplo que uno inventado en la base.
 */
const prepararAlergenos = (
  valores: readonly string[],
  nombre: string,
  reporte: Reporte,
): Allergen[] => {
  const canonicos = valores
    .map((valor) => toCanonicalAllergen(valor))
    .filter((valor): valor is Allergen => valor !== null);

  const descartados = valores.length - canonicos.length;
  if (descartados > 0) {
    registrarError(reporte, `alérgenos de "${nombre}"`, `${descartados} fuera del glosario`);
  }
  return canonicos;
};

const sembrarConfiguracion = async (reporte: Reporte): Promise<void> => {

  await saveBusinessSettings({
    name: NEGOCIO_SEED.name,
    whatsappPhone: NEGOCIO_SEED.whatsappPhone,
    address: NEGOCIO_SEED.address,
    instagramUrl: NEGOCIO_SEED.instagramUrl,
    openingHours: NEGOCIO_SEED.openingHours,
    closingMessage: NEGOCIO_SEED.closingMessage,
    legalNotice: NEGOCIO_SEED.legalNotice,
  });
  reporte.creados.push("business_settings (id=1, siempre sobrescrito)");
};

const sembrarCategorias = async (reporte: Reporte): Promise<Map<string, string>> => {
  // Lee TODAS, no solo las visibles: si el encargado ocultó una categoría
  // desde el panel, una corrida posterior no debe resucitarla.
  const existentes = new Map(
    (await findAllCategoriesForAdmin()).map((categoria) => [categoria.slug, categoria]),
  );

  const idsPorSlug = new Map<string, string>();

  for (const categoria of CATEGORIAS_SEED) {
    const existente = existentes.get(categoria.slug);
    if (existente !== undefined) {
      reporte.omitidos.push(`categoría "${categoria.slug}" (ya existía)`);
      idsPorSlug.set(categoria.slug, existente.id);
      continue;
    }

    const creada = await createCategory({
      name: categoria.name,
      slug: categoria.slug,
      description: categoria.description,
      position: categoria.position,
      isVisible: categoria.isVisible,
    });
    idsPorSlug.set(categoria.slug, creada.id);
    reporte.creados.push(`categoría "${categoria.slug}"`);
  }

  return idsPorSlug;
};

const sembrarProductos = async (
  idsPorSlug: ReadonlyMap<string, string>,
  reporte: Reporte,
): Promise<void> => {
  const existentes = new Map(
    (await findAllProductsForAdmin()).map((producto) => [producto.slug, producto]),
  );

  for (const producto of PRODUCTOS_SEED) {
    if (existentes.has(producto.slug)) {
      reporte.omitidos.push(`producto "${producto.slug}" (ya existía)`);
      continue;
    }

    const categoryId = idsPorSlug.get(producto.categorySlug);
    if (categoryId === undefined) {
      registrarError(reporte, `producto "${producto.slug}"`, `categoría "${producto.categorySlug}" inexistente`);
      continue;
    }

    await createProduct({
      name: producto.name,
      slug: producto.slug,
      description: producto.description,
      // Literal de 2 decimales o menos. Ver §9 "precio con centavos".
      price: producto.price,
      imageUrl: buildImagenDeRelleno(producto.imageSample),
      // ⛔ null: el asset de relleno no existe en la nube `demo`.
      //    Ver la nota de PRODUCTOS_SEED.
      imagePublicId: null,
      categoryId,
      status: producto.status,
      isFeatured: producto.isFeatured,
      isAvailable: producto.isAvailable,
      allergens: prepararAlergenos(producto.allergens, producto.name, reporte),
      sortOrder: producto.sortOrder,
    });
    reporte.creados.push(`producto "${producto.slug}"`);
  }
};
```

El alta del administrador es el único punto que necesita `supabaseAdmin`:

```ts
// prisma/datos-seed/ejecutar-semilla.ts (continuación)

/**
 * Crea el usuario en `auth.users` y su fila en `staff_members`.
 *
 * ⛔ `SUPABASE_SERVICE_ROLE_KEY` bypasea RLS. Se usa acá y en ningún otro
 *    lado: acá corre un script local una vez por ambiente.
 */
const sembrarAdministrador = async (reporte: Reporte): Promise<void> => {
  const { email, password } = leerAdminDelEntorno();

  const { data: creado, error: errorCreacion } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      ...(password === null ? {} : { password }),
      email_confirm: true, // No dependemos de que alguien haga clic en un mail.
      user_metadata: { name: NEGOCIO_SEED.name },
    });

  let userId: string;

  if (creado?.user !== null && creado?.user !== undefined) {
    userId = creado.user.id;
    reporte.creados.push(`auth.users "${email}"`);
  } else {
    // Ya existía. `createUser` falla con "User already registered" y eso
    // NO es un error del seed: se busca el usuario existente.
    if (errorCreacion === null) {
      registrarError(reporte, "administrador", "no se pudo crear ni recuperar el usuario");
      return;
    }
    const existente = await buscarUsuarioPorEmail(email);
    if (existente === null) {
      registrarError(reporte, "administrador", errorCreacion.message);
      return;
    }
    userId = existente;
    reporte.omitidos.push(`auth.users "${email}" (ya existía)`);
  }

  const yaRegistrado = await findStaffByEmail(email);
  if (yaRegistrado !== null) {
    reporte.omitidos.push(`staff_members "${email}" (ya existía)`);
    return;
  }

  await createStaffMember({
    id: userId,
    email,
    name: null,
    role: "OWNER",
  });
  reporte.creados.push(`staff_members "${email}" (OWNER)`);
};

/**
 * `listUsers` pagina y por defecto trae 50. Un local tiene 2 o 3 usuarios,
 * así que una sola página alcanza; el filtro por email evita depender del orden.
 */
const buscarUsuarioPorEmail = async (email: string): Promise<string | null> => {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  if (error !== null) return null;
  const usuario = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return usuario?.id ?? null;
};
```

Punto de entrada y reporte:

```ts
// prisma/datos-seed/ejecutar-semilla.ts (continuación)

/**
 * ⛔ Guarda de producción. Un `db:seed` con datos reales sobre la base de
 * producción pisa `business_settings` (incluido el número de WhatsApp).
 * Razón de más para que sea explícito y no un recordatorio en la wiki.
 */
const verificarGuardas = (): void => {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.SEED_ALLOW_IN_PRODUCTION !== "1") {
    throw new Error(
      "⛔ El seed está bloqueado en producción. Si realmente hay que correrlo, " +
        "exportá SEED_ALLOW_IN_PRODUCTION=1 y verificá el número de WhatsApp después.",
    );
  }
  console.warn("[seed] ⚠️ Corriendo el seed sobre PRODUCCIÓN.");
};

export const ejecutarSeed = async (): Promise<void> => {
  verificarGuardas();

  const reporte = crearReporte();
  console.log("[seed] Iniciando…");

  try {
    await sembrarConfiguracion(reporte);
  } catch (error) {
    registrarError(reporte, "business_settings", error);
  }

  let idsPorSlug = new Map<string, string>();

  try {
    idsPorSlug = await sembrarCategorias(reporte);
  } catch (error) {
    registrarError(reporte, "categorías", error);
  }

  if (idsPorSlug.size > 0) {
    try {
      await sembrarProductos(idsPorSlug, reporte);
    } catch (error) {
      registrarError(reporte, "productos", error);
    }
  }

  try {
    await sembrarAdministrador(reporte);
  } catch (error) {
    registrarError(reporte, "administrador", error);
  }

  console.log(`\n[seed] Creados: ${reporte.creados.length}`);
  for (const linea of reporte.creados) console.log(`  + ${linea}`);
  console.log(`[seed] Omitidos: ${reporte.omitidos.length}`);
  for (const linea of reporte.omitidos) console.log(`  = ${linea}`);

  if (reporte.errores.length > 0) {
    console.error(`[seed] Errores: ${reporte.errores.length}`);
    for (const linea of reporte.errores) console.error(`  ! ${linea}`);
    throw new Error("El seed terminó con errores. Revisá el log de arriba.");
  }

  console.log("\n[seed] Listo. Si los datos son de ejemplo, reemplazalos antes de publicar.");
};
```

### 6.7 Ejecutar y verificar

```bash
# 1. Cargar variables de entorno (con el email real del encargado)
#    Editar .env.local: SEED_ADMIN_EMAIL=...

# 2. Primera corrida
npm run db:seed

# 3. Segunda corrida: debe omitir todo
npm run db:seed

# 4. Contar filas
npx prisma db execute --stdin <<'SQL'
SELECT 'categorias' AS tabla, COUNT(*) FROM categories
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'business_settings', COUNT(*) FROM business_settings
UNION ALL SELECT 'staff_members', COUNT(*) FROM staff_members;
SQL

# 5. El usuario existe en auth.users (por el cliente, no por Prisma)
node -e "
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
s.auth.admin.listUsers().then(({ data }) =>
  console.log(data.users.map((u) => u.email + ' → ' + u.id).join('\n')));
"
```

Salida esperada de la segunda corrida:

```
[seed] Creados: 0
[seed] Omitidos: 20
  = categoría "clasicos" (ya existía)
  = producto "jamon-y-queso" (ya existía)
  ...
```

### 6.8 `slug` determinístico

```ts
// src/lib/validation/slug.ts

/**
 * Construye el `slug` a partir del nombre.
 *
 * Es la MISMA función que usa la Tarea 16 para derivar el `slug` de un
 * producto nuevo y el `public_id` de su imagen (Tarea 06). Si el slug se
 * construyera de dos maneras distintas, un mismo producto tendría dos
 * identidades.
 *
 * Regla: minúsculas, sin tildes, sin signos, palabras separadas por `-`.
 */
export const buildSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** Un slug válido solo puede contener `[a-z0-9-]` y no puede arrancar con `-`. */
export const isValidSlug = (value: string): boolean =>
  value.length > 0 && value.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
```

---

## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `ALERGENOS`, `Allergen`, `toCanonicalAllergen`, `normalizeAllergenKey` | `src/lib/domain/allergens.ts` | **Tarea 16** (formulario de producto), 10 (filtro de alérgenos), 05 |
| `buildSlug`, `isValidSlug` | `src/lib/validation/slug.ts` | 05, **Tarea 06** (`public_id` de Cloudinary), 16 |
| `CategoriaSeed` | `prisma/datos-seed/categorias.seed.ts` | Solo el seed |
| `ProductoSeed` | `prisma/datos-seed/productos.seed.ts` | Solo el seed |
| `NEGOCIO_SEED`, `leerAdminDelEntorno` | `prisma/datos-seed/negocio.seed.ts` | Solo el seed |
| `findAllCategoriesForAdmin` / `createCategory` | `category.repository.ts` | 05 (lectura de idempotencia) |
| `findAllProductsForAdmin` / `createProduct` | `product.repository.ts` | 05 |
| `saveBusinessSettings` | `settings.repository.ts` | 05 |
| `findStaffByEmail` / `createStaffMember` | `staff.repository.ts` | 05, **Tarea 07** |
| `supabaseAdmin` | `src/server/infra/supabase/admin.ts` | 05, 07, 21 |

**Contrato que NO existe todavía:** `findCategoryBySlug`. La Tarea 04 expone `findCategoryById`, `findAllCategoriesForAdmin` y `findVisibleCategories`, pero nada por slug. El seed resuelve la búsqueda cargando las categorías una sola vez en memoria. Si en el futuro el slug aparece como criterio en varios lados, agregar `findCategoryBySlug` al repositorio, no un `findFirst` suelto en el seed.

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [x] `prisma/seed.ts` carga `.env.local` y después `.env`, antes de importar la infraestructura
- [x] Se crean las 5 categorías con su `position` y `isVisible`
- [x] Se crean los 23 productos del set MOCK con sus alérgenos normalizados ¹
- [x] Todos los productos del seed tienen `imagePublicId: null`
- [x] Existe la fila `business_settings` con `id = 1` y los datos de la Tarea 00 (`id = '1'` string, ver §13)
- [ ] El usuario administrador existe en `auth.users` **y** en `staff_members` con `role = OWNER` — 🔴 **bloqueado**: no hay proyecto Supabase real (mismo bloqueo que la Tarea 02). El seed lo detecta y lo omite con aviso explícito; la próxima corrida con credenciales lo crea. Ver §13.
- [x] `npm run db:seed` corrido dos veces no crea filas nuevas (2ª corrida: `Creados: 1` = solo el upsert de settings, `Omitidos: 29`)
- [x] El script imprime cuántas filas creó y cuántas omitió
- [x] Los productos MOCK nacen en `DRAFT`; con `SEED_PUBLISH_MOCK=true` los 23 pasan a `PUBLISHED` (verificado en base limpia)
- [x] `prisma studio` muestra categorías, productos y ajustes (verificado por SQL: 5 categorías, 23 productos, 1 fila de settings)

¹ La tarea original contaba 13 productos porque se escribió **antes** de que cerrara el set MOCK de la Tarea 00 (23). La fuente de verdad es `docs/menu-maestro.md` §3.

### 8.2 Calidad

- [x] `npm run verify` en verde (71 tests, 6 archivos)
- [x] `npm run build` en verde
- [x] `npm run db:seed` no tira el error de `server-only` (se usa `--conditions=react-server` en el comando)
- [x] Los archivos `*.seed.ts` no contienen ninguna query ni llamada a la base
- [x] Ningún archivo del seed importa Prisma directamente (van por repositorios; solo `seed.ts` toca `prisma` para `$disconnect` en `finally`)
- [x] Ningún archivo del seed usa `any`, `@ts-ignore` ni `!`
- [x] El seed aborta si falta `SEED_ADMIN_EMAIL`, con un mensaje que diga qué configurar (solo cuando Supabase está realmente configurado; en modo placeholder se omite el paso con aviso — ver §13)
- [x] El seed aborta en `NODE_ENV=production` sin `SEED_ALLOW_IN_PRODUCTION=1`

### 8.3 Arquitectura

- [x] **Las escrituras de `public` van por repositorios**, no por `supabaseAdmin` ni por Prisma
- [x] `supabaseAdmin` se usa solo para `auth.users` (import dinámico, solo cuando hay credenciales reales)
- [x] El seed no importa `@/server/services` ni `@/app` ni `@/components`
- [x] Los datos deSeed están tipados (`readonly`), no son objetos literales sueltos
- [x] La idempotencia se resuelve **preguntando antes** (`findAll*`), no capturando `ConflictError`
- [x] El seed usa `findAllCategoriesForAdmin` y no `findVisibleCategories` (una categoría ocultada por el admin no debe resucitar)
- [x] `ALERGENOS` vive en `src/lib/domain/` (capa 0), no en `prisma/`

### 8.4 Pruebas

- [x] `tests/unit/allergens.test.ts` cubre la normalización del glosario (incluye los casos de la tarea y `pescado` de ADR-24)
- [x] `tests/unit/slug.test.ts` cubre `buildSlug` e `isValidSlug` (tildes, signos, espacios, límite 80)
- [x] Verificación manual: los conteos de la §6.7 paso 4 son los esperados después de la segunda corrida (5 / 23 / 1 / 0)
- [ ] Verificación manual: `staff_members` tiene el mismo `id` que el `id` del usuario en `auth.users` — 🔴 bloqueado igual que el alta del admin (sin Supabase real)

### 8.5 Documentación

- [x] Los datos están marcados como MOCK (banner en cabecera de cada archivo `*.seed.ts`, referenciando `menu-maestro.md` §0)
- [x] Está anotado que las fotos de relleno se reemplazan en la Tarea 16
- [x] Está anotado que el número es provisional (`5492615000000` = MOCK de B-1, no `5492610000000` como decía un boceto previo)
- [x] `docs/menu-maestro.md` ya existe (Tarea 00): el seed se escribió **contra su set MOCK**, no contra el §6.4 de ejemplo
- [x] `docs/tasks/README.md` actualizado

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado |
|---|---|
| **Seed sobre una base con datos reales** | ⛔ Nunca `db:reset` en producción: borra la tabla y deja los assets de Cloudinary huérfanos, sin forma de recuperarlos. El seed es aditivo: omite lo que ya existe y solo pisa `business_settings`. La guarda `NODE_ENV=production` corta el resto. |
| **Categoría duplicada en los datos** | No se detecta: el segundo elemento con el mismo `slug` encuentra el mapa ya poblado y se omite como "ya existía". Sin error. Es la conducta correcta para un seed. |
| **Producto con `slug` repetido** | Ídem: el segundo se omite. Si el `slug` existe en la base pero con **otro** nombre, también se omite y se informa el slug, no el nombre. |
| **`allergens: ["Maní", "MANI"]`** | Ambos normalizan a `"maní"`. No se deduplica el array: queda `["maní", "maní"]`. Si el formulario (Tarea 16) permite duplicados, deduplicar ahí con `new Set`. Acá se deja visible el error de entrada. |
| **Alérgeno fuera del glosario (`"sulfito"`)** | `toCanonicalAllergen` devuelve `null`, la clave se descarta y se registra el error. ⚠️ Un alérgeno desconocido en un producto real es un riesgo: la Tarea 16 tiene que agregarlo al glosario **con confirmación del encargado**, no dejarlo pasar. |
| **Precio con centavos (`1450.5`)** | `Decimal(10,2)` acepta 2 decimales. El DTO devuelve `number` con `.toNumber()` y el formateador `es-AR` los muestra solo si hace falta. Para 3 decimales, la base trunca. En el seed los precios son **literales**, nunca resultado de una operación (`1450 + 0.1`), porque ahí sí aparece el error de punto flotante. |
| **`whatsappPhone` con espacios o `+`** | El repositorio guarda lo que le llega. El campo se escribe en E.164 sin `+` (`5492610000000`). `buildWhatsAppUrl` (Tarea 12) sanifica a solo dígitos. La validación real del formato la pone el Zod de ajustes (Tarea 17). |
| **`business_settings` ya editada por el admin** | El seed la **pisa**. Es la excepción consciente a la regla de no sobrescribir. Si molesta, cambiar el seed a "crear si no existe" leyendo si la fila existe. Requiere una función de lectura que hoy no expone el repositorio (ver §12). |
| **Imagen de relleno que desaparece** | Las imágenes `cld-sample` de la nube `demo` no tienen SLA. Si un producto se ve roto en `/menu`, es eso: la Tarea 16 sube la foto real. `next/image` no revienta la página: muestra el placeholder. |
| **`auth.users` sin fila en `staff_members`** | Situación que **nunca** produce el seed: si `createStaffMember` falla, el error va al reporte y el seed termina con código de salida 1. Es exactamente el estado que la Tarea 07 tiene que rechazar en el login. |
| **`createUser` falla con "User already registered"** | No es un error del seed. Se busca con `listUsers` y se sigue con el `id` existente. |
| **`listUsers` devuelve la primera página y el usuario está en la segunda** | Con `perPage: 200` y 2 o 3 usuarios de un local, no ocurre. Si algún día el proyecto tiene más de 200 usuarios (no va a pasar: el panel es de 2 o 3 personas), agregar paginación. |
| **Falla la base a mitad del seed** | El paso que falla se registra en `reporte.errores`, los pasos siguientes intentan igual (idempotentes) y al final se lanza el error. No hay transacción global: no se puede envolver `auth.users` en una transacción de Prisma, y además una transacción sobre 20 filas de datos iniciales no aporta nada frente a un `upsert`. |
| **`products` requiere `imageUrl` no nulo** | El seed siempre la pasa. Un producto sin foto real usa el `buildImagenDeRelleno`, nunca cadena vacía. |

---

## 10. Pruebas

| Tipo | Verificación |
|---|---|
| Manual | Correr `npm run db:seed` dos veces y comparar los conteos |
| Manual | `npm run db:studio`: recorrer categorías, productos y ajustes |
| SQL | Contar filas de las 4 tablas después de la segunda corrida |
| Manual | Verificar en el panel de Supabase que el usuario existe y está confirmado |
| Unit | `tests/unit/allergens.test.ts` — normalización del glosario cerrado |
| Unit | `tests/unit/slug.test.ts` — construcción determinística de `slug` |
| Manual | Correr el seed contra una base ya sembrada **con una categoría oculta desde el panel** y verificar que no reaparece |

**Criterio de diseño de las pruebas:**

- El seed **no se testea unitariamente**. Es un script de infraestructura que depende de la base real y de Supabase Auth. Lo que sí se testea son las dos funciones puras que inventó (`buildSlug`, `toCanonicalAllergen`), porque esas las va a reusar el formulario admin y de ahí sí dependen cosas que sí importan.
- El test que de verdad importa es el **manual de la segunda corrida**. Es exactamente el criterio de aceptación y no se puede simular sin una base de verdad.

---

## 11. Definición de "Hecho" (Definition of Done)

- [x] Todos los criterios de §8 marcados (salvo el alta del admin, bloqueado por la falta de proyecto Supabase real — §13)
- [x] `npm run verify` + `npm run build` en verde
- [x] `npm run db:seed` corrido dos veces sin duplicar nada
- [ ] El usuario administrador puede autenticarse (aunque `/login` sea de la Tarea 07: alcanza con que exista en `auth.users` y en `staff_members`) — 🔴 bloqueado (idem)
- [x] `docs/tasks/README.md` actualizado
- [ ] Commit: `feat(05): seed idempotente con menu de ejemplo y usuario administrador`
- [ ] PR mergeada a `main`
- [x] **`docs/erd.md` sigue sincronizado** (el schema no cambió)

---

## 13. Registro de ejecución y desviaciones

**Fecha:** 2026-09-30 · **Verificación:** Postgres 17 en Docker (sonda local, igual que las Tareas 02–04) · `npm run verify` ✅ (71 tests) · `npm run build` ✅ · `db:seed` ×2 idempotente ✅ (2ª corrida: `Creados: 1`, `Omitidos: 29`) · flag `SEED_PUBLISH_MOCK=true` verificado en base limpia (los 23 productos pasan a `PUBLISHED`; sin el flag, todos en `DRAFT`) ✅

### Estado real de los bloqueos

- **Alta del administrador → 🔴 bloqueada.** Las credenciales de Supabase de `.env.local` valen literalmente `"PENDIENTE"` (Tarea 02 lo dejó documentado). El seed **detecta el placeholder** y omite el paso con aviso explícito en el reporte (`omitidos`), en lugar de tirar un fetch fallido de red o de abortar. Cuando exista el proyecto real, la primera `npm run db:seed` con las claves completas crea el usuario en `auth.users` y su fila en `staff_members`. Este criterio (§8.1) queda marcado como bloqueado, no como incumplido.

### Desviaciones respecto al documento

1. **Set de datos.** La tarea se escribió antes de la Tarea 00 y asumía que `docs/menu-maestro.md` no existía. Ese documento **ya existe** con 23 productos MOCK y es la fuente de verdad. El seed siembra ese set, no el ejemplo de 13 de §6.4. `docs/menu-maestro.md` no se modificó (su §6 ya anticipa esta tarea).
2. **Estado editorial.** Los 23 MOCK nacen y quedan en `DRAFT`. Se respeta la regla de la Tarea 00 (D-01): publicar un mock exige `SEED_PUBLISH_MOCK=true` explícito, definido en `.env.example`. El producto de ejemplo "Sándwich del día" del §6.4 (DRAFT con precio 0) quedó superado por el set completo del MOCK.
3. **Teléfono.** Se usa `5492615000000` (MOCK de `menu-maestro.md` §1, no asignado), no `5492610000000` del boceto. Coincide con lo que guarda `DEFAULT_BUSINESS_SETTINGS` conceptualmente (placeholder seguro) pero respetando el dato del documento.
4. **Email admin.** El mock de D-09 es `dueno@modo-miga.invalid` (RFC 2606). Es lo que sugiere `.env.example`. El documento original proponía `encargado@modomiga.com.ar` — un dominio real de Argentina, o sea registrable y por tanto inseguro como placeholder. Se siguió D-09, que es la decisión más reciente.
5. **Glosario de alérgenos.** 8 claves (se agregó `pescado`, ADR-24), no las 7 de §6.1. El mock de Atún y Salmón y Palta declararía un alérgeno sin esa clave y rompería el contrato.
6. **Descripciones.** Se copiaron del set MOCK, ajustando con el criterio editorial de `menu-maestro.md` §3.2 dos entradas que el documento tiene en forma comprimida o con comillas raras (`Queso manteca`, `aderezo de limón`).
7. **`imageSampleFor`.** La tarea pedía `imageSample` por producto; el set MOCK no lo trae (sus fotos viven en `docs/assets/` y son placeholders de talla completa). Se deriva de forma determinística por índice sobre los 5 samples de la nube `demo` de Cloudinary, sin estado. `imagePublicId` siempre `null`.
8. **Orden de lectura del admin.** El seed comprueba **primero** si Supabase está en placeholder: si lo está, omite el paso entero con aviso. El criterio "aborta si falta `SEED_ADMIN_EMAIL`" se cumple pasado ese filtro. Esto evita que la falta de un email bloquee la siembra de catálogo en local mientras el proyecto sigue sin backend de Auth real.
9. **`package.json`.** El comentario explicando `--conditions=react-server` no puede vivir en JSON estricto; se movió al `§6.2` de esta tarea (el campo del `seed` quedó sin comentario). El resto del razonamiento queda en este documento.
10. **Import dinámico del cliente admin.** `supabaseAdmin` se importa **dentro** de `sembrarAdministrador`, no arriba del todo: si el entorno está en placeholder, el módulo de infra ni siquiera se carga y no hay forma de que algún futuro refactor lo llame por accidente.

> **Antes de mergear:** correr `npm run db:seed` dos veces y confirmar que la segunda línea del log dice `Creados: 1` (solo `business_settings`) y `Omitidos: N`. Si dice `Creados: 0` en la primera, la base ya tenía todo y probaste contra datos reales, no contra una limpia.

---

## 12. Dependencias y bloqueos

**Habilita:** 10 (el catálogo público necesita productos publicados), 16 (CRUD: sin datos no hay formulario que probar), 14 (el panel muestra el menú).

**Decisiones que esta tarea deja establecidas:**

1. El seed escribe `public` **por repositorios** y usa `supabaseAdmin` **solo** para `auth.users`.
2. La clave de idempotencia es el **`slug`** (categorías y productos) y el **`email`** (usuarios), nunca el `id`.
3. El seed **no sobrescribe** lo que ya existe, salvo `business_settings`.
4. Los datos del seed se reemplazan archivo por archivo cuando cierre la Tarea 00. La estructura no cambia.
5. `imagePublicId` va en `null` en el seed: un `public_id` inventado rompe el primer reemplazo de foto (Tarea 06).
6. Los alérgenos se persisten con **tildes y eñe** (`"maní"`, `"sésamo"`); la comparación interna normaliza a NFD sin diacríticos.
7. `ALERGENOS` es un glosario **cerrado** en `src/lib/domain/allergens.ts`, compartido con el formulario admin.
8. `buildSlug` es la única forma de construir un `slug` en el proyecto.
9. `npm run db:seed` ejecuta TypeScript con `--conditions=react-server` para no chocar con `server-only`.
10. El seed se bloquea en `NODE_ENV=production` salvo `SEED_ALLOW_IN_PRODUCTION=1`.

**Bloqueo abierto para la Tarea 08 o 16:**

- **Variantes.** `ProductVariant` está en el schema (Tarea 03 §6.1) pero **ningún repositorio la expone**: `CreateProductInput` no tiene `variants`. Mientras tanto el seed no crea variantes.
  - Opción A (recomendada si el menú real tiene variantes): agregar `createProductVariants(productId, inputs)` a `product.repository.ts` y llamarlo desde el seed.
  - Opción B (si la Tarea 00 confirma que no hay variantes): sacar `ProductVariant` del schema y descartar el modelo.
  - Lo que **no** va: insertar variantes con Prisma desde el seed. Rompe la regla de "los repositorios son la única capa con Prisma" (Tarea 04 §4.4).
- **Lectura de existencia de `business_settings`.** `findBusinessSettings()` devuelve los defaults si la fila no existe, así que no permite distinguir "vacía" de "llena con los defaults". Si más adelante el seed tiene que dejar de sobrescribir los ajustes, hace falta una forma de saber si la fila existe. Decidirlo antes de la Tarea 17.

---

## Anexo — Datos DEMO para ver la web funcionando (sin Supabase Auth)

Cuando el objetivo es solo levantar la demo pública (catálogo, carrito y checkout) sin las credenciales de servicio de Supabase:

```bash
npm run demo:sondeo   # solo lectura: cuenta productos por status, categorías y settings
npm run demo:datos    # siembra 5 categorías + 23 productos MOCK directamente en PUBLISHED
```

Diferencias deliberadas con `npm run db:seed` (Tarea 05):

1. **`demo:datos` NO toca `business_settings`**: la fila puede contener datos reales (el WhatsApp del local) y el seed oficial la sobrescribe siempre. El script de demo (`scripts/sembrar-demo-mock.ts` + `prisma/datos-seed/ejecutar-demo.ts`) solo crea categorías y productos, idempotente por slug.
2. **Los productos nacen `PUBLISHED`** (el seed oficial los deja en `DRAFT` salvo `SEED_PUBLISH_MOCK=true`): la demo existe precisamente para verlos en pantalla.
3. **No crea el administrador**: necesita `SUPABASE_SERVICE_ROLE_KEY` real. Sin Supabase configurado (`.env.local` con placeholders), el panel `/admin` y el login quedan fuera de alcance, y el puente Realtime de disponibilidad se auto-desactiva con un `console.info` (la web funciona con el snapshot del SSR).
4. **Bloqueado en producción** (`NODE_ENV=production`) igual que el seed oficial.

Recordatorio vigente: los productos demo son MOCK (precios inventados, imágenes `res.cloudinary.com/demo`); se reemplazan antes de publicar (menú-maestro §0).

## Anexo 2 — Horarios de demo (merge parcial de settings)

`npm run demo:datos` ahora también siembra los horarios de la demo:

- Mar–Jue 08:30–20:30 · Vie–Sáb 08:30–22:30 · Dom 09:00–13:00 · **Lun cerrado** (coherente con el `closingMessage` "Cerramos los lunes."). El dato vive en `HORARIOS_DEMO` (`prisma/datos-seed/negocio.seed.ts`), tipado contra el dominio.
- Es la ÚNICA excepción a la regla "la demo no toca `business_settings`": se hace un **merge parcial** — se pisa solo `openingHours` y se completa `closingMessage` si está vacío; el WhatsApp y demás campos reales se preservan.
- `npm run demo:sondeo` imprime la grilla de horarios normalizada (mismo normalizador que la app), así se valida sin abrir el navegador.

**Bug corregido en el camino:** `OpeningHoursTable` consultaba las claves del jsonb en español (`hours["lunes"]`) mientras el dominio y la base usan las canónicas en inglés (`hours["monday"]`) — el footer mostraba "Cerrado" los siete días. El componente ahora consume `WEEKDAY_KEYS`/`WEEKDAY_LABELS` del dominio (única fuente de verdad) y hay test de regresión en `src/components/catalog/OpeningHours.component.test.tsx`.

## Anexo 3 — Semántica de "cerrado" vs "sin informar"

`OpeningHoursTable` ahora distingue los tres estados del dominio: clave con `null` → **"Cerrado"**, clave ausente → **"—"** (sin informar), franja → horario. Antes, ausente y `null` se mostraban como "Cerrado" — exactamente la mentira que el comentario de `normalizeOpeningHours` prohíbe. Con el set demo (`HORARIOS_DEMO`, los 7 días informados) el caso "—" no aparece; queda para datos reales parcialmente cargados. Test de regresión en `OpeningHours.component.test.tsx`.

## Anexo 4 — Los tests de integración YA NO destruyen la demo

Causa del síntoma recurrente "se vaciaron los productos / los horarios quedaron con solo lunes": el proyecto Vitest `integracion` corría contra la base de desarrollo (Supabase) y `tests/setup.ts` trunca todas las tablas en cada corrida; el último fixture escrito era `{ monday: 09:00–21:00 }`, que la grilla pública mostraba como "todo cerrado menos lunes".

Solución adoptada:

- **Base de tests aislada en Docker** (`docker-compose.test.yml`: Postgres 16 efímero en puerto 55433). Se levanta con `npm run db:test:up && npm run db:test:migrate` (el stub de roles/auth de `tests/infra/roles-y-auth-stub.sql` se aplica vía `psql` del contenedor: no requiere psql en el host).
- **`TEST_DATABASE_URL`** en `.env.local`/`.env`: `tests/setup-entorno.ts` la detecta y repunta `DATABASE_URL`/`DIRECT_DATABASE_URL` solo para la corrida de tests. En CI no se define (el job de integración inyecta su propia base efímera y `CI=true`).
- **Guarda dura**: sin `TEST_DATABASE_URL` y fuera de CI, los tests de integración fallan al arrancar con instrucciones, en lugar de vaciar la base de desarrollo. Escape hatch explícito: `ALLOW_TESTS_ON_DEV_DB=1`.
- Nota de diseño: la guarda mira `CI=true` y no `NODE_ENV=test`, porque Vitest fija `NODE_ENV=test` también en corridas locales.

 Para repoblar la demo ante cualquier reset externo: `npm run demo:datos` (idempotente).
