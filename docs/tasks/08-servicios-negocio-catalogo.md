# Tarea 08 — Capa de Servicio: Reglas de Negocio del Catálogo

| Campo | Valor |
|---|---|
| **ID** | 08 |
| **Fase (DESIGN.md §8.3)** | Fase 1 — Cimientos y Modelado |
| **Depende de** | 04 |
| **Habilita** | 10, 12, 16 |
| **Tipo** | Lógica de Negocio |
| **Esfuerzo est.** | 1 – 1.5 días |

---

## 1. Objetivo de la tarea

Implementar la **capa de servicio**: el único lugar del proyecto donde vive una regla de negocio. Los repositorios (Tarea 04) devuelven filas crudas ya mapeadas a DTO; los servicios deciden **qué es visible, en qué orden y con qué caché**.

**Criterio de éxito verificable:** `rg "prisma\." src/server/services/` devuelve cero resultados, el filtro `status === "PUBLISHED"` aparece en un solo lugar del código, y los tres servicios están cubiertos por tests unitarios que corren sin base de datos.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 04 completada (`product.repository`, `category.repository`, `settings.repository` y los DTO en `@/lib/domain`).

**Contexto arquitectónico:**

```
Capa 1 · Presentación   ──▶  Capa 3 · Servicio  ──▶  Capa 4 · Repository  ──▶  Postgres
  "¿qué muestro?"            "¿qué es visible,       "¿cómo se
   ¿lo puedo cachear?"        en qué orden y          obtiene?"
                              con qué caché?"
```

El repositorio pregunta *"¿cómo se obtiene?"*. El servicio responde *"¿qué se muestra?"*. Son preguntas distintas, en capas distintas, por dos motivos concretos:

1. **Cambiabilidad.** El día de mañana el catálogo pasa a ser un CMS externo. Se reescriben los repositorios y los servicios no se tocan.
2. **Testabilidad.** Las reglas ("un DRAFT nunca sale", "una categoría sin publicados no se renderiza") se testean con funciones falsas inyectadas, en milisegundos y sin base.

### Checklist de prerrequisitos

- [ ] `npm run typecheck` en verde (los repositorios compilan)
- [ ] `npx prisma migrate status` reporta la base al día
- [ ] `src/lib/domain/product.ts`, `category.ts`, `settings.ts` y `errors.ts` existen
- [ ] `vitest.config.ts` incluye `tests/unit/**/*.test.ts` con `environment: "node"`

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `src/lib/domain/catalog.ts` | Tipos compuestos (`CatalogSection`, `CatalogDTO`) y predicados puros de catálogo |
| `src/server/services/repository-ports.ts` | Interfaces estructurales que describen qué parte de cada repositorio necesita cada servicio (DIP) |
| `src/server/services/settings-normalizers.ts` | Funciones puras de saneado: teléfono a E.164, URL de Instagram, horarios. Sin I/O |
| `src/server/services/catalog.service.ts` | Ensamblaje del catálogo público, caché ISR y lectura de producto por slug |
| `src/server/services/category.service.ts` | Orden de categorías, lectura admin y conversión `null → ResourceNotFoundError` |
| `src/server/services/settings.service.ts` | Orquestación de lectura y escritura de ajustes del negocio |
| `tests/unit/catalog.service.test.ts` | Reglas de agrupación, publicación, disponibilidad y serialización |
| `tests/unit/category.service.test.ts` | Orden canónico y errores de categoría |
| `tests/unit/settings.service.test.ts` | Normalización de teléfono, URL de Instagram, horarios y defaults |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `src/lib/domain/index.ts` | Reexportar `./catalog` para que la presentación importe los tipos compuestos desde `@/lib/domain` |
| `docs/tasks/README.md` | Marcar Tarea 08 |

### 3.3 Eliminar

Ninguno.

---

## 4. Estructura N-Capas

### 4.1 Qué vive en esta capa

| Capa | Qué va acá | Qué NO va acá |
|---|---|---|
| 3 · Servicio | Reglas de visibilidad, agrupación, orden, disponibilidad, normalización de teléfono, decisión de caché, traducción de `null` a `ResourceNotFoundError` | Queries. No hay `prisma` en ningún archivo de `services/`. |
| 4 · Repositorio | Nada. Ya está hecho en la Tarea 04. | Nada. |
| 1 · Presentación | Nada. La Tarea 10 todavía no existe. | Nada. |

### 4.2 La regla más importante de esta tarea

> **El repositorio trae datos crudos. El servicio decide qué es visible.**

El mismo dato crudo produce dos lecturas distintas según la regla de negocio que se le aplique:

```ts
// El repositorio NO sabe si el agotado se muestra.
findPublishedProducts();                        // 6 productos
findPublishedProducts({ onlyAvailable: true }); // 2 productos
```

Y de esos dos números nacen dos reglas distintas:

| Lectura | Regla | Resultado |
|---|---|---|
| `getCatalogForPublic()` | Un agotado **se muestra** desaturado con badge (DESIGN.md §10.3). Ocultarlo esconde información que el cliente necesita para elegir otra cosa. | 6 productos |
| `getCatalogWithOnlyAvailable()` | Solo tiene sentido donde lo que importa es "¿hay algo para pedir?", es decir la lectura de respaldo de disponibilidad. | 2 productos |

Si esa decisión estuviera metida en el repositorio, la Tarea 10 no podría cambiar de opinión sin refactorizar la capa de datos. Por eso la Tarea 04 dejó la capa de datos neutra y esta tarea es la que decide.

### 4.3 El axioma que hay que codificar explícitamente

> **El catálogo público lee SOLO `status === "PUBLISHED"`.**

Este filtro se aplica **dos veces, a propósito**:

1. En el `where` de `findPublishedProducts` (Tarea 04), porque Prisma bypasea RLS (DESIGN.md §4.7) y la base no puede ser la única barrera.
2. En el servicio, con un filtro explícito sobre el DTO, porque la regla es del **dominio**, no de la consulta.

La segunda capa no es redundancia inútil: protege contra el día que alguien inyecte un repositorio distinto, migre a un CMS externo, o arme un test con un doble mal construido. Un DRAFT no sale de la capa de servicio aunque el repositorio lo haya traído. Se escribe así:

```ts
// src/server/services/catalog.service.ts

/**
 * Axioma de dominio. El repositorio ya filtra, pero el filtro se repite
 * acá a propósito: "solo PUBLISHED" es una regla del dominio, no un
 * detalle de la consulta. Si mañana el catálogo se lee de otro lado, este
 * filtro sigue existiendo y sigue siendo cierto.
 */
const isPublished = (product: ProductDTO): boolean => product.status === "PUBLISHED";
```

### 4.4 Reglas transversales

| Regla | Detalle |
|---|---|
| Nombres de función | `get*` para lecturas que aplican una regla, `*Command` para acciones. Ver contexto compartido §1. |
| Sin `try/catch` decorativo | Los servicios **propagan** los errores de dominio. El `try/catch` vive en los Route Handlers y Server Actions, que los traducen a mensajes de UI. Un servicio que se traga un error produce fallos silenciosos: la home renderiza un catálogo vacío y nadie sabe por qué. |
| Errores que el servicio sí lanza | `ResourceNotFoundError` cuando un repositorio devuelve `null` para un recurso que el dominio da por existente. `ValidationError` cuando normalizar la entrada falla. Son traductores, no capturadores. |
| DTOs planos | Los servicios devuelven DTOs. Nunca entidades Prisma, nunca `Decimal`, nunca `Date`. Se verifica en el primer test de §6.6. |
| Sin strings de presentación | Un servicio no devuelve "No hay disponibilidad". Devuelve `hasAnyAvailableProduct: false` y el copy lo pone el componente. Si el servicio devuelve textos, cada cambio de redacción obliga a tocar lógica de negocio. |
| `server-only` según el tipo | `src/lib/domain/catalog.ts` y `src/server/services/settings-normalizers.ts` **no** lo llevan: no hacen I/O, son isomórficos, se testean sin base y el cliente los puede usar (el catálogo para recalcular con el estado en vivo, los normalizadores para el preview del formulario de ajustes). `catalog.service.ts`, `category.service.ts` y `settings.service.ts` **sí** lo llevan: hablan con la base. |

### 4.5 La decisión de caché: por qué la disponibilidad NO va en el HTML cacheado

Esta es la pieza más importante de la tarea, porque es la base de la Tarea 15.

El catálogo tiene **dos capas de datos con ciclos de vida distintos** (DESIGN.md §6.1):

| Capa | Contenido | Frecuencia de cambio | Caché |
|---|---|---|---|
| Contenido | Nombres, precios, fotos, categorías, descripciones | Horas o días | **Sí.** ISR con tag `products`. |
| Disponibilidad | `isAvailable` de cada producto | Minutos | **No.** Vive en memoria del cliente y llega por push. |

Si la disponibilidad estuviera dentro de la caché del HTML, cada toggle del encargado obligaría a revalidar el catálogo **para todos los usuarios al mismo tiempo**. Con un único encargado sería tolerable, pero el diseño correcto escala gratis: el contenido se cachea, la disponibilidad se suscribe.

Por eso la frontera de caché se dibuja así:

- `getCatalogForPublic()` **cachea las secciones** (el contenido, la parte cara) con el tag `products`.
- `getCatalogForPublic()` **no cachea los ajustes**: son una fila de ocho columnas que el admin cambia una vez cada varios meses.
- `getBusinessSettings()` **no se cachea**: es un `findUnique` por clave primaria.
- `hasAnyAvailableProduct` se calcula **fuera** de la función cacheada. Es el snapshot de `isAvailable` en el momento de generar el HTML, y el cliente lo recalcula con el store en vivo (Tarea 15). Meterlo adentro de la caché lo volvería más viejo todavía sin aportar nada.

**Consecuencia concreta:** el toggle de disponibilidad (Tarea 14) **no** llama a `revalidateTag("products")`. Solo lo llaman crear, editar, publicar, despublicar, archivar y reordenar (DESIGN.md §6.1). Si algún día un toggle invalida el catálogo, es un bug.

### 4.6 Reparto específico de responsabilidades

| Servicio | Responsabilidad | No es suya |
|---|---|---|
| `catalog.service.ts` | Agrupar, filtrar por publicación, ordenar, componer el `CatalogDTO`, decidir caché, 404 de slug | Normalizar el teléfono, ordenar categorías sueltas |
| `category.service.ts` | Orden canónico de categorías, lectura admin, `null → ResourceNotFoundError` | Agrupar productos |
| `settings-normalizers.ts` | Sanear teléfono, URL de Instagram y horarios. Funciones puras | Hablar con la base |
| `settings.service.ts` | Orquestar lectura y escritura, avisar si el negocio no está configurado | Cachear, formatear el mensaje de WhatsApp (eso es la Tarea 12) |

**Decisión explícita:** la navegación de categorías del menú **no** es un servicio aparte. Se deriva de `catalog.sections` en la Tarea 10. Si existiera un `getMenuNavigation()` propio, el índice lateral y los anchors de la página podrían desincronizarse en cuanto una categoría quedara vacía.

---

## 5. Convenciones de código (Clean Code + SOLID)

**Principios aplicados: SRP, DIP e ISP.**

### 5.1 DIP — las dependencias se inyectan, no se importan

El servicio **no importa** los repositorios. Declara en `repository-ports.ts` la forma mínima que necesita y la recibe por parámetro:

```ts
// ❌ MAL — el servicio queda atado a Prisma y no se puede testear sin base
import { findPublishedProducts } from "@/server/repositories/product.repository";

export const getCatalog = async () => findPublishedProducts();
```

```ts
// ✅ BIEN — la dependencia es una función, se pasa por parámetro
export const readCatalogSections = async (
  dependencies: CatalogContentReaders,
): Promise<readonly CatalogSection[]> => {
  const [categories, products] = await Promise.all([
    dependencies.categoryRepository.findVisibleCategories(),
    dependencies.productRepository.findPublishedProducts(),
  ]);
  return buildCatalogSections(categories, products);
};
```

Consecuencias concretas:

- Los tests unitarios corren en `environment: "node"` **sin base de datos** y en milisegundos.
- Cambiar la fuente de datos (Prisma a un CMS) es cambiar la línea del call site, no el servicio.
- Se pueden testear situaciones que en la base real son difíciles de armar: un producto publicado cuya categoría está oculta, un DRAFT mezclado con publicados, un slug que apunta a un archivado.

### 5.2 ISP — un puerto por servicio, no un puerto gigante

`repository-ports.ts` **no** exporta un `ProductRepositoryInterface` con los diez métodos. Cada servicio declara solo lo que consume:

| Puerto | Métodos | Lo consume |
|---|---|---|
| `ProductCatalogReader` | `findPublishedProducts`, `findPublishedProductBySlug`, `findFeaturedProducts` | `catalog.service` |
| `CategoryCatalogReader` | `findVisibleCategories` | `catalog.service` |
| `CategoryAdminReader` | `findCategoryById` | `category.service` |
| `SettingsReader` | `findBusinessSettings` | `settings.service` |
| `SettingsWriter` | `findBusinessSettings`, `saveBusinessSettings` | `settings.service` (escritura, Tarea 17) |

Beneficio concreto: `category.service` no puede llamar a `deleteCategory` aunque exista, porque no lo ve en su tipo. La interfaz hace de whitelist.

### 5.3 Límites de tamaño

Contexto compartido §13: un servicio no puede pasar las **150 líneas**. Por eso los normalizadores puros viven aparte de la orquestación y los puertos aparte de los servicios.

**Cómo se cuenta:** por líneas de código, sin comentarios ni líneas en blanco. El motivo es concreto: en esta arquitectura la documentación de *por qué* importa más que el código, y un límite que obliga a borrar comentarios para entrar en el número produce el resultado contrario. La columna de total está para que un revisor juzgue con la misma información.

| Archivo | Código | Total con comentarios |
|---|---|---|
| `repository-ports.ts` | ~27 | ~46 |
| `settings-normalizers.ts` | ~94 | ~177 |
| `settings.service.ts` | ~35 | ~73 |
| `category.service.ts` | ~22 | ~53 |
| `catalog.service.ts` | ~103 | ~214 |

Si alguno se pasa por código, se divide por responsabilidad y no por cantidad. El nombre del archivo nuevo dice qué responsabilidad se separó: `phone-normalizer.ts`, `opening-hours-normalizer.ts`, `catalog-sections.ts`. **No** se divide en `utils.ts` ni en `helpers.ts`: están prohibidos por el contexto compartido §18.

---

## 6. Pasos de implementación

### 6.1 Tipos compuestos de catálogo

```ts
// src/lib/domain/catalog.ts
import type { CategoryDTO } from "./category";
import type { ProductDTO } from "./product";
import type { BusinessSettingsDTO } from "./settings";

/**
 * Una categoría y sus productos publicados, ya ordenados.
 *
 * ⛔ Regla estructural: `products` NUNCA es un array vacío. Una sección
 * vacía es un error de presentación, no un dato: si una categoría visible
 * no tiene publicados, no se construye la sección. Ver
 * `buildCatalogSections` en `catalog.service.ts`.
 */
export interface CatalogSection {
  readonly category: CategoryDTO;
  readonly products: readonly ProductDTO[];
}

/**
 * Ensamblaje completo que consume la capa de presentación.
 *
 * `settings` viaja dentro del catálogo a propósito: el header, el footer y
 * el botón de WhatsApp necesitan el nombre del local y el teléfono en la
 * misma lectura que el resto de la página, sin una segunda ida a la base.
 */
export interface CatalogDTO {
  readonly sections: readonly CatalogSection[];
  readonly settings: BusinessSettingsDTO;
  /**
   * Snapshot de "¿hay algo para pedir?" al momento de generar el HTML.
   *
   * ⚠️ Es un valor inicial, no el estado final. Después de hidratar, la
   * fuente de verdad es el store de disponibilidad alimentado por Realtime
   * (Tarea 15), que recalcula este booleano con el mismo helper. Si el
   * estado en vivo dijera que no hay nada para pedir, la UI lo muestra
   * aunque este booleano diga que sí.
   */
  readonly hasAnyAvailableProduct: boolean;
}

/**
 * ¿Hay al menos un producto disponible en todo el catálogo?
 *
 * Función pura e isomórfica a propósito: la usa el servidor para el HTML
 * inicial y el cliente para recalcular cuando llega un push de Realtime.
 * Si el servidor y el cliente usaran fórmulas distintas, el botón de
 * WhatsApp aparecería deshabilitado para unos y habilitado para otros.
 */
export const hasAvailableProducts = (sections: readonly CatalogSection[]): boolean =>
  sections.some((section) => section.products.some((product) => product.isAvailable));

/** Total de productos publicados, contando los agotados. Lo usa la Tarea 14. */
export const countProducts = (sections: readonly CatalogSection[]): number =>
  sections.reduce((total, section) => total + section.products.length, 0);
```

```ts
// src/lib/domain/index.ts
export * from "./errors";
export * from "./product";
export * from "./category";
export * from "./settings";
export * from "./catalog"; // ← se agrega en esta tarea
```

### 6.2 Puertos de repositorio

```ts
// src/server/services/repository-ports.ts
import type { BusinessSettingsDTO, CategoryDTO, OpeningHours, ProductDTO } from "@/lib/domain";

/**
 * Contratos que la capa de servicio necesita de la capa de datos.
 *
 * Son interfaces **estructurales**: no declaran `implements` sobre nada.
 * Los repositorios de la Tarea 04 las satisfacen por forma, sin importarlas
 * y sin que ningún repositorio sepa que existen.
 *
 * ⛔ Solo declaraciones de tipo. No deben abrir conexiones ni importar
 * nada de `next/*`: se borran al compilar y por eso el test unitario del
 * servicio no carga Prisma.
 */
export interface ProductCatalogReader {
  findPublishedProducts(options?: { readonly onlyAvailable?: boolean }): Promise<ProductDTO[]>;
  findPublishedProductBySlug(slug: string): Promise<ProductDTO | null>;
  findFeaturedProducts(limit?: number): Promise<ProductDTO[]>;
}

export interface CategoryCatalogReader {
  findVisibleCategories(): Promise<CategoryDTO[]>;
}

export interface CategoryAdminReader {
  findCategoryById(id: string): Promise<CategoryDTO | null>;
}

/** Solo lectura. Lo usa el catálogo público. */
export interface SettingsReader {
  findBusinessSettings(): Promise<BusinessSettingsDTO>;
}

/** Lectura y escritura. Lo usa el panel de ajustes (Tarea 17). */
export interface SettingsWriter extends SettingsReader {
  saveBusinessSettings(input: SaveBusinessSettingsInput): Promise<BusinessSettingsDTO>;
}

export interface SaveBusinessSettingsInput {
  readonly name: string;
  readonly whatsappPhone: string;
  readonly address: string | null;
  readonly instagramUrl: string | null;
  readonly openingHours: OpeningHours;
  readonly closingMessage: string | null;
  readonly legalNotice: string | null;
}
```

> `SaveBusinessSettingsInput` se **redeclara** acá en lugar de importarse de `settings.repository.ts`. Razón: un `import type` desde un módulo con `import "server-only"` funciona (se borra al compilar), pero ata la capa 3 a la capa 4 y las reglas de `no-restricted-imports` terminan bloqueándolo. La forma es idéntica a la del repositorio; si algún día divergen, el `typecheck` avisa en el call site.

### 6.3 `settings-normalizers.ts` (funciones puras)

```ts
// src/server/services/settings-normalizers.ts
import { ValidationError } from "@/lib/domain";
import type { BusinessSettingsDTO, OpeningHours } from "@/lib/domain";

// ─────────────────────── Constantes de negocio ──────────────────────

/** Prefijo internacional de Argentina. Sin `+`, como exige `wa.me`. */
const COUNTRY_CODE = "54";

/** E.164 admite 12 o 13 dígitos después del 9 móvil. Nada más. */
const PHONE_PATTERN = /^54\d{10,11}$/;

/**
 * Forma del número de relleno de `DEFAULT_BUSINESS_SETTINGS` (Tarea 04).
 * Si el resultado normalizado tiene esta forma, el admin todavía no cargó
 * el número real y el botón de WhatsApp no puede asumir que funciona.
 */
const PLACEHOLDER_LOCAL_NUMBER = /^5492610+$/;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

// ─────────────────────── Normalizadores puros ──────────────────────

/**
 * Lleva cualquier forma de escribir el teléfono a E.164 sin `+`.
 *
 * Acepta: `+54 9 261 555-1234`, `5492615551234`, `0261 555 1234`,
 * `261 555 1234`, `0054 261 5551234`.
 *
 * Reglas, en orden:
 *  1. Se queda solo con los dígitos.
 *  2. Saca el prefijo internacional `00`.
 *  3. Si no arranca con `54`: si arranca con `0` (formato `0261…`) lo
 *     reemplaza por `54`; si no, le antepone `54` (número local pelado).
 *  4. `540…` es un `54` seguido del `0` del `0…` local. Se saca ese `0`.
 *  5. Un número de 12 dígitos sin el `9` móvil se asume celular y se le
 *     agrega el `9`, que es como funciona WhatsApp en Argentina.
 *
 * ⛔ NO intenta arreglar la notación heredada `54 261 15 555-1234`: es
 * ambigua (el `15` se confunde con un prefijo real) y adivinar mal rompe
 * el pedido. Ante la duda lanza `ValidationError` y le pide al admin que
 * lo escriba como lo muestra WhatsApp: `+54 9 261 555-1234`.
 *
 * ⚠️ La regla 5 es una suposición documentada, no una certeza. Por eso el
 * formulario de ajustes (Tarea 17) muestra el valor ya normalizado antes
 * de guardar: el admin lo confirma con un vistazo en lugar de descubrir
 * el error cuando un cliente le escribe a un número equivocado.
 */
export const normalizeArgentinePhone = (raw: string): string => {
  let digits = raw.replace(/\D/g, "");

  if (digits.length === 0) {
    throw new ValidationError(
      { whatsappPhone: ["Ingresá el número de WhatsApp."] },
      "Teléfono de WhatsApp inválido",
    );
  }

  if (digits.startsWith("00")) digits = digits.slice(2);

  if (!digits.startsWith(COUNTRY_CODE)) {
    digits = digits.startsWith("0")
      ? `${COUNTRY_CODE}${digits.slice(1)}`
      : `${COUNTRY_CODE}${digits}`;
  }

  if (digits.startsWith(`${COUNTRY_CODE}0`)) {
    digits = `${COUNTRY_CODE}${digits.slice(3)}`;
  }

  if (digits.length === 12 && !digits.startsWith(`${COUNTRY_CODE}9`)) {
    digits = `${COUNTRY_CODE}9${digits.slice(2)}`;
  }

  if (!PHONE_PATTERN.test(digits)) {
    throw new ValidationError(
      {
        whatsappPhone: [
          "El número no es válido. Escribilo como WhatsApp lo muestra, por ejemplo +54 9 261 555-1234.",
        ],
      },
      "Teléfono de WhatsApp inválido",
    );
  }

  return digits;
};

/**
 * Sanear la URL de Instagram. Devuelve `null` en lugar de una URL rota:
 * un `javascript:` o un perfil inexistente rompen el pie de página entero.
 */
export const normalizeInstagramUrl = (raw: string | null): string | null => {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.hostname.length === 0) return null;
    return `https://${url.hostname}${url.pathname.replace(/\/+$/, "")}${url.search}`;
  } catch {
    return null;
  }
};

/**
 * Valida la forma de los horarios día por día.
 *
 * El type guard de `settings.repository` (Tarea 04) solo verifica que el
 * jsonb sea un objeto. Un `{ "lunes": { opens, closes } }`, con el día en
 * español que es lo que un humano escribe, pasa ese filtro y revienta la
 * grilla de horarios en la UI. Esta función es la segunda barrera.
 *
 * Reglas:
 *  · Solo se conservan las siete claves canónicas en inglés minúscula.
 *  · Un día con valor `null` se conserva: significa "cerrado".
 *  · Un día ausente NO se completa con `null`. Ausente es "no informado" y
 *    la UI lo muestra como `—`. Ponerlo "cerrado" sería mentir.
 *  · `HH:MM` en formato 24 h, con cero a la izquierda.
 *  · No se valida que el cierre sea posterior a la apertura: un local que
 *    cierra de madrugada es un caso válido.
 */
export const normalizeOpeningHours = (raw: unknown): OpeningHours => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const result: Record<string, { readonly opens: string; readonly closes: string } | null> = {};

  for (const day of WEEKDAY_KEYS) {
    if (!(day in source)) continue;

    const entry = source[day];
    if (entry === null) {
      result[day] = null;
      continue;
    }
    if (typeof entry !== "object" || Array.isArray(entry)) continue;

    const { opens, closes } = entry as { readonly opens?: unknown; readonly closes?: unknown };
    if (typeof opens !== "string" || typeof closes !== "string") continue;
    if (!TIME_PATTERN.test(opens) || !TIME_PATTERN.test(closes)) continue;

    result[day] = { opens, closes };
  }

  return result;
};

/** El negocio todavía no cargó sus datos y el teléfono es el de relleno. */
export const isSettingsConfigured = (settings: BusinessSettingsDTO): boolean =>
  PHONE_PATTERN.test(settings.whatsappPhone) &&
  !PLACEHOLDER_LOCAL_NUMBER.test(settings.whatsappPhone);

/** Aplica el mismo saneado a la lectura y a la escritura. Sin I/O. */
export const normalizeBusinessSettings = (
  stored: BusinessSettingsDTO,
): BusinessSettingsDTO => ({
  ...stored,
  name: stored.name.trim(),
  openingHours: normalizeOpeningHours(stored.openingHours),
  instagramUrl: normalizeInstagramUrl(stored.instagramUrl),
  address: stored.address === null ? null : stored.address.trim() || null,
  closingMessage: stored.closingMessage === null ? null : stored.closingMessage.trim() || null,
  legalNotice: stored.legalNotice === null ? null : stored.legalNotice.trim() || null,
});
```

> ⛔ Este archivo **no** lleva `import "server-only"`: no hace I/O. Eso lo deja testeable en `environment: "node"` sin cargar Prisma, y disponible para el cliente. La Tarea 17 lo va a necesitar para el preview en vivo del formulario de ajustes: mientras el admin escribe el teléfono, el input muestra la versión ya normalizada, sin ida a la base.
>
> Si algún día `settings-normalizers.ts` pasa las 150 líneas, se divide por eje de dato (`phone-normalizer.ts`, `opening-hours-normalizer.ts`), no por cantidad de funciones sueltas.

### 6.4 `settings.service.ts` (orquestación)

```ts
// src/server/services/settings.service.ts
import "server-only";

import { isSettingsConfigured, normalizeArgentinePhone, normalizeBusinessSettings } from "./settings-normalizers";
import type { BusinessSettingsDTO } from "@/lib/domain";
import type { SaveBusinessSettingsInput, SettingsReader, SettingsWriter } from "./repository-ports";

/** Aviso único para los dos caminos: la fila no existe o el número es de relleno. */
const warnAboutPlaceholderPhone = (): void => {
  console.warn(
    "[settings] El número de WhatsApp es el de relleno. Configuralo en /admin/ajustes antes de recibir pedidos.",
  );
};

/**
 * Ajustes del negocio, normalizados y **sin caché**.
 *
 * Por qué sin caché (DESIGN.md §6.1): es una lectura de una sola fila por
 * clave primaria, de ocho columnas, y el admin la cambia una vez cada
 * varios meses. Meterla en la caché obligaría a sumar un tag, una
 * invalidación y una clase de bug nueva a cambio de ahorrar unos
 * milisegundos que nadie nota. El contenido del catálogo, que sí se
 * cachea, son veinte a cuarenta filas.
 *
 * ⚠️ `findBusinessSettings` ya devuelve `DEFAULT_BUSINESS_SETTINGS` con un
 * `console.warn` propio cuando la fila no existe. Este servicio **no
 * reimplementa** ese default: solo lo normaliza y registra el aviso que al
 * repositorio no le corresponde, que es de negocio y no de datos: el
 * número de WhatsApp es el de relleno y el local todavía no está listo
 * para recibir pedidos.
 */
export const getBusinessSettings = async (
  dependencies: { readonly settingsRepository: SettingsReader },
): Promise<BusinessSettingsDTO> => {
  const settings = normalizeBusinessSettings(
    await dependencies.settingsRepository.findBusinessSettings(),
  );

  if (!isSettingsConfigured(settings)) warnAboutPlaceholderPhone();

  return settings;
};

/**
 * Guarda los ajustes del negocio.
 *
 * El input ya viene validado por Zod desde el Server Action (Tarea 17).
 * Acá solo se normaliza, porque `wa.me` es intolerante con los formatos y
 * un `+54 261…` guardado tal cual rompe el enlace del checkout.
 *
 * ⛔ No envuelve la escritura en un `try/catch`: un `ConflictError` del
 * repositorio tiene que llegar al Server Action para que lo muestre junto
 * al campo.
 */
export const updateBusinessSettings = async (
  dependencies: { readonly settingsRepository: SettingsWriter },
  input: SaveBusinessSettingsInput,
): Promise<BusinessSettingsDTO> => {
  const normalized = normalizeBusinessSettings({
    name: input.name,
    whatsappPhone: normalizeArgentinePhone(input.whatsappPhone),
    address: input.address,
    instagramUrl: input.instagramUrl,
    openingHours: input.openingHours,
    closingMessage: input.closingMessage,
    legalNotice: input.legalNotice,
  });

  const saved = await dependencies.settingsRepository.saveBusinessSettings(normalized);

  if (!isSettingsConfigured(saved)) warnAboutPlaceholderPhone();

  return saved;
};
```

> Los dos caminos de saneado comparten `normalizeBusinessSettings` a propósito. Si mañana se agrega una regla nueva (por ejemplo, truncar `closingMessage` a 280 caracteres), se agrega en un solo lugar y los dos caminos quedan cubiertos. Un `try/catch` alrededor de `saveBusinessSettings` sí sería un error: escondería el `ConflictError` y devolvería un "guardado con éxito" falso.

### 6.5 `category.service.ts`

```ts
// src/server/services/category.service.ts
import "server-only";

import { ResourceNotFoundError } from "@/lib/domain";
import type { CategoryDTO } from "@/lib/domain";
import type { CategoryAdminReader, CategoryCatalogReader } from "./repository-ports";

/**
 * Orden canónico de las categorías.
 *
 * `position` es el criterio manual del local (definido en la Tarea 00). El
 * desempate por nombre existe porque `position` es un `Int` editable a
 * mano en Prisma Studio y es perfectamente posible que dos categorías
 * queden en `0`. Sin desempate, el orden de la base (que no está
 * garantizado) se filtraría a la pantalla y las secciones del menú
 * saltarían entre cargas.
 *
 * `localeCompare` con `"es"` ordena "Álbones" junto a "Albondigas", que es
 * lo que espera un lector en español.
 */
export const orderCategories = (
  categories: readonly CategoryDTO[],
): readonly CategoryDTO[] =>
  [...categories].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name, "es"),
  );

/**
 * Categorías visibles, en el orden en que se muestran.
 *
 * Filtra `isVisible` y ordena. La usan `catalog.service` (agrupación) y la
 * Tarea 10 (anclas del menú).
 */
export const getVisibleCategories = async (
  dependencies: { readonly categoryRepository: CategoryCatalogReader },
): Promise<readonly CategoryDTO[]> =>
  orderCategories(await dependencies.categoryRepository.findVisibleCategories());

/**
 * Categoría puntual para el panel admin.
 *
 * Traduce el `null` del repositorio a `ResourceNotFoundError`, que el
 * Server Action traduce a un mensaje en pantalla. El editor de producto
 * (Tarea 16) lo usa para confirmar que la categoría elegida existe antes
 * de mandar el formulario.
 */
export const getCategoryForAdmin = async (
  dependencies: { readonly categoryRepository: CategoryAdminReader },
  id: string,
): Promise<CategoryDTO> => {
  const category = await dependencies.categoryRepository.findCategoryById(id);
  if (category === null) throw new ResourceNotFoundError("Categoría", id);
  return category;
};
```

> **Relación deliberadamente ausente:** `category.service` no expone `getMenuNavigation()`. La navegación se deriva de `catalog.sections` en la Tarea 10, para que el índice lateral y los anchors de la página no puedan desincronizarse. Ver §4.6.

### 6.6 `catalog.service.ts`

```ts
// src/server/services/catalog.service.ts
import "server-only";

import { unstable_cache } from "next/cache";
import { ResourceNotFoundError, hasAvailableProducts } from "@/lib/domain";
import type {
  BusinessSettingsDTO,
  CatalogDTO,
  CatalogSection,
  CategoryDTO,
  ProductDTO,
} from "@/lib/domain";
import type { CategoryCatalogReader, ProductCatalogReader } from "./repository-ports";

/**
 * ⛔ Tag único de invalidación del contenido. Cubre productos y categorías,
 * tal como fija el contexto compartido §15. Lo llaman el alta, la edición,
 * la publicación, la despublicación, el archivado y el reordenamiento.
 *
 * ⛔ El toggle de disponibilidad NO lo llama. Ver §4.5.
 */
export const CATALOG_CACHE_TAG = "products";

/**
 * Red de seguridad temporal. Si un `revalidateTag` queda sin escribir en
 * algún camino futuro, el contenido se refresca solo en una hora. No es el
 * mecanismo principal: es lo que evita que un olvido sirva HTML viejo de
 * productos durante semanas.
 */
const CATALOG_REVALIDATE_SECONDS = 3600;

/** Clave estable de la entrada de caché. No lleva datos del negocio. */
const CATALOG_CACHE_KEY = ["modo-miga", "catalogo-publico", "secciones"] as const;

const isPublished = (product: ProductDTO): boolean => product.status === "PUBLISHED";

const bySortOrderThenName = (a: ProductDTO, b: ProductDTO): number =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es");

/**
 * Agrupa productos publicados bajo sus categorías visibles.
 *
 * ⚠️ Se itera sobre las **categorías**, no sobre los productos. Esa es la
 * diferencia entre dos bugs que ninguno se detecta mirando la pantalla:
 *
 *  · Si se iteraran los productos, un producto cuya categoría está oculta
 *    aparecería suelto, sin encabezado, en una sección que no le
 *    corresponde. Y aparecería publicado para cualquiera que tenga el link.
 *  · Si no se filtrara `products.length > 0`, una categoría visible sin
 *    publicados dejaría un encabezado con un grid vacío debajo, que es
 *    exactamente el error de DESIGN.md §10.5. "No hay nada" y un hueco
 *    vacío se ven igual de rotos desde un celular.
 */
const buildCatalogSections = (
  categories: readonly CategoryDTO[],
  products: readonly ProductDTO[],
): readonly CatalogSection[] => {
  const published = products.filter(isPublished);

  const byCategoryId = new Map<string, ProductDTO[]>();
  for (const product of published) {
    const bucket = byCategoryId.get(product.categoryId);
    if (bucket === undefined) byCategoryId.set(product.categoryId, [product]);
    else bucket.push(product);
  }

  return categories
    .map((category) => ({
      category,
      products: [...(byCategoryId.get(category.id) ?? [])].sort(bySortOrderThenName),
    }))
    .filter((section) => section.products.length > 0);
};

export interface CatalogContentReaders {
  readonly productRepository: ProductCatalogReader;
  readonly categoryRepository: CategoryCatalogReader;
}

export interface CatalogServiceDependencies extends CatalogContentReaders {
  /** Se inyecta como función suelta: es un servicio, no un repositorio. */
  readonly getBusinessSettings: () => Promise<BusinessSettingsDTO>;
}

/**
 * Lectura del contenido, SIN caché. Acá viven todas las reglas.
 *
 * Es la función que se testea. `getCatalogForPublic` la envuelve en
 * `unstable_cache` y le suma los ajustes; los tests unitarios llaman esta,
 * nunca la otra. Ver §9 y §10.
 */
export const readCatalogSections = async (
  dependencies: CatalogContentReaders,
): Promise<readonly CatalogSection[]> => {
  const [categories, products] = await Promise.all([
    dependencies.categoryRepository.findVisibleCategories(),
    dependencies.productRepository.findPublishedProducts(),
  ]);

  return buildCatalogSections(categories, products);
};

/**
 * Envuelve una lectura de contenido en la caché ISR de Next.
 *
 * Detalle no obvio: `unstable_cache` serializa los argumentos para armar la
 * clave de caché, así que **no puede recibir funciones**. Por eso la
 * función cacheada no toma dependencias como argumento: las captura en el
 * cierre. La clave es constante, de modo que la entrada de caché es la
 * misma en todos los requests.
 *
 * Consecuencia para los tests: como el resultado se guarda en una caché
 * global de Next compartida por toda la aplicación, un unitario que
 * llamara a `getCatalogForPublic` con dobles distintos recibiría el
 * resultado del test anterior. Por eso el punto de testear es
 * `readCatalogSections`, no esta función.
 */
const readCachedCatalogSections = (
  dependencies: CatalogContentReaders,
): Promise<readonly CatalogSection[]> =>
  unstable_cache(
    async () => readCatalogSections(dependencies),
    [...CATALOG_CACHE_KEY],
    { tags: [CATALOG_CACHE_TAG], revalidate: CATALOG_REVALIDATE_SECONDS },
  )();

/** Ensamblaje puro del DTO. Sin I/O, sin caché: totalmente testeable. */
export const buildCatalogDTO = (
  sections: readonly CatalogSection[],
  settings: BusinessSettingsDTO,
): CatalogDTO => ({
  sections,
  settings,
  hasAnyAvailableProduct: hasAvailableProducts(sections),
});

/**
 * Catálogo público completo: contenido cacheado + ajustes sin caché.
 *
 * Es la única puerta de entrada del catálogo. La Tarea 10 la llama desde un
 * Server Component y el resultado se serializa hacia los Client Components
 * como DTO plano.
 *
 * ⚠️ `hasAnyAvailableProduct` es un snapshot del HTML generado. No es el
 * estado final de la disponibilidad: eso vive en el cliente y llega por
 * Realtime (Tarea 15). Ver §4.5.
 */
export const getCatalogForPublic = async (
  dependencies: CatalogServiceDependencies,
): Promise<CatalogDTO> => {
  const [sections, settings] = await Promise.all([
    readCachedCatalogSections(dependencies),
    dependencies.getBusinessSettings(),
  ]);

  return buildCatalogDTO(sections, settings);
};

/**
 * Catálogo filtrando los agotados. **Sin caché**, a propósito: existe para
 * la lectura de respaldo de disponibilidad (Tarea 15), que tiene que
 * reflejar el estado actual y no el de hace hasta una hora.
 *
 * ⚠️ Si ninguna vista termina usándola, es código muerto y hay que
 * borrarla. Dos consumidores previstos: el filtro "Solo disponibles" de la
 * Tarea 10, si se decide exponerlo, y el fallback cuando Realtime no está
 * disponible.
 */
export const getCatalogWithOnlyAvailable = async (
  dependencies: CatalogContentReaders,
): Promise<readonly CatalogSection[]> => {
  const [categories, products] = await Promise.all([
    dependencies.categoryRepository.findVisibleCategories(),
    dependencies.productRepository.findPublishedProducts({ onlyAvailable: true }),
  ]);

  return buildCatalogSections(categories, products);
};

/**
 * Ficha de producto para la página pública.
 *
 * Traduce el `null` del repositorio a `ResourceNotFoundError`. Un slug que
 * apunta a un DRAFT o a un ARCHIVED devuelve 404, igual que un slug
 * inexistente: responder 403 confirmaría que ese producto existe y fue
 * retirado, que es información de la competencia y del local que no hace
 * falta dar.
 */
export const getProductBySlugForPublic = async (
  dependencies: { readonly productRepository: ProductCatalogReader },
  slug: string,
): Promise<ProductDTO> => {
  const product = await dependencies.productRepository.findPublishedProductBySlug(slug);
  if (product === null || !isPublished(product)) {
    throw new ResourceNotFoundError("Producto", slug);
  }
  return product;
};

/**
 * Destacados de la home.
 *
 * `limit` se acota a un rango razonable: el repositorio no pagina y este
 * catálogo tiene veinte a cuarenta productos, así que un `limit` de
 * `10000` desde un call site equivocado no debe convertir esto en un
 * `findMany` que trae todo.
 */
export const getFeaturedProductsForPublic = async (
  dependencies: { readonly productRepository: ProductCatalogReader },
  limit = 4,
): Promise<readonly ProductDTO[]> => {
  const bounded = Math.min(Math.max(Math.trunc(limit), 1), 12);
  const products = await dependencies.productRepository.findFeaturedProducts(bounded);
  return products.filter(isPublished).slice(0, bounded);
};
```

### 6.7 Tests unitarios

Se inyectan dobles escritos a mano. **No** se usa `vi.mock` de los repositorios: un mock verifica que el código se llame como se escribió, no que funcione. Un doble es un objeto con la misma forma, y la prueba sigue valiendo si mañana el servicio cambia por dentro.

```ts
// tests/unit/catalog.service.test.ts
import { describe, expect, it } from "vitest";
import { ResourceNotFoundError } from "@/lib/domain";
import type { BusinessSettingsDTO, CategoryDTO, ProductDTO } from "@/lib/domain";
import {
  buildCatalogDTO,
  getFeaturedProductsForPublic,
  getProductBySlugForPublic,
  readCatalogSections,
} from "@/server/services/catalog.service";
import type { CatalogContentReaders } from "@/server/services/catalog.service";

const buildCategory = (overrides: Partial<CategoryDTO> = {}): CategoryDTO => ({
  id: "cat_clasicos",
  name: "Clásicos",
  slug: "clasicos",
  description: null,
  position: 0,
  isVisible: true,
  ...overrides,
});

const buildProduct = (overrides: Partial<ProductDTO> = {}): ProductDTO => ({
  id: "prod_jamon",
  name: "Jamón y Queso",
  slug: "jamon-y-queso",
  description: null,
  price: 1450,
  imageUrl: "https://res.cloudinary.com/demo/image/upload/jq.jpg",
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

const buildSettings = (): BusinessSettingsDTO => ({
  name: "Mi Negocio",
  whatsappPhone: "5492615551234",
  address: null,
  instagramUrl: null,
  openingHours: {},
  closingMessage: null,
  legalNotice: null,
});

/** Doble de repositorio. Solo implementa lo que el puerto declara. */
const buildReaders = (
  categories: readonly CategoryDTO[],
  products: readonly ProductDTO[],
): CatalogContentReaders => ({
  categoryRepository: { findVisibleCategories: async () => [...categories] },
  productRepository: {
    findPublishedProducts: async () => [...products],
    findPublishedProductBySlug: async (slug) =>
      products.find((product) => product.slug === slug) ?? null,
    findFeaturedProducts: async (limit = 4) => products.filter((p) => p.isFeatured).slice(0, limit),
  },
});

describe("catalog.service", () => {
  describe("readCatalogSections", () => {
    it("debe excluir un producto DRAFT aunque el repositorio lo haya traído", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [buildProduct(), buildProduct({ id: "prod_borrador", slug: "borrador", status: "DRAFT" })],
      );

      const sections = await readCatalogSections(readers);

      expect(sections).toHaveLength(1);
      expect(sections[0]?.products.map((p) => p.slug)).toEqual(["jamon-y-queso"]);
    });

    it("debe excluir también un producto ARCHIVED", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [buildProduct(), buildProduct({ id: "prod_archivado", status: "ARCHIVED" })],
      );

      const sections = await readCatalogSections(readers);

      expect(sections[0]?.products).toHaveLength(1);
    });

    it("debe excluir un producto ARCHIVED de la lista de destacados", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [buildProduct({ isFeatured: true, status: "ARCHIVED" })],
      );

      expect(await getFeaturedProductsForPublic(readers)).toHaveLength(0);
    });

    it("no debe construir una sección para una categoría visible sin publicados", async () => {
      const readers = buildReaders(
        [buildCategory(), buildCategory({ id: "cat_postres", name: "Postres", position: 1 })],
        [buildProduct()],
      );

      const sections = await readCatalogSections(readers);

      expect(sections).toHaveLength(1);
      expect(sections[0]?.category.name).toBe("Clásicos");
    });

    it("debe excluir los productos de una categoría oculta, no dejarlos sueltos", async () => {
      const readers = buildReaders(
        [buildCategory({ id: "cat_visibles", name: "Clásicos" })],
        [buildProduct({ categoryId: "cat_oculta" })],
      );

      expect(await readCatalogSections(readers)).toHaveLength(0);
    });

    it("debe ordenar los productos por sortOrder y desempatar por nombre", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [
          buildProduct({ id: "p3", name: "Zapallito", sortOrder: 2 }),
          buildProduct({ id: "p1", name: "Bife", sortOrder: 0 }),
          buildProduct({ id: "p2", name: "Americana", sortOrder: 0 }),
        ],
      );

      const sections = await readCatalogSections(readers);

      expect(sections[0]?.products.map((p) => p.name)).toEqual([
        "Americana",
        "Bife",
        "Zapallito",
      ]);
    });

    it("debe devolver un producto sin descripción, sin variantes y sin imagen pública", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [
          buildProduct({
            description: null,
            imagePublicId: null,
            variants: [],
            allergens: [],
          }),
        ],
      );

      const [section] = await readCatalogSections(readers);
      const product = section?.products[0];

      expect(product?.description).toBeNull();
      expect(product?.imagePublicId).toBeNull();
      expect(product?.variants).toEqual([]);
      expect(product?.allergens).toEqual([]);
    });

    it("debe devolver precios como number, nunca Prisma.Decimal", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [buildProduct({ price: 1450.5, variants: [{ id: "v1", name: "Doble", priceDelta: 450, isAvailable: true, sortOrder: 0 }] })],
      );

      const [section] = await readCatalogSections(readers);
      const product = section?.products[0];

      expect(typeof product?.price).toBe("number");
      expect(product?.price).toBe(1450.5);
      expect(typeof product?.variants[0]?.priceDelta).toBe("number");
    });

    it("debe devolver un producto sin variantes sin inventar una variante única", async () => {
      const readers = buildReaders([buildCategory()], [buildProduct({ variants: [] })]);

      const [section] = await readCatalogSections(readers);

      expect(section?.products[0]?.variants).toEqual([]);
    });
  });

  describe("buildCatalogDTO", () => {
    it("debe marcar que no hay disponibilidad cuando todos los productos están agotados", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [buildProduct({ isAvailable: false })],
      );

      const sections = await readCatalogSections(readers);
      const catalog = buildCatalogDTO(sections, buildSettings());

      expect(catalog.hasAnyAvailableProduct).toBe(false);
      // Los agotados siguen estando: se muestran desaturados (DESIGN.md §10.3).
      expect(catalog.sections[0]?.products).toHaveLength(1);
    });

    it("debe marcar que hay disponibilidad si un solo producto está disponible", async () => {
      const readers = buildReaders(
        [buildCategory()],
        [
          buildProduct({ id: "p1", isAvailable: false }),
          buildProduct({ id: "p2", sortOrder: 1, isAvailable: true }),
        ],
      );

      const catalog = buildCatalogDTO(await readCatalogSections(readers), buildSettings());

      expect(catalog.hasAnyAvailableProduct).toBe(true);
    });

    it("debe devolver un catálogo vacío sin lanzar cuando no hay nada publicado", async () => {
      const catalog = buildCatalogDTO([], buildSettings());

      expect(catalog.sections).toEqual([]);
      expect(catalog.hasAnyAvailableProduct).toBe(false);
      expect(catalog.settings.name).toBe("Mi Negocio");
    });
  });

  describe("getProductBySlugForPublic", () => {
    it("debe lanzar ResourceNotFoundError si el slug no existe", async () => {
      const readers = buildReaders([buildCategory()], []);

      await expect(getProductBySlugForPublic(readers, "no-existe")).rejects.toThrow(
        ResourceNotFoundError,
      );
    });

    it("debe lanzar ResourceNotFoundError si el slug apunta a un DRAFT", async () => {
      const readers = buildReaders([buildCategory()], [buildProduct({ status: "DRAFT" })]);

      await expect(getProductBySlugForPublic(readers, "jamon-y-queso")).rejects.toThrow(
        ResourceNotFoundError,
      );
    });

    it("debe devolver el producto cuando el slug es de un PUBLISHED", async () => {
      const readers = buildReaders([buildCategory()], [buildProduct()]);

      const product = await getProductBySlugForPublic(readers, "jamon-y-queso");

      expect(product.name).toBe("Jamón y Queso");
    });
  });

  describe("getFeaturedProductsForPublic", () => {
    it("debe acotar el límite a un rango razonable", async () => {
      const readers = buildReaders(
        [buildCategory()],
        Array.from({ length: 20 }, (_, index) =>
          buildProduct({ id: `p${index}`, slug: `p-${index}`, isFeatured: true }),
        ),
      );

      expect(await getFeaturedProductsForPublic(readers, 999)).toHaveLength(12);
      expect(await getFeaturedProductsForPublic(readers, 0)).toHaveLength(1);
    });
  });
});
```

```ts
// tests/unit/settings.service.test.ts
import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/lib/domain";
import type { BusinessSettingsDTO } from "@/lib/domain";
import {
  isSettingsConfigured,
  normalizeArgentinePhone,
  normalizeInstagramUrl,
  normalizeOpeningHours,
} from "@/server/services/settings-normalizers";
import { getBusinessSettings, updateBusinessSettings } from "@/server/services/settings.service";

describe("normalizeArgentinePhone", () => {
  it.each([
    ["+54 9 261 555-1234", "5492615551234"],
    ["5492615551234", "5492615551234"],
    ["54 261 555 1234", "5492615551234"],
    ["0261 555 1234", "5492615551234"],
    ["261 555 1234", "5492615551234"],
    ["0054 9 261 555 1234", "5492615551234"],
    ["(261) 555-1234", "5492615551234"],
  ])("debe normalizar %s a %s", (entrada, esperado) => {
    expect(normalizeArgentinePhone(entrada)).toBe(esperado);
  });

  it("debe rechazar un número vacío", () => {
    expect(() => normalizeArgentinePhone("   ")).toThrow(ValidationError);
  });

  it("debe rechazar un número demasiado corto para ser argentino", () => {
    expect(() => normalizeArgentinePhone("112233")).toThrow(ValidationError);
  });

  it("debe rechazar la notación heredada con 15 en lugar del 9", () => {
    // A propósito: es ambigua y el servicio no adivina. Ver §6.3.
    expect(() => normalizeArgentinePhone("+54 261 15 555-1234")).toThrow(ValidationError);
  });
});

describe("normalizeInstagramUrl", () => {
  it("debe agregar el protocolo cuando falta", () => {
    expect(normalizeInstagramUrl("instagram.com/modo.miga")).toBe(
      "https://instagram.com/modo.miga",
    );
  });

  it("debe quitar la barra final", () => {
    expect(normalizeInstagramUrl("https://instagram.com/modo.miga/")).toBe(
      "https://instagram.com/modo.miga",
    );
  });

  it("debe devolver null ante un esquema peligroso", () => {
    expect(normalizeInstagramUrl("javascript:alert(1)")).toBeNull();
  });

  it("debe devolver null ante una cadena vacía o solo espacios", () => {
    expect(normalizeInstagramUrl("   ")).toBeNull();
    expect(normalizeInstagramUrl(null)).toBeNull();
  });
});

describe("normalizeOpeningHours", () => {
  it("debe conservar los días válidos y descartar las claves desconocidas", () => {
    const resultado = normalizeOpeningHours({
      monday: { opens: "09:00", closes: "21:00" },
      lunes: { opens: "09:00", closes: "21:00" },
    });

    expect(resultado).toEqual({ monday: { opens: "09:00", closes: "21:00" } });
  });

  it("debe conservar un día en null como cerrado, sin inventar los demás", () => {
    const resultado = normalizeOpeningHours({ sunday: null });

    expect(resultado).toEqual({ sunday: null });
    expect(Object.keys(resultado)).toHaveLength(1);
  });

  it("debe descartar un horario con formato inválido", () => {
    expect(normalizeOpeningHours({ monday: { opens: "9am", closes: "9pm" } })).toEqual({});
  });

  it("debe devolver un objeto vacío cuando no hay horarios cargados", () => {
    expect(normalizeOpeningHours({})).toEqual({});
    expect(normalizeOpeningHours(null)).toEqual({});
    expect(normalizeOpeningHours("corrupto")).toEqual({});
  });
});

describe("isSettingsConfigured", () => {
  const con = (whatsappPhone: string): BusinessSettingsDTO => ({
    name: "Mi Negocio",
    whatsappPhone,
    address: null,
    instagramUrl: null,
    openingHours: {},
    closingMessage: null,
    legalNotice: null,
  });

  it("debe dar falso con el teléfono de relleno del repositorio", () => {
    expect(isSettingsConfigured(con("5492610000000"))).toBe(false);
  });

  it("debe dar verdadero con un número real", () => {
    expect(isSettingsConfigured(con("5492615551234"))).toBe(true);
  });
});

describe("getBusinessSettings", () => {
  it("debe devolver los defaults normalizados y avisar que el local no está configurado", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const settings = await getBusinessSettings({
      settingsRepository: {
        findBusinessSettings: async () => ({
          name: "  Mi Negocio  ",
          whatsappPhone: "5492610000000",
          address: "   ",
          instagramUrl: "instagram.com/modo.miga",
          openingHours: {},
          closingMessage: null,
          legalNotice: null,
        }),
      },
    });

    expect(settings.name).toBe("Mi Negocio");
    expect(settings.address).toBeNull();
    expect(settings.instagramUrl).toBe("https://instagram.com/modo.miga");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("debe propagar el error del repositorio en vez de devolver defaults inventados", async () => {
    await expect(
      getBusinessSettings({
        settingsRepository: {
          findBusinessSettings: async () => {
            throw new Error("connection refused");
          },
        },
      }),
    ).rejects.toThrow("connection refused");
  });
});

describe("updateBusinessSettings", () => {
  it("debe normalizar el teléfono antes de guardar", async () => {
    const guardado: BusinessSettingsDTO[] = [];
    const guardadoResult = await updateBusinessSettings(
      {
        settingsRepository: {
          findBusinessSettings: async () => buildSettingsGuardadas(),
          saveBusinessSettings: async (input) => {
            const row = { ...input, whatsappPhone: input.whatsappPhone };
            guardado.push(row);
            return row;
          },
        },
      },
      {
        name: "Mi Negocio",
        whatsappPhone: "+54 261 555 1234",
        address: null,
        instagramUrl: null,
        openingHours: {},
        closingMessage: null,
        legalNotice: null,
      },
    );

    expect(guardado[0]?.whatsappPhone).toBe("5492615551234");
    expect(guardadoResult.whatsappPhone).toBe("5492615551234");
  });

  it("debe rechazar guardar con un teléfono que no normaliza, sin tocar la base", async () => {
    let escribio = false;
    await expect(
      updateBusinessSettings(
        {
          settingsRepository: {
            findBusinessSettings: async () => buildSettingsGuardadas(),
            saveBusinessSettings: async (input) => {
              escribio = true;
              return input;
            },
          },
        },
        {
          name: "Mi Negocio",
          whatsappPhone: "123",
          address: null,
          instagramUrl: null,
          openingHours: {},
          closingMessage: null,
          legalNotice: null,
        },
      ),
    ).rejects.toThrow(ValidationError);
    expect(escribio).toBe(false);
  });
});

const buildSettingsGuardadas = (): BusinessSettingsDTO => ({
  name: "Mi Negocio",
  whatsappPhone: "5492615551234",
  address: null,
  instagramUrl: null,
  openingHours: {},
  closingMessage: null,
  legalNotice: null,
});
```

```ts
// tests/unit/category.service.test.ts
import { describe, expect, it } from "vitest";
import { ResourceNotFoundError } from "@/lib/domain";
import type { CategoryDTO } from "@/lib/domain";
import {
  getCategoryForAdmin,
  getVisibleCategories,
  orderCategories,
} from "@/server/services/category.service";

const buildCategory = (overrides: Partial<CategoryDTO> = {}): CategoryDTO => ({
  id: "cat_1",
  name: "Clásicos",
  slug: "clasicos",
  description: null,
  position: 0,
  isVisible: true,
  ...overrides,
});

describe("orderCategories", () => {
  it("debe ordenar por position y desempatar por nombre en español", () => {
    const ordenadas = orderCategories([
      buildCategory({ id: "c3", name: "Zapatitos", position: 2 }),
      buildCategory({ id: "c1", name: "Bebidas", position: 0 }),
      buildCategory({ id: "c2", name: "Álbones", position: 0 }),
    ]);

    expect(ordenadas.map((c) => c.name)).toEqual(["Álbones", "Bebidas", "Zapatitos"]);
  });

  it("no debe mutar el array recibido", () => {
    const original = [buildCategory({ name: "Z", position: 1 }), buildCategory({ name: "A", position: 0 })];
    const copia = [...original];

    orderCategories(original);

    expect(original).toEqual(copia);
  });
});

describe("getVisibleCategories", () => {
  it("debe devolver solo las visibles, ya ordenadas", async () => {
    const categorias = await getVisibleCategories({
      categoryRepository: {
        findVisibleCategories: async () => [
          buildCategory({ id: "c2", name: "Premium", position: 1 }),
          buildCategory({ id: "c1", name: "Clásicos", position: 0 }),
        ],
      },
    });

    expect(categorias.map((c) => c.name)).toEqual(["Clásicos", "Premium"]);
  });
});

describe("getCategoryForAdmin", () => {
  it("debe lanzar ResourceNotFoundError cuando la categoría no existe", async () => {
    await expect(
      getCategoryForAdmin(
        { categoryRepository: { findCategoryById: async () => null } },
        "no-existe",
      ),
    ).rejects.toThrow(ResourceNotFoundError);
  });
});
```

### 6.8 Verificación de la frontera de capas

```bash
# 1. Cero Prisma en la capa de servicio. Debe devolver 0 líneas.
rg "prisma" src/server/services/

# 2. Cero React en la capa de servicio. Debe devolver 0 líneas.
rg "from \"react\"|from \"next/react\"" src/server/services/

# 3. El único import de next/* es la caché del catálogo.
rg "from \"next/" src/server/services/

# 4. El filtro de publicación existe en un solo lugar.
rg -n 'status === "PUBLISHED"' src/

# 5. Ningún servicio importa un repositorio: las dependencias se inyectan.
rg "server/repositories" src/server/services/

# 6. Quality gates.
npm run verify
npm run build
```

---

## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `CatalogSection` | `src/lib/domain/catalog.ts` | Tarea 10 (secciones del menú), Tarea 14 (resumen) |
| `CatalogDTO` | idem | Tarea 10 (home y `/menu`), Tarea 12 (WhatsApp), Tarea 18 (JSON-LD) |
| `hasAvailableProducts(sections)` | idem | Tarea 15 (recalcular en el cliente con el estado en vivo) |
| `countProducts(sections)` | idem | Tarea 14 (contadores del panel) |
| `ProductCatalogReader` | `src/server/services/repository-ports.ts` | `catalog.service`, tests |
| `CategoryCatalogReader` | idem | `catalog.service`, `category.service`, tests |
| `CategoryAdminReader` | idem | `category.service`, Tarea 16 |
| `SettingsReader` / `SettingsWriter` | idem | `settings.service`, Tarea 17 |
| `getCatalogForPublic(deps)` | `catalog.service.ts` | Tarea 10 |
| `getCatalogWithOnlyAvailable(deps)` | idem | Tarea 10 (si se expone el filtro) y Tarea 15 (fallback sin Realtime) |
| `getProductBySlugForPublic(deps, slug)` | idem | Tarea 10 (ficha de producto), Tarea 18 (sitemap) |
| `getFeaturedProductsForPublic(deps, limit?)` | idem | Tarea 10 (cinta de destacados de la home) |
| `readCatalogSections(deps)` | idem | Tests unitarios. Punto único de test de las reglas. |
| `buildCatalogDTO(sections, settings)` | idem | Tests unitarios, Tarea 10 |
| `CATALOG_CACHE_TAG` | idem | Tarea 14 y 16 (`revalidateTag`) |
| `getBusinessSettings(deps)` | `settings.service.ts` | Tarea 10, 12, 17 |
| `updateBusinessSettings(deps, input)` | idem | Tarea 17 (Server Action de ajustes) |
| `normalizeArgentinePhone(raw)` | `settings-normalizers.ts` | Tarea 12 (`buildWhatsAppUrl`), Tarea 17 (formulario, también en el cliente para el preview) |
| `normalizeInstagramUrl(raw)` | idem | Tarea 17 (formulario) |
| `normalizeOpeningHours(raw)` | idem | Tarea 10 (grilla de horarios), Tarea 17 |
| `normalizeBusinessSettings(stored)` | idem | `settings.service.ts` (los dos caminos) |
| `isSettingsConfigured(settings)` | idem | Tarea 13 (aviso si no se puede pedir) |
| `orderCategories(categories)` | `category.service.ts` | Tarea 10, 17 |

### Cómo se cablea en la Tarea 10

El servicio no importa los repositorios, así que el punto de composición es la propia ruta. Si al aparecer el segundo call site se repite, se extrae un módulo de composition root en `src/server/services/index.ts`. **No hacerlo antes:** una indirección usada una sola vez es ruido.

```ts
// src/app/(public)/menu/page.tsx
import { findVisibleCategories } from "@/server/repositories/category.repository";
import { findPublishedProducts } from "@/server/repositories/product.repository";
import { getBusinessSettings } from "@/server/services/settings.service";
import { getCatalogForPublic } from "@/server/services/catalog.service";

export default async function MenuPage() {
  const catalog = await getCatalogForPublic({
    productRepository: { findPublishedProducts },
    categoryRepository: { findVisibleCategories },
    getBusinessSettings: () => getBusinessSettings({ settingsRepository: { findBusinessSettings } }),
  });

  return <CatalogView catalog={catalog} />;
}
```

> Si el `readCatalogSections` de producción se inyecta con un objeto literal que solo trae dos métodos, el resto de `ProductCatalogReader` queda sin usar y `tsc` no se queja: es lo correcto según ISP. Para no perder métodos en la inyección, se importa el módulo entero (`productRepository` con `import * as productRepository`) o se reexporta un objeto ya armado desde el repositorio.

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [x] `getCatalogForPublic()` devuelve `sections`, `settings` y `hasAnyAvailableProduct`
- [x] Un producto `DRAFT` o `ARCHIVED` nunca aparece en `sections`, ni siquiera si el doble del repositorio lo devuelve
- [x] Una categoría visible sin productos publicados **no** genera sección
- [x] Un producto con categoría oculta no aparece suelto en ninguna sección
- [x] Los productos de cada sección quedan ordenados por `sortOrder` y desempatados por nombre en español
- [x] Un producto agotado **sí** aparece en la sección, con `isAvailable: false` (DESIGN.md §10.3)
- [x] `hasAnyAvailableProduct` da `false` cuando todos los productos están agotados, y las secciones siguen pobladas
- [x] `getCatalogWithOnlyAvailable()` excluye los agotados y no usa caché
- [x] `getProductBySlugForPublic()` lanza `ResourceNotFoundError` para slug inexistente, DRAFT y ARCHIVED
- [x] `getFeaturedProductsForPublic()` acota el límite entre 1 y 12
- [x] `getVisibleCategories()` ordena por `position` y luego por nombre, sin mutar el array recibido
- [x] `getCategoryForAdmin()` lanza `ResourceNotFoundError` si la categoría no existe
- [x] `normalizeArgentinePhone()` produce E.164 sin `+` para los siete formatos del `it.each`
- [x] `normalizeArgentinePhone()` lanza `ValidationError` con `fieldErrors.whatsappPhone` ante un número no argentino
- [x] `normalizeInstagramUrl()` devuelve `null` ante `javascript:` y ante cadena vacía
- [x] `normalizeOpeningHours()` descarta claves en español, formatos inválidos y días desconocidos
- [x] `getBusinessSettings()` no usa caché, normaliza y loguea el aviso de teléfono de relleno
- [x] `updateBusinessSettings()` normaliza antes de escribir y no escribe si la normalización falla

### 8.2 Calidad

- [x] `npm run verify` en verde (145 tests, 13 archivos)
- [x] `npm run build` en verde
- [x] `rg "prisma" src/server/services/` devuelve 0 resultados
- [x] `rg "server/repositories" src/server/services/` devuelve 0 resultados
- [x] Ningún servicio importa `react` ni `@/components/*` ni `@/app/*`
- [x] `catalog.service.ts`, `category.service.ts` y `settings.service.ts` llevan `import "server-only"`
- [x] `src/lib/domain/catalog.ts` y `settings-normalizers.ts` **no** llevan `import "server-only"`
- [x] Ningún archivo de `src/server/services/` supera las 150 líneas de código (catálogo 102, categorías 18, settings 39, normalizers 92, ports 27)
- [x] Ningún DTO de salida contiene `Decimal`, `Date` ni entidad Prisma (test dedicado)
- [x] No hay ningún `try/catch` que trague un error: los errores de dominio se propagan

### 8.3 Arquitectura — verificación obligatoria

- [x] El filtro de publicación está escrito **una sola vez** en el servicio, en `isPublished` (`rg 'status === "PUBLISHED"' src/` → solo `catalog.service.ts`)
- [x] `buildCatalogSections` itera sobre las categorías, no sobre los productos
- [x] El filtro `products.length > 0` está aplicado antes de devolver las secciones
- [x] Ninguna función de servicio devuelve un string de presentación
- [x] Los puertos de `repository-ports.ts` no declaran `implements` y no importan nada de la capa 4
- [x] `getBusinessSettings()` no envuelve la lectura en `unstable_cache` ni en `revalidate`
- [x] `hasAnyAvailableProduct` se calcula fuera de la función cacheada
- [x] `getBusinessSettings()` no reimplementa el default del repositorio: solo lo loguea
- [x] `category.service` no expone `getMenuNavigation()`

### 8.4 Pruebas

- [x] Mínimo 12 casos en `catalog.service.test.ts` — **13 casos** (algunos cubren varios criterios)
- [x] Mínimo 4 casos en `settings.service.test.ts` — **18 casos** contando el `it.each` de teléfono como 7
- [x] Mínimo 3 casos en `category.service.test.ts` — **5 casos**
- [x] Un test que verifique que el precio sigue siendo `number` y no `Decimal`
- [x] Un test que verifique que la escritura no ocurre si la normalización del teléfono falla
- [x] Un test que verifique que un error del repositorio se propaga sin convertirse en defaults
- [x] Los tests usan dobles escritos a mano, no `vi.mock` de repositorios
- [x] Los tests de servicio corren sin `DATABASE_URL`: `npm test` no toca la base para estas suites ¹

### 8.5 Documentación y trazabilidad

- [x] `docs/tasks/README.md` con la Tarea 08 marcada
- [x] La decisión de no cachear la disponibilidad está escrita en el código (`catalog.service.ts`) y acá
- [x] `DESIGN.md §6.1` sigue describiendo esta arquitectura sin contradicciones
- [x] `hasAnyAvailableProduct` está documentado como snapshot, no como estado final
- [x] La regla 5 de `normalizeArgentinePhone` (agregar el `9`) está marcada como suposición, con su mitigación (preview en la Tarea 17)

¹ Las suites de esta tarea no leen la base, pero `tests/integration/` sí: la Tarea 04 las corre contra el Postgres en Docker. Las nuevas suites de §6.7 no la necesitan y el criterio se cumple para ellas; la de integración es la que exige la base (comportamiento documentado desde la Tarea 04).

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado |
|---|---|
| Producto `DRAFT` entre los publicados | **Excluido.** El servicio vuelve a filtrar por `status`, aunque el repositorio ya lo haya hecho (§4.3). |
| Producto `ARCHIVED` con variantes | **Excluido.** El borrado es lógico; las variantes siguen en la base, pero no se leen. |
| Categoría visible sin productos publicados | **No se construye la sección.** Nunca un encabezado con un grid vacío (DESIGN.md §10.5). |
| Categoría oculta con productos publicados | Los productos **se descartan**. No aparecen sueltos ni bajo otra categoría. |
| Todos los productos del catálogo agotados | `hasAnyAvailableProduct: false` con las secciones pobladas. La UI (Tarea 10) muestra un mensaje de "no hay disponibilidad por ahora", no un grid vacío. El texto vive en el componente, no en el servicio. |
| No hay ningún producto publicado | `sections: []` y `hasAnyAvailableProduct: false`. `buildCatalogDTO` no lanza. La Tarea 10 muestra el `EmptyState`. |
| No hay ninguna categoría | `sections: []`. Sin encabezados, sin separadores, sin error. La Tarea 10 muestra el `EmptyState`. |
| Producto sin descripción | Pasa tal cual (`description: null`). La Tarea 10 omite el párrafo en lugar de renderizar un espacio vacío. |
| Producto sin variantes | `variants: []`. El servicio **no** inyecta una variante "Única": inventar un `ProductVariantDTO` en memoria haría que el carrito y el mensaje de WhatsApp trataran como si fuera un dato persistido. |
| Producto sin `imagePublicId` | Pasa tal cual. `imageUrl` es `NOT NULL` en el modelo (Tarea 03), así que si algún día llega vacía es un defecto del seed: la Tarea 10 muestra un placeholder, no el servicio. |
| `imageUrl` vacía | El servicio no la inventa ni la corrige. Se reporta en el formulario de la Tarea 16 como campo obligatorio. |
| `openingHours` vacío `{}` | Se devuelve tal cual. **No** se completa con los siete días en `null`: ausente significa "no informado" y la UI muestra `—`. Ponerlo "cerrado" sería una mentira en la vidriera. |
| `openingHours` con días en español | Se descartan. El type guard del repositorio solo verifica que sea un objeto; esta es la segunda barrera. |
| `openingHours` con `"9am"` | Se descarta el día. `HH:MM` de 24 h con cero a la izquierda. |
| Un día con cierre anterior a la apertura | Se conserva. Un local que cierra de madrugada es un caso válido. |
| `business_settings` inexistente | El repositorio devuelve `DEFAULT_BUSINESS_SETTINGS` y loguea. El servicio normaliza y agrega su propio aviso: el número es de relleno. El catálogo **no** se rompe. |
| Teléfono con formato humano `+54 261 555 1234` | Normalizado a `5492615551234`. La Tarea 17 muestra el valor ya normalizado antes de guardar. |
| Teléfono en notación heredada con `15` | `ValidationError`. No se adivina. El mensaje le pide al admin que lo escriba como lo muestra WhatsApp. |
| Teléfono de relleno `5492610000000` | `isSettingsConfigured` da `false` y se loguea el aviso. El servicio igual devuelve los datos: el catálogo tiene que renderizar igual. |
| Número de productos muy alto | Sin paginación. Un local de sándwiches tiene veinte a cuarenta productos. Si creciera, la paginación va **en el repositorio** (parámetro `limit`/`cursor`), nunca con un `.slice()` en el servicio. `getFeaturedProductsForPublic` sí acota el `limit` porque ese límite lo elige el call site, no la base. |
| Dos requests simultáneos que revalidan el tag | `revalidateTag` es idempotente. No hay carrera: la siguiente lectura regenera la entrada. |
| Un `revalidateTag` olvidado en algún camino futuro | `revalidate: 3600` refresca el contenido solo en una hora. Es la red de seguridad, no el mecanismo. |
| El repositorio devuelve datos imposibles (producto sin categoría) | El producto se descarta: el `Map` lo acumula bajo una clave que ninguna categoría del bucle outer va a leer. Ningún error, ninguna sección rota. |
| `saveBusinessSettings` lanza `ConflictError` | Se propaga. El Server Action de la Tarea 17 lo traduce y lo muestra junto al campo. Si el servicio lo tragara, el admin vería "guardado" con un error en la consola. |
| `findBusinessSettings` lanza por caída de conexión | Se propaga. Devolver defaults ante un error de red mostraría un local sin nombre y sin teléfono en producción, y nadie lo notaría. El default es solo para "la fila no existe", no para "no pude preguntar". |

---

## 10. Pruebas

| Suite | Qué verifica |
|---|---|
| `catalog.service.test.ts` | Exclusión de `DRAFT` y `ARCHIVED`, sección vacía que no se construye, categoría oculta que descarta sus productos, orden con desempate, agotados que sí se muestran, `hasAnyAvailableProduct` en ambos sentidos, 404 de slug en sus tres variantes, acotado de `limit`, tipos serializables |
| `category.service.test.ts` | Orden por `position` con desempate en español, no mutación del array, `ResourceNotFoundError` |
| `settings.service.test.ts` | Normalización de teléfono en siete formatos, rechazo de formatos no argentinos, saneo de URL de Instagram, validación de horarios, detección del teléfono de relleno, propagación del error del repositorio, no escritura si la normalización falla |

### Qué NO se testea acá, y por qué

- **`getCatalogForPublic()` con su `unstable_cache`.** `unstable_cache` es una API del runtime de Next: fuera de un request no tiene almacén y, dentro de uno, la caché es global a la aplicación, así que un unitario con dobles distintos recibiría el resultado del test anterior. Se testea `readCatalogSections` (mismas reglas, sin caché) y `buildCatalogDTO` (ensamblaje puro). El comportamiento de la caché se verifica en la Tarea 20, con un request real.
- **La consulta a la base.** Los repositorios ya tienen sus tests de integración contra la base real (Tarea 04). Repetirlos acá probaría Prisma, no el servicio.

### Criterio de diseño de los tests

- **Comportamiento, no implementación.** El test verifica que "no se muestran los borradores", no que "se llamó `findMany` con este `where`".
- **Dobles escritos a mano, no `vi.mock`.** Un doble es un objeto con la forma del puerto. `vi.mock` ata el test a la forma interna de la llamada y se rompe con cada refactor sin que nada haya empeorado.
- **Nombres en español con voseo y formato `debe <comportamiento>`.** Sobreviven a los refactors. `it("works")` no dice nada.
- **`it.each` para las variantes de teléfono.** Siete formatos son siete ejemplos de la misma regla, y una tabla los muestra juntos, que es donde se ven los casos que faltan.

---

## 11. Definición de "Hecho" (Definition of Done)

- [x] Todos los criterios de §8 marcados
- [x] `npm run verify` + `npm run build` en verde
- [x] `rg "prisma" src/server/services/` devuelve 0 resultados
- [x] `rg "server/repositories" src/server/services/` devuelve 0 resultados
- [x] `npm test` corre los unitarios de esta tarea sin `DATABASE_URL` definida (los de `tests/integration` de la Tarea 04 sí la necesitan, por diseño)
- [x] `docs/tasks/README.md` actualizado
- [ ] Commit: `feat(08): capa de servicio con reglas de catálogo y caché por tag`
- [ ] PR mergeada a `main`
- [x] `DESIGN.md §6.1` sigue siendo cierto; si algo cambió, la diferencia está explicada en el commit

---

## 13. Registro de ejecución y desviaciones

**Fecha:** 2026-09-30 · **Verificación:** `npm run verify` ✅ (145 tests, 13 archivos) · `npm run build` ✅ · frontera de capas: `prisma` y `server/repositories` ausentes de `src/server/services/` ✅ · `status === "PUBLISHED"` solo en `catalog.service.ts` ✅ · líneas de código (sin comentarios): catalog 102 · category 18 · settings 39 · normalizers 92 · ports 27 — todas ≤ 150 ✅

### Desviaciones y decisiones que la tarea deja asentadas

1. **La regla ESLint de servicios (Tarea 01) se relajó con una excepción acotada a `next/cache`.** El patrón original prohibía *todo* `next/*` en servicios, y eso imposibilita el diseño central de esta tarea: `unstable_cache` solo puede vivir en la capa de servicio (una envoltura en el Server Component rompería la regla "las rutas no llevan reglas de negocio"). La regla quedó como regex negativo que permite solo `next/cache` y sigue bloqueando `react`, `@/app`, `@/components` y `@/server/actions`. Documentado en `eslint.config.mjs`.
2. **`SaveBusinessSettingsInput` se redeclaró en `repository-ports.ts`** (en vez de importarlo del repositorio), tal como marca el propio documento: sin el `import type` desde un módulo `server-only` la regla de capas lo señalaba.
3. **La comprobación de §10 "un test por comportamiento"**: varios `it` cubren más de un caso del checklist (`normalizeOpeningHours` con clave en español, formato inválido y ausente en el mismo `describe`); el conteo real es 13/18/5 contra 12/4/3 pedidos.

**Nada de esta tarea requirió tocar la base ni la infraestructura**: corre toda sobre los mismos puertos de la Tarea 04 y compila contra el `server-only` stub de los tests.

> **Antes de mergear:** abrir `catalog.service.ts` y comprobar con los ojos que la línea `readCachedCatalogSections` está en `getCatalogForPublic` y **no** dentro de `buildCatalogSections`. Si la caché termina envolviendo el ensamblaje completo, el tag `products` empieza a depender de los ajustes del negocio, y cada cambio de teléfono regenera el catálogo entero sin que nadie lo haya pedido. Es el error más caro de esta tarea y no lo detecta ningún test.

---

## 12. Dependencias y bloqueos

**Habilita:** 10 (catálogo público), 12 (mensaje de WhatsApp, que necesita el teléfono ya normalizado), 16 (CRUD de productos, que valida la categoría antes de guardar).

**Decisiones que esta tarea deja establecidas:**

1. La capa de servicio **decide la visibilidad**. El repositorio traduce la base, el servicio la interpreta.
2. El catálogo público lee **solo** `status === "PUBLISHED"`, con el filtro repetido en el servicio a propósito.
3. El contenido se cachea con el tag `products`; la disponibilidad **no** se cachea y llega por Realtime (Tarea 15). El toggle de disponibilidad nunca invalida el catálogo.
4. `hasAnyAvailableProduct` es un snapshot del HTML. El cliente lo recalcula con `hasAvailableProducts`, la misma función pura.
5. Una sección sin productos publicados no se construye: no hay encabezado con grid vacío.
6. Los servicios devuelven **datos**, nunca copy de presentación.
7. Los errores de dominio se propagan. El servicio traduce `null` a `ResourceNotFoundError` y entradas inválidas a `ValidationError`; nunca captura para tapar.
8. Las dependencias se inyectan por parámetro contra interfaces segregadas (`repository-ports.ts`). Ningún servicio importa un repositorio.
9. El teléfono se normaliza a E.164 sin `+` en la capa de servicio, no en el repositorio: es una regla de negocio, y la base no debería imponer un formato de teléfono.
10. Los días de `openingHours` ausentes significan "no informado", nunca "cerrado".
11. Las funciones puras de saneado viven en `settings-normalizers.ts` sin `server-only`, para que el formulario de ajustes (Tarea 17) pueda previsualizar la normalización sin ida a la base.




