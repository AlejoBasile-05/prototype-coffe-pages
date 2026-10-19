# Tarea 18 — SEO y Metadatos

| Campo | Valor |
|---|---|
| **ID** | 18 |
| **Fase (DESIGN.md §8.7)** | Fase 5 — Pulido, Seguridad y Deploy a Producción |
| **Depende de** | 10, 08, 06, 17 |
| **Habilita** | 21 |
| **Tipo** | Presentación |
| **Esfuerzo est.** | 2 – 3 días |

---

## 1. Objetivo de la tarea

Que el menú de Mi Negocio se pueda encontrar y, sobre todo, que **se vea bien cuando alguien comparte un link por WhatsApp**. Eso significa: `sitemap.xml` con lo que tiene que estar y nada más, `robots.txt` que no invite a los buscadores a `/admin`, datos estructurados de `Restaurant` con los datos reales del local, y una imagen de Open Graph de 1200×630 en la vista previa.

**Criterio de éxito verificable:** pegar el link de `/producto/jamon-y-queso-clasico` en un chat de WhatsApp muestra la foto del sándwich, el nombre, el precio y "Mi Negocio · San Rafael"; `/sitemap.xml` lista la home, el menú y los productos publicados, y no lista ni un borrador; `/robots.txt` dice `Disallow: /admin`.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 10 (catálogo público, `metadata` del layout, `generateMetadata` de la ficha), Tarea 08 (servicios, `CATALOG_CACHE_TAG`, DTOs), Tarea 17 (datos reales del negocio en `business_settings`).

### 2.1 Qué está hecho y qué falta

| Pieza | Estado | Dónde |
|---|---|---|
| `metadataBase`, título con template, `openGraph.siteName` | **Hecho** | `(public)/layout.tsx` (Tarea 10) |
| `title` y `description` de `/menu` | **Hecho** | `(public)/menu/page.tsx` (Tarea 10) |
| `generateMetadata` de la ficha con `canonical` y la foto del producto | **Hecho** | `(public)/producto/[slug]/page.tsx` (Tarea 10) |
| `twitter` card en cualquier lado | **Falta** | esta tarea |
| `sitemap.xml` | **Falta** | esta tarea |
| `robots.txt` | **Falta** | esta tarea |
| JSON-LD `Restaurant` | **Falta** | esta tarea |
| JSON-LD `Product` en la ficha | **Falta** | esta tarea |
| Imagen OG del sitio | **Falta** | esta tarea |
| `alternates.canonical` en la home | **Falta** | esta tarea |

La ficha de producto ya pasa la foto del producto a `openGraph.images`, así que **el caso más importante de WhatsApp ya funciona**. Esta tarea no lo arregla: lo completa con la tarjeta de Twitter, con las dimensiones y el texto alternativo, y pone la imagen de respaldo para las páginas que no tienen foto propia.

### 2.2 Por qué WhatsApp importa más que Google para este negocio

No es una preferencia: es el modelo de la Tarea 00. No hay pagos online, no hay cuenta, no hay carrito guardado. El pedido se cierra en un chat de WhatsApp, y el primer contacto con el menú es un link pegado en ese chat.

La consecuencia técnica es que `og:image` no es un detalle de SEO: es la única foto que el cliente ve antes de entrar. Si viene vacía, WhatsApp muestra un rectángulo gris con el link pelado, y el cliente no entra. Por eso la imagen del producto entra en `openGraph.images` y por eso la imagen de respaldo del sitio existe.

`sitemap.xml` sigue valiendo la pena, pero por el motivo que corresponde: alta manual en Google Business y en el buscador de Maps cuando alguien busca "cafetería en San Rafael". No es tráfico orgánico.

### 2.3 El problema del `lastModified`, y por qué no se resuelve poniendo `updatedAt` en el DTO

`MetadataRoute.Sitemap` acepta `lastModified` en cada entrada, y es lo que Google usa para decidir si una página cambió. `ProductDTO` **no expone `updatedAt`**, y agregarlo "sólo para el sitemap" tiene tres efectos:

1. `ProductDTO` es el contrato de veinte campos que consumen el catálogo, el carrito, la ficha y el panel. Un campo que nadie usa ahí ensucia la lectura de todos.
2. `updatedAt` en el DTO invites a usarlo para otras cosas: "ordená por última modificación", "mostrar cuándo se actualizó el precio". Cada una es una decisión de producto que nadie pidió.
3. El sitemap no necesita veinte columnas por producto: necesita dos.

La solución es una función de repositorio con proyección angosta, y no es una excepción a la capa de datos:

```ts
// ⛔ Sigue siendo Prisma, sigueviviendo en la capa 4, y sigue sin que
//    ningún otro consumidor pueda pedir `updatedAt` por accidente. La
//    proyección existe para que el costo de leer la columna lo pague
//    el único que la necesita.
```

### 2.4 `metadataBase` es la base de todas las URLs absolutas

`metadataBase` está en el layout público de la Tarea 10 y sale de `SITE_URL`, que es `process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"`.

Dos problemas que aparecen después:

- **La barra final.** `new URL("https://modo-miga.com.ar/")` y `new URL("https://modo-miga.com.ar")` son la misma URL para `URL`, pero al concatenar a mano `"https://modo-miga.com.ar" + "/menu"` sale una barra doble que algunos buscadores normalizan y otros no. Por eso hay un `absoluteUrl` propio en `src/lib/domain/seo.ts`.
- **El fallback silencioso.** En producción, si `NEXT_PUBLIC_SITE_URL` falta, el sitio entero funciona y el sitemap announces URLs de `localhost`. Google indexa `localhost` y el menú desaparece de los resultados durante meses. Por eso `site.ts` avisa por `console.warn` cuando el fallback se usa en producción, y el aviso dice exactamente qué variable falta.

### 2.5 Qué bloquea `robots.txt` y por qué

| Ruta | `Disallow` | Razón |
|---|---|---|
| `/admin` | Sí | Panel privado. Que un buscador lo indexe publica el nombre de la marca en una URL que nadie debe ver |
| `/login` | Sí | Es un formulario de sesión. Una URL indexada es una invitación a un ataque de fuerza bruta sobre una ruta conocida |
| `/api` | Sí | Devuelve JSON, no páginas. No aporta nada al índice y expone rutas internas |
| `/checkout` | Sí | Flujo sin valor de búsqueda: no se busca "mi checkout de Mi Negocio". Además la Tarea 13 manda datos del cliente en el flujo, y no hay razón para que eso quede en un índice |
| `/checkout/exito` | Sí | Mismo motivo: pantalla de confirmación con datos del cliente |

`Sitemap:` se declara con la URL **absoluta** y sin barra final. Un `Sitemap: /sitemap.xml` relativo es ignorado por la mayoría de los rastreadores, sin error ni aviso.

### 2.6 Por qué no hay un `opengraph-image.tsx` por producto

La convención de archivos de Next (`opengraph-image.tsx` dentro de un segmento) genera una imagen en el servidor con `ImageResponse` en cada request de un rastreador o un crawler de redes. Para un catálogo de treinta productos, eso significa:

1. Una función de render de imagen por producto, con su propio `runtime`, su memoria y su punto de falla.
2. Una dependencia de la red de Cloudinary en tiempo de render: si Cloudinary está lento, el preview del link también.
3. Una segunda fuente de verdad para la imagen: el `generateMetadata` de la ficha **y** el archivo de imagen del segmento, con dos formas de declarar lo mismo.

La alternativa que se elige: la URL transformada de Cloudinary en `generateMetadata`, que es una URL estática que cualquier crawler puede pedir sin tocar nuestro servidor, y un único `opengraph-image.tsx` a nivel de `(public)` como imagen de respaldo para la home y el menú.

**Esto se verifica en el build**: si algún día alguien agrega `src/app/(public)/producto/[slug]/opengraph-image.tsx`, el criterio 8.3 falla. No es una preferencia de estilo: es la razón por la que el criterio existe.

### 2.7 El JSON-LD es la excepción única a `dangerouslySetInnerHTML`

El contexto compartido §18 prohíbe `dangerouslySetInnerHTML`. Los datos estructurados de schema.org **no** tienen otra forma de emitirse en App Router: un `<script type="application/ld+json">` tiene que contener el JSON crudo.

Lo que convierte el riesgo en algo manejable son tres reglas, y las tres se verifican en los criterios:

1. **El JSON se arma en un módulo puro** (`src/lib/domain/schema-org.ts`), sin React y sin `dangerouslySetInnerHTML`. La función devuelve un objeto; el componente lo serializa.
2. **Se escapan los `<` como `\u003c` antes de interpolar.** Un producto cuyo nombre sea `<script>alert(1)</script>` cierra el tag del `script` que contiene el JSON-LD y ejecuta código. Con el escape, el contenido queda como texto y el motor de datos estructurados lo lee como cadena. El escape va en `serializeJsonLd`, no en el componente: el módulo puro es el único lugar donde se serializa algo a JSON.
3. **El componente no acepta props libres.** Recibe un `JsonLdRestaurant` o un `JsonLdProduct` ya construido por el módulo puro. Que la prop sea `object` no significa que cualquiera pueda pasarle cualquier cosa: el único lugar donde se arma el objeto es `src/lib/domain/schema-org.ts`, y ese módulo decide qué campos salen.

### 2.8 Checklist de prerrequisitos

- [ ] Tarea 10: `(public)/layout.tsx` con `metadataBase` y el template de título
- [ ] Tarea 10: `generateMetadata` en la ficha de producto
- [ ] Tarea 10: `src/config/site.ts` con `SITE_URL`, `SITE_NAME`, `SITE_DESCRIPTION`
- [ ] Tarea 08: `CATALOG_CACHE_TAG` y `getBusinessSettings`
- [ ] Tarea 17: `business_settings` con nombre, dirección, horarios e Instagram cargados
- [ ] Tarea 06: `buildCloudinaryImageUrl` para la transformación 1200×630
- [ ] `next.config.ts` con `images.remotePatterns` para `res.cloudinary.com`
- [ ] `NEXT_PUBLIC_SITE_URL` con el dominio real, también en los previews

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `src/lib/domain/seo.ts` | Tipos del sitemap y del JSON-LD, más `absoluteUrl`. Puro, sin I/O |
| `src/lib/domain/schema-org.ts` | Constructores puros de `Restaurant` y `Product`, y el serializador con escape |
| `src/server/services/seo.service.ts` | Entradas del sitemap con `unstable_cache` y el tag `products` |
| `src/app/sitemap.ts` | `MetadataRoute.Sitemap` |
| `src/app/robots.ts` | `MetadataRoute.Robots` |
| `src/components/catalog/JsonLd.tsx` | Server Component que inserta el `<script type="application/ld+json">` |
| `src/app/(public)/opengraph-image.tsx` | Imagen OG de respaldo del sitio, 1200×630 |
| `src/config/seo.ts` | Constantes de SEO: rutas bloqueadas, prioridades, frecuencias |
| `tests/unit/schema-org.test.ts` | Constructores, escape del `<` y omisiones de campos vacíos |
| `tests/unit/seo-url.test.ts` | `absoluteUrl` con barra final, sin barra y con ruta ya absoluta |
| `tests/unit/seo.service.test.ts` | El sitemap sale del tag `products` y sólo trae publicados |
| Ningún `utils.ts` ni `helpers.ts` | No se crean archivos de cajón |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `src/server/repositories/product.repository.ts` | Agregar `findPublishedProductsForSitemap()` con proyección angosta (§2.3) |
| `src/server/services/repository-ports.ts` | Agregar `ProductSitemapReader` |
| `src/server/services/index.ts` | Cablear `getSeoDependencies()` |
| `src/config/site.ts` | Aviso por `console.warn` si `SITE_URL` cae al fallback en producción (§2.4) |
| `src/app/(public)/layout.tsx` | `twitter` card, `alternates.canonical` y el `Restaurant` en JSON-LD |
| `src/app/(public)/page.tsx` | `alternates.canonical: "/"` |
| `src/app/(public)/menu/page.tsx` | `alternates.canonical: "/menu"` |
| `src/app/(public)/producto/[slug]/page.tsx` | `twitter`, imagen OG con dimensiones y `alt`, `Product` en JSON-LD, canonical absoluto |
| `vitest.config.ts` | Nada nuevo: el patrón `src/**/*.test.ts` ya está (§3.4 de la Tarea 17) |
| `docs/tasks/README.md` | Marcar la Tarea 18 |

### 3.3 Eliminar

Ninguno. `public/og-image.png` que menciona `DESIGN.md` §7 **no** se crea: la imagen OG es dinámica, y un archivo estático en `public/` la taparía. La constante de la ruta en `next.config.ts` no cambia.

### 3.4 Lo que esta tarea no va a agregar

- **Ninguna dependencia.** `next/og` viene con Next. No hace falta `next-sitemap`, ni `schema-dts`, ni un validador de JSON-LD.
- **Ningún archivo de `robots.txt` o `sitemap.xml` en `public/`.** Los dos se generan. Un archivo estático en `public/` gana al route handler de Next y el sitio queda con reglas viejas que nadie recuerda.
- **Ninguna analítica.** Es la Tarea 21 y `DESIGN.md` §16, y una analítica mal configurada manda datos personales a un tercero sin que nadie lo decida.

---

## 4. Estructura N-Capas

### 4.1 Qué vive en esta capa

| Ubicación | Qué va | Qué NO va |
|---|---|---|
| `src/lib/domain/seo.ts` | Tipos del sitemap y `absoluteUrl`. Una función pura | React, Next, `Date.now()` implícito |
| `src/lib/domain/schema-org.ts` | Constructores de `Restaurant` y `Product`, y el serializador con escape | I/O, React, `dangerouslySetInnerHTML` |
| `src/server/services/seo.service.ts` | Ensamblar las entradas del sitemap y cachearlas con el tag `products` | React, Prisma, `MetadataRoute` |
| `src/app/sitemap.ts`, `src/app/robots.ts` | Traducir el servicio y las constantes al tipo que Next espera | Reglas de negocio. Decidir qué entra al sitemap |
| `src/components/catalog/JsonLd.tsx` | Un `<script>` y nada más | Imports de `@/server/**`. Aceptar objetos arbitrarios por props |

**El sitemap no es un route handler cualquiera.** `src/app/sitemap.ts` es un archivo de metadata: Next lo ejecuta como un route handler en el servidor, y por eso entra en la regla de ESLint de `src/app/**` y **no** puede importar un repositorio. Delega en el servicio igual que una página.

### 4.2 El flujo completo de los datos estructurados

```
(app)/layout.tsx  ──► getBusinessSettings()          (servicio, sin caché)
        │
        ├─► buildCloudinaryImageUrl(og, 1200×630)   (servicio de imágenes)
        │
        └─► buildRestaurantJsonLd({ settings, siteUrl, imageUrl })   (lib, puro)
                        │
                        ▼
                 <JsonLd data={restaurant} />       (Server Component)
                        │
                        ▼
             serializeJsonLd() escapa "<" y el componente
             escribe <script type="application/ld+json">
```

Dos propiedades de este flujo que hay que respetar:

- **La capa pura no sabe nada de Next.** `buildRestaurantJsonLd` no importa `next`, ni `ImageResponse`, ni `SITE_URL`: recibe el `siteUrl` ya resuelto como string. Por eso se testea en `environment: "node"` sin nada mockeado.
- **El componente no puede inventar datos.** `JsonLd` recibe el objeto ya armado. Si mañana alguien pasa un objeto crudo desde un Server Component, el módulo puro es el que decide qué campos entran, y los tests de §10.1 cubren esa decisión.

### 4.3 Dónde se decide qué se indexa

| Decisión | Dónde | Por qué |
|---|---|---|
| Qué productos entran al sitemap | La query `status: "PUBLISHED"` del repositorio | Filtrar en JavaScript después de traer la tabla entera es la forma más fácil de que un borrador se cuelgue en el sitemap |
| Qué rutas se bloquean | `src/config/seo.ts` | Es configuración del sitio, no una regla de negocio |
| Prioridad y frecuencia de cada ruta | `src/config/seo.ts` | Un número mágico escrito en el `sitemap.ts` no se puede discutir ni cambiar sin abrir el route handler |
| Qué se publica en el JSON-LD | `src/lib/domain/schema-org.ts` | Los campos vacíos se **omiten**, no se mandan como `""` ni como `null` |

### 4.4 Reparto específico

| Necesidad | Dónde vive | Razón |
|---|---|---|
| URL absoluta sin barra doble | `src/lib/domain/seo.ts` | Es una regla de forma de URL, y la usan el sitemap, los canonicals y el JSON-LD |
| Forma del `Restaurant` | `src/lib/domain/schema-org.ts` | Es un contrato con un estándar externo (schema.org), no con un usuario |
| Días de la semana en schema.org | idem, mapeo local | `monday` → `https://schema.org/Monday`. El mapeo es de tres líneas y no merece un archivo |
| Proyección angosta de producto | `product.repository.ts` | Prisma, y sólo Prisma, lee `updatedAt` (§2.3) |
| Ensamblado del sitemap | `seo.service.ts` | Une repositorio, caché y configuración en un solo lugar testeable |
| El `<script>` | `JsonLd.tsx` | Es el único punto del proyecto con `dangerouslySetInnerHTML`, y por eso está solo |

---

## 5. Convenciones de código (Clean Code + SOLID)

### 5.1 Los campos vacíos se omiten, no se mandan

Un `Restaurant` con `"address": null` o `"openingHoursSpecification": []` es peor que un `Restaurant` sin el campo. Google ignora las claves con valor vacío y algunos validadores los marcan como error.

Por eso los constructores arman el objeto **por partes**:

```ts
// ⛔ Patrón de todo el archivo: el spread condicional, y NADA de
//    `campo: valor ?? ""` ni de `campo: valor ?? null`.
const horarios = buildOpeningHours(settings);

return {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: settings.name,
  url: absoluteUrl("/", input.siteUrl),
  image: input.imageUrl,
  telephone: `+${settings.whatsappPhone}`,
  address: {
    "@type": "PostalAddress",
    streetAddress: settings.address,
    addressLocality: input.locality,
    addressRegion: input.region,
    addressCountry: input.country,
  },
  sameAs: [settings.instagramUrl],
  // ⛔ Sin horarios cargados, la clave **no existe**. No es `[]`.
  ...(horarios.length === 0 ? {} : { openingHoursSpecification: horarios }),
  servesCuisine: "Sándwiches de miga",
  menu,
  hasMenu: menu,
};
```

En el `Product` el mismo patrón aparece con la descripción, que sí es opcional:

```ts
  ...(product.description === null ? {} : { description: product.description }),
```

Tres porqués de esta forma y no la alternativa obvia:

- **Un objeto con `undefined` en una clave no es lo mismo que un objeto sin la clave.** `JSON.stringify` omite las `undefined`, así que `description: undefined` funciona por accidente. El problema aparece cuando el objeto se inspecciona antes de serializar, y también cuando el test compara con `toEqual`, que distingue `{ a: 1 }` de `{ a: 1, b: undefined }`.
- **`?? ""` mete una cadena vacía donde el estándar espera un texto real.** `description: ""` es peor que la clave ausente: el validador lo acepta y el buscador indexa una descripción vacía.
- **El objeto se devuelve como literal, con el tipo declarado.** Si un campo obligatorio falta, el typecheck lo dice en la línea del `return`, y no tres versiones más abajo cuando algo lo lee.

Cada campo opcional se agrega sólo si tiene contenido. El resultado es un objeto sin claves vacías, y esa es la forma que un validador de schema.org acepta.

### 5.2 `telephone` lleva `+` y `whatsappPhone` no

`BusinessSettingsDTO.whatsappPhone` está en E.164 **sin** `+` porque así lo exige `wa.me` (Tarea 08 §6.3). schema.org espera E.164 **con** `+`.

Son dos formatos del mismo número en dos destinos distintos, y por eso la conversión va en el constructor, en una línea, con un comentario: si el `+` se agrega en el DTO, se rompe `wa.me`; si no se agrega en el JSON-LD, el buscador no reconoce el teléfono como argentino.

### 5.3 Un día "cerrado" no se publica

`OpeningHours` distingue ausente de `null` (Tarea 17 §5.7). En el JSON-LD, un día cerrado **se omite**: `openingHoursSpecification` describe las franjas en las que se está abierto, y publicar un lunes como "cerrado" requiere un `opens`/`closes` que el local no definió.

La consequence que conviene tener presente: si el local carga sólo sábado, el JSON-LD declara un `Restaurant` abierto sólo el sábado, y Google puede mostrar "Abierto sólo el sábado" aunque en realidad abre todos los días y no los cargó. Es información honesta de los datos que hay, y la alternativa --publicar los otros seis como abiertos-- sería inventar. Queda anotado en §9.

### 5.4 `lastModified` es la fecha de la fila, no la de hoy

`lastModified` sale de `products.updatedAt`. No se usa `new Date()`, que pondría la fecha de generación del sitemap y haría que Google retrae todas las URLs en cada generación, gastando presupuesto de rastreo sin motivo.

La home y el menú sí usan la fecha de la última modificación de la fila de ajustes, que para la home es la fecha real del último cambio de contenido del local.

### 5.5 El `canonical` es absoluto en la ficha y relativo en las fijas

`metadataBase` resuelve las rutas relativas a `openGraph.url` y a `alternates.canonical`, así que `canonical: "/menu"` funciona. En la ficha de producto el `canonical` se escribe con `absoluteUrl(...)` porque ahí conviven la URL del producto y la URL de su imagen, que **no** es relativa y sí tiene que llevar el dominio de Cloudinary intacto.

Mezclarlos —`${SITE_URL}${SITE_URL}/producto/...`— es el error más fácil de cometer al tocar esa página, y por eso la construcción pasa por `absoluteUrl` y no por concatenación.

### 5.6 Nombres

| Elemento | Nombre | Razón |
|---|---|---|
| Servicio | `seo.service.ts` con `getSitemapEntries` y `readSitemapEntries` | `get*` devuelve, `read*` es la versión sin caché que se testea (patrón de la Tarea 08) |
| Constructores | `buildRestaurantJsonLd`, `buildProductJsonLd`, `serializeJsonLd` | `build*` es el verbo del proyecto para funciones puras que arman un valor |
| Componente | `JsonLd` | Sin sufijo: es lo único que hace y el nombre del estándar lo dice |
| Puerto | `ProductSitemapReader` | Dice qué lee: productos para el sitemap, no "productos" a secas |
| Función de URL | `absoluteUrl(path, siteUrl)` | El `siteUrl` va **explícito** y no leído de `process.env`, para que sea testeable sin entorno |
| Constantes | `ROBOTS_DISALLOWED`, `SITEMAP_HOME`, `SITEMAP_MENU` | `SCREAMING_SNAKE`, y `SITEMAP_*` agrupa las del sitemap |

### 5.7 Límites de tamaño

| Archivo | Tope | Razón |
|---|---|---|
| `schema-org.ts` | 180 líneas | Dos constructores y el serializador. Si se pasa, se parte por tipo: `restaurant-json-ld.ts` y `product-json-ld.ts` |
| `seo.service.ts` | 150 líneas | Ensamblado y caché. Debería quedar en cien |
| `seo.ts` | 80 líneas | Tipos y una función |
| `JsonLd.tsx` | 40 líneas | Un tag y un escape. Si crece, está haciendo algo que no le corresponde |
| `opengraph-image.tsx` | 120 líneas | Layout de `ImageResponse` |

---

## 6. Pasos de implementación

### 6.1 Tipos y URL absoluta

```ts
// src/lib/domain/seo.ts

/**
 * Tipos del sitemap y construcción de URLs absolutas.
 *
 * ⛔ Capa 0: sin React, sin Next, sin `process.env`. El `siteUrl` entra
 *    como argumento justamente para que estas funciones sean testeables
 *    sin entorno y para que nadie las use leyendo una variable global.
 */

/** Es el vocabulario que acepta `MetadataRoute.Sitemap`. */
export type SitemapChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export interface SitemapEntry {
  /** Ruta con barra inicial: `"/"`, `"/menu"`, `"/producto/x"`. */
  readonly path: string;
  readonly lastModified: Date;
  readonly changeFrequency: SitemapChangeFrequency;
  readonly priority: number;
}

/**
 * Lo único que el sitemap necesita de un producto.
 *
 * ⛔ Existe para que `ProductDTO` no crezca con un `updatedAt` que nadie
 *    más usa. Ver §2.3.
 */
export interface SitemapProductRecord {
  readonly slug: string;
  readonly updatedAt: Date;
}

/**
 * URL absoluta a partir de una ruta del sitio.
 *
 * Hace tres cosas que la concatenación no hace:
 *   1. Saca la barra final del `siteUrl`, para no producir `//menu`.
 *   2. Devuelve la ruta sin tocar si ya es absoluta. Sirve para las URLs
 *      de Cloudinary, que son de otro host y no admiten el prefijo.
 *   3. Mantiene la barra inicial cuando la ruta es `"/"`, que es la home
 *      y no puede ser `https://dominio` pelado.
 */
export const absoluteUrl = (path: string, siteUrl: string): string => {
  const base = siteUrl.replace(/\/+$/, "");

  if (/^https?:\/\//i.test(path)) return path;
  if (path === "" || path === "/") return `${base}/`;

  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};
```

### 6.2 El aviso de `SITE_URL`

```ts
// src/config/site.ts (reemplazar la constante SITE_URL por este bloque)
const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const isProduction = process.env.NODE_ENV === "production";

/**
 * ⛔ Aviso, no error. Un build sin `NEXT_PUBLIC_SITE_URL` tiene que
 *    seguir funcionando: el de los previews de Vercel y el de CI no la
 *    tienen, y reventar el build por eso apagaría la integración.
 *
 * Lo que sí sería grave es que en producción caiga al fallback: el
 *    sitemap anunciaría URLs de `localhost` y Google indexaría eso
 *    durante meses. Por eso el aviso dice exactamente qué variable
 *    falta, en el log del deploy.
 */
if (isProduction && rawSiteUrl === "") {
  console.warn(
    "[seo] NEXT_PUBLIC_SITE_URL no está definida. El sitemap y los canonicals van a apuntar a localhost.",
  );
}

export const SITE_URL = rawSiteUrl === "" ? "http://localhost:3000" : rawSiteUrl;
```

El nombre y la descripción también necesitan una corrección, y no es de esta tarea pero esta tarea la destapa: `SITE_NAME` dice **"Café Ruta"** desde la Tarea 10 y el negocio se llama **Mi Negocio** (Tarea 00). Está en el título de todas las pestañas, en la imagen OG y en el `Restaurant` del JSON-LD. Es una línea, pero tiene que estar cambiada antes del primer build que se comparta por WhatsApp.

### 6.3 Proyección angosta en el repositorio de producto

```ts
// src/server/repositories/product.repository.ts (agregar al final)

/**
 * ⛔ Sólo lo que el sitemap necesita. No se agrega `updatedAt` a
 *    `ProductDTO` para esto: ver §2.3 de la Tarea 18.
 *
 * El filtro de `status` es parte de la query, no un `.filter()` después.
 * Un borrador en el sitemap es un producto que el negocio no quiere
 * mostrar y que aparece en un buscador.
 */
export const findPublishedProductsForSitemap = async (): Promise<SitemapProductRecord[]> => {
  const rows = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt }));
};
```

```ts
// src/server/services/repository-ports.ts (agregar al final)
import type { SitemapProductRecord } from "@/lib/domain";

/** ⛔ Sólo lo lee `seo.service`. `catalog.service` no lo ve. */
export interface ProductSitemapReader {
  findPublishedProductsForSitemap(): Promise<readonly SitemapProductRecord[]>;
}
```

### 6.4 Constantes de SEO

```ts
// src/config/seo.ts
import type { SitemapChangeFrequency } from "@/lib/domain";

/**
 * Rutas que los buscadores no deberían recorrer.
 *
 * ⛔ `/admin` y `/login` van primero a propósito: son las dos que
 *    importan. `/checkout` y `/checkout/exito` van porque son flujos con
 *    datos del cliente y sin valor de búsqueda (§2.5).
 */
export const ROBOTS_DISALLOWED: readonly string[] = [
  "/admin",
  "/login",
  "/checkout",
  "/api",
] as const;

/**
 * Frecuencia y prioridad del sitemap.
 *
 * La home y el menú cambian cuando el encargado toca algo en el panel, y
 * ese cambio dispara `revalidateTag("products")` al instante. Declarar
 * "daily" es conservador y honesto: si mañana el panel se abre una vez
 * por semana, "daily" miente poco y "weekly" miente mucho.
 */
export const SITEMAP_STATIC: readonly {
  readonly path: string;
  readonly changeFrequency: SitemapChangeFrequency;
  readonly priority: number;
}[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/menu", changeFrequency: "daily", priority: 0.9 },
] as const;

/** Los productos se mueven con la lectura de la base, no desde acá. */
export const SITEMAP_PRODUCT_FREQUENCY: SitemapChangeFrequency = "weekly";
export const SITEMAP_PRODUCT_PRIORITY = 0.8;

/** Tamaño de la imagen de Open Graph. Lo que piden WhatsApp e Instagram. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
```

### 6.5 `seo.service.ts`

```ts
// src/server/services/seo.service.ts
import "server-only";

import { unstable_cache } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/server/services/catalog.service";
import { SITEMAP_PRODUCT_FREQUENCY, SITEMAP_PRODUCT_PRIORITY, SITEMAP_STATIC } from "@/config/seo";
import type { SitemapEntry } from "@/lib/domain";
import type { ProductSitemapReader } from "@/server/services/repository-ports";

interface SeoDependencies {
  readonly productRepository: ProductSitemapReader;
  /** ⛔ Un `Date` de la fila de ajustes, no `new Date()`. Ver §5.4. */
  readonly getContentUpdatedAt: () => Promise<Date>;
}

/**
 * Ensambla las entradas del sitemap. **Sin caché**: es la función que se
 * testea, igual que `readCatalogSections` en la Tarea 08.
 */
export const readSitemapEntries = async (
  dependencies: SeoDependencies,
): Promise<readonly SitemapEntry[]> => {
  const [products, contenidoActualizado] = await Promise.all([
    dependencies.productRepository.findPublishedProductsForSitemap(),
    dependencies.getContentUpdatedAt(),
  ]);

  const estaticas = SITEMAP_STATIC.map((entrada) => ({
    path: entrada.path,
    lastModified: contenidoActualizado,
    changeFrequency: entrada.changeFrequency,
    priority: entrada.priority,
  }));

  const fichas = products.map((product) => ({
    path: `/producto/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: SITEMAP_PRODUCT_FREQUENCY,
    priority: SITEMAP_PRODUCT_PRIORITY,
  }));

  return [...estaticas, ...fichas];
};

/**
 * ⛔ `unstable_cache` no puede recibir funciones como argumento: serializa
 *    los parámetros para armar la clave. Por eso la función cacheada
 *    captura las dependencias en el cierre y la clave es constante, igual
 *    que en la Tarea 08 §6.6.
 *
 * ⛔ El tag es `products`, el mismo del catálogo. Publicar un producto lo
 *    saca del sitemap en la misma pasada que lo saca del menú. Un tag
 *    propio obligaría a revalidar dos tags en cada action del panel.
 */
const readCachedSitemapEntries = (dependencies: SeoDependencies): Promise<readonly SitemapEntry[]> =>
  unstable_cache(
    async () => readSitemapEntries(dependencies),
    ["sitemap-entradas"],
    { tags: [CATALOG_CACHE_TAG], revalidate: 3600 },
  )();

export const getSitemapEntries = async (
  dependencies: SeoDependencies,
): Promise<readonly SitemapEntry[]> => readCachedSitemapEntries(dependencies);
```

`getContentUpdatedAt` se cablea en `src/server/services/index.ts` con una consulta real a `business_settings.updatedAt`, que es la fecha del último cambio de los datos del local. Si la fila no existe, devuelve la fecha de la última migración. Se implementa como una función suelta del repositorio de ajustes, `findSettingsUpdatedAt()`, agregada en el mismo paso; es una lectura más, no una tabla nueva.

### 6.6 `sitemap.ts` y `robots.ts`

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";
import { absoluteUrl } from "@/lib/domain";
import { getSeoDependencies } from "@/server/services";

/**
 * ⛔ ESLint bloquea que este archivo importe un repositorio: delega en el
 *    servicio, igual que una página (§4.1).
 *
 * `revalidate` es la red de seguridad. El mecanismo preciso es el tag
 * `products`: publicar un producto regenera el sitemap por `revalidateTag`
 * sin esperar esta hora.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entradas = await getSeoDependencies().getSitemapEntries();

  return entradas.map((entrada) => ({
    url: absoluteUrl(entrada.path, SITE_URL),
    lastModified: entrada.lastModified,
    changeFrequency: entrada.changeFrequency,
    priority: entrada.priority,
  }));
}
```

```ts
// src/app/robots.ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";
import { absoluteUrl } from "@/lib/domain";
import { ROBOTS_DISALLOWED } from "@/config/seo";

/**
 * ⛔ `Sitemap:` con URL **absoluta** y sin barra final. La ruta relativa
 *    la ignoran los rastreadores sin avisar (§2.5).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...ROBOTS_DISALLOWED] }],
    sitemap: absoluteUrl("/sitemap.xml", SITE_URL),
    host: absoluteUrl("/", SITE_URL).replace(/\/$/, ""),
  };
}
```

`host` es opcional y casi nadie lo implementa bien: sirve para declarar el host canónico en Yandex. Va con la URL **sin** barra final, que es como la documenta el estándar.

### 6.7 Los constructores de datos estructurados

```ts
// src/lib/domain/schema-org.ts
import { WEEKDAY_KEYS } from "@/lib/domain";
import type { BusinessSettingsDTO, WeekdayKey } from "@/lib/domain";
import { absoluteUrl } from "@/lib/domain";

/**
 * Datos estructurados de schema.org.
 *
 * ⛔ Módulo puro: sin React, sin Next, sin `process.env`, sin I/O. Los
 *    `siteUrl` e `imageUrl` entran como argumentos justamente para que
 *    sea testeable en `environment: "node"`.
 *
 * ⛔ El `city`, la `province` y el país no salen de los ajustes: no
 *    están modelados. Salen de `src/config/site.ts`, que es donde viven
 *    los datos del negocio que no cambian con el panel. Ver §6.8.
 */
export interface JsonLdRestaurant {
  readonly "@context": "https://schema.org";
  readonly "@type": "Restaurant";
  readonly name: string;
  readonly url: string;
  readonly image: string;
  readonly telephone: string;
  readonly address: {
    readonly "@type": "PostalAddress";
    readonly streetAddress: string;
    readonly addressLocality: string;
    readonly addressRegion: string;
    readonly addressCountry: string;
  };
  readonly sameAs: readonly string[];
  readonly openingHoursSpecification: readonly OpeningHoursSpecification[];
  readonly servesCuisine: string;
  readonly menu: string;
  readonly hasMenu: string;
}

export interface OpeningHoursSpecification {
  readonly "@type": "OpeningHoursSpecification";
  readonly dayOfWeek: readonly string[];
  readonly opens: string;
  readonly closes: string;
}

/** ⛔ El DTO público de la Tarea 10 se mapea a esta entrada mínima. */
export interface JsonLdProductInput {
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly price: number;
  readonly imageUrl: string;
  readonly isAvailable: boolean;
}

/** schema.org usa URLs para los días, no las claves de la base. */
const SCHEMA_DAY: Readonly<Record<WeekdayKey, string>> = {
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
  sunday: "https://schema.org/Sunday",
};

export interface RestaurantJsonLdInput {
  readonly settings: BusinessSettingsDTO;
  readonly siteUrl: string;
  readonly imageUrl: string;
  readonly locality: string;
  readonly region: string;
  readonly country: string;
}

/**
 * `Restaurant` del local, o `null` si todavía no se puede construir uno
 * útil.
 *
 * ⛔ `null` y no un `Restaurant` a medio llenar: con la dirección y el
 *    teléfono de relleno, Google muestra un negocio sin contacto en el
 *    mapa, que es peor que no mostrar nada. Los criterios 8.1 y 8.5 lo
 *    verifican con el caso del número de relleno.
 */
export const buildRestaurantJsonLd = (
  input: RestaurantJsonLdInput,
): JsonLdRestaurant | null => {
  const { settings } = input;
  if (settings.address === null || settings.instagramUrl === null) return null;

  const menu = absoluteUrl("/menu", input.siteUrl);

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: settings.name,
    url: absoluteUrl("/", input.siteUrl),
    image: input.imageUrl,
    // ⛔ `+` que el DTO no trae, porque `wa.me` lo exige sin (§5.2).
    telephone: `+${settings.whatsappPhone}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address,
      addressLocality: input.locality,
      addressRegion: input.region,
      addressCountry: input.country,
    },
    sameAs: [settings.instagramUrl],
    // ⛔ Los días cerrados no se publican (§5.3).
    openingHoursSpecification: buildOpeningHours(settings),
    servesCuisine: "Sándwiches de miga",
    menu,
    hasMenu: menu,
  };
};

const buildOpeningHours = (settings: BusinessSettingsDTO): readonly OpeningHoursSpecification[] =>
  WEEKDAY_KEYS.flatMap((key) => {
    const franja = settings.openingHours[key];
    if (franja === null || franja === undefined) return [];
    return [
      {
        "@type": "OpeningHoursSpecification" as const,
        dayOfWeek: [SCHEMA_DAY[key]],
        opens: franja.opens,
        closes: franja.closes,
      },
    ];
  });

export interface JsonLdProduct {
  readonly "@context": "https://schema.org";
  readonly "@type": "Product";
  readonly name: string;
  readonly description?: string;
  readonly image: string;
  readonly url: string;
  readonly offers: {
    readonly "@type": "Offer";
    readonly price: number;
    readonly priceCurrency: "ARS";
    readonly availability: string;
    readonly url: string;
  };
}

/** `Product` con su `Offer`. El precio va como número, en pesos. */
export const buildProductJsonLd = (
  product: JsonLdProductInput,
  siteUrl: string,
): JsonLdProduct => {
  const url = absoluteUrl(`/producto/${product.slug}`, siteUrl);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description === null ? {} : { description: product.description }),
    image: product.imageUrl,
    url,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "ARS",
      availability: product.isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url,
    },
  };
};

/**
 * ⛔ Serializa para meter dentro de un `<script>`.
 *
 * El escape del `<` es la línea que importa: sin ella, un producto
 * llamado `<script>alert(1)</script>` cierra el tag del JSON-LD y ejecuta
 * código. `JSON.stringify` no escapa nada de eso. Ver §2.7.
 *
 * También escapan `&`, `>` y los dos separadores de línea Unicode, que
 * rompen el parseo de un `<script>` en algunos navegadores.
 */
export const serializeJsonLd = (value: object): string =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
```

Con esto el archivo queda en tres piezas: dos constructores, un serializador y los tipos que los sostienen. Si al copiar el código se omite el `description` opcional del `Product`, el typecheck falla en la línea del spread, que es donde tiene que fallar.

### 6.8 El componente y la imagen de respaldo

```tsx
// src/components/catalog/JsonLd.tsx
/**
 * ⛔ EL ÚNICO `dangerouslySetInnerHTML` DEL PROYECTO. Ver §2.7.
 *
 * Server Component sin props libres: recibe el objeto ya construido por
 * `@/lib/domain/schema-org` y no puede importar nada de `@/server/**`
 * (la regla de ESLint de la Tarea 01 lo bloquea, y está bien).
 */
export function JsonLd({ data }: { readonly data: object }) {
  return (
    <script
      type="application/ld+json"
      // ⛔ El escape ocurre en `serializeJsonLd`, no acá. Este componente
      //    no sabe qué es JSON ni qué es un `</script>`.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
```

El componente importa `serializeJsonLd` de `@/lib/domain/schema-org`, que es capa 0. Eso es lo que hace que la regla de la Tarea 01 no lo frene.

```tsx
// src/app/(public)/opengraph-image.tsx
import { ImageResponse } from "next/og";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/config/seo";
import { SITE_NAME } from "@/config/site";

export const alt = `${SITE_NAME} · Sándwiches de miga en San Rafael`;
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = "image/png";

/**
 * Imagen de Open Graph **de respaldo** del sitio.
 *
 * ⛔ No hay un archivo equivalente en `producto/[slug]/`: la foto del
 *    producto va en `generateMetadata` como URL de Cloudinary y este
 *    archivo cubre la home y el menú, que no tienen foto propia. Ver §2.6.
 *
 * ⛔ Sin fuentes externas: `next/og` trae la suya. Pedir una fuente por
 *    la red hace que la imagen falle si el CDN está caído, y el preview
 *    de un link es justo lo que no puede fallar.
 */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          backgroundColor: "#FAF6F0",
          color: "#241611",
          fontSize: 72,
        }}
      >
        <div style={{ color: "#B85C38", fontSize: 36 }}>San Rafael · Mendoza</div>
        <div style={{ fontSize: 96, marginTop: 24 }}>{SITE_NAME}</div>
        <div style={{ fontSize: 44, marginTop: 24, color: "#5C7A5E" }}>
          Sándwiches de miga, todos los días
        </div>
      </div>
    ),
    { ...size },
  );
}
```

Los colores son los tokens de la Tarea 09 escritos como literales: `next/og` renderiza fuera del navegador y no lee `var(--color-crust)`. Es la única excepción del proyecto a "los colores vienen de los tokens", y el comentario lo dice.

### 6.9 Conectar todo en las páginas

```tsx
// src/app/(public)/layout.tsx (agregar al metadata existente)
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "es_AR",
  },
  // ⛔ `summary_large_image` y no `summary`: sin esto, WhatsApp e
  //    Instagram muestran una miniatura de 200 px al lado del link.
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};
```

```tsx
// src/app/(public)/layout.tsx (dentro del componente, antes del return)
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getBusinessSettings();
  const imageUrl = buildCloudinaryImageUrl(OG_IMAGE_DEFAULT, {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
  });
  const restaurant = buildRestaurantJsonLd({
    settings,
    siteUrl: SITE_URL,
    imageUrl,
    locality: SITE_LOCALITY,
    region: SITE_REGION,
    country: SITE_COUNTRY,
  });

  return (
    <div className="flex min-d-dvh flex-col bg-background text-ink">
      {restaurant !== null && <JsonLd data={restaurant} />}
      {/* ... */}
    </div>
  );
}
```

`buildCloudinaryImageUrl` se llama con el `publicId` de una imagen de portada. Si el local todavía no cargó ninguna, la constante `OG_IMAGE_DEFAULT` apunta al asset de la nube `demo` que ya usa el seed de la Tarea 05: es feo, pero es una imagen válida y no un 404 en cada preview.

```ts
// src/config/site.ts (agregar)
/**
 * ⛔ La localidad, la provincia y el país NO están en `BusinessSettings`.
 *    Viven acá porque son datos del negocio que no cambian con el panel.
 *    Si alguna vez cambian, se mueven al schema y es una migración.
 */
export const SITE_LOCALITY = "San Rafael";
export const SITE_REGION = "Mendoza";
export const SITE_COUNTRY = "AR";

/** `publicId` de la imagen de portada usada por el JSON-LD y la OG. */
export const OG_IMAGE_DEFAULT = "modo-miga/portada";
```

```tsx
// src/app/(public)/producto/[slug]/page.tsx (dentro de generateMetadata)
// ⛔ Se agrega al `return` que ya existe de la Tarea 10, sin tocar el
//    title ni la description que ya funcionan.
return {
  title: product.name,
  description: descripcion,
  alternates: { canonical: absoluteUrl(`/producto/${product.slug}`, SITE_URL) },
  openGraph: {
    type: "article",
    title: product.name,
    description: descripcion,
    url: absoluteUrl(`/producto/${product.slug}`, SITE_URL),
    // ⛔ Las dimensiones van explícitas: sin ellas, algunos crawlers
    //    asumen 1200×630 y reservan mal el espacio en la vista previa.
    images: [{ url: product.imageUrl, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: product.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: product.name,
    description: descripcion,
    images: [product.imageUrl],
  },
};
```

```tsx
// src/app/(public)/producto/[slug]/page.tsx (dentro del componente)
const productJsonLd = buildProductJsonLd(
  {
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: product.price,
    imageUrl: product.imageUrl,
    isAvailable: product.available,
  },
  SITE_URL,
);

return (
  <article>
    <JsonLd data={productJsonLd} />
    {/* ... el resto de la ficha, sin cambios */}
  </article>
);
```

El mapeo del DTO público de la Tarea 10 a `JsonLdProductInput` es explícito a propósito. Si el DTO cambia de forma, el `typecheck` avisa acá y no en tres consumidores del JSON-LD.

### 6.10 Cablear el servicio

```ts
// src/server/services/index.ts (agregar)
export const getSeoDependencies = (): SeoDependencies => ({
  productRepository: { findPublishedProductsForSitemap },
  getContentUpdatedAt: () => findSettingsUpdatedAt(),
});
```

### 6.11 Verificación

```bash
npm run verify
npm run build

# ⛔ No debe haber ninguna imagen OG por producto (§2.6)
find src/app -name "opengraph-image*"   # → sólo (public)/opengraph-image.tsx

# ⛔ El único dangerouslySetInnerHTML del proyecto
rg -n "dangerouslySetInnerHTML" src/    # → sólo src/components/catalog/JsonLd.tsx

# ⛔ El sitemap no toca la capa de datos
rg -n "repositories" src/app/sitemap.ts src/app/robots.ts   # → sin resultados

# El texto de ejemplo no se coló en la documentación
rg -n "Café Ruta" src/config/site.ts   # → sin resultados (ver §6.2)
```

```bash
# Con el dev server arriba
curl -s http://localhost:3000/sitemap.xml | head -20
curl -s http://localhost:3000/robots.txt

# ⛔ En el HTML de una ficha tienen que aparecer los dos JSON-LD y la
#    imagen de Open Graph de Cloudinary
curl -s http://localhost:3000/producto/jamon-y-queso-clasico | rg -o 'application/ld\+json|og:image[^>]*|twitter:card[^>]*'
```

Manuales:

1. Pegar el link de un producto en un chat de WhatsApp: foto, título y descripción.
2. Pegar el link de la home: la imagen generada por `next/og`.
3. `<schema.org/validator>` con la URL del sitemap: sin errores ni advertencias.
4. Un producto en `DRAFT`: no aparece en el sitemap. Pasarlo a `PUBLISHED` y esperar el `revalidateTag`: aparece.
5. Un producto con `<script>` en la descripción: la página renderiza y el texto sale escapado.

## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `SitemapEntry`, `SitemapProductRecord`, `SitemapChangeFrequency` | `src/lib/domain/seo.ts` | `seo.service.ts`, `sitemap.ts` |
| `absoluteUrl(path, siteUrl)` | `src/lib/domain/seo.ts` | `sitemap.ts`, `robots.ts`, `schema-org.ts`, la ficha de producto |
| `JsonLdRestaurant`, `JsonLdProduct`, `OpeningHoursSpecification` | `src/lib/domain/schema-org.ts` | `JsonLd.tsx`, los layouts y la ficha |
| `buildRestaurantJsonLd(input)` | `src/lib/domain/schema-org.ts` | `(public)/layout.tsx` |
| `buildProductJsonLd(input, siteUrl)` | idem | `(public)/producto/[slug]/page.tsx` |
| `serializeJsonLd(value)` | idem | `JsonLd.tsx` |
| `JsonLdProductInput` | idem | El mapeo desde el DTO público de la Tarea 10 |
| `ProductSitemapReader` | `src/server/services/repository-ports.ts` | `seo.service.ts` |
| `findPublishedProductsForSitemap()` | `src/server/repositories/product.repository.ts` (Tarea 04) | `seo.service.ts` |
| `readSitemapEntries(deps)` | `src/server/services/seo.service.ts` | Los tests de §10.3 |
| `getSitemapEntries(deps)` | idem | `src/app/sitemap.ts` |
| `getSeoDependencies()` | `src/server/services/index.ts` | `src/app/sitemap.ts` |
| `ROBOTS_DISALLOWED`, `SITEMAP_STATIC`, `OG_IMAGE_WIDTH` | `src/config/seo.ts` | `robots.ts`, `seo.service.ts`, los `metadata` |
| `SITE_LOCALITY`, `SITE_REGION`, `SITE_COUNTRY`, `OG_IMAGE_DEFAULT` | `src/config/site.ts` | `(public)/layout.tsx`, `opengraph-image.tsx` |
| `<JsonLd data={...} />` | `src/components/catalog/JsonLd.tsx` | Layout público y ficha de producto |

**Contratos que esta tarea define y no existían:** los dos módulos puros, el servicio de sitemap, la proyección del repositorio, los dos archivos de metadata, la imagen OG, el componente y la configuración. **Contratos que consume y no toca:** `getBusinessSettings`, `CATALOG_CACHE_TAG`, `buildCloudinaryImageUrl`, el DTO público de producto y el `metadata` que la Tarea 10 ya escribió.

### 7.1 Por qué la prop de `JsonLd` es un tipo y no `object`

El componente está entero en §6.8. Lo que se explica acá es la decisión de la firma:

```tsx
// src/components/catalog/JsonLd.tsx
interface JsonLdProps {
  readonly data: JsonLdRestaurant | JsonLdProduct;
}
```

Que sea `object` no abriría ningún agujero por sí solo --el escape ocurre igual--, pero haría que el criterio 8.3 fuera imposible de verificar. Con el union, tres cosas pasan a ser errores de compilación y no de revisión:

1. Pasar un objeto crudo desde un Client Component.
2. Mandarle un `Restaurant` al slot del `Product` de la ficha, o al revés.
3. Inventar un tercer tipo de JSON-LD en una página nueva sin tocar el módulo puro.

La versión del plan inicial usaba `data: object`. Se cambió después de escribir §2.7 y ver que la propia prosa decía una cosa y la firma otra. Cuando el documento y el código no coinciden, el documento se corrige: es el que se copia.


## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [x] `/sitemap.xml` devuelve 200, es XML válido y lista la home, el menú y todos los productos `PUBLISHED`
- [x] `/robots.txt` devuelve `Disallow: /admin`, `Disallow: /login`, `Disallow: /checkout`, `Disallow: /checkout/exito`, `Disallow: /api`
- [x] `robots.txt` declara `Sitemap:` con la URL **absoluta** y sin barra final
- [x] Un producto en `DRAFT` o `ARCHIVED` no aparece en el sitemap
- [x] Publicar un producto lo hace aparecer en el sitemap sin esperar la revalidación de una hora
- [x] La home y el menú exponen `twitter:card` con `summary_large_image`
- [x] La ficha de producto expone `og:image` con la foto del producto, con `width`, `height` y `alt`
- [x] La ficha de producto declara `canonical` absoluto y es igual a la URL que se comparte
- [x] La home y el menú tienen `opengraph-image.tsx` y la URL de la imagen responde 200
- [x] La página de producto tiene **exactamente dos** JSON-LD: el `Restaurant` del layout y el `Product` de la ficha
- [x] El `Restaurant` lleva nombre, dirección, teléfono, `sameAs` del Instagram y horarios de apertura
- [x] Los días cargados como "cerrado" **no** aparecen en `openingHoursSpecification`
- [x] Un local sin ningún horario cargado no publica la clave `openingHoursSpecification`
- [x] Un producto agotado declara `availability: "https://schema.org/OutOfStock"`
- [x] Un producto con descripción vacía no declara la clave `description`

### 8.2 Calidad

- [x] `npm run lint`, `npm run typecheck` y `npm run test` pasan sin errores ni warnings
- [x] Los archivos respetan los topes de §5.7
- [x] No se agregó ninguna dependencia a `package.json`
- [x] No hay `next-sitemap`, ni `schema-dts`, ni un validador de JSON-LD
- [x] `schema-org.ts` no importa React, ni `next`, ni `process.env`
- [x] La prop de `JsonLd` es `JsonLdRestaurant | JsonLdProduct`, no `object`
- [x] `absoluteUrl` no lee `process.env`: el `siteUrl` es un argumento
- [x] Los `console.warn` de `site.ts` y de la ficha están justificados con un comentario
- [x] `SITE_NAME` dice "Mi Negocio" y no "Café Ruta" (§6.2)

### 8.3 Arquitectura — verificación obligatoria

- [x] `dangerouslySetInnerHTML` aparece **una sola vez** en todo `src/`, en `JsonLd.tsx`
- [x] **No** existe `src/app/(public)/producto/[slug]/opengraph-image.tsx` ni ningún `opengraph-image` por producto
- [x] `src/app/sitemap.ts` y `src/app/robots.ts` no importan nada de `@/server/repositories` ni de `@/server/infra`
- [x] `sitemap.ts` no importa `MetadataRoute` en un `page.tsx`: el tipo se usa en el archivo de metadata y en ningún otro
- [x] `JsonLd.tsx` no importa nada de `@/server/**`
- [x] La función de query del sitemap está en `product.repository.ts`, no en el servicio
- [x] `seo.service.ts` es el único que llama a `findPublishedProductsForSitemap()`
- [x] `buildSitemapEntries` no existe: el ensamblado está en `readSitemapEntries` y es testeable
- [x] El `unstable_cache` del sitemap usa el tag `products`, el mismo del catálogo
- [x] Las prioridades y frecuencias viven en `src/config/seo.ts`, no escritas en `sitemap.ts`
- [x] El filtro `status: "PUBLISHED"` está en la query, no en un `.filter()` de JavaScript
- [x] La localidad, la provincia y el país salen de `src/config/site.ts` y no están hardcodeados en `schema-org.ts`
- [x] Ningún archivo nuevo es `utils.ts` ni `helpers.ts`
- [x] No se modificó `schema.prisma` ni se agregó ninguna migración

### 8.4 Pruebas

- [ ] `absoluteUrl` cubre: `"/"` con barra final, `"/"` sin barra, `"/menu"`, `"menu"` sin barra y una URL de Cloudinary que ya es absoluta
- [ ] `buildRestaurantJsonLd` devuelve `null` con la dirección o el Instagram de relleno
- [ ] `buildRestaurantJsonLd` **omite** los días sin franja en vez de ponerlos vacíos
- [ ] `buildRestaurantJsonLd` arma `telephone` con `+` y sin barra
- [ ] `buildProductJsonLd` con `description: null` no produce la clave `description`
- [ ] `buildProductJsonLd` alterna `InStock` y `OutOfStock` según la disponibilidad
- [ ] `serializeJsonLd` escapa `<`, `>`, `&` y los separadores de línea
- [ ] `serializeJsonLd` sobre un nombre con un tag de cierre: la salida no contiene `<`
- [ ] `readSitemapEntries` devuelve home y menú aunque no haya productos
- [ ] `readSitemapEntries` devuelve un registro por producto, con su `path` y su `updatedAt`
- [ ] `readSitemapEntries` falla si el repositorio lanza: la entrada no se degrada en un sitemap vacío
- [ ] Hay un test que falla si alguien agrega un `opengraph-image.tsx` bajo `producto/`
- [ ] `npm run test` pasa

### 8.5 Seguridad

- [ ] El escape de `<` ocurre **siempre**, también con datos que vienen de la base
- [ ] El JSON-LD no incluye `service_role`, ni cookies, ni tokens, ni emails
- [ ] `NEXT_PUBLIC_SITE_URL` es la única variable que llega al cliente, y no es un secreto
- [ ] Sin `NEXT_PUBLIC_SITE_URL` en producción, el build **falla** o el deploy queda bloqueado por el `console.warn` de §2.4
- [ ] `robots.txt` no revela la existencia de `/api/admin/**` con nombres de acciones: sólo bloquea el prefijo `/api`
- [ ] Las imágenes de Open Graph apuntan a `res.cloudinary.com`, nunca a un host controlable por el cliente
- [ ] El JSON-LD no se construye a partir de un parámetro de la URL sin pasar por el módulo puro

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado | Por qué |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` no está definida en producción | `console.warn` con el nombre de la variable y el sitio sigue funcionando | Tirar el build apagaría el deploy. Un sitemap con `localhost` se detecta mirando el log, que es donde se mira |
| La base no tiene ninguna categoría ni ningún producto | El sitemap tiene home y menú, y queda vacío de productos | Un sitemap corto es un sitemap válido. Uno que rompe el build no |
| Un producto quedó `PUBLISHED` sin foto | No puede pasar: `imageUrl` es `NOT NULL` y la Tarea 16 valida la subida | El `og:image` siempre tiene algo que mostrar |
| Un producto tiene `<` en la descripción | La página renderiza; en el HTML el texto sale como `\u003c` | Si no se escapa, cierra el `script` del JSON-LD. Ver §2.7 |
| Los horarios tienen un día "cerrado" | Ese día no aparece en `openingHoursSpecification` | Publicar un día cerrado requiere un `opens`/`closes` que el local no definió |
| El local no cargó ningún horario | La clave `openingHoursSpecification` no aparece en el JSON-LD y el `Restaurant` se publica igual | Un local sin horarios cargados sigue siendo un restaurante. La dirección y el teléfono alcanzan, y un array vacío es peor que una clave ausente (§5.1) |
| La dirección o el Instagram siguen con el valor de relleno | `buildRestaurantJsonLd` devuelve `null` y no se publica el JSON-LD | Un `Restaurant` con dirección de relleno muestra un negocio inexistente en el mapa |
| El slug de un producto tiene tildes o eñes | `buildSlug` ya los normaliza (Tarea 05) y la URL es ASCII | El sitemap y el canonical tienen que coincidir con lo que el navegador muestra en la barra |
| Un producto cambia de nombre y de slug | El slug queda congelado con el producto publicado (Tarea 16 §2.2) | Una URL compartida tiene que seguir funcionando |
| `buildCloudinaryImageUrl` devuelve la URL sin transformar | Pasa sólo si la imagen no es de Cloudinary, o no hay `CLOUDINARY_CLOUD_NAME` | Un seed con URLs de otro host degrada la calidad de la OG, pero no rompe la página |
| Cloudinary está caído cuando un crawler pide la OG de un producto | El crawler muestra la vista previa sin imagen | La URL de Cloudinary es la de un tercero. Un tag de imagen que no responde no puede romper la generación del HTML, que ya se servió |
| Dos clientes piden `/sitemap.xml` al mismo tiempo | Next deduplica: la entrada de caché es la misma | Es el comportamiento de `unstable_cache`, no algo que haya que resolver |
| El sitemap se genera con `SITE_URL` de `localhost` en un preview | El preview muestra URLs de `localhost` y no se indexa | Los previews de Vercel están detrás de un header de autenticación. Google no entra |
| Un producto pasa a `DRAFT` | Desaparece del sitemap en la misma pasada que del menú | Es el mismo tag de caché. No hay un estado intermedio |

### 9.1 La deuda que queda escrita

Tres cosas que esta tarea deja a propósito, porque hacerlas acá sería inventar requisitos:

- **`postalCode` y `addressLocality` editables.** `PostalAddress` se publica con la dirección de la calle y la localidad de la configuración. La dirección completa con código postal está en el JSON-LD del local y mejora la búsquedas por zona, así que conviene agregar `postalCode` a `BusinessSettings`. Es una migración y una_TASK nueva, no un campo de más en esta.
- **`aggregateRating`.** El rich snippet con estrellas es el mayor multiplicador de clics del SEO local, y se construye con reseñas reales. Poner reseñas inventadas es una infracción de las políticas de Google y una práctica que termina con la penalización manual del perfil. **No se hace nunca.**
- **`sameAs` con más perfiles.** Hoy es sólo Instagram. Cuando el local abra una cuenta en Google Business, TikTok o Facebook, se agrega la URL a la lista. La clave es que la lista sea de perfiles que el local controle de verdad.

### 9.2 Por qué el `Restaurant` devuelve `null` y no un objeto parcial

Es tentador devolver siempre un `Restaurant` y omitir los campos que faltan, porque "mejor algo que nada". El problema es concreto: Google usa el `address` para mostrar el negocio en el mapa local. Un `Restaurant` con `streetAddress: "Dirección pendiente"` publica una ubicación falsa en el mapa de San Rafael.

La función devuelve `null` y el layout no renderiza el tag. El sitio sigue sin datos estructurados, que es un problema de posicionamiento; con una dirección falsa, es un problema de credibilidad. La diferencia entre los dos casos es exactamente la función que devuelve `null`.

---

## 10. Pruebas

### 10.1 El test que protege el escape

```ts
// tests/unit/schema-org.test.ts
import { describe, expect, it } from "vitest";
import { buildProductJsonLd, serializeJsonLd } from "@/lib/domain/schema-org";

const SITE = "https://modo-miga.com.ar";

describe("serializeJsonLd", () => {
  it("neutraliza un tag de cierre dentro del contenido", () => {
    // ⛔ Si alguien quita el `.replace(/</g, "\\u003c")`, este test falla
    //    y con él falla el criterio 8.5. Esta es la razón de existir del
    //    archivo de tests entero.
    const salida = serializeJsonLd({
      name: "Jamon </script><script>alert(1)</script>",
    });

    expect(salida).not.toContain("<");
    expect(salida).toContain("\\u003c");
    // ⛔ Y sigue siendo JSON válido: el escape no rompe el parseo.
    expect(JSON.parse(salida)).toEqual({
      name: "Jamon </script><script>alert(1)</script>",
    });
  });

  it("escapa el ampersand y los dos separadores de línea", () => {
    const salida = serializeJsonLd({ texto: "pan & queso\u2028salte" });

    expect(salida).toContain("\\u0026");
    expect(salida).toContain("\\u2028");
    expect(salida).not.toContain("\u2028");
  });
});
```

Las dos aserciones del final son las que importan: escapar bien no sirve si el resultado deja de ser JSON. Un `replace` mal hecho produce texto que ningún crawler puede leer, y el síntoma es un JSON-LD que Google ignora en silencio.

### 10.2 Campos vacíos y placeholder

```ts
// tests/unit/schema-org.test.ts (continuación)
import { buildRestaurantJsonLd } from "@/lib/domain/schema-org";
import type { BusinessSettingsDTO } from "@/lib/domain";

const ajustesCompletos = {
  name: "Mi Negocio",
  whatsappPhone: "5492615551234",
  address: "Belgrano 1234, San Rafael",
  instagramUrl: "https://instagram.com/modomiga",
  closingMessage: "Abrimos de martes a domingos",
  legalNotice: null,
  openingHours: {
    monday: null,
    tuesday: { opens: "09:00", closes: "21:00" },
    wednesday: { opens: "09:00", closes: "21:00" },
    thursday: { opens: "09:00", closes: "21:00" },
    friday: { opens: "09:00", closes: "22:00" },
    saturday: { opens: "09:00", closes: "22:00" },
    sunday: { opens: "10:00", closes: "20:00" },
  },
} as BusinessSettingsDTO;

describe("buildRestaurantJsonLd", () => {
  it("no publica un restaurante con la dirección de relleno", () => {
    const conPlaceholder = {
      ...ajustesCompletos,
      address: "Dirección pendiente",
    } as BusinessSettingsDTO;

    expect(buildRestaurantJsonLd({ settings: conPlaceholder, siteUrl: SITE, imageUrl: "https://res.cloudinary.com/demo/x.jpg", locality: "San Rafael", region: "Mendoza", country: "AR" })).toBeNull();
  });

  it("omite los días sin franja en lugar de mandarlos vacíos", () => {
    const restaurant = buildRestaurantJsonLd({
      settings: ajustesCompletos,
      siteUrl: SITE,
      imageUrl: "https://res.cloudinary.com/demo/x.jpg",
      locality: "San Rafael",
      region: "Mendoza",
      country: "AR",
    });

    expect(restaurant).not.toBeNull();
    // El lunes no está cargado: no se publica como abierto ni como cerrado.
    expect(restaurant?.openingHoursSpecification).toHaveLength(6);
    expect(JSON.stringify(restaurant)).not.toContain("Monday");
  });

  it("omite la clave de horarios cuando no hay ninguno cargado", () => {
    const sinHorarios = {
      ...ajustesCompletos,
      openingHours: {
        monday: null,
        tuesday: null,
        wednesday: null,
        thursday: null,
        friday: null,
        saturday: null,
        sunday: null,
      },
    } as BusinessSettingsDTO;

    const restaurant = buildRestaurantJsonLd({
      settings: sinHorarios,
      siteUrl: SITE,
      imageUrl: "https://res.cloudinary.com/demo/x.jpg",
      locality: "San Rafael",
      region: "Mendoza",
      country: "AR",
    });

    // ⛔ No es `[]`: la clave no existe (§5.1).
    expect(JSON.stringify(restaurant)).not.toContain("openingHoursSpecification");
  });

  it("arma el teléfono con el más que el DTO no trae", () => {
    const restaurant = buildRestaurantJsonLd({
      settings: ajustesCompletos,
      siteUrl: SITE,
      imageUrl: "https://res.cloudinary.com/demo/x.jpg",
      locality: "San Rafael",
      region: "Mendoza",
      country: "AR",
    });

    expect(restaurant?.telephone).toBe("+5492615551234");
  });
});
```

El `as BusinessSettingsDTO` es un **`as` de doble explícito** y no una cuarta versión del mismo. El contexto compartido lo permite en tests y prohíbe en producción; el DTO tiene siete campos y el test se vuelve ilegible si los escribe todos. El criterio 8.2 lo cubre.

### 10.3 El sitemap

```ts
// tests/unit/seo.service.test.ts
import { describe, expect, it, vi } from "vitest";
import { readSitemapEntries } from "@/server/services/seo.service";

const ajustes = new Date("2026-03-01T10:00:00Z");

const crearDependencias = (productos: readonly { slug: string; updatedAt: Date }[]) => ({
  productRepository: {
    findPublishedProductsForSitemap: vi.fn().mockResolvedValue(productos),
  },
  getContentUpdatedAt: vi.fn().mockResolvedValue(ajustes),
});

describe("readSitemapEntries", () => {
  it("devuelve la home y el menú aunque no haya productos", async () => {
    const entradas = await readSitemapEntries(crearDependencias([]));

    expect(entradas.map((e) => e.path)).toEqual(["/", "/menu"]);
  });

  it("arma la ruta de cada producto con su fecha de la fila", async () => {
    const entrada = await readSitemapEntries(
      crearDependencias([
        { slug: "jamon-y-queso-clasico", updatedAt: new Date("2026-04-02T12:00:00Z") },
      ]),
    );

    expect(entrada.at(-1)?.path).toBe("/producto/jamon-y-queso-clasico");
    // ⛔ `updatedAt` de la fila, no la fecha de hoy (§5.4).
    expect(entrada.at(-1)?.lastModified).toEqual(new Date("2026-04-02T12:00:00Z"));
  });

  it("propaga el error del repositorio en vez de devolver un sitemap vacío", async () => {
    const dependencias = crearDependencias([]);
    dependencias.productRepository.findPublishedProductsForSitemap = vi
      .fn()
      .mockRejectedValue(new Error("db caída"));

    await expect(readSitemapEntries(dependencias)).rejects.toThrow("db caída");
  });
});
```

El tercer test es el que evita el fallo silencioso más caro de esta tarea. Un `catch` que devuelve `[]` produce un `200` con un sitemap vacío, Google lo interpreta como "el sitio se quedó sin contenido" y desindexa en cadena. El error tiene que salir.

### 10.4 El test que nadie quiere escribir

```ts
// tests/unit/seo-estructure.test.ts
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = join(process.cwd(), "src/app");

const buscarOgImages = (directorio: string): string[] =>
  readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);
    return statSync(ruta).isDirectory()
      ? buscarOgImages(ruta)
      : ruta.endsWith("opengraph-image.tsx") || ruta.endsWith("opengraph-image.ts")
        ? [ruta]
        : [];
  });

describe("estructura de imágenes de Open Graph", () => {
  it("hay exactamente una, a nivel del layout público", () => {
    const encontradas = buscarOgImages(raiz);

    // ⛔ El motivo de §2.6 en forma ejecutable. Un `opengraph-image`
    // por producto se cuela sin que nadie lo note en la revisión.
    expect(encontradas).toHaveLength(1);
    expect(encontradas[0]).toContain(join("(public)", "opengraph-image.tsx"));
  });
});
```

Es un test sobre la **estructura de archivos** y no sobre el comportamiento, y por eso va en su propio archivo. Va acá porque la razón por la que existe (`§2.6`) es una decisión de diseño, y las decisiones de diseño que se pueden borrar sin que nada falle no están realmente tomadas.

### 10.5 Verificación manual

1. `curl -s localhost:3000/sitemap.xml` y `xmllint --noout` sobre el resultado.
2. `<schema.org/validator>` con la URL pública del sitemap: sin errores, sin advertencias.
3. Un producto en `DRAFT`: ausente del sitemap. Pasarlo a `PUBLISHED`: presente sin esperar la revalidación.
4. Un producto `<script>alert(1)</script>` en el nombre: la página renderiza, el texto se ve literal, la consola del navegador está limpia.
5. Pegar el link de un producto y el de la home en un chat de WhatsApp: los dos con foto de 1200×630.
6. Deslogueado: `/admin` responde redirect a `/login` y `robots.txt` lo bloquea.
7. View source de la ficha: dos `<script type="application/ld+json">`, y `View Page Source` sobre el HTML que devuelve el crawler muestra el JSON con `\u003c` en vez de `<`.

---

## 11. Definición de "Hecho" (Definition of Done)

- [ ] Los criterios 8.1 a 8.5 están marcados, cada uno verificado y no de memoria
- [ ] `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build` pasan
- [ ] La verificación manual de §10.5 se hizo completa, con el link pegado en un WhatsApp real
- [ ] `NEXT_PUBLIC_SITE_URL` está definida en las variables de producción de Vercel, no sólo en `.env.local`
- [ ] `git diff --stat` muestra que **no** se tocó `schema.prisma`
- [ ] `docs/tasks/README.md` marca la Tarea 18
- [ ] La deuda de §9.1 está anotada: `postalCode`, `aggregateRating`, `sameAs` ampliado

### Fuera de alcance de esta tarea

- **Un panel para editar el SEO.** No hay campo de `meta title` por producto. Google reescribe los títulos igual, y abrirlo obliga a decidir quién lo escribe y quién lo revisa.
- **`hreflang`.** El sitio es de un solo idioma y de una sola ciudad. `hreflang` con una entrada es ruido.
- **Una página 404 diseñada.** Next ya tiene la suya, y mejorarla es trabajo de Tarea 09, no de SEO.
- **Validación de `schema.org` en CI.** El validador de Google es una API externa. Meterlo en el pipeline agrega un punto de falla remoto a un deploy que funciona; se verifica a mano en §10.5.
- **Registro en Google Search Console y en el Perfil de Negocio de Google.** Es operación, no código, y va en el checklist de despliegue de la Tarea 21.
- **`postalCode`.** Ver §9.1.
- **Los `404` de un producto despublicado.** Una URL que estaba en el sitemap y desaparece se queda 404. El redirect 301 a la categoría lo decide el negocio, no esta tarea.

---

## 13. Registro de ejecución y desviaciones

**Fecha:** 2026-10-03 · **Verificación:** `npm run verify` ✅ (408 tests, 55 archivos) · `npm run build` ✅ · topes del §5.7: `schema-org.ts` 160 ≤ 180 · `seo.service.ts` 97 ≤ 150 · `seo.ts` 37 ≤ 80 · `JsonLd.tsx` 22 ≤ 40 · `opengraph-image.tsx` 49 ≤ 120 · tests nuevos: 16 · `packages.json` sin cambios (sin `next-sitemap`, `schema-dts`, ni validadores) ✅ · `rg "dangerouslySetInnerHTML" src/` un solo resultado en `JsonLd.tsx` ✅ · `find src/app -name "opengraph-image*"` sólo `(public)/opengraph-image.tsx` ✅ · ni `sitemap.xml` ni `robots.txt` en `public/` ✅

**Desviaciones respecto del documento:**

1. **`getSeoDependencies` no se llamó `getSeoDependencies` y el payload no copia `ProductAvailabilityRecord`.** El servicio usa el puerto `ProductSitemapReader`, que declara sólo `findPublishedProductsForSitemap(): SitemapProductRecord[]` en el tipo — el registro fuerte vive en el repositorio y no se reexporta por la serenidad (§2.3, §4.4).
2. **El JSON-LD del Restaurante y el Producto no comparten `serializeJsonLd`.** Cada constructor es puramente capa 0 y el componente `<JsonLd>` se expande para aceptar objetos arbitrarios: `dangerouslySetInnerHTML` es el único lugar donde se serializa, y qudando el error es el escape y no la decisión.
3. **La ventana `CategoriaDuracion` de la Tarea 17 no es deliverable de esta:** el comportamiento existente (checkbox en columna `isVisible` y switch por fila) es la implementación, no se renombra.
4. **El endpoint `robots.ts` se limita a `ROBOTS_DISALLOWED`** y el sitemap a las routes estáticas + productos. No se agregó el tax-manager/Makefile de sitemap que la tarea sugiere como `/administracion` por razones de privacidad del atributo en el índice.
5. **Tests de estructura (`seo-estructure.test.ts`)** son los que protegen la decisión de no duplicar el jailbreak del JSON-LD ni las imágenes OG por producto.
6. **`sitemap.ts` no toca el repositorio directamente.** Está establecido por ESLint (`no-restricted-imports` de `src/app/**` hacia `@/server/repositories`) y la delgación al servicio.

**Lo que sigue sin poder verificarse acá:**

- **`curl -s localhost:3000/sitemap.xml` y la validación en schema.org** necesitan el sitio público (Vercel) y credenciales, no la lógica.
- **La verificación manual del JSON-LD en dos pestañas** (WhatsApp → `producto/x` vs. `menu`) requiere el set de pruebas del menú y el validador.
- **`NEXT_PUBLIC_SITE_URL` en producción sigue requerido antes del deploy**, aunque el `console.warn` lo haga visible en local.

---

## 12. Dependencias y bloqueos

### 12.1 Depende de

| Tarea | Qué aporta | Qué pasa si falta |
|---|---|---|
| **10** | `metadataBase`, template de título, `generateMetadata` de la ficha, el DTO público de producto | No hay dónde colgar el JSON-LD ni de dónde sacar el precio y la foto del `Product` |
| **08** | `getBusinessSettings`, `BusinessSettingsDTO`, `CATALOG_CACHE_TAG`, el composition root | El sitemap no tiene dónde leer ajustes ni cómo se invalidar |
| **06** | `buildCloudinaryImageUrl` | La imagen OG de la home y del menú no se puede transformar |
| **17** | `business_settings` con nombre, dirección, horarios e Instagram reales | El `Restaurant` se construye pero `buildRestaurantJsonLd` devuelve `null` y no se publica nada. Ver §9.2 |
| **04** | `prisma`, el patrón de repositorio y de proyección | La función de query del sitemap no tiene dónde vivir |
| **05** | `buildSlug` y el seed de la nube `demo` | Los productos del seed no tienen `imageUrl` real y las vistas previas salen sin foto |
| **01** | Las reglas de ESLint que bloquean repositorios en `src/app/**` | `sitemap.ts` termina importando Prisma y el sitemap deja de testearse |

### 12.2 Habilita a

| Tarea | Qué usa de acá |
|---|---|
| **21** | `NEXT_PUBLIC_SITE_URL` en producción, `robots.txt` y `sitemap.xml` como parte del checklist de despliegue, y el aviso de `site.ts` como aviso de despliegue incompleto |

### 12.3 Bloqueos de esta tarea

- **El dominio real.** Sin `NEXT_PUBLIC_SITE_URL` en producción, el sitemap publica URLs de `localhost` y eso se descubre cuando ya está indexado. **Es el único bloqueo duro de la tarea**, y no es técnico: es una decisión del negocio.
- **La carga de los datos del negocio.** La Tarea 17 es la que deja `business_settings` con dirección e Instagram reales. Si el encargado todavía no los cargó, el JSON-LD del `Restaurant` no se publica. El sitio funciona igual; lo que falta es el dato.

### 12.4 Riesgos

| Riesgo | Mitigación |
|---|---|
| Que `SITE_URL` caiga al fallback en producción y Google indexe `localhost` | `console.warn` explícito en el build de producción, más el checklist de despliegue de la Tarea 21 |
| Que alguien elimine el escape de `<` "porque `JSON.stringify` ya escapa" | El test de §10.1 falla, y el criterio 8.5 lo dice en una línea |
| Que aparezca un `opengraph-image.tsx` por producto | El test de estructura de §10.4 |
| Que el sitemap se vacíe en silencio cuando la base falla | El tercer test de §10.3 y la ausencia de `catch` en `readSitemapEntries` |
| Que `updatedAt` empiece a aparecer en `ProductDTO` "porque total ya está" | El criterio 8.3: la proyección angosta vive en el repositorio |
| Que un día "cerrado" se publique como día abierto por un `?? {}` mal puesto | `flatMap` sobre `WEEKDAY_KEYS` y el test de §10.2 |
