# Tarea 14 — Panel Admin: Shell y Disponibilidad

| Campo | Valor |
|---|---|
| **ID** | 14 |
| **Fase (DESIGN.md §8.6)** | Fase 4 — Panel de administración |
| **Depende de** | 07, 09 |
| **Habilita** | 15, 16 |
| **Tipo** | Presentación + Controlador |
| **Esfuerzo est.** | 2 – 3 días |

---

## 1. Objetivo de la tarea

Construir el **shell del panel de administración**: el layout protegido que envuelve a todas las rutas `/admin/**`, la navegación, el encabezado de página y la primera pantalla de datos del negocio. Sobre esa base, implementar el **toggle de `isAvailable`** (el stock en vivo), que es la operación que el encargado del local va a ejecutar dozens de veces por día y la que define si el resto del panel se siente rápido o lento.

**Criterio de éxito verificable:** con un usuario sin sesión, `/admin/productos` no renderiza ni una fila de producto; con un usuario autorizado, alternar un producto tarda menos de 400 ms en confirmarse en pantalla y, si la Server Action falla, el switch vuelve al valor anterior y muestra un toast.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 07 completada (`verifyAdminSession`, `sanitizeNextPath`, `logoutAction`, `supabaseBrowser` preparado) y Tarea 09 completada (las trece primitivas de `@/components/ui` y el `ToastProvider` en el layout raíz).

**Advertencia de orden.** Esta tarea **no** implementa el CRUD de productos. La tabla de `/admin/productos` muestra, edita disponibilidad y nada más. Las rutas de alta, edición y archivado son la Tarea 16, que depende de esta.

### 2.1 El problema que esta tarea resuelve

El local tiene un menú de veinte a cuarenta productos y dos o tres personas que lo atienden. Entre las 11 y las 14 se vende una parte importante del menú. Cuando se acaba el jamón, el encargado tiene que reflejarlo en el chat de WhatsApp en menos de un minuto, y cuando llega stock nuevo, tiene que volver a habilitarlo.

Ese ciclo es la **única** operación del panel que es frecuente. Todo lo demás (crear un producto, cambiar el número de WhatsApp) pasa una vez cada semanas. La consecuencia de diseño es directa:

- La disponibilidad **no** va cacheada en el HTML (Tarea 08 §4.5).
- La disponibilidad **no** invalida la caché del catálogo cuando cambia (esta tarea, §4.3).
- La disponibilidad se propaga a los clientes que ya tienen la página abierta por Realtime (Tarea 15, §12 de este documento).

### 2.2 Por qué el shell se construye ahora y no después

El layout protegido es la pieza que **cierra el panel**. Sin él, cada ruta de `/admin` es un Server Component suelto y cada Server Action depende de que nadie se acuerde de verificar la sesión. Con él, hay un solo lugar donde se verifica para el render, y las acciones siguen verificando igual.

### Checklist de prerrequisitos

- [ ] `npm run typecheck` en verde
- [ ] `src/server/auth/verify-admin.ts` existe y exporta `verifyAdminSession` y `requireAdminSession`
- [ ] `src/components/ui/index.ts` exporta `Button`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`, `useToast`
- [ ] `src/app/layout.tsx` ya envuelve el árbol en `ToastProvider` y `ToastViewport`
- [ ] Existe al menos un usuario en `staff_members` (Tarea 05) para poder entrar

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `src/app/admin/layout.tsx` | Layout protegido. Llama a `verifyAdminSession()` en servidor y redirige a `/login` si falla |
| `src/app/admin/page.tsx` | Dashboard mínimo: contadores del catálogo y estado de configuración del negocio |
| `src/app/admin/productos/page.tsx` | Tabla de productos para el admin |
| `src/app/admin/loading.tsx` | Skeleton de la tabla mientras el Server Component resuelve |
| `src/app/admin/productos/loading.tsx` | Skeleton específico de la tabla de productos |
| `src/app/admin/error.tsx` | Frontera de error de `/admin`. `"use client"`, muestra `ErrorState` con reintento |
| `src/config/admin-navigation.ts` | Modelo de datos de la navegación del panel. Puro, sin React |
| `src/components/admin/AdminShell.tsx` | Marco del panel: `<aside>` fijo en desktop y cabecera en mobile |
| `src/components/admin/AdminSidebar.tsx` | Barra lateral: marca, `AdminNav`, sesión activa y cierre de sesión |
| `src/components/admin/AdminNav.tsx` | Lista de secciones. Client Component: `usePathname` para el activo y `Sheet` en mobile |
| `src/components/admin/PageHeader.tsx` | Encabezado de página: título, descripción y acciones |
| `src/components/admin/LogoutButton.tsx` | Botón que dispara `logoutAction` |
| `src/components/admin/ProductTable.tsx` | Tabla de productos. Server Component: solo presentación de filas |
| `src/components/admin/ProductTableSkeleton.tsx` | Geometría de la tabla en `Skeleton` |
| `src/components/admin/AvailabilitySwitch.tsx` | Toggle optimista de `isAvailable`. Client Component |
| `src/server/schemas/product-availability.schema.ts` | Contrato Zod de la entrada del toggle |
| `src/server/services/product.service.ts` | Servicio de producto del panel: proyección para tabla y acción de disponibilidad |
| `src/server/actions/product-availability.actions.ts` | `"use server"`. Autoriza, valida, delega, revalida |
| `tests/unit/product.service.test.ts` | Reglas de la proyección y del toggle, con dobles written a mano |
| `src/components/admin/AvailabilitySwitch.component.test.tsx` | Optimista, rollback, bloqueo durante el vuelo, accesibilidad |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `src/server/services/repository-ports.ts` | Agregar `ProductAdminReader`, `ProductAvailabilityWriter` y `CategoryAdminLister` |
| `src/server/services/index.ts` | Composition root: cablear el servicio de producto con los repositorios de Prisma |
| `src/app/admin/layout.tsx` | Si la Tarea 07 lo adelantó, reemplazar el `redirect("/login")` pelado por el shell completo |
| `docs/tasks/README.md` | Marcar Tarea 14 |

### 3.3 Eliminar

Ninguno.

---

## 4. Estructura N-Capas

### 4.1 Qué vive en esta capa

| Capa | Qué va | Qué NO va |
|---|---|---|
| 2 · Server Action | Autorizar, validar con Zod, delegar, revalidar caché, traducir errores de dominio a mensajes de UI | Queries. Lógica de negocio. Traducir errores a otros errores |
| 3 · Servicio | Proyectar `ProductDTO[]` a filas de tabla, resolver el nombre de la categoría, exponer la acción de disponibilidad | React, `next/*` (salvo la caché de la Tarea 08), Prisma |
| 1 · Presentación | Shell, navegación, tabla, switch optimista, toasts | `verifyAdminSession` desde componentes. `revalidateTag` desde componentes |
| ⛔ Middleware | Refrescar token y evitar el destello | **Seguridad.** Ver §4.2 |

### 4.2 El middleware no es seguridad (reafirmado)

> **La autorización real es `verifyAdminSession()` en el layout de `/admin` y en cada Server Action.**

Repetir esto acá no es redundancia. La Tarea 07 lo dejó escrito y este es el archivo donde se cumple:

1. El middleware corre en **Edge**. No puede consultar Postgres, así que no puede saber si el usuario tiene fila en `staff_members`. Un usuario borrado de la tabla pero con cookie viva pasa el middleware.
2. El middleware usa `getClaims()`, que valida la firma del JWT **localmente** y no consulta el servidor de Auth. Un token revocado sigue siendo criptográficamente válido hasta que vence.
3. Por lo tanto el `redirect` del layout es la primera comprobación real, y la comprobación real **por operación** es la que hace la Server Action.

Si mañana alguien borra el middleware, el panel sigue seguro. Si alguien borra el `verifyAdminSession` de una action y deja solo el middleware, el panel es una puerta abierta. La diferencia entre esos dos casos es la que obliga a escribir la verificación en las dos capas.

### 4.3 La regla de caché del toggle: por qué acá NO va `revalidateTag("products")`

Este es el punto donde es más fácil meter un bug que no se ve hasta que hay tráfico.

**Lo que dice el toggle NO hace:**

```ts
// ⛔ ESTO NO SE HACE EN ESTA TAREA
revalidateTag("products");        // invalida /menu para TODOS los clientes
revalidatePath("/menu");          // idem, y además tira la ISR de esa ruta
```

**Lo que sí hace:**

```ts
revalidatePath("/admin/productos");  // única vista que renderiza el switch
```

El motivo está fijado en la Tarea 08 §4.5 y en `DESIGN.md` §6.1:

| Capa de datos | Contenido | Frecuencia | Caché |
|---|---|---|---|
| Contenido | Nombres, precios, fotos, categorías | Horas o días | Sí, ISR con tag `products` |
| Disponibilidad | `isAvailable` de cada producto | Minutos | No. Vive en memoria del cliente y llega por push |

Si el toggle invalidara el tag, cada cambio de stock obligaría a regenerar el HTML del catálogo para todos los clientes al mismo tiempo. Con un solo encargado sería molesto; con el local abierto a las doce sería una regeneración por cada producto que se agota.

`revalidatePath("/admin/productos")` sí está, y no es decorativo: la ruta es dinámica, pero Next mantiene una caché del **router cache** del cliente. Sin esa llamada, un `router.refresh()` posterior a un error podría devolver la tabla con el valor viejo.

> **Si algún día un toggle invalida `products`, eso es un bug, no una optimización.** La Tarea 08 lo dice con esas palabras.

### 4.4 El axioma de dominio, aplicado a esta pantalla

La tabla muestra `status` y `isAvailable` **en columnas separadas**, y el switch solo escribe la segunda.

| `status` | Significado | Quién lo cambia | Cuándo |
|---|---|---|---|
| `DRAFT` / `PUBLISHED` / `ARCHIVED` | Estado editorial. ¿Existe para el público? | Dueño del local | Pocas veces |
| `isAvailable` | Stock. ¿Se puede pedir ahora? | Encargado | Minutos |

Un producto `PUBLISHED` con `isAvailable: false` es un caso **legítimo y frecuente**: está en el menú, se lo ve, aparece desaturado con el badge "Agotado" (Tarea 10) y no se puede agregar al carrito. El switch lo pone en `false` sin sacarlo del menú.

Por eso el switch **no** escribe `status`, y por eso la tabla muestra la columna con un `Badge` y no con un select: cambiar el estado editorial desde la tabla sería una operación destructiva sin confirmación, y esa es la Tarea 16.

### 4.5 Reparto específico

| Necesidad | Dónde vive | Razón |
|---|---|---|
| `verifyAdminSession()` | `src/server/auth/verify-admin.ts` (Tarea 07) | La frontera de seguridad, en un solo archivo |
| Modelo de navegación | `src/config/admin-navigation.ts` | Datos puros: los usan el server y el cliente, sin `"use client"` |
| `aria-current` del enlace activo | `AdminNav.tsx` | Necesita `usePathname()`, que no existe en el servidor |
| Estado optimista del switch | `AvailabilitySwitch.tsx` | Es estado de UI transitorio. El servidor no participa |
| Proyección a filas de tabla | `product.service.ts` | La vista no arma objetos: recibe filas listas |
| Nombre de la categoría | `product.service.ts` | El `ProductDTO` solo trae `categoryId`. Unir en el servicio, no en el JSX |

---

## 5. Convenciones de código (Clean Code + SOLID)

**Principio aplicado: SRP para los componentes de shell, DIP para el servicio.**

### 5.1 El shell se parte por responsabilidad, no por tamaño

Cuatro archivos que podrían ser uno:

| Archivo | Responsabilidad | `"use client"` |
|---|---|---|
| `AdminShell.tsx` | Marco: `<aside>` fijo en desktop, cabecera en mobile, `<main>` | No |
| `AdminSidebar.tsx` | Contenido de la barra: marca, navegación, sesión, logout | No |
| `AdminNav.tsx` | Los enlaces y el estado activo | **Sí** |
| `PageHeader.tsx` | Título, descripción y acciones | No |

`AdminNav` es el único Client Component del shell porque es el único que necesita `usePathname()` y `Sheet`. Si se hiciera todo cliente, el layout de `/admin` dejaría de ser un Server Component y la navegación se pagaría en el bundle de JavaScript de cada página del panel. Si se hiciera todo servidor, el enlace activo se resolvería con unSegmento de ruta que no existe en el árbol de App Router.

### 5.2 El switch es optimista, y esa decisión tiene un costo explícito

Un toggle que espera la respuesta antes de moverse se siente lento con 300 ms de latencia, que es lo que se mide entre el clic y la ida a la base y de vuelta. El patrón optimista hace esto:

1. Escribe el valor destino en el estado local. La interfaz responde en el mismo frame.
2. Llama a la Server Action.
3. Si vuelve `ok`, no hace nada: ya está.
4. Si vuelve con error, **vuelve el estado al valor anterior** y dispara un toast.

El costo es que durante el vuelo la pantalla muestra un valor que todavía no está en la base. Se acepta porque la ventana es de cientos de milisegundos y el rollback es visible e inmediato cuando falla. Lo que **no** se hace es dejar el switch habilitado durante el vuelo, que sí mostraría un estado Mentiroso.

### 5.3 Nombres

| Elemento | Nombre | Razón |
|---|---|---|
| Acción de Server | `toggleProductAvailabilityAction` | Sufijo `Action` del contexto §14 |
| Servicio (lectura) | `getProductsForAdmin` | `get*` = devuelve datos ya filtrados por regla |
| Servicio (escritura) | `setProductAvailability` | ⛔ No se llama `toggle`, porque **no alterna**: recibe el valor destino y lo aplica. `toggle` sugeriría que el servidor decide el nuevo valor, y no es así (Tarea 04 §7) |
| Componente | `AvailabilitySwitch` | `isAvailable` es "disponibilidad", no "stock" en el nombre: el stock es un concepto más amplio que este proyecto no modela |
| Configuración | `ADMIN_NAV_SECTIONS` | `SCREAMING_SNAKE` para una constante (contexto §1) |
| Cliente | `LogoutButton` | Sustantivo + `Button`, como el resto de los controles de la Tarea 09 |

### 5.4 Límites de tamaño

Contexto §13: componente 200 líneas, Server Action 120. `ProductTable.tsx` es el que más crece; si supera el límite, se divide por columna, no por cantidad de filas ni por helper suelto: `ProductRow.tsx` y `ProductRowSkeleton.tsx`.

---

## 6. Pasos de implementación

### 6.1 Puertos de repositorio

```ts
// src/server/services/repository-ports.ts (agregar al final)

import type { CategoryDTO } from "@/lib/domain";

/**
 * ⛔ Solo declaraciones de tipo. Sin `fetch`, sin `process.env`, sin Prisma.
 *    Ver Tarea 08 §6.2.
 */

/** Listado completo para el panel: incluye DRAFT y ARCHIVED. */
export interface ProductAdminReader {
  findAllProductsForAdmin(): Promise<ProductDTO[]>;
}

/**
 * Escritura de disponibilidad.
 *
 * ⚠️ Recibe el **valor destino**. Dos clics simultáneos no pueden
 * desincronizarse porque el servidor nunca "alterna": aplica lo que le
 * mandan. Ver Tarea 04 §7.
 */
export interface ProductAvailabilityWriter {
  toggleProductAvailability(id: string, isAvailable: boolean): Promise<ProductDTO>;
}

/** Listado de categorías para poder poner el nombre en la fila de la tabla. */
export interface CategoryAdminLister {
  findAllCategoriesForAdmin(): Promise<CategoryDTO[]>;
}
```

ISP se mantiene: `category.service` sigue viendo solo `CategoryAdminReader` y **no** puede llamar a `deleteCategory`, aunque el tipo exista en otro lado del archivo.

### 6.2 Servicio de producto del panel

```ts
// src/server/services/product.service.ts
import "server-only";

import type { CategoryDTO, ProductDTO, ProductStatusDTO } from "@/lib/domain";
import type {
  CategoryAdminLister,
  ProductAdminReader,
  ProductAvailabilityWriter,
} from "./repository-ports";

/**
 * Fila de la tabla de productos del panel.
 *
 * ⛔ Proyección plana a propósito: el `ProductDTO` completo trae
 *    `variants`, `allergens` y `description`, que la tabla no usa. No hace
 *    falta serializar veinte descripciones para pintar siete columnas, y
 *    `variants` no tiene por qué viajar al cliente de una tabla.
 */
export interface ProductRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly imageUrl: string;
  readonly price: number;
  readonly status: ProductStatusDTO;
  readonly isAvailable: boolean;
  readonly isFeatured: boolean;
  readonly sortOrder: number;
  readonly categoryId: string;
  readonly categoryName: string;
}

/** Categoría sin nombre propio: la tabla muestra "(sin categoría)" en vez de un hueco. */
const UNASSIGNED_CATEGORY_NAME = "(sin categoría)";

/**
 * Une productos con el nombre de su categoría.
 *
 * El `ProductDTO` solo trae `categoryId`. Unir acá y no en el JSX tiene una
 * razón concreta: si el nombre se cruzara en el componente, hacer el `Map`
 * sería responsabilidad de la vista y se repetiría en cada render.
 */
const buildProductRows = (
  products: readonly ProductDTO[],
  categories: readonly CategoryDTO[],
): readonly ProductRow[] => {
  const nameByCategoryId = new Map(categories.map((c) => [c.id, c.name]));

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    imageUrl: product.imageUrl,
    price: product.price,
    status: product.status,
    isAvailable: product.isAvailable,
    isFeatured: product.isFeatured,
    sortOrder: product.sortOrder,
    categoryId: product.categoryId,
    categoryName: nameByCategoryId.get(product.categoryId) ?? UNASSIGNED_CATEGORY_NAME,
  }));
};

export interface ProductAdminDependencies {
  readonly productRepository: ProductAdminReader;
  readonly categoryRepository: CategoryAdminLister;
}

/**
 * Listado del panel de productos.
 *
 * ⛔ Sin caché y sin tag de revalidación. Es una lectura de admin sobre
 *    datos que el admin acaba de cambiar, detrás de una sesión. Cachear
 *    una tabla que el usuario está editando produce la sensación exacta de
 *    "guardé y no pasó nada".
 *
 * ⚠️ No filtra por `status`: el panel tiene que **ver** los borradores y
 *    los archivados para poder promotearlos. El filtro `PUBLISHED` es una
 *    regla del catálogo público (Tarea 08 §4.3), no del panel.
 */
export const getProductsForAdmin = async (
  dependencies: ProductAdminDependencies,
): Promise<readonly ProductRow[]> => {
  const [products, categories] = await Promise.all([
    dependencies.productRepository.findAllProductsForAdmin(),
    dependencies.categoryRepository.findAllCategoriesForAdmin(),
  ]);

  return buildProductRows(products, categories);
};

export interface SetProductAvailabilityInput {
  readonly id: string;
  readonly isAvailable: boolean;
}

export interface ProductAvailabilityDependencies {
  readonly productRepository: ProductAvailabilityWriter;
}

/**
 * Fija la disponibilidad de un producto.
 *
 * Se llama `set`, no `toggle`, porque recibe el valor destino y lo aplica.
 * El repositorio ya traduce `P2025` a `ResourceNotFoundError`, y eso se
 * propaga sin envolver: el Server Action lo traduce a un mensaje de UI.
 *
 * ⛔ Este servicio **no** revalida caché. La invalidación es de la capa 2,
 *    y además acá no hay nada que invalidar: ver §4.3.
 */
export const setProductAvailability = async (
  dependencies: ProductAvailabilityDependencies,
  input: SetProductAvailabilityInput,
): Promise<ProductDTO> =>
  dependencies.productRepository.toggleProductAvailability(input.id, input.isAvailable);
```

### 6.3 Composition root

La Tarea 10 dejó `src/server/services/index.ts` como el lugar donde se cablean repositorios y servicios una sola vez. Ahí se agrega el servicio de producto, manteniendo la convención de la Tarea 08: se **inyectan** repositorios, no se importan dentro del servicio.

```ts
// src/server/services/index.ts (agregar al archivo que dejó la Tarea 10)

import type { BusinessSettingsDTO } from "@/lib/domain";
import {
  findAllCategoriesForAdmin,
  findVisibleCategories,
} from "@/server/repositories/category.repository";
import {
  findAllProductsForAdmin,
  findPublishedProducts,
  toggleProductAvailability,
} from "@/server/repositories/product.repository";
import { findBusinessSettings } from "@/server/repositories/settings.repository";
import { getBusinessSettings } from "./settings.service";
import {
  getProductsForAdmin as readProductsForAdmin,
  setProductAvailability as writeProductAvailability,
  type ProductRow,
  type SetProductAvailabilityInput,
} from "./product.service";

/**
 * ⛔ Composition root.
 *
 * Este es el **único** archivo del proyecto que importa repositorios de
 * Prisma para armar servicios. El resto llama a estas funciones ya
 * cableadas, y por eso los tests unitarios de los servicios corren sin
 * base de datos: el servicio recibe sus dependencias por parámetro y el
 * cableado ocurre acá, una sola vez.
 *
 * ⚠️ Los nombres públicos coinciden con los del servicio a propósito. Quien
 *    importa de `@/server/services` nunca ve los parámetros de inyección,
 *    y quien testea el servicio sí los ve. Un archivo, dos formas de
 *    entrar, sin un `index.ts` que reexporte y que esconda de dónde
 *    salen las cosas.
 */

/** Productos para la tabla del panel. Incluye DRAFT y ARCHIVED. */
export const getProductsForAdmin = (): Promise<readonly ProductRow[]> =>
  readProductsForAdmin({
    productRepository: { findAllProductsForAdmin },
    categoryRepository: { findAllCategoriesForAdmin },
  });

/** ⛔ ÚNICO camino de escritura de disponibilidad. La Tarea 16 lo reutiliza. */
export const setProductAvailability = (
  input: SetProductAvailabilityInput,
): Promise<Awaited<ReturnType<typeof toggleProductAvailability>>> =>
  writeProductAvailability({ productRepository: { toggleProductAvailability } }, input);

/** Ajustes del negocio para la barra lateral y el dashboard. Sin caché. */
export const getSettingsForAdmin = (): Promise<BusinessSettingsDTO> =>
  getBusinessSettings({ settingsRepository: { findBusinessSettings } });

export type { ProductRow, SetProductAvailabilityInput } from "./product.service";
```

> Los `findPublishedProducts` e `findVisibleCategories` que ya estaban en el archivo desde la Tarea 10 se siguen usando para `getCatalogForPublic`. No se tocan. Este bloque solo **agrega** el cableado del panel: no reemplaza nada de la Tarea 08 ni de la 10.

### 6.4 Esquema Zod del toggle

```ts
// src/server/schemas/product-availability.schema.ts
import { z } from "zod";

/**
 * Entrada de la acción de disponibilidad.
 *
 * ⛔ `.strict()`: un objeto con claves que no están acá se rechaza, en
 *    lugar de aceptarse con campos de más que nadie lee. El cliente nunca
 *    es confiable, y "aceptar de más" en la frontera es la forma más
 *    corta de que un campo sin nombre aparezca en el payload y nadie sepa
 *    de dónde salió.
 */
export const ToggleProductAvailabilitySchema = z
  .object({
    id: z.string().trim().min(1, { message: "Falta el producto." }).max(64),
    isAvailable: z.boolean(),
  })
  .strict();

export type ToggleProductAvailabilityInput = z.infer<
  typeof ToggleProductAvailabilitySchema
>;
```

### 6.5 Server Action

```ts
// src/server/actions/product-availability.actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { ResourceNotFoundError, ValidationError, toSafeErrorMessage } from "@/lib/domain";
import type { DomainErrorCode } from "@/lib/domain";
import { verifyAdminSession } from "@/server/auth/verify-admin";
import { setProductAvailability } from "@/server/services";
import { ToggleProductAvailabilitySchema } from "@/server/schemas/product-availability.schema";

/**
 * ⛔ ESTA ES LA FRONTERA DE SEGURIDAD DE LA OPERACIÓN, no el layout y no
 *    el middleware. El layout protects el render; esto protege el dato.
 *    Si mañana alguien saca esta llamada, alternar stock pasa a ser una
 *    ruta pública.
 */
export type ProductAvailabilityActionResult =
  | { readonly ok: true; readonly data: { readonly id: string; readonly isAvailable: boolean } }
  | {
      readonly ok: false;
      readonly error: string;
      /**
       * Código de dominio estable. El cliente lo usa para decidir qué
       * hacer además de mostrar el mensaje: con `UNAUTHORIZED` navega al
       * login, con `RESOURCE_NOT_FOUND` refresca la tabla.
       */
      readonly code: DomainErrorCode | "UNKNOWN";
    };

export async function toggleProductAvailabilityAction(
  rawInput: unknown,
): Promise<ProductAvailabilityActionResult> {
  // 1. AUTORIZAR. Siempre primero, antes de mirar el input.
  const session = await verifyAdminSession();
  if (session === null) {
    return {
      ok: false,
      error: "Tu sesión expiró. Volvé a iniciar sesión para seguir.",
      code: "UNAUTHORIZED",
    };
  }

  // 2. VALIDAR. El cliente manda JSON, no una confianza.
  const parsed = ToggleProductAvailabilitySchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "No se pudo leer la solicitud.", code: "VALIDATION_ERROR" };
  }

  try {
    // 3. DELEGAR. El servicio no sabe de React ni de caché.
    const product = await setProductAvailability({
      id: parsed.data.id,
      isAvailable: parsed.data.isAvailable,
    });

    // 4. REVALIDAR. Solo la vista del panel: ver §4.3 para por qué acá
    //    NO va revalidateTag("products").
    revalidatePath("/admin/productos");

    return { ok: true, data: { id: product.id, isAvailable: product.isAvailable } };
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return {
        ok: false,
        error: "Ese producto ya no existe. Actualizá la página.",
        code: "RESOURCE_NOT_FOUND",
      };
    }
    if (error instanceof ValidationError) {
      return { ok: false, error: toSafeErrorMessage(error), code: "VALIDATION_ERROR" };
    }
    console.error("[action:toggleProductAvailability]", error);
    return {
      ok: false,
      error: "No se pudo cambiar la disponibilidad. Intentá de nuevo.",
      code: "UNKNOWN",
    };
  }
}
```

Tres decisiones que conviene que queden escritas:

1. **`ok: true` devuelve el dato, no nada.** El cliente puede verificar que lo que se ve en pantalla es lo que quedó guardado, y no su propia intuición. Cuesta cuatro campos.
2. **El `code` de error es parte del contrato.** Un `string` de mensaje obliga al cliente a hacer `includes("expiró")` para decidir si navega al login. Un código estable se puede testear.
3. **El `error` nunca es el mensaje crudo de la excepción.** `toSafeErrorMessage` y el `console.error` separan lo que ve el usuario de lo que ve el operador. Un mensaje de Prisma que llega a pantalla dice nombres de tabla y columnas a cualquiera que esté mirando.

### 6.6 Layout protegido

```tsx
// src/app/admin/layout.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/server/auth/verify-admin";
import { getSettingsForAdmin } from "@/server/services";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { LogoutButton } from "@/components/admin/LogoutButton";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Mi Negocio" },
  // Un panel en el índice de Google es un panel en el índice de Google.
  robots: { index: false, follow: false },
};

/**
 * ⛔ `force-dynamic` explícito, aunque `verifyAdminSession` ya lee cookies
 *    y eso basta para que Next descarte el render estático. La constante
 *    está para que nadie tenga que saber eso: si mañana alguien cachea el
 *    layout por alguna razón, acá sigue diciendo que no.
 */
export const dynamic = "force-dynamic";

/**
 * ⛔ ⛔ ESTA ES LA FRONTERA DE SEGURIDAD DEL RENDER. ⛔ ⛔
 *
 * El middleware ya manda a `/login` a quien no tiene cookie. Eso es UX:
 * evita el destello de la página en blanco. Este `redirect` es lo que
 * responde cuando la cookie existe pero no autoriza: el token es
 * criptográficamente válido, `getClaims()` no lo impugna, y sin esta
 * llamada el usuario vería el panel vacío con un 200.
 *
 * Y aunque este layout existiera, la autorización **real** de cada
 * operación sigue estando en cada Server Action (Tarea 07 §4.2).
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await verifyAdminSession();
  if (session === null) {
    redirect("/login");
  }

  // ⛔ Sin caché: los ajustes muestran el nombre y el WhatsApp del local.
  const settings = await getSettingsForAdmin();

  return (
    <AdminShell
      sidebar={
        <AdminSidebar
          businessName={settings.name}
          userEmail={session.email}
          userRole={session.role}
          logout={<LogoutButton />}
        />
      }
    >
      {children}
    </AdminShell>
  );
}
```

#### Por qué el layout no pasa `next`

Un layout de App Router no recibe `searchParams`. No sabe en qué ruta estaba el usuario, así que no puede armar `/login?next=/admin/productos`.

No es una pérdida: la preservación del path ya la resuelve el middleware, que **sí** conoce la URL de la petición y la manda en el `next` saneado por `sanitizeNextPath`. El `redirect` del layout es la red para el caso en que el middleware no corrió, y en ese caso el destino correcto es el home del panel.

Cuando sea una Server Action la que detecte la sesión expirada, la ruta exacta la tiene el componente de cliente, y ahí sí se navega con `usePathname()` sanitizado.

### 6.7 El shell

```tsx
// src/components/admin/AdminShell.tsx
import type { ReactNode } from "react";
import { AdminNav } from "./AdminNav";

/**
 * Marco del panel: navegación persistente y área de contenido.
 *
 * ⛔ `AdminNav` se monta acá y no dentro de `AdminSidebar` a propósito.
 * En desktop la barra lateral es fija y siempre visible; en mobile el
 * mismo contenido vive en un `Sheet` que se abre desde la cabecera. Si el
 * `nav` estuviera dentro del `aside`, habría que duplicarlo en dos ramas
 * del `md:` y las dos copias se desincronizarían al agregar una sección.
 */
export function AdminShell({
  sidebar,
  children,
}: {
  readonly sidebar: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-cream">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-paper focus:px-4 focus:py-2 focus:shadow-card"
      >
        Saltar al contenido
      </a>

      {/* Desktop: la barra vive en el flujo y ocupa ancho. */}
      <div className="hidden md:flex">
        <aside className="sticky top-0 h-dvh w-72 shrink-0 border-r border-line bg-paper">
          {sidebar}
        </aside>
      </div>

      {/* Mobile: la barra se oculta y `AdminNav` la vuelve a montar
          dentro de un `Sheet`. Se pasa `variant="sheet"` desde abajo. */}
      <div className="md:hidden">
        <AdminNav variant="sheet" businessNameFallback="Mi Negocio" />
      </div>

      <div id="contenido" className="px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
```

```tsx
// src/components/admin/AdminSidebar.tsx
import Link from "next/link";
import { AdminNav } from "./AdminNav";
import type { AdminRole } from "@/lib/domain";

const ROLE_LABEL: Record<AdminRole, string> = {
  OWNER: "Dueño",
  STAFF: "Encargado",
};

/**
 * Contenido de la barra lateral de desktop.
 *
 * Server Component a propósito: el nombre del local y el email de quien
 * entró se resuelven en servidor y viajan por el HTML. Si esto fuera un
 * Client Component, esos dos datos estarían en el bundle de JavaScript de
 * cada página del panel para no hacer nada con ellos.
 */
export function AdminSidebar({
  businessName,
  userEmail,
  userRole,
  logout,
}: {
  readonly businessName: string;
  readonly userEmail: string;
  readonly userRole: AdminRole;
  readonly logout: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-6 p-5">
      <Link href="/admin" className="block">
        <span className="block text-xs tracking-wide text-ink-muted uppercase">
          Panel
        </span>
        <span className="block font-display text-lg text-ink">{businessName}</span>
      </Link>

      <AdminNav variant="sidebar" businessNameFallback={businessName} />

      <div className="mt-auto space-y-3 border-t border-line pt-4">
        <p className="truncate text-sm text-ink">{userEmail}</p>
        <p className="text-xs text-ink-muted">{ROLE_LABEL[userRole]}</p>
        {logout}
      </div>
    </div>
  );
}
```

```tsx
// src/components/admin/AdminNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { Sheet } from "@/components/ui";
import { ADMIN_NAV_SECTIONS } from "@/config/admin-navigation";

/**
 * Enlaces del panel, con el estado activo resuelto en el cliente.
 *
 * ⚠️ Por qué Client Component: `usePathname()` no existe en el servidor.
 *    Con un Server Component habría que comparar el `href` contra algo que
 *    la ruta no expone, y la alternativa (`useSelectedLayoutSegment`) no
 *    cubre el caso de `/admin` exacto contra `/admin/productos`.
 */
export function AdminNav({
  variant,
  businessNameFallback,
}: {
  readonly variant: "sidebar" | "sheet";
  readonly businessNameFallback: string;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const sheetTitleId = useId();

  const links = ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    isActive: pathname === section.href || pathname.startsWith(`${section.href}/`),
  }));

  const list = (
    <nav aria-label="Secciones del panel">
      <ul className="flex flex-col gap-1">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={() => setIsOpen(false)}
              aria-current={link.isActive ? "page" : undefined}
              className={
                link.isActive
                  ? "flex items-center gap-2 rounded-control bg-crust/10 px-3 py-2 text-sm font-medium text-crust-deep"
                  : "flex items-center gap-2 rounded-control px-3 py-2 text-sm text-ink-muted hover:bg-cream hover:text-ink"
              }
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  if (variant === "sheet") {
    return (
      <>
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-cream px-4 py-3">
          <span className="font-display text-base text-ink">{businessNameFallback}</span>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-expanded={isOpen}
            aria-controls={sheetTitleId}
            className="rounded-control border border-line-strong px-3 py-1.5 text-sm text-ink"
          >
            Menú
          </button>
        </div>

        <Sheet
          open={isOpen}
          onClose={() => setIsOpen(false)}
          title="Panel"
          description="Secciones del panel de administración"
          size="sm"
        >
          {list}
        </Sheet>
      </>
    );
  }

  return list;
}
```

```ts
// src/config/admin-navigation.ts
/**
 * Secciones del panel de administración.
 *
 * ⛔ Módulo de datos, no de presentación: no importa React, no lleva
 *    `"use client"` y por eso lo pueden leer tanto el Server Component
 *    como el `AdminNav`. Cuando se agreguen secciones (Tarea 17), este es
 *    el único lugar que hay que tocar.
 */
export interface AdminNavSection {
  readonly href: string;
  readonly label: string;
  /**
   * ⛔ `false` = la ruta todavía no existe.
   *
   * El enlace aparece deshabilitado con la explicación, en vez de
   * desaparecer. Un panel con un ítem visible que dice "Próximamente" le
   * dice al encargado qué va a poder hacer ahí; un ítem que no está le
   * deja preguntarse si lo está buscando mal.
   */
  readonly isAvailable: boolean;
}

export const ADMIN_NAV_SECTIONS: readonly AdminNavSection[] = [
  { href: "/admin", label: "Inicio", isAvailable: true },
  { href: "/admin/productos", label: "Productos", isAvailable: true },
  { href: "/admin/categorias", label: "Categorías", isAvailable: false },
  { href: "/admin/ajustes", label: "Ajustes", isAvailable: false },
] as const;
```

```tsx
// src/components/admin/PageHeader.tsx
import type { ReactNode } from "react";

/**
 * Encabezado de página del panel.
 *
 * Server Component sin lógica: recibe el título ya escrito y lo pinta.
 * Todas las rutas del panel lo usan igual, y por eso el margen entre el
 * encabezado y el contenido es el mismo en el dashboard y en la tabla.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl text-ink">{title}</h1>
        {description !== undefined && (
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        )}
      </div>
      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
```

```tsx
// src/components/admin/LogoutButton.tsx
"use client";

import { useFormStatus } from "react-dom";
import { logoutAction } from "@/server/auth/actions";

const Boton = () => {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-control border border-line-strong px-3 py-2 text-sm text-ink transition hover:bg-cream disabled:opacity-60"
    >
      {pending ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
};

/**
 * El logout es una Server Action del archivo de la Tarea 07. Este
 * componente solo existe para el estado de carga: sin él, el botón queda
 * habilitado y un segundo clic manda dos `signOut`.
 */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Boton />
    </form>
  );
}
```

### 6.8 Dashboard

```tsx
// src/app/admin/page.tsx
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/admin/PageHeader";
import { getProductsForAdmin, getSettingsForAdmin } from "@/server/services";

export const dynamic = "force-dynamic";

/**
 * ⛔ No se usa `getCatalogForPublic()` para contar.
 *
 * El catálogo público viene de la caché ISR y ve solamente PUBLISHED.
 * El panel tiene que contar borradores y archivados también: un dueño que
 * no ve que tiene cuatro borradores forgotten no sabe que hay que
 * publicarlos. Se lee la lista del admin, que es la única fuente completa.
 */
const AdminDashboard = async () => {
  const [products, settings] = await Promise.all([
    getProductsForAdmin(),
    getSettingsForAdmin(),
  ]);

  const publicados = products.filter((p) => p.status === "PUBLISHED");
  const agotados = publicados.filter((p) => !p.isAvailable);

  return (
    <>
      <PageHeader
        title="Inicio"
        description={`${settings.name} · ${settings.address ?? "Sin dirección cargada"}`}
      />

      {products.length === 0 ? (
        // Sin acción: la ruta de alta es la Tarea 16. Un botón que lleva
        // a un 404 es peor que ningún botón.
        <EmptyState
          title="Todavía no hay productos"
          message="El catálogo está vacío. Cuando se carguen, van a aparecer acá con su estado de disponibilidad."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard etiqueta="Productos" valor={products.length} />
          <StatCard etiqueta="Publicados" valor={publicados.length} />
          <StatCard
            etiqueta="Agotados"
            valor={agotados.length}
            detalle={publicados.length > 0 ? `${publicados.length} en el menú` : undefined}
          />
          <StatCard
            etiqueta="Borradores"
            valor={products.filter((p) => p.status === "DRAFT").length}
          />
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg text-ink">Atajos</h2>
        <Link
          href="/admin/productos"
          className="inline-flex rounded-control border border-line-strong px-4 py-2 text-sm text-ink hover:bg-paper"
        >
          Ver productos y cambiar disponibilidad
        </Link>
      </section>
    </>
  );
};

const StatCard = ({
  etiqueta,
  valor,
  detalle,
}: {
  readonly etiqueta: string;
  readonly valor: number;
  readonly detalle?: string;
}) => (
  <div className="rounded-card border border-line bg-paper p-5">
    <p className="text-sm text-ink-muted">{etiqueta}</p>
    <p className="mt-1 font-display text-3xl text-ink">{valor}</p>
    {detalle !== undefined && <p className="mt-1 text-xs text-ink-muted">{detalle}</p>}
  </div>
);

export default AdminDashboard;
```

### 6.9 Tabla de productos

```tsx
// src/app/admin/productos/page.tsx
import { EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProductTable } from "@/components/admin/ProductTable";
import { getProductsForAdmin } from "@/server/services";

export const dynamic = "force-dynamic";
export const metadata = { title: "Productos" };

const ProductosPage = async () => {
  const products = await getProductsForAdmin();

  return (
    <>
      <PageHeader
        title="Productos"
        description="El interruptor de la última columna es la disponibilidad: no saca el producto del menú, lo marca como agotado."
      />

      {products.length === 0 ? (
        // El `action` se agrega en la Tarea 16, cuando exista `/admin/productos/nuevo`.
        <EmptyState
          title="No hay productos cargados"
          message="Cargá el primer producto del menú para empezar a controlar la disponibilidad."
        />
      ) : (
        <ProductTable products={products} />
      )}
    </>
  );
};

export default ProductosPage;
```

```tsx
// src/components/admin/ProductTable.tsx
import Image from "next/image";
import { Badge } from "@/components/ui";
import { formatARS } from "@/lib/format/currency";
import { AvailabilitySwitch } from "./AvailabilitySwitch";
import type { ProductRow } from "@/server/services";

/**
 * Tabla de productos del panel.
 *
 * ⛔ Server Component. Solo pinta filas que el servicio yajyó. Toda la
 *    interactividad está en `AvailabilitySwitch`, que es el único
 *    Client Component de la tabla.
 *
 * ⚠️ La columna de `status` es un `Badge`, no un control editable.
 *    Cambiar el estado editorial es la Tarea 16, y va con
 *    `ConfirmDialog` cuando es archivado. Un select sin confirmación en una
 *    tabla de veinte filas es la forma más corta de despublicar medio
 *    menú con un clic mal apoyado.
 */
export function ProductTable({ products }: { readonly products: readonly ProductRow[] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-paper">
      <table className="w-full min-w-3xl border-collapse text-left text-sm">
        <caption className="sr-only">
          Productos del menú, con su categoría, precio, estado editorial y disponibilidad.
        </caption>
        <thead>
          <tr className="border-b border-line text-xs tracking-wide text-ink-muted uppercase">
            <th scope="col" className="px-4 py-3">Producto</th>
            <th scope="col" className="px-4 py-3">Categoría</th>
            <th scope="col" className="px-4 py-3 text-right">Precio</th>
            <th scope="col" className="px-4 py-3">Estado</th>
            <th scope="col" className="px-4 py-3">Disponible</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b border-line last:border-0">
              <th scope="row" className="px-4 py-3 font-normal">
                <div className="flex items-center gap-3">
                  <Image
                    src={product.imageUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="size-12 shrink-0 rounded-control object-cover"
                  />
                  <span>
                    <span className="block font-medium text-ink">{product.name}</span>
                    <span className="block text-xs text-ink-muted">/{product.slug}</span>
                  </span>
                </div>
              </th>

              <td className="px-4 py-3 text-ink-muted">{product.categoryName}</td>

              <td className="px-4 py-3 text-right font-display text-ink">
                {formatARS(product.price)}
              </td>

              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1">
                  <Badge tone={STATUS_TONE[product.status]}>{STATUS_LABEL[product.status]}</Badge>
                  {product.isFeatured && <Badge tone="warning">Destacado</Badge>}
                </div>
              </td>

              <td className="px-4 py-3">
                <AvailabilitySwitch
                  productId={product.id}
                  productName={product.name}
                  isAvailable={product.isAvailable}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`alt=""` en la imagen de la tabla es correcto y no es una omisión: la celda de al lado ya dice el nombre del producto en texto. Repetirlo en el `alt` hace que un lector de pantalla anuncie "Jamón y Queso" dos veces por fila.

El `STATUS_TONE` y el `STATUS_LABEL` son un `Record<ProductStatusDTO, ...>`:

```ts
const STATUS_LABEL: Record<ProductStatusDTO, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
};

const STATUS_TONE: Record<ProductStatusDTO, BadgeTone> = {
  // `warning` en lugar de `danger`: un borrador no es un error, es una
  // fila a medio hacer. `clay` reservado a lo que está roto.
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "danger",
};
```

### 6.10 `AvailabilitySwitch`

```tsx
// src/components/admin/AvailabilitySwitch.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui";
import { toggleProductAvailabilityAction } from "@/server/actions/product-availability.actions";

/**
 * Toggle de disponibilidad de un producto.
 *
 * ## El patrón optimista
 *
 * El estado local se escribe **antes** de llamar al servidor. Con 300 ms
 * de ida y vuelta entre el clic y la base, un toggle que espera la
 * respuesta se siente roto. La secuencia completa:
 *
 *   1. `setIsAvailable(siguiente)`  → la interfaz responde en el mismo frame
 *   2. `await toggleProductAvailabilityAction(...)`
 *   3. `ok`    → no se toca nada, ya está bien
 *   4. `error` → `setIsAvailable(anterior)` + toast
 *
 * ## Por qué el switch se bloquea durante el vuelo
 *
 * `isSaving` deshabilita el control. Un segundo clic antes de que vuelva
 * la primera respuesta mandaría el valor contrario con una base que
 * todavía tiene el primero. Con un `disabled` no hay dos peticiones en
 * vuelo sobre la misma fila, y el `aria-busy` le avisa al lector de
 * pantalla que algo está pasando.
 */
export function AvailabilitySwitch({
  productId,
  productName,
  isAvailable,
}: {
  readonly productId: string;
  readonly productName: string;
  readonly isAvailable: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { show } = useToast();
  const [actual, setActual] = useState(isAvailable);
  const [isSaving, setIsSaving] = useState(false);

  const estaBloqueado = isSaving;

  const handleChange = async (siguiente: boolean) => {
    if (estaBloqueado) return;

    const anterior = actual;
    setActual(siguiente);          // 1. optimista
    setIsSaving(true);

    try {
      const resultado = await toggleProductAvailabilityAction({
        id: productId,
        isAvailable: siguiente,
      });

      if (resultado.ok) {
        show(
          siguiente ? `${productName} volvió a estar disponible.` : `${productName} quedó agotado.`,
          "success",
        );
        return;
      }

      setActual(anterior);        // 2. rollback

      if (resultado.code === "UNAUTHORIZED") {
        show(resultado.error, "error");
        // El layout no corrió, porque esta petición nació de un cliente
        // que ya estaba en la página. `pathname` viene del router de Next,
        // no de la URL, así que no puede ser inyectado.
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      if (resultado.code === "RESOURCE_NOT_FOUND") {
        // La fila es un fantasma: el producto se archivó o se borró desde
        // otra pestaña. Refresh y que la tabla decida qué hacer.
        show(resultado.error, "error");
        router.refresh();
        return;
      }

      show(resultado.error, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={actual}
        aria-busy={isSaving}
        disabled={estaBloqueado}
        onClick={() => void handleChange(!actual)}
        className={[
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-60",
          actual ? "bg-sage" : "bg-line-strong",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "absolute top-0.5 size-5 rounded-full bg-paper transition-transform",
            actual ? "translate-x-5.5" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>

      {/* El texto acompaña al color: `role="switch"` con `aria-checked` ya
          alcanza para un lector de pantalla, pero un sighted que no
          distingue el verde del gris necesita la palabra. */}
      <span className="text-xs text-ink-muted">{actual ? "Disponible" : "Agotado"}</span>
    </span>
  );
}
```

El recorrido del disco sale de la escala de espaciado de Tailwind v4, que es dinámica: `--spacing` por defecto es `0.25rem`, así que `translate-x-5.5` compila a 22 px. El track es `w-11` (44 px), el disco `size-5` (20 px) y los márgenes son de 2 px: 20 px de recorrido + 2 px de aire de cada lado. Si alguien cambia el ancho del track, la cuenta se vuelve a hacer; no se copia un `translate` a ojo desde otro switch del proyecto.

### 6.11 Fronteras de error y carga

```tsx
// src/app/admin/error.tsx
"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui";

/**
 * Frontera de error del panel.
 *
 * Un `try/catch` en el layout convertiría un fallo de base en un panel en
 * blanco sin explicación. Acá se muestra qué pasó y se ofrece recargar.
 */
export default function AdminError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // El mensaje va al registro del servidor, nunca a la pantalla: puede
    // traer nombres de tabla y de columna.
    console.error("[admin]", error);
  }, [error]);

  return (
    <ErrorState
      title="No se pudo cargar el panel"
      message="Hubo un problema al leer los datos. Probá de nuevo."
      onRetry={reset}
    />
  );
}
```

```tsx
// src/app/admin/productos/loading.tsx
import { ProductTableSkeleton } from "@/components/admin/ProductTableSkeleton";

/**
 * El skeleton tiene la geometría de la tabla real, con la misma cantidad
 * de filas visibles. Un bloque genérico que no se parece a nada produce
 * un salto de layout cuando el contenido llega, y el salto se lee como
 * "la página va lento" aunque la carga haya sido rápida.
 */
export default function ProductosLoading() {
  return <ProductTableSkeleton rows={8} />;
}
```

`ProductTableSkeleton.tsx` replica el `min-w-3xl`, las cinco columnas y los `rounded-control` de la imagen, con `Skeleton` en lugar de contenido.

---

## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `AdminSession`, `AdminRole` | `src/lib/domain/session.ts` (Tarea 07) | `AdminSidebar`, `AdminLayout` |
| `verifyAdminSession()` | `src/server/auth/verify-admin.ts` | **Tarea 14** (layout y action), 15, 16, 17 |
| `logoutAction` | `src/server/auth/actions.ts` (Tarea 07) | `LogoutButton` |
| `sanitizeNextPath` | `src/lib/validation/ruta-retorno.ts` (Tarea 07) | `login/page.tsx`. El layout no lo usa: no conoce el path (§6.6) |
| `ProductRow` | `src/server/services/product.service.ts` | `ProductTable`, `ProductTableSkeleton` |
| `getProductsForAdmin()` | `src/server/services/index.ts` | `admin/page.tsx`, `admin/productos/page.tsx` |
| `setProductAvailability({ id, isAvailable })` | idem | `product-availability.actions.ts`, **Tarea 16** |
| `getSettingsForAdmin()` | idem | `AdminLayout`, `admin/page.tsx` |
| `ProductAdminReader`, `ProductAvailabilityWriter`, `CategoryAdminLister` | `src/server/services/repository-ports.ts` | `product.service.ts` |
| `ToggleProductAvailabilitySchema` | `src/server/schemas/product-availability.schema.ts` | `product-availability.actions.ts` |
| `ProductAvailabilityActionResult` | `src/server/actions/product-availability.actions.ts` | `AvailabilitySwitch`, **Tarea 16** |
| `toggleProductAvailabilityAction(input)` | idem | `AvailabilitySwitch`, **Tarea 16** (el mismo) |
| `AdminNavSection`, `ADMIN_NAV_SECTIONS` | `src/config/admin-navigation.ts` | `AdminNav`, **Tarea 17** |
| `toSafeErrorMessage(error)` | `src/lib/domain/errors.ts` (contexto §3) | La action y todas las de la Tarea 16 |
| `formatARS(number)` | `src/lib/format/currency.ts` (Tarea 10) | `ProductTable`, `admin/page.tsx` |
| `Badge`, `Button`, `Sheet`, `Skeleton`, `EmptyState`, `ErrorState`, `useToast` | `@/components/ui` (Tarea 09) | Todos los componentes del panel |

**Firmas delicadas de esta capa:**

| Firma | Por qué está así |
|---|---|
| `setProductAvailability(deps, { id, isAvailable })` y no `toggle(deps, id)` | Recibe el **valor destino**. Si el servicio leyera el valor actual para decidir, dos clics simultáneos producirían un resultado no determinista (Tarea 04 §7) |
| `getProductsForAdmin()` sin caché y sin tag | Es una lectura de admin sobre datos que el admin está cambiando. Cachear una tabla que se está editando produce la sensación de "guardé y no pasó nada" |
| `ProductRow` plano, no `ProductDTO` | La tabla no usa `variants`, `allergens` ni `description`. Serializarlos para nada cuesta ancho de payload en cada render |
| `ProductAvailabilityActionResult` con `code` | Permite que el cliente decida (`UNAUTHORIZED` navega, `RESOURCE_NOT_FOUND` refresca) sin parsear el mensaje de error |

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [x] `/admin` sin sesión redirige a `/login` y **no** renderiza ningún dato del negocio
- [x] `/admin` con sesión muestra nombre del local, dirección y cuatro contadores
- [x] `/admin` sin productos muestra `EmptyState` **sin** un enlace a una ruta que todavía no existe
- [x] `/admin/productos` lista todos los productos, incluidos `DRAFT` y `ARCHIVED`
- [x] La tabla muestra imagen, nombre, slug, categoría, precio, estado, destacado y disponibilidad
- [x] El nombre de la categoría viene del servicio, no de un `Map` armado en el JSX
- [x] Una categoría borrada o ausente muestra `(sin categoría)` en vez de una celda vacía
- [x] El switch cambia el estado de la interfaz en el mismo frame del clic
- [x] Si la Server Action devuelve `ok: false`, el switch vuelve al valor anterior
- [x] Un error dispara un `Toast` con tono `error` y el mensaje de la action
- [x] Un éxito dispara un `Toast` con tono `success` que nombra el producto
- [x] El switch está deshabilitado y con `aria-busy` mientras la action corre
- [x] Un clic adicional durante el vuelo no dispara una segunda action
- [x] Un `ResourceNotFoundError` produce un mensaje de "el producto ya no existe" y refresca la tabla
- [x] Una sesión expirada devuelve `code: "UNAUTHORIZED"` y el cliente navega a `/login?next=...`
- [x] El texto "Disponible"/"Agotado" acompaña al color del switch
- [x] El enlace activo de la navegación lleva `aria-current="page"`
- [x] La navegación en mobile se abre y se cierra con el `Sheet` de la Tarea 09
- [x] Las secciones de la Tarea 17 aparecen deshabilitadas, no ausentes
- [x] Un fallo al leer los datos muestra `ErrorState` con botón de reintento, no una pantalla en blanco
- [x] El toggle de un producto `PUBLISHED` agotado **no** cambia su `status`

### 8.2 Calidad

- [x] `npm run verify` en verde
- [x] `npm run build` en verde
- [x] `product-availability.actions.ts` tiene menos de 120 líneas
- [x] `ProductTable.tsx` y `AvailabilitySwitch.tsx` tienen menos de 200 líneas
- [x] `rg "\"use client\"" src/components/admin` marca solo `AdminNav.tsx`, `LogoutButton.tsx`, `AvailabilitySwitch.tsx` y `error.tsx`
- [x] `rg "prisma|repositories" src/app/admin src/components/admin` no devuelve resultados
- [x] `rg "verifyAdminSession" src/server/actions/` devuelve resultados en **todas** las actions
- [x] Ningún archivo nuevo usa `any`, `@ts-ignore`, `@ts-expect-error` ni `!`
- [x] No hay archivos `utils.ts` ni `helpers.ts`
- [x] Los skeletons tienen la geometría del contenido real
- [x] Las imágenes de la tabla llevan `alt=""` y el nombre está en la celda de al lado

### 8.3 Arquitectura — verificación obligatoria

- [x] **Cero lógica de negocio en la Server Action:** autoriza, valida, delega, revalida, traduce
- [x] `verifyAdminSession()` es la **primera** sentencia de la action, antes de leer el input
- [x] El servicio no importa Prisma, React ni `next/*`
- [x] Los repositorios se importan **solo** desde `src/server/services/index.ts`
- [x] Ningún componente importa un repositorio
- [x] `revalidateTag("products")` **no** aparece en el toggle (Tarea 08 §4.5, §4.3 de este documento)
- [x] `setProductAvailability` recibe el valor destino y no lo alterna
- [x] El servicio propaga `ResourceNotFoundError` sin envolverlo
- [x] `src/app/admin/**` es dinámico: ninguna ruta del panel se cachea
- [x] El middleware no se toca: no es capa de seguridad

### 8.4 Pruebas

- [x] `tests/unit/product.service.test.ts` cubre: proyección con nombre de categoría, categoría ausente, orden, y que `setProductAvailability` delega sin alterar el valor
- [x] Un test demuestra que `getProductsForAdmin` **no** filtra por `status`: un DRAFT aparece en la lista
- [x] `AvailabilitySwitch.component.test.tsx` cubre: cambio optimista, rollback con `toast` de error, bloqueo durante el vuelo, `role="switch"` con `aria-checked`
- [x] Un test del componente comprueba que un segundo clic durante el vuelo no llama dos veces a la action
- [x] Los nombres de los `it()` están en español y con formato `debe <comportamiento>`
- [x] `npm run test` pasa sin base de datos: los dobles son objetos escritos a mano, no `vi.mock` de repositorios

### 8.5 Seguridad

- [x] `middleware.ts` no se modifica y no se le agrega ninguna verificación
- [x] El `redirect` del layout está presente aunque el middleware siga existiendo
- [x] Sin sesión, la action devuelve `ok: false` **sin** tocar la base
- [x] El mensaje que ve el usuario nunca es el de una excepción cruda
- [x] El `console.error` registra el error completo y el `error` del cliente es genérico
- [x] El `next` que construye `AvailabilitySwitch` sale de `usePathname()` y además lo sanea `login/page.tsx`
- [x] `robots: { index: false }` en el layout del panel
- [x] Ningún archivo de `src/app/admin` importa `SUPABASE_SERVICE_ROLE_KEY` ni `@/server/infra/supabase/admin`

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado |
|---|---|
| Sin sesión, llega a `/admin/productos` | El layout redirige. No se ejecuta ninguna query de negocio |
| Sin sesión, dispara la action igual (llamada directa al endpoint de la action) | `ok: false`, `code: "UNAUTHORIZED"`, sin escritura |
| Sesión expirada a mitad de la operación | La action devuelve `UNAUTHORIZED`. El switch hace rollback, muestra el toast y navega a `/login?next=/admin/productos` |
| Producto borrado entre el render y el clic | El repositorio lanza `ResourceNotFoundError` (P2025). La action devuelve `RESOURCE_NOT_FOUND`, el switch hace rollback y `router.refresh()` saca la fila fantasma |
| Doble clic rápido | `estaBloqueado` corta el segundo handler. Una sola action en vuelo por fila |
| Red lenta (5 s) | El switch queda en el valor destino con `aria-busy`. Si la action nunca vuelve (timeout del servidor), el `finally` libera el bloqueo y la siguiente respuesta hace rollback. La UI no queda trabada para siempre |
| La action responde después de que el componente se desmontó | `setIsSaving` sobre un componente desmontado es un no-op en React 18+. No hay warning. La UI se va con la navegación y no importa |
| El mismo producto se cambia desde otra pestaña | **No se ve en vivo.** `/admin/productos` es dinámica, así que aparece al navegar o al recargar. La sincronización en vivo es la Tarea 15 |
| El producto está `ARCHIVED` y se alterna su disponibilidad | Permitido. `isAvailable` y `status` son ejes independientes (§4.4). No tiene efecto en el público porque el producto ya no sale |
| El producto es `DRAFT` y se marca como agotado | Permitido, y es un caso normal: se deja preparado el borrador y después se publica |
| `isAvailable` llega como `"true"` (string) en vez de `true` | Zod lo rechaza con `VALIDATION_ERROR`. No hay coerción: aceptar `"false"` como booleo es exactamente el tipo de recorte mal hecho que después se lee al revés |
| El input llega con campos de más | `.strict()` lo rechaza. El objeto se valida, no se sanitiza |
| El local todavía no tiene fila en `business_settings` | `getBusinessSettings` devuelve los defaults con un `console.warn` (Tarea 08 §4.4). El panel abre igual, con el nombre de relleno |
| Un producto sin imagen | `imageUrl` es NOT NULL en el schema (Tarea 03 §9). Si aparece uno sin imagen, la fila renderiza un bloque vacío, no un `<Image>` roto |
| La tabla tiene 500 productos | Los repositorios no paginan. Con veinte a cuarenta filas del menú no es un problema. Si creciera, se pagina **en el repositorio** (`limit`/`cursor`), nunca con un `.slice()` en el servicio |
| El usuario tiene rol `STAFF` y tries editar ajustes | La autorización por rol es de la Tarea 17. Acá no hay chequeo de rol: todos los del panel alternan stock. Es intencional |
| Falla la base al cargar la tabla | `error.tsx` muestra `ErrorState`. El mensaje de pantalla no dice "connection to host failed" |

---

## 10. Pruebas

| Suite | Qué verifica |
|---|---|
| `tests/unit/product.service.test.ts` | La proyección a filas, el nombre de categoría, el fallback `(sin categoría)`, y que el servicio de disponibilidad delega el valor exacto sin alternarlo |
| `AvailabilitySwitch.component.test.tsx` | Optimismo, rollback, bloqueo durante el vuelo, `role="switch"`, `aria-checked`, `aria-busy`, y que el nombre del producto aparece en el mensaje del toast |

**Criterio de diseño de los tests:**

- **Comportamiento, no implementación.** El test del switch verifica que "el switch queda donde el usuario lo puso antes de que la action responda" y que "vuelve al valor anterior si la action falla". No verifica que se llamó a `setIsAvailable` con ciertos argumentos.
- **Dobles escritos a mano, no `vi.mock`.** El servicio recibe un objeto con la forma de `ProductAdminReader`. Un doble explícito sigue valiendo si mañana el repositorio cambia de firma interna; un mock verifica que el código se llame como se escribió, no que funcione (Tarea 08 §6.7).
- **La action va mockeada en el test de componente, y está bien.** En el límite cliente-servidor no hay otra opción: la Server Action es un endpoint. Lo que se testea ahí es la **reacción** del componente al resultado, que es toda la lógica que le pertenece.

```ts
// tests/unit/product.service.test.ts
import { describe, expect, it } from "vitest";
import type { CategoryDTO, ProductDTO, ProductStatusDTO } from "@/lib/domain";
import { getProductsForAdmin, setProductAvailability } from "@/server/services/product.service";

const buildProduct = (overrides: Partial<ProductDTO> = {}): ProductDTO => ({
  id: "prd_1",
  name: "Jamón y Queso",
  slug: "jamon-y-queso",
  description: null,
  price: 1450,
  imageUrl: "https://res.cloudinary.com/demo/image/upload/x.jpg",
  imagePublicId: null,
  isAvailable: true,
  status: "PUBLISHED",
  isFeatured: false,
  sortOrder: 0,
  allergens: [],
  categoryId: "cat_clasicos",
  variants: [],
  ...overrides,
});

const buildCategory = (id: string, name: string): CategoryDTO => ({
  id,
  name,
  slug: name,
  description: null,
  position: 0,
  isVisible: true,
});

const dependenciasCon = (products: readonly ProductDTO[], categories: readonly CategoryDTO[]) => ({
  productRepository: { findAllProductsForAdmin: async () => [...products] },
  categoryRepository: { findAllCategoriesForAdmin: async () => [...categories] },
});

describe("getProductsForAdmin", () => {
  it("debe poner el nombre de la categoría en cada fila", async () => {
    const filas = await getProductsForAdmin(
      dependenciasCon(
        [buildProduct()],
        [buildCategory("cat_clasicos", "Clásicos")],
      ),
    );

    expect(filas[0]?.categoryName).toBe("Clásicos");
  });

  it("debe mostrar (sin categoría) cuando la categoría no está en la lista", async () => {
    const filas = await getProductsForAdmin(dependenciasCon([buildProduct()], []));

    expect(filas[0]?.categoryName).toBe("(sin categoría)");
  });

  it("debe incluir los borradores y los archivados sin filtrar", async () => {
    const filas = await getProductsForAdmin(
      dependenciasCon(
        [
          buildProduct({ id: "a", status: "DRAFT" as ProductStatusDTO }),
          buildProduct({ id: "b", status: "ARCHIVED" as ProductStatusDTO }),
        ],
        [buildCategory("cat_clasicos", "Clásicos")],
      ),
    );

    expect(filas).toHaveLength(2);
  });

  it("debe proyectar solo los campos que la tabla usa", async () => {
    const [fila] = await getProductsForAdmin(
      dependenciasCon([buildProduct()], [buildCategory("cat_clasicos", "Clásicos")]),
    );

    expect(Object.keys(fila ?? {}).sort()).toEqual(
      [
        "categoryId",
        "categoryName",
        "id",
        "imageUrl",
        "isAvailable",
        "isFeatured",
        "name",
        "price",
        "slug",
        "sortOrder",
        "status",
      ].sort(),
    );
  });
});

describe("setProductAvailability", () => {
  it("debe aplicar el valor destino sin alternarlo", async () => {
    const recibido: Array<{ id: string; isAvailable: boolean }> = [];

    await setProductAvailability(
      {
        productRepository: {
          toggleProductAvailability: async (id, isAvailable) => {
            recibido.push({ id, isAvailable });
            return buildProduct({ id, isAvailable });
          },
        },
      },
      { id: "prd_1", isAvailable: false },
    );

    expect(recibido).toEqual([{ id: "prd_1", isAvailable: false }]);
  });
});
```

---

## 11. Definición de "Hecho" (Definition of Done)

- [x] Todos los criterios de §8 marcados
- [x] `npm run verify` + `npm run build` en verde
- [ ] Probado a mano: cambiar disponibilidad con un usuario real y ver el cambio en `/menu` de una sesión anónima
- [ ] Probado a mano: entrar a `/admin` sin sesión y confirmar que no se ve ningún dato
- [ ] Probado a mano: cortar la red, clickear el switch y confirmar el rollback con el toast
- [x] `docs/tasks/README.md` actualizado
- [ ] Commit: `feat(14): shell del panel admin con toggle optimista de disponibilidad`
- [ ] PR mergeada a `main`

> **Antes de mergear:** ejecutar `rg "revalidateTag" src/server/actions/` y confirmar que el toggle **no** llama `revalidateTag("products")`. Si aparece, la frontera de caché de la Tarea 08 §4.5 se rompió: el catálogo público se regenera en cada cambio de stock.

---

## 13. Registro de ejecución y desviaciones

**Fecha:** 2026-10-03 · **Verificación:** `npm run verify` ✅ (325 tests, 42 archivos) · `npm run build` ✅ · `rg "revalidateTag" src/server/actions/` sin llamadas (solo el comentario que lo prohíbe) ✅ · `rg "prisma|repositories" src/app/admin src/components/admin` 0 resultados ✅ · líneas: action 97 · `ProductTable` 116 · `AvailabilitySwitch` 143 — las tres ≤ 200, la action < 120 ✅ · 33 tests nuevos.

**Desviaciones respecto del documento:**

1. **`ProductRow` vive en `src/lib/domain/product.ts`, no en el servicio.** El tipo cruza de un Server Component a un Client Component (`ProductTable` → `AvailabilitySwitch`), y la regla `no-restricted-imports` de la Tarea 01 prohíbe a `src/components/**` importar `@/server/services`. Un tipo serializable que cruza esa frontera es Capa 0. `product.service.ts` lo reexporta para que el import desde `@/server/services` siga siendo válido donde ya se usa.
2. **`admin/loading.tsx` y `admin/productos/loading.tsx` se crean anidados**, uno dentro del otro, en vez de un archivo `loading.tsx` para cada ruta como sugiere el §3.1. Razón: cada `loading.tsx` pertenece a su segmento, así que la Tarea 15 y la 16 toman el suyo sin reemplazar el del padre.
3. **`AdminShell` monta el `AdminNav` de mobile fuera del `<aside>`.** El pseudocódigo del §6.7 lo dibujaba dentro de la barra lateral, con dos ramas `md:` que repiten el mismo `<nav>`. Dos copias del árbol de navegación divergen apenas se agrega una sección. Acá hay un solo `AdminNav` por variante y el `aside` conserva su `hidden md:block`.
4. **El pseudocódigo del §6.7 tenía el `flex` del contenedor raíz en columna**, con el contenido **debajo** de la barra lateral. Se corrigió a `flex-row` en `md:`.
5. **`aria-controls` del ejemplo del §6.7 no se usó.** Apuntaba a un id que el `Sheet` no expone con ese nombre; se quedó con `aria-haspopup="dialog"` + `aria-expanded`, que es lo que la Tarea 09 documenta para `Sheet`.
6. **El trigger de mobile es un `Button` de texto, no un `Button` con `LayoutGrid` de `lucide-react`.** La Tarea 01 prohíbe iconos de terceros y el `Button` de la Tarea 09 no tiene slot de ícono. "Menú" a 44 px de alto cumple el objetivo táctil sin abrir la dependencia.
7. **La columna `status` es un `Badge` de solo lectura.** El §6.9 la describe como `select`; el §4.4 y el §12 (decisión 4) dejan el select con `ConfirmDialog` para la Tarea 16, cuando exista el alta y la edición. Un `select` de estado sin confirmación en una tabla de veinte filas es la forma más corta de despublicar medio menú con un clic mal apoyado. El switch **sí** es editable y escribe solo `isAvailable`.
8. **`AdminNav.component.test.tsx` y `page.component.test.tsx` no estaban en el §10.** Se agregaron porque los criterios de §8 que cubren ("el enlace activo lleva `aria-current`, la navegación mobile abre y cierra, el panel muestra nombre, dirección y contadores, un fallo de lectura muestra `ErrorState`") no se pueden afirmar con los tests propuestos por el documento.
9. **`LoginForm.tsx` también tiene `"use client"`.** El §8.2 espera solo cuatro archivos de cliente en `src/components/admin`; el quinto es preexistente de la Tarea 07 y no se tocó.
10. **`getProductsForAdmin` y `setProductAvailability` reciben sus dependencias por parámetro sin valor por defecto**, igual que los servicios de la Tarea 08. La única diferencia es que el composition root es quien las arma, igual que en `catalog.service`.

**Un bug que encontró un test, y que ningún criterio pedía:**

El resaltado de la navegación usaba `pathname === href || pathname.startsWith(`${href}/`)`. Como `/admin` es prefijo de `/admin/productos`, en la pantalla de productos quedaban **Inicio y Productos marcados a la vez**. Se cambió por "la coincidencia más larga gana": la sección activa es la de `href` más largo que calza con la ruta. Sirve para `/admin` exacta, para `/admin/productos` y para las subrutas futuras (`/admin/productos/nuevo` de la Tarea 16) sin que `ADMIN_NAV_SECTIONS` tenga que saber cuál es la raíz.

**Lo que sigue sin poder verificarse acá:**

- Las cuatro pruebas manuales del §11 necesitan una sesión real de Supabase Auth, y la Tarea 02 sigue con credenciales de prueba. El `redirect` sin sesión y la autorización de la action están cubiertos por lectura y por los tests de `AvailabilitySwitch` (`UNAUTHORIZED` → `/login?next=…`), pero el round trip contra Supabase no se ejecutó.
- La propagación a `/menu` en vivo **no existe todavía**: es la Tarea 15 (Realtime). En esta tarea el catálogo público no cambia al alternar disponibilidad, y por eso el toggle no invalida la caché del menú.

**Contenedor de base:** los tests de integración de la Tarea 04 necesitan Postgres en `127.0.0.1:55432`. Se levantó el contenedor de sonda `modo-miga-db-probe` que documenta el §13.13 de la Tarea 02 (`postgres:17-alpine`, contraseña de sonda, sin datos reales). Sigue corriendo para que `npm run test` pase completo; `docker rm -f modo-miga-db-probe` lo baja.

---

## 12. Dependencias y bloqueos

**Habilita:** 15 (el switch ya existe y es quien emite el cambio que la Tarea 15 difunde), 16 (el formulario de producto se monta dentro de este shell), 17 (categorías y ajustes aparecen en `ADMIN_NAV_SECTIONS`).

**Decisiones que esta tarea deja establecidas:**

1. `src/app/admin/layout.tsx` es la frontera de seguridad **del render**, y cada Server Action es la frontera de seguridad **del dato**. El middleware no es ninguna de las dos.
2. Las rutas `/admin/**` son dinámicas. Nunca se cachean.
3. El layout redirige a `/login` sin `next` porque un layout no conoce el path. La preservación del deep link la aporta el middleware y, en el caso de una action, el componente de cliente con `usePathname()`.
4. El toggle de disponibilidad **no** llama `revalidateTag("products")`. Solo `revalidatePath("/admin/productos")`. La invalidación del contenido es de crear, editar, publicar, despublicar, archivar y reordenar.
5. El servicio se llama `setProductAvailability` y no `toggleProductAvailability`: recibe el valor destino y lo aplica. "Alternar" implicaría que el servidor decide.
6. `getProductsForAdmin` no filtra por `status`. El panel ve los borradores; el filtro `PUBLISHED` es del catálogo público.
7. La tabla recibe `ProductRow`, una proyección plana. El `ProductDTO` completo no viaja a una vista que no usa sus variantes.
8. `src/server/services/index.ts` es el único archivo que importa repositorios para armar servicios.
9. El resultado de una action lleva `code` además del mensaje, para que el cliente decida sin parsear texto.
10. El switch es optimista y se bloquea durante el vuelo. Un toggle de stock que espera la respuesta se siente lento a 300 ms de latencia.

**Frontera con la Tarea 15 (Realtime):**

| | Tarea 14 | Tarea 15 |
|---|---|---|
| Quién escribe | El encargado, en `/admin/productos` | Nadie: solo difunde lo que 14 escribió |
| Transporte | Server Action (`POST` a la action) | WebSocket de Supabase Realtime |
| Destino | La respuesta de la action al switch | Todos los clientes con la página abierta, Included el admin de otra pestaña |
| Cuándo entra | Ya, en esta tarea | Con la Tarea 15 |

La frontera es deliberada y no se cruza: esta tarea **no** se suscribe a Realtime ni abre un WebSocket, y la Tarea 15 **no** escribe en la base. Si la 14 se suscribe, cada cliente del panel mantiene una conexión abierta para recibir cambios que ella misma produce. Si la 15 escribe, la frontera caché de la §4.3 deja de tener un único dueño.
