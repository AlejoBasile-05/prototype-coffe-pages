# Tarea 04 — Capa de Datos: Repositories

| Campo | Valor |
|---|---|
| **ID** | 04 |
| **Fase (DESIGN.md §8.3)** | Fase 1 — Cimientos y Modelado |
| **Depende de** | 02, 03 |
| **Habilita** | 05, 08 |
| **Tipo** | Acceso a Datos |
| **Esfuerzo est.** | 1 – 1.5 días |

---

## 1. Objetivo de la tarea

Implementar la **capa de acceso a datos**: el único lugar del proyecto donde existen queries de Prisma. Encapsular cada consulta detrás de una función con nombre declarativo y tipado de retorno explícito, de modo que las capas superiores nunca constructuyan queries ni dependan de la forma de la base.

**Criterio de éxito verificable:** `rg "prisma\." src/` no devuelve resultados fuera de `src/server/repositories/`, y todos los repositorios están cubiertos por tests contra la base real.

---

## 2. Contexto y dependencias

**Requiere:** Tareas 02 y 03 completadas (conexión + schema aplicado).

**Contexto arquitectónico:**

```
Capa 3 · Servicio  ──▶  Capa 4 · Repository  ──▶  prisma (infra)  ──▶  Postgres
     "¿qué reglas           "¿cómo se            "¿cómo se
      se aplican?"            obtiene?"             conecta?"
```

El servicio dice **qué** necesita y con qué criterio de orden. El repositorio decide **cómo** obtenerlo. Si el día de mañana el catálogo pasa a ser un CMS externo, se reescribe el repositorio y el servicio no cambia.

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `src/server/repositories/product.repository.ts` | Queries de `products` y `product_variants` |
| `src/server/repositories/category.repository.ts` | Queries de `categories` |
| `src/server/repositories/settings.repository.ts` | Queries de `business_settings` (singleton) |
| `src/server/repositories/staff.repository.ts` | Queries de `staff_members` |
| `src/server/repositories/mappers/product.mapper.ts` | Conversión `Prisma` → DTO serializable |
| `tests/integration/product.repository.test.ts` | Cobertura contra la base real |
| `tests/integration/category.repository.test.ts` | idem |
| `tests/integration/settings.repository.test.ts` | idem |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `src/lib/domain/index.ts` | Reexportar los DTOs del repositorio |
| `tests/setup.ts` | Utilidad de limpieza de base entre tests |
| `docs/tasks/README.md` | Marcar Tarea 04 |

### 3.3 Eliminar

Ninguno.

---

## 4. Estructura N-Capas

### 4.1 Qué vive en esta capa

| Capa | Qué va acá | Qué NO va acá |
|---|---|---|
| 4 · Repositorio | `prisma.product.findMany(...)`, `include`, `select`, orden, filtros SQL, manejo de `P2002`/`P2025` | **Ninguna regla de negocio.** "Ocultar los agotados" NO va acá. |
| 3 · Servicio | — | Nada. Los servicios aún no existen (Tarea 08). |
| 1 · Presentación | — | Nada. |

### 4.2 La regla más importante de esta tarea

> **El repositorio traduce la base, no la interpreta.**

Ejemplo de lo que **no** va en el repositorio:

```ts
// ❌ MAL — regla de negocio en la capa de datos
export const findAvailableProducts = () =>
  prisma.product.findMany({
    where: { isAvailable: true, status: "PUBLISHED" },
  });
```

```ts
// ✅ BIEN — el repositorio trae todo y el servicio decide
export const findAllProducts = () => prisma.product.findMany({ /* ... */ });
```

Motivo: cuando llegue la regla "un producto sin stock se muestra igual pero desaturado" (que es el diseño de `DESIGN.md` §10.3), **no hay que tocar los repositorios**. Si la regla estuviera metida en el query, habría que refactorizar la capa de datos a mitad de proyecto.

### 4.3 Contrato de retorno: DTOs, nunca entidades Prisma

`Prisma.Decimal` y `Date` no se serializan hacia Client Components. **Todo lo que sale de un repositorio se mapea a un DTO plano:**

```ts
// ❌ MAL — Decimal no serializable hacia el cliente
export const findAllProducts = () => prisma.product.findMany();

// ✅ BIEN — DTO serializable
export const findAllProducts = (): Promise<ProductDTO[]> => ...
```

| Tipo Prisma | Tipo en DTO | Razón |
|---|---|---|
| `Decimal` | `number` | React no puede serializar `Prisma.Decimal` |
| `Date` | `string` (ISO 8601) | Los Server Components **sí** pueden pasar `Date`, pero un DTO con `string` es más simple de testear y no depende del serializer de React |
| `ProductStatus` (enum) | `string` (union type) | Los enums de Prisma son `const objects`; importarlos en un Client Component arrastra código de Prisma al bundle |
| `Product` | `ProductDTO` | Sin metadatos internos de Prisma |

### 4.4 Reglas transversales

| Regla | Detalle |
|---|---|
| Nombres de función | `find*` para lecturas, `create*`/`update*`/`archive*`/`toggle*` para escrituras. Verbos declarativos, no `get`/`do`. |
| `select` explícito | Preferir `select` a `include` cuando el DTO no necesita todo. Evita traer campos pesados y hace visible el contrato. |
| Sin lógica condicional | Si un repositorio tiene un `if`, es señal de que hay una regla de negocio. Esa función pertenece al servicio. |
| Errores | Traducir códigos de Prisma a errores de dominio: `P2025` → `ResourceNotFoundError`, `P2002` → `ConflictError`. El resto se deja propagar. |
| Side effects | Ninguno. Un repositorio no envía emails, ni llama a APIs externas, ni toca el sistema de archivos. |
| Instancia de Prisma | Se importa de `@/server/infra/prisma`. **Nunca** `new PrismaClient()`. |

---

## 5. Convenciones de código (Clean Code + SOLID)

**Principio aplicado: Separación de Concerns (SRP) + Inversión de Dependencias.**

- **SRP:** un archivo de repositorio por agregado (`product`, `category`, `settings`, `staff`). Si el archivo de productos supera 150 líneas, hay que dividirlo.
- **DIP:** los servicios dependen de **funciones** de acceso a datos, no de Prisma. Si mañana los productos se cachean en Redis, se cambia el repositorio, no el servicio.
- **Naming:** `findProductsByCategoryId` es mejor que `getByCat` porque declara el criterio. Los parámetros son objetos nombrados, no posicionales, cuando hay más de uno:

```ts
// ❌ Posicional: hay que leer la firma para saber qué es qué
findProducts(categoryId, true, 10);

// ✅ Objeto nombrado: autodocumentado
findProducts({ categoryId, onlyAvailable: true, limit: 10 });
```

---

## 6. Pasos de implementación

### 6.1 DTOs de dominio (`src/lib/domain/`)

```ts
// src/lib/domain/product.ts

export type ProductStatusDTO = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/** Variante de un producto. El precio final es `product.price + variant.priceDelta`. */
export interface ProductVariantDTO {
  readonly id: string;
  readonly name: string;
  /** Delta en pesos sobre el precio del producto. Puede ser 0. */
  readonly priceDelta: number;
  readonly isAvailable: boolean;
  readonly sortOrder: number;
}

export interface ProductDTO {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  /** En pesos. Ver §4.3: nunca Decimal. */
  readonly price: number;
  readonly imageUrl: string;
  readonly imagePublicId: string | null;
  /** Stock en vivo. Lo alterna el encargado (Tarea 14). */
  readonly isAvailable: boolean;
  readonly status: ProductStatusDTO;
  readonly isFeatured: boolean;
  readonly sortOrder: number;
  readonly allergens: readonly string[];
  readonly categoryId: string;
  /** Variante ya aplanada. Vacío si el producto no tiene. */
  readonly variants: readonly ProductVariantDTO[];
}
```

```ts
// src/lib/domain/category.ts

import type { ProductDTO } from "./product";

export interface CategoryDTO {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly position: number;
  readonly isVisible: boolean;
}
```

```ts
// src/lib/domain/settings.ts

export type OpeningHours = Readonly<
  Record<string, { readonly opens: string; readonly closes: string } | null>
>;

export interface BusinessSettingsDTO {
  readonly name: string;
  /** E.164 sin `+`. Ej: "5492615551234". */
  readonly whatsappPhone: string;
  readonly address: string | null;
  readonly instagramUrl: string | null;
  readonly openingHours: OpeningHours;
  readonly closingMessage: string | null;
  readonly legalNotice: string | null;
}
```

```ts
// src/lib/domain/index.ts
export * from "./errors";
export * from "./product";
export * from "./category";
export * from "./settings";
```

### 6.2 Mappers

```ts
// src/server/repositories/mappers/product.mapper.ts
import type { Product, ProductVariant, Category } from "@prisma/client";
import type { ProductDTO, ProductStatusDTO, ProductVariantDTO } from "@/lib/domain";

/** Convierte el enum de Prisma a la union type del dominio. */
const toProductStatusDTO = (status: Product["status"]): ProductStatusDTO => status;

const toVariantDTO = (variant: ProductVariant): ProductVariantDTO => ({
  id: variant.id,
  name: variant.name,
  // ⚠️ El punto de la Tarea 03 §4.3: Decimal → number, SIEMPRE.
  priceDelta: variant.priceDelta.toNumber(),
  isAvailable: variant.isAvailable,
  sortOrder: variant.sortOrder,
});

/**
 * Traduce una entidad Prisma a un DTO serializable.
 *
 * ¿Por qué mapper y no un `as`?
 * Porque el mapeo DEBE ser explícito y revisable: si mañana Prisma agrega
 * un campo o cambia un tipo, el compilador avisa acá en lugar de fallar
 * en runtime con un error de serialización en el cliente.
 *
 * El `select` del repositorio ya garantiza que solo llegan estos campos.
 * El tipo `ProductWithRelations` se define en el propio repositorio.
 */
export const toProductDTO = (
  product: Product & { variants: ProductVariant[]; category: Category },
): ProductDTO => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  description: product.description,
  price: product.price.toNumber(),
  imageUrl: product.imageUrl,
  imagePublicId: product.imagePublicId,
  isAvailable: product.isAvailable,
  status: toProductStatusDTO(product.status),
  isFeatured: product.isFeatured,
  sortOrder: product.sortOrder,
  allergens: product.allergens,
  categoryId: product.categoryId,
  variants: [...product.variants]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toVariantDTO),
});
```

### 6.3 `product.repository.ts`

```ts
/**
 * Acceso a datos de productos y variantes.
 *
 * ⚠️ Esta capa NO conoce reglas de negocio. Devuelve datos crudos
 * (ya mapeados a DTO) y deja que el servicio decida qué es visible.
 *
 * Ver Tarea 04 §4.2 para el motivo de esta restricción.
 */
import "server-only";

import { Prisma, type ProductStatus } from "@prisma/client";
import { prisma } from "@/server/infra/prisma";
import { ConflictError, ResourceNotFoundError } from "@/lib/domain";
import type { ProductDTO } from "@/lib/domain";
import { toProductDTO } from "./mappers/product.mapper";

/** Payload de creación. `id`, `createdAt` y `updatedAt` los pone la base. */
export interface CreateProductInput {
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly price: number;
  readonly imageUrl: string;
  readonly imagePublicId: string | null;
  readonly categoryId: string;
  readonly status: ProductStatus;
  readonly isFeatured: boolean;
  readonly isAvailable: boolean;
  readonly allergens: readonly string[];
  readonly sortOrder: number;
}

export type UpdateProductInput = Partial<Omit<CreateProductInput, "slug">> & {
  readonly slug?: string;
};

const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  imageUrl: true,
  imagePublicId: true,
  isAvailable: true,
  status: true,
  isFeatured: true,
  sortOrder: true,
  allergens: true,
  categoryId: true,
  category: { select: { id: true, name: true, slug: true } },
  variants: {
    select: { id: true, name: true, priceDelta: true, isAvailable: true, sortOrder: true },
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.ProductSelect;

type ProductWithRelations = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

// ────────────────────────── Lecturas ─────────────────────────────

/**
 * Productos para el catálogo público.
 *
 * `onlyAvailable` NO controla la visibilidad: controla si se filtran los
 * agotados. El filtro de `status` sí es parte de la lectura pública,
 * porque un DRAFT no debe salir de la base bajo ninguna circunstancia
 * (DESIGN.md §4.7: Prisma bypasea RLS, el filtro va en la query).
 */
export const findPublishedProducts = async (
  options: { readonly onlyAvailable?: boolean } = {},
): Promise<ProductDTO[]> => {
  const products: ProductWithRelations[] = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      ...(options.onlyAvailable === true ? { isAvailable: true } : {}),
    },
    select: PRODUCT_SELECT,
    orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
  });

  return products.map(toProductDTO);
};

export const findPublishedProductsByCategory = async (
  categoryId: string,
): Promise<ProductDTO[]> => {
  const products: ProductWithRelations[] = await prisma.product.findMany({
    where: { status: "PUBLISHED", categoryId },
    select: PRODUCT_SELECT,
    orderBy: { sortOrder: "asc" },
  });

  return products.map(toProductDTO);
};

export const findPublishedProductBySlug = async (
  slug: string,
): Promise<ProductDTO | null> => {
  const product = await prisma.product.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: PRODUCT_SELECT,
  });

  return product ? toProductDTO(product) : null;
};

/** Listado completo para el panel admin. Incluye DRAFT y ARCHIVED. */
export const findAllProductsForAdmin = async (): Promise<ProductDTO[]> => {
  const products: ProductWithRelations[] = await prisma.product.findMany({
    select: PRODUCT_SELECT,
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
  });

  return products.map(toProductDTO);
};

export const findProductByIdForAdmin = async (
  id: string,
): Promise<ProductDTO | null> => {
  const product = await prisma.product.findUnique({ where: { id }, select: PRODUCT_SELECT });
  return product ? toProductDTO(product) : null;
};

export const findFeaturedProducts = async (limit = 4): Promise<ProductDTO[]> => {
  const products: ProductWithRelations[] = await prisma.product.findMany({
    where: { status: "PUBLISHED", isFeatured: true },
    select: PRODUCT_SELECT,
    orderBy: { sortOrder: "asc" },
    take: limit,
  });

  return products.map(toProductDTO);
};

// ───────────────────────── Escrituras ────────────────────────────

export const createProduct = async (input: CreateProductInput): Promise<ProductDTO> => {
  try {
    const product = await prisma.product.create({
      data: { ...input, allergens: [...input.allergens] },
      select: PRODUCT_SELECT,
    });
    return toProductDTO(product);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError(`Ya existe un producto con el slug "${input.slug}"`, {
        slug: input.slug,
      });
    }
    throw error;
  }
};

export const updateProduct = async (
  id: string,
  input: UpdateProductInput,
): Promise<ProductDTO> => {
  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...input,
        ...(input.allergens ? { allergens: [...input.allergens] } : {}),
      },
      select: PRODUCT_SELECT,
    });
    return toProductDTO(product);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new ConflictError("Ya existe un producto con ese slug", { id });
      }
      if (error.code === "P2025") {
        throw new ResourceNotFoundError("Producto", id);
      }
    }
    throw error;
  }
};

/**
 * Alterna la disponibilidad (stock). Operación atómica de un solo campo:
 * no lee el valor anterior, lo que evita condiciones de carrera cuando
 * dos：admin hacen clic simultáneamente sobre el mismo producto.
 */
export const toggleProductAvailability = async (
  id: string,
  isAvailable: boolean,
): Promise<ProductDTO> => {
  try {
    const product = await prisma.product.update({
      where: { id },
      data: { isAvailable },
      select: PRODUCT_SELECT,
    });
    return toProductDTO(product);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ResourceNotFoundError("Producto", id);
    }
    throw error;
  }
};

/**
 * Borrado lógico. Nunca borra físicamente: la URL del producto puede estar
 * compartida por clientes y el asset de Cloudinary quedaría huérfano.
 */
export const archiveProduct = async (id: string): Promise<ProductDTO> => {
  try {
    const product = await prisma.product.update({
      where: { id },
      data: { status: "ARCHIVED", isFeatured: false },
      select: PRODUCT_SELECT,
    });
    return toProductDTO(product);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ResourceNotFoundError("Producto", id);
    }
    throw error;
  }
};
```

### 6.4 `category.repository.ts`

```ts
import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/infra/prisma";
import { ConflictError, ResourceNotFoundError } from "@/lib/domain";
import type { CategoryDTO } from "@/lib/domain";

export interface CreateCategoryInput {
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly position: number;
  readonly isVisible: boolean;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  position: true,
  isVisible: true,
} satisfies Prisma.CategorySelect;

type CategoryRecord = Prisma.CategoryGetPayload<{ select: typeof CATEGORY_SELECT }>;

const toCategoryDTO = (category: CategoryRecord): CategoryDTO => ({ ...category });

export const findVisibleCategories = async (): Promise<CategoryDTO[]> => {
  const categories = await prisma.category.findMany({
    where: { isVisible: true },
    select: CATEGORY_SELECT,
    orderBy: { position: "asc" },
  });
  return categories.map(toCategoryDTO);
};

export const findAllCategoriesForAdmin = async (): Promise<CategoryDTO[]> => {
  const categories = await prisma.category.findMany({
    select: CATEGORY_SELECT,
    orderBy: { position: "asc" },
  });
  return categories.map(toCategoryDTO);
};

export const findCategoryById = async (id: string): Promise<CategoryDTO | null> => {
  const category = await prisma.category.findUnique({ where: { id }, select: CATEGORY_SELECT });
  return category ? toCategoryDTO(category) : null;
};

export const createCategory = async (input: CreateCategoryInput): Promise<CategoryDTO> => {
  try {
    return toCategoryDTO(await prisma.category.create({ data: input, select: CATEGORY_SELECT }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError(`Ya existe una categoría con el slug "${input.slug}"`);
    }
    throw error;
  }
};

export const updateCategory = async (
  id: string,
  input: UpdateCategoryInput,
): Promise<CategoryDTO> => {
  try {
    const category = await prisma.category.update({
      where: { id },
      data: input,
      select: CATEGORY_SELECT,
    });
    return toCategoryDTO(category);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") throw new ResourceNotFoundError("Categoría", id);
      if (error.code === "P2002") throw new ConflictError("Ya existe una categoría con ese slug");
    }
    throw error;
  }
};

/**
 * Elimina una categoría. La FK tiene `onDelete: Restrict`, así que
 * Postgres rechaza el borrado si tiene productos. Se traduce `P2003`
 * (violación de foreign key) a un error de dominio accionable, porque
 * el mensaje crudo de Prisma ("Foreign key constraint violated")
 * no le dice nada al encargado.
 */
export const deleteCategory = async (id: string): Promise<void> => {
  try {
    await prisma.category.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        const productCount = await prisma.product.count({ where: { categoryId: id } });
        throw new ConflictError(
          "No se puede eliminar: la categoría tiene productos asignados. Reasignalos o archivá la categoría.",
          { productCount },
        );
      }
      if (error.code === "P2025") throw new ResourceNotFoundError("Categoría", id);
    }
    throw error;
  }
};
```

### 6.5 `settings.repository.ts`

```ts
import "server-only";

import { prisma } from "@/server/infra/prisma";
import type { BusinessSettingsDTO, OpeningHours } from "@/lib/domain";

/**
 * Valores por defecto si la fila singleton no existe.
 *
 * Una base recién migrada no tiene esta fila hasta que corre el seed
 * (Tarea 05). Los servicios deben ser resilientes a esa ausencia en lugar
 * de romper el catálogo entero.
 */
export const DEFAULT_BUSINESS_SETTINGS: BusinessSettingsDTO = {
  name: "Mi Negocio",
  whatsappPhone: "5492610000000",
  address: null,
  instagramUrl: null,
  openingHours: {},
  closingMessage: null,
  legalNotice: null,
};

const SETTINGS_SELECT = {
  name: true,
  whatsappPhone: true,
  address: true,
  instagramUrl: true,
  openingHours: true,
  closingMessage: true,
  legalNotice: true,
} as const;

/** Lector del singleton. Nunca lanza: devuelve defaults si falta la fila. */
export const findBusinessSettings = async (): Promise<BusinessSettingsDTO> => {
  const settings = await prisma.businessSettings.findUnique({
    where: { id: 1 },
    select: SETTINGS_SELECT,
  });

  if (!settings) {
    console.warn(
      "[settings] No existe la fila business_settings (id=1). Se usan los valores por defecto. Ejecutar el seed.",
    );
    return DEFAULT_BUSINESS_SETTINGS;
  }

  return {
    ...settings,
    // `openingHours` es Json en Prisma → tipo `unknown` en TypeScript.
    // Se valida con un type guard en lugar de castear a ciegas (§4.3).
    openingHours: parseOpeningHours(settings.openingHours),
  };
};

export interface SaveBusinessSettingsInput {
  readonly name: string;
  readonly whatsappPhone: string;
  readonly address: string | null;
  readonly instagramUrl: string | null;
  readonly openingHours: OpeningHours;
  readonly closingMessage: string | null;
  readonly legalNotice: string | null;
}

/** `upsert` porque la fila singleton puede no existir todavía. */
export const saveBusinessSettings = async (
  input: SaveBusinessSettingsInput,
): Promise<BusinessSettingsDTO> => {
  const settings = await prisma.businessSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...input },
    update: input,
    select: SETTINGS_SELECT,
  });

  return { ...settings, openingHours: parseOpeningHours(settings.openingHours) };
};

/**
 * Type guard para el campo `Json`.
 *
 * Postgres no garantiza la forma de un jsonb. Sin esta validación,
 * un `openingHours` corrupto rompería el catálogo en runtime con un
 * error difícil de rastrear. Ante la duda, degrada a vacío.
 */
const parseOpeningHours = (value: unknown): OpeningHours => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as OpeningHours;
};
```

### 6.6 `staff.repository.ts`

```ts
import "server-only";

import { prisma } from "@/server/infra/prisma";
import type { StaffRole } from "@prisma/client";

export interface StaffMemberRecord {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: StaffRole;
  readonly createdAt: string;
}

const STAFF_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

export const findStaffById = async (id: string): Promise<StaffMemberRecord | null> => {
  const member = await prisma.staffMember.findUnique({ where: { id }, select: STAFF_SELECT });
  if (!member) return null;
  // `createdAt` → ISO string: el DTO no expone objetos Date.
  return { ...member, createdAt: member.createdAt.toISOString() };
};

export const findStaffByEmail = async (
  email: string,
): Promise<StaffMemberRecord | null> => {
  const member = await prisma.staffMember.findUnique({
    where: { email: email.toLowerCase() },
    select: STAFF_SELECT,
  });
  if (!member) return null;
  return { ...member, createdAt: member.createdAt.toISOString() };
};

export const createStaffMember = async (input: {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: StaffRole;
}): Promise<StaffMemberRecord> => {
  const member = await prisma.staffMember.create({
    data: { ...input, email: input.email.toLowerCase() },
    select: STAFF_SELECT,
  });
  return { ...member, createdAt: member.createdAt.toISOString() };
};
```

### 6.7 Tests de integración

```ts
// tests/setup.ts
import { prisma } from "@/server/infra/prisma";

/**
 * Limpia las tablas entre tests.
 *
 * ⚠️ ORDEN IMPORTANTE: se desactiva la verificación de FK de Postgres
 * porque el orden de borrado de las tablas no se puede garantizar con
 * `truncate` de múltiples tablas. Se usa TRUNCATE ... CASCADE.
 */
export const resetDatabase = async (): Promise<void> => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "product_variants",
      "products",
      "categories",
      "staff_members"
    RESTART IDENTITY CASCADE
  `);
  // business_settings NO se trunca: es singleton y se resetea por UPDATE.
  await prisma.businessSettings.deleteMany({});
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
};
```

```ts
// tests/integration/product.repository.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { disconnectDatabase, resetDatabase } from "../setup";
import {
  archiveProduct,
  findAllProductsForAdmin,
  findPublishedProducts,
  findPublishedProductBySlug,
  toggleProductAvailability,
} from "@/server/repositories/product.repository";
import { createCategory } from "@/server/repositories/category.repository";
import { ConflictError, ResourceNotFoundError } from "@/lib/domain";

const buildProduct = (overrides: Partial<Parameters<typeof toggleProductAvailability>> = {}) => ({
  name: "Jamón y Queso",
  slug: "jamon-y-queso",
  description: "Jamón cocido y cheddar en pan de miga.",
  price: 1450.0,
  imageUrl: "https://res.cloudinary.com/demo/image/upload/modo-miga.jpg",
  imagePublicId: "modo-miga/products/jamon-y-queso",
  categoryId: "",
  status: "PUBLISHED" as const,
  isFeatured: false,
  isAvailable: true,
  allergens: ["gluten", "lactosa"],
  sortOrder: 0,
  ...overrides,
});

let categoryId: string;

beforeAll(async () => {
  const category = await createCategory({
    name: "Clásicos",
    slug: "clasicos",
    description: null,
    position: 0,
    isVisible: true,
  });
  categoryId = category.id;
});

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

describe("product.repository", () => {
  describe("findPublishedProducts", () => {
    it("debe excluir los productos que no están PUBLISHED", async () => {
      const { createProduct } = await import("@/server/repositories/product.repository");
      await createProduct(buildProduct({ categoryId }));
      await createProduct(buildProduct({ categoryId, name: "Borrador", slug: "borrador", status: "DRAFT" }));

      const products = await findPublishedProducts();

      expect(products).toHaveLength(1);
      expect(products[0]?.slug).toBe("jamon-y-queso");
    });

    it("debe mapear Decimal a number, nunca devolver Prisma.Decimal", async () => {
      const { createProduct } = await import("@/server/repositories/product.repository");
      await createProduct(buildProduct({ categoryId, price: 1450.5 }));

      const [product] = await findPublishedProducts();

      expect(product?.price).toBe(1450.5);
      expect(typeof product?.price).toBe("number");
      expect(product?.price).not.toHaveProperty("toNumber");
    });

    it("debe filtrar por disponibilidad solo cuando se lo pide", async () => {
      const { createProduct } = await import("@/server/repositories/product.repository");
      await createProduct(buildProduct({ categoryId, isAvailable: true }));
      await createProduct(buildProduct({ categoryId, name: "Agotado", slug: "agotado", isAvailable: false }));

      expect(await findPublishedProducts()).toHaveLength(2);
      expect(await findPublishedProducts({ onlyAvailable: true })).toHaveLength(1);
    });
  });

  describe("slug duplicado", () => {
    it("debe lanzar ConflictError con un mensaje accionable", async () => {
      const { createProduct } = await import("@/server/repositories/product.repository");
      await createProduct(buildProduct({ categoryId }));

      await expect(createProduct(buildProduct({ categoryId }))).rejects.toThrow(ConflictError);
    });
  });

  describe("operaciones sobre un id inexistente", () => {
    it("debe lanzar ResourceNotFoundError, no un error crudo de Prisma", async () => {
      await expect(toggleProductAvailability("no-existe", false)).rejects.toThrow(
        ResourceNotFoundError,
      );
      await expect(archiveProduct("no-existe")).rejects.toThrow(ResourceNotFoundError);
    });
  });

  describe("archiveProduct", () => {
    it("debe ser borrado lógico: el registro sigue existiendo", async () => {
      const { createProduct } = await import("@/server/repositories/product.repository");
      const created = await createProduct(buildProduct({ categoryId }));

      const archived = await archiveProduct(created.id);

      expect(archived.status).toBe("ARCHIVED");
      // Sigue en la base: no se borró físicamente.
      expect(await findAllProductsForAdmin()).toHaveLength(1);
      // Pero desaparece del catálogo público.
      expect(await findPublishedProducts()).toHaveLength(0);
    });
  });
});
```

```ts
// tests/integration/category.repository.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { deleteCategory, findVisibleCategories } from "@/server/repositories/category.repository";
import { createProduct } from "@/server/repositories/product.repository";
import { ConflictError } from "@/lib/domain";
import { disconnectDatabase, resetDatabase } from "../setup";

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

describe("category.repository", () => {
  it("debe rechazar el borrado de una categoría con productos y explicar cuántos hay", async () => {
    const { createCategory } = await import("@/server/repositories/category.repository");
    const category = await createCategory({
      name: "Clásicos", slug: "clasicos", description: null, position: 0, isVisible: true,
    });
    await createProduct({
      name: "Jamón y Queso", slug: "jamon-y-queso", description: null, price: 1450,
      imageUrl: "https://res.cloudinary.com/demo/image/upload/x.jpg", imagePublicId: null,
      categoryId: category.id, status: "PUBLISHED", isFeatured: false, isAvailable: true,
      allergens: [], sortOrder: 0,
    });

    await expect(deleteCategory(category.id)).rejects.toThrow(ConflictError);
    await expect(deleteCategory(category.id)).rejects.toThrow(/productos asignados/);
  });

  it("debe excluir las categorías ocultas de la lectura pública", async () => {
    const { createCategory } = await import("@/server/repositories/category.repository");
    await createCategory({ name: "Visible", slug: "visible", description: null, position: 0, isVisible: true });
    await createCategory({ name: "Oculta", slug: "oculta", description: null, position: 1, isVisible: false });

    const categories = await findVisibleCategories();

    expect(categories).toHaveLength(1);
    expect(categories[0]?.name).toBe("Visible");
  });
});
```

```ts
// tests/integration/settings.repository.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { findBusinessSettings, saveBusinessSettings } from "@/server/repositories/settings.repository";
import { disconnectDatabase, resetDatabase } from "../setup";

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

describe("settings.repository", () => {
  it("debe devolver los defaults si la fila singleton no existe", async () => {
    const settings = await findBusinessSettings();

    expect(settings.name).toBe("Mi Negocio");
    expect(settings.openingHours).toEqual({});
  });

  it("debe hacer upsert de la fila singleton con id fijo en 1", async () => {
    const input = {
      name: "Mi Negocio",
      whatsappPhone: "5492615551234",
      address: "San Rafael, Mendoza",
      instagramUrl: "https://instagram.com/modo.miga",
      openingHours: { monday: { opens: "09:00", closes: "21:00" } },
      closingMessage: "Cerramos los lunes.",
      legalNotice: null,
    };

    const created = await saveBusinessSettings(input);
    const updated = await saveBusinessSettings({ ...input, name: "Mi Negocio Bar" });

    expect(created.name).toBe("Mi Negocio");
    expect(updated.name).toBe("Mi Negocio Bar");
    // Sigue siendo una sola fila.
    const { prisma } = await import("@/server/infra/prisma");
    expect(await prisma.businessSettings.count()).toBe(1);
  });

  it("debe degradar a vacío un openingHours corrupto en lugar de romper", async () => {
    const { prisma } = await import("@/server/infra/prisma");
    await prisma.businessSettings.create({
      data: { id: 1, name: "Mi Negocio", whatsappPhone: "5492615551234", openingHours: "corrupto" },
    });

    const settings = await findBusinessSettings();

    expect(settings.openingHours).toEqual({});
  });
});
```

### 6.8 Configurar el proyecto de tests de integración

`vitest.config.ts` (actualizar el de la Tarea 01):

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    globals: true,
    // NODE_ENV=test hace que `server-only` no rompa: el paquete solo
    //intercepta el bundle de Next.js, no las ejecuciones de Vitest.
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Los tests de integración comparten una única base: no paralelizar.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts", "src/server/services/**/*.ts", "src/server/repositories/**/*.ts"],
      exclude: ["**/*.d.ts", "**/index.ts", "**/mappers/**"],
    },
  },
});
```

---

## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `ProductDTO` | `src/lib/domain/product.ts` | **Tarea 08** (servicios), 10 (UI), 14 (admin) |
| `CategoryDTO` | `src/lib/domain/category.ts` | Tarea 08, 10, 17 |
| `BusinessSettingsDTO` | `src/lib/domain/settings.ts` | Tarea 08, 12 (WhatsApp), 17 |
| `StaffMemberRecord` | `src/server/repositories/staff.repository.ts` | Tarea 07 (autorización) |
| `CreateProductInput` / `UpdateProductInput` | `product.repository.ts` | Tarea 16 (formulario admin) |
| `findPublishedProducts(options?)` | idem | Tarea 08, 10 |
| `findAllProductsForAdmin()` | idem | Tarea 14 (tabla admin) |
| `toggleProductAvailability(id, isAvailable)` | idem | Tarea 14 (el switch) |
| `findBusinessSettings()` | `settings.repository.ts` | Tarea 08, 12 |
| `DEFAULT_BUSINESS_SETTINGS` | idem | Tarea 08 (fallback) |

**Firma más delicadas de la capa:** `toggleProductAvailability` recibe el valor **destino** en lugar de alternar en el servidor. Motivo: si el servidor decidiera el nuevo valor leyendo el actual, dos clics simultáneos del mismo toggle producirían un resultado incorrecto y no determinista. El valor lo calcula la UI (que ya lo conoce), y el servidor lo aplica.

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [x] Los 4 repositorios y el mapper están implementados
- [x] Todos los tests de integración pasan
- [x] `findPublishedProducts` excluye todo lo que no sea `PUBLISHED`
- [x] `findPublishedProducts({ onlyAvailable: true })` filtra por stock
- [x] `findPublishedProductBySlug` devuelve `null` (no lanza) si no existe
- [x] `toggleProductAvailability` es atómico y devuelve el DTO actualizado
- [x] `archiveProduct` marca `ARCHIVED` sin borrar el registro
- [x] `deleteCategory` con productos lanza `ConflictError` con el conteo
- [x] `findBusinessSettings` devuelve defaults si falta la fila, sin lanzar
- [x] `saveBusinessSettings` hace upsert sobre `id = 1`

### 8.2 Calidad

- [x] `npm run verify` en verde
- [x] `npm run build` en verde
- [x] `rg "prisma\." src/` devuelve resultados **solo** en `src/server/infra/` y `src/server/repositories/` ¹
- [x] `rg "new PrismaClient" src/` → 1 solo resultado (Tarea 02)
- [x] Todos los repositorios tienen `import "server-only"`
- [x] Ningún repositorio importa de `@/server/services`, `@/app` ni `@/components`
- [x] Ningún repositorio importa `react` ni `next/*`

¹ También aparece `src/app/api/health/route.ts`: es la **excepción documentada y acotada** de la Tarea 02 (sonda de infraestructura, no consulta de negocio), con paso autorizado en `eslint.config.mjs`. No es una filtración de la capa de datos nueva.

### 8.3 Arquitectura — verificación obligatoria

- [x] **Cero lógica de negocio en repositorios:** no hay ningún `if` que filtre por `status` o `isAvailable` salvo el `where` de una lectura pública
- [x] Todos los DTOs de salida tienen `Decimal` convertido a `number` (verificado por test)
- [x] `Date` se convierte a `string` ISO en los DTOs
- [x] Los mappers son funciones puras: no reciben nada más que el registro
- [x] Todos los errores de Prisma conocidos (`P2002`, `P2003`, `P2025`) están traducidos a errores de dominio
- [x] Los parámetros de funciones con más de un argumento usan objeto nombrado ²

² **Excepción de las escrituras de update:** `toggleProductAvailability(id, isAvailable)` (dos requeridos, sin ambigüedad de orden y previsto por la firma contractual de §7) y `updateProduct(id, input)` / `updateCategory(id, input)` (el segundo argumento ya es el objeto nombrado). Ninguna función de lectura con filtros múltiples usa posicionales.

### 8.4 Pruebas

- [x] Mínimo 10 casos de test en `product.repository.test.ts` — **15 casos**
- [x] Mínimo 2 casos en `category.repository.test.ts` — **8 casos**
- [x] Mínimo 3 casos en `settings.repository.test.ts` — **4 casos**
- [x] Un test específico para el mapeo `Decimal → number`
- [x] Un test específico para la corrupción de `openingHours`
- [x] `tests/setup.ts` limpia la base entre tests (`TRUNCATE ... CASCADE`)

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado |
|---|---|
| Producto inexistente en `toggle` o `archive` | `ResourceNotFoundError`, no `P2025` crudo. El mensaje incluye el id. |
| Slug duplicado | `ConflictError` con el slug en el mensaje. La UI (Tarea 16) lo muestra junto al campo. |
| Borrar categoría con productos | `ConflictError` con `productCount` en `details`. La UI puede decir "tiene 8 productos". |
| `business_settings` inexistente | Devuelve `DEFAULT_BUSINESS_SETTINGS` + `console.warn`. **No** rompe el catálogo. |
| `openingHours` con forma inesperada | `parseOpeningHours` degrada a `{}`. Un jsonb corrupto no puede tirar abajo la home. |
| `price` con 3 decimales | La base trunca a 2. La Tarea 16 valida con Zod antes de llegar aquí. |
| Producto con `allergens` vacío | `String[] @default([])` devuelve `[]`. El mapper lo pasa directo. Nunca `null`. |
| Producto sin variantes | La relación devuelve `[]`. El mapper aplica `.sort()` sobre array vacío, que es seguro. |
| N+1 en categorías con conteo de productos | **No resuelto en esta tarea.** `findVisibleCategories` no trae el conteo. Si la UI (Tarea 17) lo necesita, agregar `_count` en el `select` de ese repositorio, no en un loop. |
| Muchos productos (500+) | Los repositorios no paginan. El volumen de un local de sándwiches es de ~20–40 productos. Si creciera, paginar **en el repositorio** (parámetro `limit`/`cursor`), nunca en el servicio con un `.slice()`. |
| Prisma no está instalado en el entorno de test | `tests/integration` requiere `.env.local` cargado. Configurar en `vitest.config.ts` con `envFile` o `dotenv`. |
| Conexión caída durante un test | El test falla con error de red. Es correcto: los tests de integración **deben** detectar una base caída. No agregar reintentos que oculten el problema. |

---

## 10. Pruebas

| Suite | Qué verifica |
|---|---|
| `product.repository.test.ts` | Filtro por status, mapeo de `Decimal`, filtro de disponibilidad, `ConflictError` por slug, `ResourceNotFoundError` por id, borrado lógico |
| `category.repository.test.ts` | `Restrict` de FK traducido a `ConflictError`, filtro de visibilidad |
| `settings.repository.test.ts` | Defaults sin fila, upsert singleton, degradación de `openingHours` corrupto |

**Criterio de diseño de los tests:**

- **Comportamiento, no implementación.** El test verifica que "no se muestran los borradores", no que "se llamó `findMany` con este where".
- **Una dependencia real.** Se prueba contra la base de verdad, no contra mocks. Un mock de Prisma verifica que el código se llama como se escribió, no que funcione. Solo tiene sentido testear contra la DB real cuando la lógica es de traducción (como el mapeo de `Decimal`).
- **Nombres descriptivos en español.** `it("debe excluir los productos que no están PUBLISHED")` documenta el comportamiento y sobrevive a los refactors. `it("works")` no dice nada.

---

## 11. Definición de "Hecho" (Definition of Done)

- [x] Todos los criterios de §8 marcados
- [x] `npm run verify` + `npm run build` en verde
- [x] `docs/tasks/README.md` actualizado
- [ ] Commit: `feat(04): capa de datos con repositorios y DTOs serializables`
- [ ] PR mergeada a `main`
- [x] **`docs/erd.md` sigue sincronizado** con el schema (esta tarea no debería haberlo cambiado; si cambió, justificar en el commit)

---

## 13. Registro de ejecución y desviaciones

**Fecha:** 2026-09-30 · **Verificación:** Postgres 17 en Docker (contenedor de sonda de la Tarea 02/03, sin credenciales de Supabase reales) · `npm run verify` ✅ (31 tests: 26 integración + 5 unit) · `npm run build` ✅ · `rg "prisma\." src/` → solo `infra/`, `repositories/` y la sonda de `health` documentada ✅

**Desviaciones y decisiones respecto al documento de la tarea:**

1. **`server-only` necesita un stub en Vitest.** El §6.8 de la tarea afirma que el paquete “no rompe” en Vitest, pero su `index.js` lanza **al importarse** en cualquier runtime sin el condicional `react-server` (que solo aplica el bundler de Next.js). Se agregó `resolve.alias` en `vitest.config.ts` a `tests/server-only.stub.ts` (no-op). **La verificación de la frontera no se pierde:** sigue blindada por el build de Next.js, que sí falla si un archivo del cliente importa `server-only`.
2. **`id del singleton como string "1"`.** El esquema de la Tarea 03 define `BusinessSettings.id` como `String @default("1")` (literal de string); el pseudocódigo de esta tarea usaba `id: 1` numérico. Se respetó el tipo real del schema.
3. **El `select` vive en el archivo del mapper, no en el repositorio.** El pseudocódigo importaba el tipo desde el repositorio al mapper, lo que producía una circularidad de tipos. La solución elegida invierte la dependencia: `mappers/product.mapper.ts` exporta `PRODUCT_SELECT` + `ProductWithRelations`, y el repositorio los consume. Así el contrato de lectura queda físicamente junto a la conversión que lo exige (si ambos divergen, el compilador avisa).
4. **`updateProduct` sin spreads.** Con `exactOptionalPropertyTypes: true` (Tarea 01), un `Partial<>` spredado no es asignable al `*UpdateInput` de Prisma (sus campos opcionales son `T | undefined`). El payload se construye **campo a campo** sin un solo cast, bajo la regla 7 transversal (“cero `any`, cero `@ts-ignore`, cero `!`”). Es más verboso y más seguro que el pseudocódigo.
5. **La categoría de los tests se crea en `beforeEach`**, no en `beforeAll` como el pseudocódigo: `resetDatabase` hace `TRUNCATE … CASCADE` entre tests, de modo que una fila creada una sola vez quedaría con la FK colgando en el primer test.
6. **`buildProduct` tipado contra `CreateProductInput`** en vez del `Parameters<typeof toggleProductAvailability>` del pseudocódigo, que no modela el dominio.
7. **Tests extra** (por encima del mínimo): toggle idempotente, variantes vacías como `[]`, update con slug duplicado en categorías, CHECK de singleton de `business_settings` desde el repositorio (rechaza una segunda fila).

**Lo que esta tarea NO hizo (pertenece a otras):** ninguna QUERY de interfaz de negocio, ningún servicio (Tarea 08), ningún `_count` en categorías (Tarea 17 lo agregará en el `select` si la UI lo necesita, sin loops).

> **Antes de mergear:** ejecutar `rg "prisma\." src/ --files-with-matches` y confirmar que la lista solo contiene `src/server/infra/` y `src/server/repositories/`. Si aparece `src/app/` o `src/components/`, la capa de datos se filtró hacia arriba y hay que revertirlo antes de seguir.

---

## 12. Dependencias y bloqueos

**Habilita:** 05 (seed usa los repositorios o `supabaseAdmin`), 08 (los servicios se escriben contra estas funciones), 14 (tabla admin), 16 (CRUD).

**Decisiones que esta tarea deja establecidas:**

1. `src/server/repositories/` es la **única** capa con queries de Prisma.
2. Los repositorios **traducen** la base, no **interpretan** reglas de negocio.
3. Todo retorno de repositorio es un **DTO plano y serializable**: `Decimal → number`, `Date → string ISO`, enum → union type.
4. Los errores de Prisma (`P2002`, `P2003`, `P2025`) se traducen a errores de dominio accionables.
5. `toggleProductAvailability(id, isAvailable)` recibe el valor destino: la decisión la toma la UI, la aplicación es atómica.
6. `findBusinessSettings()` es resiliente: devuelve defaults en lugar de lanzar.
7. `business_settings` es singleton con `id = 1` y se lee con `upsert` en escritura.
8. Los parámetros de más de un argumento son objetos nombrados.
