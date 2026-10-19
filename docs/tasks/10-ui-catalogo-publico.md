# Tarea 10 — UI del Catálogo Público

| Campo | Valor |
|---|---|
| **ID** | 10 |
| **Fase (DESIGN.md §8.4)** | Fase 2 — Catálogo Público |
| **Depende de** | 08, 09 |
| **Habilita** | 13, 18 |
| **Tipo** | Presentación |
| **Esfuerzo est.** | 4 – 5 días |

---

## 1. Objetivo de la tarea

Construir **la primera pantalla que ve el cliente**: la home, el catálogo completo en `/menu` y la ficha de producto en `/producto/[slug]`. Tres rutas públicas servidas como Server Components, con caché ISR, responsive desde 320 px y accesibles con teclado y lector de pantalla.

**Criterio de éxito verificable:** `rg "server/repositories|prisma" src/app src/components/catalog` devuelve cero resultados, el catálogo renderiza un producto agotado con badge y sin acción de agregar, y Lighthouse en modo móvil sobre `/menu` da ≥ 90 en Performance sin que la imagen LCP bloquee el render.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 08 completada (servicios de catálogo con caché por tag) y Tarea 09 completada (tokens `@theme` y las trece primitivas de `src/components/ui/`). También la Tarea 06, de la que se usa `buildCloudinaryImageUrl`.

**Contexto arquitectónico:**

```
Capa 1 · Presentación  ──▶  Capa 3 · Servicio  ──▶  Capa 4 · Repository  ──▶  Postgres
  "¿cómo se ve el           "¿qué es visible,       "¿cómo se
   catálogo?"                en qué orden y          obtiene?"
                             con qué caché?"
```

Esta tarea **no decide nada de negocio**. Recibe un `CatalogDTO` de la Tarea 08 y lo dibuja. Si aparece una regla nueva ("los agotados no se muestran"), esa regla pertenece a la Tarea 08, no acá: la presentación no filtra datos, los recibe ya filtrados.

### 2.1 Checklist de prerrequisitos

- [ ] `npm run typecheck` en verde (Tareas 08 y 09 compilan)
- [ ] `npx prisma migrate status` reporta la base al día y hay productos `PUBLISHED` de prueba
- [ ] `src/lib/domain/catalog.ts` exporta `CatalogSection`, `CatalogDTO`, `hasAvailableProducts` y `countProducts`
- [ ] `src/components/ui/index.ts` exporta las trece primitivas
- [ ] `next.config.ts` tiene `images.remotePatterns` con `res.cloudinary.com` (Tarea 06)
- [ ] `CLOUDINARY_CLOUD_NAME` está definida en `.env.local`
- [ ] `src/app/page.tsx` de la Tarea 01 existe todavía y va a ser reemplazada (§3.3)

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `src/config/site.ts` | Constantes del sitio: `SITE_URL`, `SITE_NAME`, `SITE_DESCRIPTION` |
| `src/lib/format/currency.ts` | `formatARS`. Formato de moneda. Sin estado, sin I/O |
| `src/lib/images/cloudinary-loader.ts` | Loader de `next/image` que pide la transformación a Cloudinary en vez de descargar y redimensionar en el optimizador |
| `src/server/services/index.ts` | Composition root: cablea repositorios y servicios una sola vez para las tres rutas |
| `src/app/(public)/layout.tsx` | Layout público: `BusinessHeader`, `<main>`, `BusinessFooter` |
| `src/app/(public)/page.tsx` | Home: hero, destacados, acceso al menú |
| `src/app/(public)/error.tsx` | Frontera de error del grupo público. `"use client"` |
| `src/app/(public)/menu/page.tsx` | Catálogo completo agrupado por categoría, con navegación sticky |
| `src/app/(public)/menu/loading.tsx` | Skeleton del grid con la geometría de la card real |
| `src/app/(public)/producto/[slug]/page.tsx` | Ficha de producto, con `generateStaticParams` y `generateMetadata` |
| `src/app/(public)/producto/[slug]/loading.tsx` | Skeleton de la ficha |
| `src/app/(public)/producto/[slug]/not-found.tsx` | 404 de producto, con salida visible hacia el menú |
| `src/components/catalog/ProductImage.tsx` | Imagen con `next/image`, loader de Cloudinary, placeholder y estado desaturado |
| `src/components/catalog/AvailabilityBadge.tsx` | "Agotado" con `Badge tone="danger"`, opcionalmente "Disponible" |
| `src/components/catalog/AllergenList.tsx` | Lista de alérgenos con el glosario cerrado de la Tarea 00 |
| `src/components/catalog/ProductCard.tsx` | Card del grid. **Client Component**: toast y animación |
| `src/components/catalog/ProductCardSkeleton.tsx` | Geometría de la card en `Skeleton`. Compartida por los tres `loading.tsx` |
| `src/components/catalog/ProductGrid.tsx` | Rejilla responsive de 1, 2, 3 o 4 columnas |
| `src/components/catalog/CategorySection.tsx` | `<section>` con ancla, `<h2>` y el grid de la categoría |
| `src/components/catalog/CategoryNav.tsx` | Índice sticky con scroll-snap horizontal en mobile. **Client Component** |
| `src/components/catalog/CatalogView.tsx` | Ensamblaje de la página de menú: nav + secciones |
| `src/components/catalog/ClosingMessage.tsx` | Aviso de cierre si el local lo cargó |
| `src/components/catalog/OpeningHours.tsx` | Grilla de horarios con los días de la semana en español |
| `src/components/catalog/BusinessHeader.tsx` | Cabecera con nombre del local y navegación |
| `src/components/catalog/BusinessFooter.tsx` | Pie con dirección, Instagram, horarios y aviso legal |
| `src/lib/format/currency.test.ts` | `formatARS` contra el locale `es-AR` |
| `src/lib/images/cloudinary-loader.test.ts` | Equivalencia del loader con `buildCloudinaryImageUrl` y pass-through de URLs ajenas |
| `src/components/catalog/AvailabilityBadge.component.test.tsx` | Tono y texto del badge |
| `src/components/catalog/AllergenList.component.test.tsx` | Glosario, lista vacía y valor desconocido |
| `src/components/catalog/ProductCard.component.test.tsx` | Agotado desaturado y sin acción, precio formateado, `alt` descriptivo |
| `src/components/catalog/CategoryNav.component.test.tsx` | Un enlace por sección, `aria-current`, `aria-label` del landmark |

Tres archivos de la tabla anterior no estaban en el plan original y se agregan con motivo:

| Archivo | Por qué existe |
|---|---|
| `CatalogView.tsx` | El ejemplo de cableo de la Tarea 08 §7 ya define `<CatalogView catalog={catalog} />`. Sin ese componente, cada ruta reimplementa nav + secciones y el índice lateral se desincroniza del contenido |
| `ProductCardSkeleton.tsx` | La geometría del skeleton aparece en tres `loading.tsx`. Copiada tres veces, cualquier ajuste de la card rompe dos de ellas y el layout salta |
| `src/lib/images/cloudinary-loader.ts` | `DESIGN.md §4.4` pide loader de Cloudinary. `buildCloudinaryImageUrl` de la Tarea 06 vive en un módulo con `server-only` y lee `process.env`, así que no se puede usar como `ImageLoader` de cliente (§6.3) |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `src/app/not-found.tsx` | Agregar salida visible al menú y a la home. Hoy es la pantalla que el cliente ve desde cualquier enlace roto |
| `next.config.ts` | Agregar `images.minimumCacheTTL` para que la entrega optimizada de Cloudinary no se regenere en cada request |
| `docs/tasks/README.md` | Marcar Tarea 10 |

### 3.3 Eliminar

| Ruta | Motivo |
|---|---|
| `src/app/page.tsx` | Se reemplaza por `src/app/(public)/page.tsx`. Si queda, Next resuelve dos rutas para `/` y falla el build. Es la única eliminación de esta tarea y va en el mismo commit |

---

## 4. Estructura N-Capas

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CAPA 1 · PRESENTACIÓN (esta tarea)                                       │
│                                                                          │
│  app/(public)/page.tsx  menu/page.tsx  producto/[slug]/page.tsx          │
│        │                                                                  │
│        ▼                                                                  │
│  components/catalog/  (RSC por defecto)                                  │
│  ── server/  CategorySection, ProductGrid, ProductImage, OpeningHours     │
│  ── client/   ProductCard, CategoryNav                                   │
│        │                                                                  │
│        ▼                                                                  │
│  src/server/services/index.ts  (composition root)                        │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
┌──────────────────────────────────────────────────────────────────────────┐
│ CAPA 3 · SERVICIO (Tarea 08)                                             │
│  getCatalogForPublic() · getFeaturedProductsForPublic()                  │
│  getProductBySlugForPublic() · getBusinessSettings()                     │
│  CATALOG_CACHE_TAG = "products"                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

La presentación **solo conoce la capa 3**, y únicamente a través de la interface pública. El único `import` de `server/` allowed es el `from "@/server/services"` en los tres `page.tsx` y en `CatalogView`. Ningún componente de `components/catalog/` importa un repository: `rg "server/repositories|prisma" src/components/catalog src/app` tiene que devolver cero.

---

## 5. Convenciones de código

### 5.1 Imports y alias

Solo el alias `@/` de `tsconfig.json`. Todo import de un módulo `server/` dentro de `app/` y `components/catalog/` tiene que ser de tipo `import type` cuando el símbolo es un tipo, o de un archivo que no arrastre `server-only`.

### 5.2 `"use client"` por componente, no por archivo compartido

`ProductCard` y `CategoryNav` llevan `"use client"` arriba de todo. Los demás son Server Components. No se crea un `index.ts` con `"use client"` que reexporte todo `components/catalog/`, porque arrastraría el límite de cliente a `CategorySection` y `ProductGrid` sin necesidad.

`"use client"` va en la primera línea, antes de cualquier import, sin punto y coma.

### 5.3 Tipos estrictos y módulos con nombre

Nada de tipos dinámicos: los props del loader y de cada componente se tipan con una interface explícita, y `tsc` corre con `strict`.

No se crea ningún cajón genérico de utilidades. Lo que se comparte va en el módulo con el nombre del concepto: `currency.ts` para el formato de moneda, `cloudinary-loader.ts` para la imagen, `catalog.ts` para los tipos del dominio. Un archivo que se llama "utilidades" termina siendo el lugar donde aterriza todo lo que nadie supo dónde poner, y a las tres semanas nadie sabe qué se puede borrar.

### 5.4 Clases de Tailwind

Tokens del `@theme` de la Tarea 09. Nada de valores arbitrarios: si hace falta un color o un radio, se agrega el token, no el hex. Orden de clases con `prettier-plugin-tailwindcss` si el proyecto lo tiene; si no, orden semántico: layout, box model, tipografía, color.

### 5.5 Accesibilidad

- Un solo `<h1>` por página. Las categorías usan `<h2>`.
- Toda imagen decorativa lleva `alt=""`. `ProductImage` exige un `alt` no vacío, porque la card es un enlace con información.
- Landmarks: `<header>`, `<nav aria-label="Categorías">`, `<main>`, `<footer>`, `<aside>` para horarios.
- Foco visible en todos los elementos interactivos, incluido el índice lateral sticky.

### 5.6 Accesibilidad de los datos de disponibilidad

Agotado no se comunica solo con color. El badge lleva texto "Agotado" y la card desaturada mantiene contraste suficiente para leerse.

---

## 6. Pasos de implementación

### 6.1 Paso 1 — Constantes del sitio y formato de moneda

Primero lo que no depende de nadie, porque tres archivos lo importan y no se negocia en pull request.

`src/config/site.ts`:

```ts
// src/config/site.ts
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const SITE_NAME = "Café Ruta";

export const SITE_DESCRIPTION =
  "Café de especialidad en el barrio, tostado local y mesas para quedarse.";

export const SITE_WHATSAPP = process.env.NEXT_PUBLIC_SITE_WHATSAPP ?? "";
```

El fallback a `localhost` evita que el build de CI reviente por `SITE_URL` ausente, y `generateMetadata` sigue produciendo URLs absolutas correctas en producción.

`SITE_WHATSAPP` empieza vacío: esta tarea solo muestra el link de la ficha cuando el número ya está cargado, y la Tarea 13 lo completa con el valor real y el mensaje prearmado. Un número hardcodeado en un componente público es una constante que la Tarea 13 va a tener que cambiar igual.

`src/lib/format/currency.ts`:

```ts
// src/lib/format/currency.ts
const ARSONES = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatARS(amount: number): string {
  return ARSONES.format(amount);
}
```

`es-AR` rinde `$ 1.200` con espacio fino y sin decimales, que es como se escribe un precio de menú en Argentina. `Intl` se instancia a nivel de módulo: dentro del componente, cada render paga la construcción del formateador.

`formatARS` **no valida** el input. Recibe números de la capa 3 y no reinterpreta el dato. El redondeo de la aritmética del carrito es otra función, en la Tarea 11.

Test:

```ts
// src/lib/format/currency.test.ts
import { describe, expect, it } from "vitest";
import { formatARS } from "./currency";

describe("formatARS", () => {
  it("formatea sin decimales con el locale es-AR", () => {
    expect(formatARS(1200)).toContain("1.200");
  });

  it("no inventa decimales en importes enteros", () => {
    expect(formatARS(0)).toMatch(/0\s*$/);
    expect(formatARS(350)).not.toContain(",");
  });
});
```

### 6.2 Paso 2 — Loader de imágenes para Cloudinary

`buildCloudinaryImageUrl` de la Tarea 06 no se puede importar acá: vive en `src/server/services/image.service.ts`, que importa `server-only` y lee `process.env.CLOUDINARY_CLOUD_NAME`. Un `ImageLoader` de `next/image` se ejecuta en el navegador, así que ese import compila en TypeScript y revienta en runtime.

El loader no necesita nada de `server-only`. Solo necesita el nombre del cloud, que es público por definición (va en cada URL de imagen que el navegador ya descarga) y que además se expone al cliente con `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.

`next.config.ts`, un solo lugar:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
};

export default nextConfig;
```

`minimumCacheTTL` sube el default de 60 s a 7 días. Las imágenes de un menú no cambian seguido y cada recálculo en el optimizador es CPU y bytes en la respuesta.

`src/lib/images/cloudinary-loader.ts`:

```ts
// src/lib/images/cloudinary-loader.ts
import type { ImageLoaderProps } from "next/image";

export interface CloudinaryTransform {
  width?: number;
  height?: number;
  crop?: "fill" | "fit" | "limit" | "thumb";
  gravity?: "auto" | "center" | "face";
  quality?: "auto" | "auto:best" | number;
  format?: "auto" | "webp" | "avif" | "jpg";
  dpr?: "auto" | number;
}

interface CloudinaryTransformParams {
  cloudName?: string;
  crop?: CloudinaryTransform["crop"];
  gravity?: CloudinaryTransform["gravity"];
  quality?: CloudinaryTransform["quality"];
  format?: CloudinaryTransform["format"];
  dpr?: CloudinaryTransform["dpr"];
}

const DEFAULT_CROP: CloudinaryTransform["crop"] = "fill";
const DEFAULT_GRAVITY: CloudinaryTransform["gravity"] = "auto";
const DEFAULT_QUALITY = "auto";
const DEFAULT_FORMAT: CloudinaryTransform["format"] = "auto";

export function buildCloudinaryLoaderUrl(
  src: string,
  width: number,
  params: CloudinaryTransformParams = {},
): string {
  if (!src.includes("/upload/")) {
    return src;
  }

  const cloudName =
    params.cloudName ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (!cloudName) {
    return src;
  }

  const operations = [
    `f_${params.format ?? DEFAULT_FORMAT}`,
    `q_${params.quality ?? DEFAULT_QUALITY}`,
    `c_${params.crop ?? DEFAULT_CROP}`,
    `g_${params.gravity ?? DEFAULT_GRAVITY}`,
    `dpr_${params.dpr ?? "auto"}`,
    `w_${Math.round(width)}`,
  ];

  return src.replace(
    "/upload/",
    `/upload/${operations.join(",")}/`,
  );
}

export default function cloudinaryLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  return buildCloudinaryLoaderUrl(src, width, {
    quality: quality === undefined ? undefined : Number(quality),
  });
}
```

Dos decisiones que importan:

**El pass-through de `src` sin `/upload/`.** Si `publicUrl` devuelve una URL externa o un `data:` URI, se devuelve tal cual. Meter una transformación en una URL que no es de Cloudinary produce un 404 silencioso.

**El acuerdo de tipos en `quality`.** `ImageLoaderProps.quality` llega como `string | undefined` en el default de Next, pero `quality` de la Tarea 06 es `"auto" | "auto:best" | number`. La interface pública es lo único que traduce de un tipo al otro; internamente ambos caminos convergen a la misma forma de la URL.

`buildCloudinaryLoaderUrl` se exporta con nombre para poder compararlo con el helper de `server/` desde un test, sin necesidad de renderizar un componente.

`ImageTransform` de la Tarea 06 se declara acá por forma. La Tarea 09 no provee tipos de transformación, y duplicar la interface es menos riesgoso que mover un tipo compartido a `src/lib/domain/`, que es de la Tarea 01 y ya está cerrada.

Test:

```ts
// src/lib/images/cloudinary-loader.test.ts
import { describe, expect, it } from "vitest";
import { buildCloudinaryImageUrl } from "@/server/services/image.service";
import { buildCloudinaryLoaderUrl } from "./cloudinary-loader";

const SRC =
  "https://res.cloudinary.com/demo/image/upload/products/cafe-01.jpg";

describe("buildCloudinaryLoaderUrl", () => {
  it("produce la misma URL que el helper de server", () => {
    const viaLoader = buildCloudinaryLoaderUrl(SRC, 640, {
      cloudName: "demo",
    });
    const viaService = buildCloudinaryImageUrl(SRC, {
      cloudName: "demo",
      width: 640,
    });

    expect(viaLoader).toBe(viaService);
  });

  it("devuelve la URL sin tocar si no es de Cloudinary", () => {
    const external = "https://example.com/otra-imagen.jpg";

    expect(buildCloudinaryLoaderUrl(external, 640)).toBe(external);
  });

  it("no rompe cuando falta el nombre del cloud", () => {
    expect(buildCloudinaryLoaderUrl(SRC, 640)).toBe(SRC);
  });
});
```

La primera prueba es la que importa: ata el loader al helper real, así que si la Tarea 06 cambia la receta de transformaciones, el test falla en vez de servir imágenes deformadas en producción.

### 6.3 Paso 3 — Componentes de presentación base

`formatARS` y el loader de Cloudinary ya quedaron listos en los pasos 1 y 2. Acá van los tres componentes que no tienen estado.

#### `ProductImage`

Es un Server Component. Envuelve `next/image` con el loader de Cloudinary, aplica la desaturación cuando el producto está agotado y define un `sizes` explícito. El `sizes` no es opcional: sin él, `next/image` genera un `srcset` que asumirá siempre la pantalla más ancha del viewport y descarga hasta cinco veces lo necesario.

`src/components/catalog/ProductImage.tsx`:

```tsx
// src/components/catalog/ProductImage.tsx
import Image from "next/image";
import cloudinaryLoader from "@/lib/images/cloudinary-loader";

interface ProductImageProps {
  src: string;
  alt: string;
  available: boolean;
  sizes: string;
  priority?: boolean;
}

export function ProductImage({
  src,
  alt,
  available,
  sizes,
  priority = false,
}: ProductImageProps) {
  return (
    <Image
      loader={cloudinaryLoader}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      fetchPriority={priority ? "high" : "auto"}
      className={
        available
          ? "object-cover transition-transform duration-300 group-hover:scale-105"
          : "object-cover grayscale opacity-60 transition-transform duration-300 group-hover:scale-105"
      }
    />
  );
}
```

`priority` y `fetchPriority="high"` van juntos y solo en la imagen principal de la home. Marcar todas las imágenes del grid como `priority` le dice al navegador que las diez son críticas, que es lo contrario de priorizar.

#### `AvailabilityBadge`

Server Component. Envuelve `Badge` de la Tarea 09.

```tsx
// src/components/catalog/AvailabilityBadge.tsx
import { Badge } from "@/components/ui";

interface AvailabilityBadgeProps {
  available: boolean;
}

export function AvailabilityBadge({ available }: AvailabilityBadgeProps) {
  if (!available) {
    return (
      <Badge tone="danger">
        Agotado
      </Badge>
    );
  }

  return (
    <Badge tone="success">
      Disponible
    </Badge>
  );
}
```

Solo dos estados. El stock parcial no es un estado de la interfaz: si la Tarea 08 no lo filtra, acá no hay nada que distinguir.

#### `AllergenList`

Server Component. Toma los alérgenos del producto y los resuelve contra el glosario cerrado de la Tarea 00.

```tsx
// src/components/catalog/AllergenList.tsx
interface AllergenListProps {
  allergens: readonly string[];
  className?: string;
}

const TONE_DOT = "size-1.5 rounded-full bg-current opacity-60";

export function AllergenList({ allergens, className }: AllergenListProps) {
  if (allergens.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label="Alérgenos"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted ${className ?? ""}`}
    >
      {allergens.map((allergen) => (
        <li key={allergen} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={TONE_DOT} />
          {allergen}
        </li>
      ))}
    </ul>
  );
}
```

Devuelve `null` con lista vacía en vez de un bloque vacío: en la card, un `div` de alto cero es un hueco invisible en la grilla.

El texto visible es la etiqueta canónica que ya viene del DTO. `DESIGN.md` exige que no se traduzca el dato crudo, y el glosario cerrado de la Tarea 00 es la autoridad: si algún día llegara un valor fuera del glosario, se muestra tal cual y se reporta, no se inventa una traducción.

### 6.4 Paso 4 — `ProductCard`: la card del grid

Es **Client Component**. Necesita dos cosas que un Server Component no puede hacer: disparar el toast de "Próximamente" y animar la entrada.

```tsx
// src/components/catalog/ProductCard.tsx
"use client";

import Link from "next/link";
import { useToast } from "@/components/ui";
import { formatARS } from "@/lib/format/currency";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { ProductImage } from "./ProductImage";

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  available: boolean;
  imageUrl: string | null;
}

interface ProductCardProps {
  product: ProductCardData;
  priority?: boolean;
}

const DESCRIPTION_LIMIT = 120;

function truncate(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit).trimEnd()}…`;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
    const { toast } = useToast();
    const [isPending, setIsPending] = useState(false);

    const handleAdd = () => {
      toast({
        message: "El carrito llega en la Tarea 11.",
      });
    };

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-card border border-border bg-surface transition-shadow hover:shadow-card"
    >
      <div className="relative aspect-4/3 w-full overflow-hidden bg-surface-muted">
        {product.imageUrl ? (
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            available={product.available}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            priority={priority}
          />
        ) : (
          <div
            aria-hidden="true"
            className="size-full bg-surface-muted"
          />
        )}

        {!product.available && (
          <div className="absolute left-3 top-3">
            <AvailabilityBadge available={false} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold text-base text-ink">{product.name}</h3>

        <p className="line-clamp-2 text-sm text-muted">
          {truncate(product.description, DESCRIPTION_LIMIT)}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="font-display text-lg text-ink">
            {formatARS(product.price)}
          </span>

          {product.available ? (
            <button
              type="button"
              onClick={handleAdd}
              className="rounded-control bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast"
            >
              Agregar
            </button>
          ) : (
            <span className="text-sm text-muted">Sin stock</span>
          )}
        </div>
      </div>

      <Link
        href={`/producto/${product.slug}`}
        className="absolute inset-0"
      >
        <span className="sr-only">Ver {product.name}</span>
      </Link>
    </article>
  );
}
```

Cuatro decisiones que conviene que se entiendan antes de seguir:

**El botón "Agregar" es un placeholder declarado, no una acción a medias.** Muestra un toast y nada más. No llama a ninguna API de carrito, porque la Tarea 11 todavía no existe. El texto del toast lo dice sin rodeos. Cuando llegue la Tarea 11, este `handleAdd` es el punto exacto a reemplazar.

**El enlace que cubre la card va arriba del botón, no adentro.** Un `<button>` dentro de un `<Link>` es HTML inválido: dos elementos interactivos anidados, foco duplicado y comportamiento impredecible con teclado. La card tiene dos zonas clicables —el enlace que cubre todo y el botón "Agregar"— y por eso el enlace es un hermano absoluto con `span.sr-only` como alvo, no un contenedor del botón.

**La imagen de la card es `ProductImage` y el `alt` es el nombre del producto.** La card completa es un enlace con información, así que la imagen no es decorativa: `alt` no vacío.

**`handleAdd` no es asíncrono todavía.** Hoy solo dispara el toast. Cuando la Tarea 11 lo conecte, ese es el punto exacto donde entra el `await` a `addItemToCart` y donde vuelve a limpiar el estado. No agregar un `setTimeout` artificial para simularlo: sería un parche sobre un comportamiento que todavía no existe.

`ProductImage` no se importa como default y sí con nombre, siguiendo el patrón de `import { X } from "@/components/ui"` de la Tarea 09.

### 6.5 Paso 5 — `ProductGrid` y `CategorySection`

#### `ProductGrid`

Server Component. Solo decide columnas y reemplaza el DTO por el modelo de vista de la card.

```tsx
// src/components/catalog/ProductGrid.tsx
import type { ProductDTO } from "@/lib/domain/catalog";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: readonly ProductDTO[];
  priorityCount?: number;
  columns?: 2 | 3 | 4;
}

const COLUMN_CLASS: Record<NonNullable<ProductGridProps["columns"]>, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

export function ProductGrid({
  products,
  priorityCount = 0,
  columns = 3,
}: ProductGridProps) {
  return (
    <div className={`grid gap-4 ${COLUMN_CLASS[columns]}`}>
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={index < priorityCount}
        />
      ))}
    </div>
  );
}
```

`columns` es explícito y no se deduce del viewport. La home usa 4, el menú 3, y `priorityCount` marca cuántas imágenes son LCP probable. En el menú es 0: ahí la LCP es otra cosa.

El mapper de `ProductDTO` a `ProductCardData` se hace en `CatalogView`, no acá. `ProductGrid` no conoce la forma del DTO, conoce la de la card.

#### `CategorySection`

Server Component. `<section>` con ancla, `<h2>` y el grid.

```tsx
// src/components/catalog/CategorySection.tsx
import type { CatalogSection as CatalogSectionDTO } from "@/lib/domain/catalog";
import { ProductGrid } from "./ProductGrid";

interface CategorySectionProps {
  section: CatalogSectionDTO;
}

export function CategorySection({ section }: CategorySectionProps) {
  return (
    <section
      id={section.categorySlug}
      aria-labelledby={`${section.categorySlug}-titulo`}
      className="scroll-mt-28 py-8"
    >
      <h2
        id={`${section.categorySlug}-titulo`}
        className="font-display text-2xl text-ink"
      >
        {section.categoryName}
      </h2>

      <div className="mt-4">
        <ProductGrid products={section.products} />
      </div>
    </section>
  );
}
```

`scroll-mt-28` no es decorativo: sin él, el `scrollIntoView` del índice lateral deja el `<h2>` de la categoría tapado debajo del header sticky.

### 6.6 Paso 6 — `CategoryNav` y `CatalogView`

#### `CategoryNav`

**Client Component.** Solo necesita `useEffect` para marcar la categoría que se está leyendo.

```tsx
// src/components/catalog/CategoryNav.tsx
"use client";

import { useEffect, useState } from "react";

interface CategoryLink {
  slug: string;
  name: string;
}

interface CategoryNavProps {
  categories: readonly CategoryLink[];
}

export function CategoryNav({ categories }: CategoryNavProps) {
  const [activeSlug, setActiveSlug] = useState(categories[0]?.slug ?? "");

  useEffect(() => {
    const sections = categories
      .map(({ slug }) => document.getElementById(slug))
      .filter((element): element is HTMLElement => element !== null);

    if (sections.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) {
          setActiveSlug(visible[0].target.id);
        }
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );

    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, [categories]);

  return (
    <nav
      aria-label="Categorías"
      className="sticky top-16 z-30 -mx-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur"
    >
      <ul className="flex snap-x gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible">
        {categories.map(({ slug, name }) => {
          const isActive = slug === activeSlug;

          return (
            <li key={slug} className="snap-start">
              <a
                href={`#${slug}`}
                aria-current={isActive ? "true" : undefined}
                className={
                  isActive
                    ? "inline-block rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast"
                    : "inline-block rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink"
                }
              >
                {name}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

Cuatro puntos que se esconden:

**Es scroll horizontal en mobile, no una lista de 40 píxeles de alto.** En 320 px, ocho categorías en flex-wrap se comen media pantalla y empujan el producto fuera de vista. Con `overflow-x-auto` y `snap-x` el índice queda en una línea con arrastre por toque. En `sm` y arriba vuelve a ser una lista normal, porque ahí hay ancho de sobra.

**El `IntersectionObserver` va en un `useEffect`, no en el render.** El componente es cliente, pero los `section` que observa los renderiza el servidor. El `useEffect` corre una sola vez en el cliente, después del montaje, que es cuando el DOM existe. Buscar por `getElementById` evita tener que pasar refs a través de `CatalogView`.

**El `rootMargin` de "-96px 0px -60% 0px"** hace que la categoría activa sea la primera que ocupa la parte superior de la ventana, no la que roza el borde inferior. Sin ese recorte, la activa cambia varias veces durante un scroll largo.

**`aria-current="true"`** en el enlace activo. Un `className` distinto no le dice nada a un lector de pantalla: hay que marcarlo en el DOM.

#### `CatalogView`

Server Component. Es el ensamblaje de la página de menú. Existe porque el ejemplo de la Tarea 08 §7 ya lo nombraba, y porque las tres rutas comparten nav + secciones.

```tsx
// src/components/catalog/CatalogView.tsx
import type { CatalogDTO, ProductDTO } from "@/lib/domain/catalog";
import { CategoryNav } from "./CategoryNav";
import { CategorySection } from "./CategorySection";
import type { ProductCardData } from "./ProductCard";

interface CatalogViewProps {
  catalog: CatalogDTO;
}

const DESCRIPTION_LIMIT = 120;

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit).trimEnd()}…`;
}

function toCardData(product: ProductDTO): ProductCardData {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: product.price,
    available: product.available,
    imageUrl: product.imageUrl,
  };
}

export function CatalogView({ catalog }: CatalogViewProps) {
  const categories = catalog.sections.map((section) => ({
    slug: section.categorySlug,
    name: section.categoryName,
    products: section.products.map(toCardData),
  }));

  return (
    <>
      <CategoryNav
        categories={categories.map(({ slug, name }) => ({ slug, name }))}
      />

      <div className="flex flex-col">
        {categories.map((section) => (
          <CategorySection key={section.slug} section={section} />
        ))}
      </div>
    </>
  );
}
```

La conversión `ProductDTO` → `ProductCardData` vive acá y no en `ProductGrid`, porque la card necesita campos que el DTO de categoría no expone y la ficha de producto sí. Centralizarlo evita que la card reciba un objeto con la forma equivocada en la mitad de las rutas.

### 6.7 Paso 7 — `OpeningHours`, `ClosingMessage`, `BusinessHeader` y `BusinessFooter`

#### `OpeningHours`

Server Component. Toma `OpeningHours` de `BusinessSettingsDTO` y lo muestra como grilla.

```tsx
// src/components/catalog/OpeningHours.tsx
import type { OpeningHours as OpeningHoursDTO } from "@/lib/domain/settings";

interface OpeningHoursProps {
  hours: readonly OpeningHoursDTO[];
}

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_LABEL: Record<(typeof DAY_ORDER)[number], string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const CLOSED_LABEL = "Cerrado";

function formatRange(hour: OpeningHoursDTO): string {
  if (!hour.open || !hour.close) {
    return CLOSED_LABEL;
  }

  return `${String(hour.open).padStart(2, "0")} a ${String(hour.close).padStart(2, "0")} hs`;
}

export function OpeningHours({ hours }: OpeningHoursProps) {
  const byDay = new Map(hours.map((hour) => [hour.day, hour]));
  const ordered = DAY_ORDER.map(
    (day) => byDay.get(day) ?? { day, open: null, close: null },
  );

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Horarios de atención</caption>
      <tbody>
        {ordered.map((hour) => (
          <tr key={hour.day} className="border-b border-border last:border-0">
            <th scope="row" className="py-1.5 text-left font-normal text-muted">
              {DAY_LABEL[hour.day]}
            </th>
            <td className="py-1.5 text-right font-medium text-ink">
              {formatRange(hour)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

`<table>` y no una grilla de `<div>`: la relación día → horario es tabular y un lector de pantalla la anuncia con `scope="row"` de forma nativa. El `caption` con `sr-only` le da nombre accesible a la tabla.

El orden de los días lo fija `DAY_ORDER`, no el orden en que llegan del DTO. Si la base devuelve los días desordenados, el cliente ve "Domingo, Lunes, Martes" y pierde credibility en la primera pantalla.

**No se calcula "Abierto ahora" ni "Cerrado ahora" en el HTML.** El día actual se resuelve en el servidor o en el cliente, pero no en un componente estático que se sirve desde la caché ISR: un Tuesday cacheado de ayer es peor que no mostrarlo. `DESIGN.md §4.2` descarta el badge de estado por esto.

#### `ClosingMessage`

Server Component. Muestra el aviso de cierre solo si el local lo cargó.

```tsx
// src/components/catalog/ClosingMessage.tsx
interface ClosingMessageProps {
  message: string | null;
}

export function ClosingMessage({ message }: ClosingMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <aside
      role="note"
      className="rounded-card border border-border bg-surface-muted p-4 text-sm text-ink"
    >
      <p className="font-medium">{message}</p>
    </aside>
  );
}
```

`ClosingMessage` no calcula el estado del local. Muestra lo que `BusinessSettingsDTO.closingMessage` trae, que es un texto escrito por la persona a cargo. Si el mensaje dice "Cerrado por vacaciones hasta el 12" y el local reabre, hay que editar el texto; no se resuelve con lógica de fechas.

#### `BusinessHeader` y `BusinessFooter`

Server Components. `BusinessHeader` lleva el nombre, la navegación y el botón de carrito. Este último lo implementa la Tarea 11; por ahora el hueco se reserva con un placeholder que se explica.

```tsx
// src/components/catalog/BusinessHeader.tsx
import Link from "next/link";
import type { BusinessSettingsDTO } from "@/lib/domain/settings";

interface BusinessHeaderProps {
  settings: BusinessSettingsDTO;
}

const NAV_LINKS = [
  { href: "/menu", label: "Menú" },
  { href: "/#nosotros", label: "Nosotros" },
  { href: "/#visitanos", label: "Visitanos" },
] as const;

export function BusinessHeader({ settings }: BusinessHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-display text-lg text-ink">
          {settings.name}
        </Link>

        <nav aria-label="Principal">
          <ul className="flex items-center gap-4 text-sm">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-muted hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* La Tarea 11 reemplaza este placeholder por CartButton */}
        <span
          aria-hidden="true"
          className="size-10 rounded-control border border-border"
        />
      </div>
    </header>
  );
}
```

El placeholder del carrito es un `span` vacío con `aria-hidden`, para que el header tenga la misma altura final y el contenido no salte cuando aparezca el botón. No es un botón deshabilitado: un control que se ve pero no hace nada es peor que un hueco.

```tsx
// src/components/catalog/BusinessFooter.tsx
import Link from "next/link";
import type { BusinessSettingsDTO } from "@/lib/domain/settings";
import { OpeningHours } from "./OpeningHours";

interface BusinessFooterProps {
  settings: BusinessSettingsDTO;
}

export function BusinessFooter({ settings }: BusinessFooterProps) {
  return (
    <footer className="border-t border-border bg-surface-muted">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="font-display text-lg text-ink">{settings.name}</p>
          <address className="text-sm not-italic text-muted">
            {settings.address}
          </address>
          {settings.instagramHandle && (
            <a
              href={`https://instagram.com/${settings.instagramHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent hover:underline"
            >
              @{settings.instagramHandle}
            </a>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Horarios
          </h2>
          <div className="mt-2">
            <OpeningHours hours={settings.openingHours} />
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted">
          <p>
            © {new Date().getFullYear()} {settings.name}
          </p>
          <Link href="/legal" className="hover:text-ink">
            Aviso legal
          </Link>
        </div>
      </div>
    </footer>
  );
}
```

El año con `new Date().getFullYear()` sí es correcto acá, y a propósito: el pie se renderiza en servidor, no se sirve desde un HTML estático cacheado por día, y copyright desactualizado es un detalle que la gente nota.

### 6.8 Paso 8 — Composition root de la capa 3

El ejemplo de la Tarea 08 §7 ya define este archivo. Acá se completa con los tres servicios que usan las rutas públicas.

`src/server/services/index.ts`:

```ts
// src/server/services/index.ts
import { PrismaClient } from "@/server/db/prisma";
import { prismaCategoryRepository } from "@/server/repositories/category.repository";
import { prismaProductRepository } from "@/server/repositories/product.repository";
import { prismaBusinessSettingsRepository } from "@/server/repositories/business-settings.repository";
import {
  createCatalogService,
  type CatalogService,
} from "./catalog.service";
import {
  createProductService,
  type ProductService,
} from "./product.service";
import {
  createBusinessSettingsService,
  type BusinessSettingsService,
} from "./business-settings.service";

function getPrismaClient(): PrismaClient {
  return prisma();
}

let catalogService: CatalogService | undefined;
let productService: ProductService | undefined;
let businessSettingsService: BusinessSettingsService | undefined;

export function getCatalogService(): CatalogService {
  catalogService ??= createCatalogService({
    categoryRepository: prismaCategoryRepository,
    productRepository: prismaProductRepository,
  });

  return catalogService;
}

export function getProductService(): ProductService {
  productService ??= createProductService({
    productRepository: prismaProductRepository,
    categoryRepository: prismaCategoryRepository,
  });

  return productService;
}

export function getBusinessSettingsService(): BusinessSettingsService {
  businessSettingsService ??= createBusinessSettingsService({
    businessSettingsRepository: prismaBusinessSettingsRepository,
  });

  return businessSettingsService;
}
```

`??=` sobre una variable de módulo da un singleton por proceso sin `import` de lado. En desarrollo, con hot reload, el módulo se reevalúa y se crea un service nuevo: por eso el campo es `let` y no un `const` calculado al import.

### 6.9 Paso 9 — Layout del grupo público y la home

#### `(public)/layout.tsx`

El route group no cambia la URL: `(public)/layout.tsx` envuelve `/`, `/menu` y `/producto/[slug]` sin agregar un segmento. Sirve para tener un solo layout público en vez de repetir header y footer en cada página.

```tsx
// src/app/(public)/layout.tsx
import type { Metadata } from "next";
import { getBusinessSettingsService } from "@/server/services";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/config/site";
import { BusinessFooter } from "@/components/catalog/BusinessFooter";
import { BusinessHeader } from "@/components/catalog/BusinessHeader";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "es_AR",
  },
};

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getBusinessSettingsService().getBusinessSettings();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-ink">
      <BusinessHeader settings={settings} />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <BusinessFooter settings={settings} />
    </div>
  );
}
```

`metadataBase` en el layout y no en cada `generateMetadata`: define cómo se resuelven las URLs relativas de Open Graph en todo el grupo. Sin él, `openGraph.images` produce una URL relativa y los buscadores la descartan.

`export const metadata` convive con `generateMetadata` en las hijas. La hija pisa lo que declara, el template `%s | Café Ruta` se aplica solo, y el resto de los campos (`metadataBase`, `openGraph.siteName`) se hereda.

El layout es `async` porque lee los datos del local. Next lo ejecuta en el servidor y su resultado se incluye en la caché del segmento. Los datos del negocio cambian una vez cada varios meses: revalidar en cada visita sería tirar una consulta a la base para nada.

#### `(public)/page.tsx`

```tsx
// src/app/(public)/page.tsx
import Link from "next/link";
import { hasAvailableProducts } from "@/lib/domain/catalog";
import { getCatalogService, getProductService } from "@/server/services";
import { ProductGrid } from "@/components/catalog/ProductGrid";

export const revalidate = 3600;

export default async function HomePage() {
  const [featured, catalog] = await Promise.all([
    getProductService().getFeaturedProductsForPublic(4),
    getCatalogService().getCatalogForPublic(),
  ]);

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="font-display text-4xl text-balance text-ink sm:text-5xl">
          Café de especialidad, tostado en el barrio
        </h1>

        <p className="mt-4 max-w-prose text-lg text-muted">
          Bajá el menú, armá tu pedido y mandanos un mensaje por WhatsApp.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/menu"
            className="rounded-control bg-accent px-5 py-3 font-medium text-accent-contrast"
          >
            Ver el menú
          </Link>

          <Link
            href="/#visitanos"
            className="rounded-control border border-border px-5 py-3 font-medium text-ink"
          >
            Cómo llegar
          </Link>
        </div>
      </section>

      {featured.length > 0 && (
        <section
          aria-labelledby="destacados"
          className="mx-auto max-w-6xl px-4 py-12"
        >
          <h2
            id="destacados"
            className="font-display text-2xl text-ink"
          >
            Destacados
          </h2>

          <div className="mt-4">
            <ProductGrid
              products={featured}
              columns={4}
              priorityCount={1}
            />
          </div>
        </section>
      )}

      {!hasAvailableProducts(catalog) && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <p className="rounded-card border border-border bg-surface-muted p-4 text-muted">
            Estamos reponiendo el menú. Escribinos y te avisamos cuando
            vuelva.
          </p>
        </section>
      )}
    </>
  );
}
```

`Promise.all` y no dos `await`: son dos consultas independientes a Postgres y resolverlas en paralelo vale la pena, además de que la segunda no espera a la primera para arrancar.

`priorityCount={1}` marca una sola imagen como LCP. `hasAvailableProducts` decide si el aviso de reposición tiene sentido, y es una función pura de la Tarea 08: la home no cuenta productos, consulta una decisión que ya está tomada.

### 6.10 Paso 10 — La página de menú

```tsx
// src/app/(public)/menu/page.tsx
import type { Metadata } from "next";
import { getCatalogService, getBusinessSettingsService } from "@/server/services";
import { CatalogView } from "@/components/catalog/CatalogView";
import { ClosingMessage } from "@/components/catalog/ClosingMessage";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Menú",
  description:
    "Cafés, infusiones y comida casera. Conocé el menú completo de Café Ruta.",
};

export default async function MenuPage() {
  const [catalog, settings] = await Promise.all([
    getCatalogService().getCatalogForPublic(),
    getBusinessSettingsService().getBusinessSettings(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <h1 className="py-8 font-display text-3xl text-ink">Menú</h1>

      <ClosingMessage message={settings.closingMessage} />

      {catalog.sections.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-muted p-6 text-muted">
          Todavía no cargamos productos. Volvé en un rato.
        </p>
      ) : (
        <CatalogView catalog={catalog} />
      )}
    </div>
  );
}
```

El estado vacío es un párrafo con el mismo borde y fondo que usa el sitio, no un `EmptyState` de la Tarea 09. `EmptyState` está pensado para estados con ícono, título y acción, y acá el caso es una sola frase: usar la primitiva grande sería ruido visual para el mismo contenido.

`revalidate = 3600` en vez de `true`. Con `true` Next revalida en cada visita y golpea la base para el mismo menú. Una hora es suficiente para un café: si mañana agrega un producto, aparece mañana, y el tag `"products"` revalida antes si hace falta.

### 6.11 Paso 11 — Ficha de producto, 404 y frontera de error

#### `producto/[slug]/page.tsx`

```tsx
// src/app/(public)/producto/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductService } from "@/server/services";
import { formatARS } from "@/lib/format/currency";
import { SITE_URL } from "@/config/site";
import { AvailabilityBadge } from "@/components/catalog/AvailabilityBadge";
import { ProductImage } from "@/components/catalog/ProductImage";
import { SITE_WHATSAPP } from "@/config/site";
import { AllergenList } from "@/components/catalog/AllergenList";

export const revalidate = 3600;

export const dynamicParams = true;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const products = await getProductService().getFeaturedProductsForPublic(24);

  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductService().getProductBySlugForPublic(slug);

  if (!product) {
    return { title: "Producto no encontrado" };
  }

  return {
    title: product.name,
    description: product.description.slice(0, 160),
    alternates: {
      canonical: `/producto/${product.slug}`,
    },
    openGraph: {
      type: "article",
      title: product.name,
      description: product.description.slice(0, 160),
      url: `${SITE_URL}/producto/${product.slug}`,
      images: product.imageUrl
        ? [{ url: product.imageUrl, alt: product.name }]
        : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductService().getProductBySlugForPublic(slug);

  if (!product) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Miga de pan" className="text-sm text-muted">
        <ol className="flex flex-wrap gap-2">
          <li>
            <a href="/menu" className="hover:text-ink">
              Menú
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <a href={`/menu#${product.categorySlug}`} className="hover:text-ink">
              {product.categoryName}
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-4/3 overflow-hidden rounded-card bg-surface-muted">
          {product.imageUrl && (
            <ProductImage
              src={product.imageUrl}
              alt={product.name}
              available={product.available}
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority
            />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl text-ink">{product.name}</h1>
            <AvailabilityBadge available={product.available} />
          </div>

          <p className="font-display text-2xl text-ink">
            {formatARS(product.price)}
          </p>

          <p className="max-w-prose text-muted">{product.description}</p>

          <AllergenList allergens={product.allergens} />

          {product.available ? (
            SITE_WHATSAPP.length > 0 ? (
              <div className="mt-2 rounded-card border border-border bg-surface p-4">
                <p className="text-sm text-muted">
                  El carrito llega en la Tarea 11. Por ahora,{" "}
                  <a
                    href={`https://wa.me/${SITE_WHATSAPP}`}
                    className="text-accent hover:underline"
                  >
                    mandanos el pedido por WhatsApp
                  </a>
                  .
                </p>
              </div>
            ) : null
          ) : (
            <p className="rounded-card bg-surface-muted p-4 text-sm text-muted">
              Este producto está agotado. Mirá las otras opciones del menú.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
```

Cuatro decisiones que conviene que se entiendan antes de seguir:

**`params` es una `Promise` y se espera con `await`.** En Next 15 los params de una página dinámica llegan como promesa. `const { slug } = await params` es obligatorio, no opcional.

**`generateStaticParams` precarga 24 productos y `dynamicParams` queda en `true`.** Los 24 se generan en el build, así que las fichas más vistas no cuestan una query. El resto se genera bajo demanda en la primera visita y se cachea una hora. Si `dynamicParams` fuera `false`, un producto nuevo creado en producción daría 404 hasta el próximo build.

**`generateMetadata` pide el producto otra vez.** Next no comparte la promesa entre `generateMetadata` y el render de la página, así que hay dos llamadas al servicio. Con la caché por tag de la Tarea 08, la segunda sale de memoria, no de Postgres.

**`notFound()` antes de usar el producto.** `getProductBySlugForPublic` devuelve `null` para un slug que no existe o que no está publicado. El `null` se maneja con `notFound()`, no con un error: un producto inexistente es un 404, no una falla del servidor.

`SITE_WHATSAPP` se importa de `@/config/site` y arranca vacío, así que el bloque del WhatsApp se renderiza solo cuando la Tarea 13 haya cargado el número.

#### `producto/[slug]/not-found.tsx`

```tsx
// src/app/(public)/producto/[slug]/not-found.tsx
import Link from "next/link";

export default function ProductNotFound() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-20">
      <h1 className="font-display text-3xl text-ink">
        No encontramos ese producto
      </h1>

      <p className="max-w-prose text-muted">
        Puede que haya cambiado de nombre o que ya no esté en el menú.
      </p>

      <Link
        href="/menu"
        className="rounded-control bg-accent px-5 py-3 font-medium text-accent-contrast"
      >
        Volver al menú
      </Link>
    </div>
  );
}
```

Un `not-found.tsx` que no ofrece salida es un callejón sin salida. Este incluye el link al menú, que es adonde el visitante realmente quiere ir.

#### `(public)/error.tsx`

```tsx
// src/app/(public)/error.tsx
"use client";

import { useEffect } from "react";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-20">
      <h1 className="font-display text-3xl text-ink">
        Algo se rompió de nuestro lado
      </h1>

      <p className="max-w-prose text-muted">
        La página no se pudo cargar. Podés reintentar.
      </p>

      <button
        type="button"
        onClick={reset}
        className="rounded-control bg-accent px-5 py-3 font-medium text-accent-contrast"
      >
        Reintentar
      </button>

      {error.digest && (
        <p className="text-xs text-muted">
          Código: {error.digest}
        </p>
      )}
}
}
```

`"use client"` es obligatorio: `error.tsx` recibe funciones, y un Server Component no puede tener `onClick`. `error.tsx` **no captura** errores del layout que lo contiene, solo de los segmentos hijos. Por eso el header y el footer siguen visibles cuando esta pantalla aparece.

El `digest` es la única referencia útil que llega al cliente en producción: es el identificador con el que se busca el error en los logs del servidor. Mostrarlo no filtra datos, filtra el ruido.

### 6.12 Paso 12 — Los tres `loading.tsx`

Skeleton con la geometría real de cada destino. Un spinner genérico hace que la página salte cuando llega el contenido; el skeleton mantiene el alto.

```tsx
// src/app/(public)/menu/loading.tsx
import { Skeleton } from "@/components/ui";
import { ProductCardSkeleton } from "@/components/catalog/ProductCardSkeleton";

export default function MenuLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <div className="h-10 w-40 py-8">
        <Skeleton className="size-full" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
```

El `h-10 w-40` del encabezado imita el alto del `<h1>` de la página real, así el título no empuja el grid al llegar.

`src/components/catalog/ProductCardSkeleton.tsx`:

```tsx
// src/components/catalog/ProductCardSkeleton.tsx
import { Skeleton } from "@/components/ui";

const CONTAINER = "rounded-card border border-border bg-surface";

export function ProductCardSkeleton() {
  return (
    <div
      className={`${CONTAINER} flex flex-col overflow-hidden`}
      aria-hidden="true"
    >
      <Skeleton className="aspect-4/3 w-full rounded-none" />

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />

        <div className="mt-auto flex items-center justify-between pt-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </div>
  );
}
```

`aria-hidden="true"` en el contenedor: el skeleton es decorativo. Sin eso, un lector de pantalla anuncia un dozen de bloques sin texto cada vez que la navegación empieza a cargar.

`aspect-4/3` y `rounded-none` tienen que coincidir exactamente con la imagen de `ProductCard`. Si el skeleton mide 16:9 y la card 4:3, el contenido salta al llegar y el skeleton pierde su propósito.

```tsx
// src/app/(public)/producto/[slug]/loading.tsx
import { Skeleton } from "@/components/ui";

export default function ProductLoading() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 py-8"
      aria-hidden="true"
    >
      <Skeleton className="h-4 w-64" />

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-4/3 w-full rounded-card" />

        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}
```

El tercer `loading.tsx` es el de la home, y comparte `ProductCardSkeleton` con el del menú. Ninguno exporta `revalidate`: los skeletons se renderizan durante la carga, no se cachean.

### 6.13 Paso 13 — Modificar el 404 raíz y `next.config.ts`

`src/app/not-found.tsx` ya existe desde la Tarea 01. Hoy es una pantalla genérica sin salida. Se le agregan los links, sin tocar el copy original más de lo necesario.

```tsx
// src/app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col items-start justify-center gap-4 px-4">
      <h1 className="font-display text-3xl text-ink">
        No encontramos esta página
      </h1>

      <p className="max-w-prose text-muted">
        Puede que el link esté viejo o que la dirección tenga un error de
        tipeo.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-control border border-border px-5 py-3 font-medium text-ink"
        >
          Ir al inicio
        </Link>

        <Link
          href="/menu"
          className="rounded-control bg-accent px-5 py-3 font-medium text-accent-contrast"
        >
          Ver el menú
        </Link>
      </div>
    </main>
  );
}
```

`next.config.ts` ya tiene `images.remotePatterns` de la Tarea 06. Solo se le agrega `minimumCacheTTL` (§6.2).

### 6.14 Paso 14 — Verificación manual

```bash
npm run typecheck
npm run lint
npm run build
npm run test
```

Después, en `npm run dev`:

| Verificación | Resultado esperado |
|---|---|
| `/` | Hero, destacados en grilla de 4, aviso de reposición si no hay disponibles |
| `/menu` con 8 categorías | Índice sticky en una línea, scroll por arrastre, `aria-current` en la visible |
| `/menu` sin productos | Párrafo con borde, sin índice, sin grid vacío |
| `/producto/cafe-medialuna` | Imagen, precio en `es-AR`, alérgenos, miga de pan |
| `/producto/no-existe` | 404 con link al menú |
| Producto agotado | Badge "Agotado", imagen desaturada, texto "Sin stock", sin botón |
| `/menu` a 320 px | Índice con scroll horizontal, grilla de 1 columna, sin desborde |
| `/menu` a 1440 px | Grilla de 3 columnas, ancho máximo contenido |
| Tab desde el header | Foco visible en cada enlace, orden de lectura lógico |
| DevTools con red a "Slow 3G" | El skeleton aparece y el contenido no salta al llegar |
| Consola del navegador | Cero errores y cero warnings de hidratación |

La última fila es la que más se descuida y la que más cuesta detectar a ojo: un desajuste de hidratación es un warning en consola, no un error visible.

### 6.15 Paso 15 — Actualizar el índice de tareas

En `docs/tasks/README.md`, cambiar el estado de la Tarea 10 a `hecho` y agregar la fecha. Si la Tarea 11 ya arrancó y todavía no está, dejar la 13 bloqueada por la 11.

---

## 7. Contratos y tipos

### 7.1 Interfaces de props

```ts
// Contratos de components/catalog
interface ProductCardProps {
  product: ProductCardData;
  priority?: boolean;
}

interface ProductGridProps {
  products: readonly ProductDTO[];
  priorityCount?: number;
  columns?: 2 | 3 | 4;
}

interface CategorySectionProps {
  section: CatalogSection;
}

interface CategoryNavProps {
  categories: readonly { slug: string; name: string }[];
}

interface ProductImageProps {
  src: string;
  alt: string;
  available: boolean;
  sizes: string;
  priority?: boolean;
}

interface AvailabilityBadgeProps {
  available: boolean;
}

interface AllergenListProps {
  allergens: readonly string[];
  className?: string;
}

interface ClosingMessageProps {
  message: string | null;
}

interface OpeningHoursProps {
  hours: readonly OpeningHours[];
}

interface BusinessHeaderProps {
  settings: BusinessSettingsDTO;
}

interface BusinessFooterProps {
  settings: BusinessSettingsDTO;
}

interface CatalogViewProps {
  catalog: CatalogDTO;
}
```

`ProductCardData` es una vista local de `ProductDTO`, declarada en `ProductCard.tsx` y construida por `CatalogView`. Existe porque la card solo necesita siete campos de los que el DTO expone, y validar esa reducción en un solo lugar evita que cada ruta pase el DTO entero a un componente que no lo usa.

### 7.2 Lo que la presentación no decide

| Decisión | Dónde vive | Por qué no acá |
|---|---|---|
| Qué productos se muestran | Tarea 08, `getCatalogForPublic` | Filtrar en el componente rompe la caché por tag y duplica la regla de publicación |
| El orden de las categorías y los productos | Tarea 08 | Es `sortOrder` de la base, no un `sort()` en JSX |
| Si un producto está disponible | Tarea 08, `available` | La presentación no consulta stock |
| El precio | `ProductDTO.price` | Formatear sí es de esta capa; calcular o redondear no |
| El mensaje de cierre | `BusinessSettingsDTO.closingMessage` | La presentación muestra texto, no decide si el local está cerrado |
| Si el pedido se manda a WhatsApp | Tarea 13 | Esta tarea solo deja el link con el número vacío |
| Si el producto entra al carrito | Tarea 11 | `handleAdd` es un placeholder declarado |

### 7.3 Estrategia de caché

| Aspecto | Decisión |
|---|---|
| Mecanismo | ISR con `revalidate = 3600` en las tres rutas |
| Tag | `"products"`, aplicado por la Tarea 08 vía `revalidateTag(CATALOG_CACHE_TAG)` |
| Invalidación | Desde el panel, la acción de la Tarea 18 revalida por tag sin deploy |
| Estático vs dinámico | Todo es estático salvo `error.tsx` y los dos Client Components |
| Datos del local | Se resuelven en el layout, una vez por render del layout |
| Sin caché de datos | El carrito no existe todavía, así que no hay lectura de `localStorage` en esta tarea |

`revalidate` en la ficha y en el menú apunta al mismo tag. Publicar un producto nuevo revalida las tres rutas de una.

---

## 8. Criterios de aceptación

- [ ] **8.1** `npm run build` termina sin errores y `npm run typecheck` y `npm run lint` están en verde, con `src/app/page.tsx` eliminado y una sola ruta para `/`.
- [ ] **8.2** `rg "server/repositories|prisma" src/app src/components/catalog` devuelve cero resultados, `rg "server-only" src/components/catalog src/app` devuelve cero, y solo `src/app/(public)/page.tsx`, `menu/page.tsx`, `producto/[slug]/page.tsx` y `src/server/services/index.ts` importan de `@/server/`.
- [ ] **8.3** `"/use client"/` aparece exactamente dos veces en `src/components/catalog/` (`ProductCard.tsx` y `CategoryNav.tsx`), más una en `src/app/(public)/error.tsx`; los demás componentes y las tres páginas son Server Components, y `next build` no reporta ningún error de límite cliente-servidor.
- [ ] **8.4** Los tres `loading.tsx` renderizan skeleton con la misma geometría que su destino, `ProductCardSkeleton` se usa en la home y en el menú, y en la consola del navegador no hay errores ni warnings de hidratación al navegar de `/` a `/menu` a una ficha.
- [ ] **8.5** Un producto agotado se muestra con badge "Agotado" visible, imagen desaturada y sin botón de agregar; un producto disponible muestra precio con `formatARS` e imagen con `alt` igual al nombre; `/producto/no-existe` devuelve 404 con enlace al menú; no hay scroll horizontal a 320 px y todo elemento interactivo es alcanzable por teclado con foco visible.

---

## 9. Casos borde

| Caso | Qué pasa | Por qué |
|---|---|---|
| Producto sin imagen | `ProductImage` no se renderiza; queda el `div` con el fondo neutro | Un `next/image` con `src=""` pide la imagen de la propia ruta y renderiza roto |
| Categoría sin productos | No llega en el DTO: la Tarea 08 no la incluye | Una sección vacía es un encabezado sin contenido, y el índice apuntaría a un ancla inexistente |
| Catálogo entero vacío | Párrafo de estado vacío en `/menu`, sin índice | `CatalogView` con `sections: []` dejaría un nav con `categories[0]` en `undefined` |
| Slug inexistente | `notFound()` desde el servicio, 404 con salida al menú | `ResourceNotFoundError` es de la capa 3; la página no lo atrapa, decide el código con `notFound()` |
| Producto despublicado después de generarse | `getProductBySlugForPublic` devuelve `null` y la página da 404 en la próxima revalidación | El tag cubre la caché, así que el cambio se ve sin deploy |
| `imageUrl` con URL externa | El loader la devuelve sin tocar | Meterle una transformación a una URL que no es de Cloudinary da 404 |
| Texto de producto larguísimo | `truncate` recorta a 120 caracteres en la card; la ficha muestra completo | El `line-clamp-2` de la card más el corte por caracteres es defensa doble |
| Alérgeno fuera del glosario | Se muestra la etiqueta tal cual y se reporta en el ticket | Traducirlo inventado es peor que mostrarlo crudo |
| `closingMessage` vacío | `ClosingMessage` devuelve `null` | Un bloque vacío en el layout empuja el menú hacia abajo |
| Cero `CLOUDINARY_CLOUD_NAME` en `.env.local` | El loader devuelve la URL original sin transformar | La página sigue mostrando imágenes, degradadas en calidad, en vez de romperse |
| Nombre de categoría con tilde o `ñ` | El ancla usa el slug, que es ASCII | Un `id` con acento rompe el `href="#..."` en algunos navegadores |
| Scroll a una categoría con el header sticky | `scroll-mt-28` deja el `<h2>` visible | Sin el margen, el encabezado queda debajo del header |
| `error.tsx` en desarrollo | Muestra el stack en la overlay de Next, no esta pantalla | En desarrollo el overlay es más útil que el mensaje propio |
| Ancho de 320 px | Grilla de 1 columna, índice con scroll horizontal | Un flex-wrap de ocho categorías empuja el producto fuera de pantalla |

---

## 10. Pruebas

| Archivo | Caso | Resultado esperado |
|---|---|---|
| `src/lib/format/currency.test.ts` | `formatARS(1200)` | Contiene `1.200`, con el separador de miles de `es-AR` |
| `src/lib/format/currency.test.ts` | `formatARS(0)` y `formatARS(350)` | Sin decimales ni coma decimal |
| `src/lib/images/cloudinary-loader.test.ts` | Loader vs `buildCloudinaryImageUrl` con los mismos params | URLs idénticas |
| `src/lib/images/cloudinary-loader.test.ts` | URL sin `/upload/` | Devuelve la URL sin modificar |
| `src/lib/images/cloudinary-loader.test.ts` | Sin `cloudName` | Devuelve la URL sin modificar, sin lanzar |
| `src/components/catalog/ProductCard.component.test.tsx` | Producto agotado | Badge "Agotado", sin botón "Agregar", con "Sin stock" |
| `src/components/catalog/ProductCard.component.test.tsx` | Producto disponible | Precio formateado, botón "Agregar", `alt` igual al nombre |
| `src/components/catalog/ProductCard.component.test.tsx` | Clic en "Agregar" | Se dispara el toast, sin llamar a ninguna API |
| `src/components/catalog/AvailabilityBadge.component.test.tsx` | `available={false}` | `Badge` con `tone="danger"` y texto "Agotado" |
| `src/components/catalog/AllergenList.component.test.tsx` | Alérgenos con tilde | Se muestran tal cual, sin traducir |
| `src/components/catalog/AllergenList.component.test.tsx` | Lista vacía | No renderiza nada |
| `src/components/catalog/CategoryNav.component.test.tsx` | Categorías varias | Un enlace por sección, con `aria-label="Categorías"` |
| `src/components/catalog/CategoryNav.component.test.tsx` | Sección visible | El enlace activo tiene `aria-current="true"` |

Test de la card, que es el que importa:

```tsx
// src/components/catalog/ProductCard.component.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/ui";
import { ProductCard, type ProductCardData } from "./ProductCard";

const AVAILABLE: ProductCardData = {
  id: "prod-1",
  slug: "cafe-medialuna",
  name: "Café y medialuna",
  description: "Blend de la casa con medialuna de manteca.",
  price: 4500,
  available: true,
  imageUrl: null,
};

const SOLD_OUT: ProductCardData = {
  ...AVAILABLE,
  id: "prod-2",
  slug: "cortado",
  name: "Cortado",
  available: false,
};

function renderCard(product: ProductCardData) {
  return render(
    <ToastProvider>
      <ProductCard product={product} />
    </ToastProvider>,
  );
}

describe("ProductCard", () => {
  it("muestra el precio formateado y el botón cuando hay stock", () => {
    renderCard(AVAILABLE);

    expect(screen.getByText("Café y medialuna")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar" })).toBeInTheDocument();
  });

  it("sin botón y con badge cuando está agotado", () => {
    renderCard(SOLD_OUT);

    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.getByText("Sin stock")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Agregar" }),
    ).not.toBeInTheDocument();
  });

  it("avisa que el carrito todavía no existe", async () => {
    const user = userEvent.setup();
    renderCard(AVAILABLE);

    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(
      screen.getByText("El carrito llega en la Tarea 11."),
    ).toBeInTheDocument();
  });

  it("expone el enlace de la ficha con nombre accesible", () => {
    renderCard(AVAILABLE);

    expect(
      screen.getByRole("link", { name: "Ver Café y medialuna" }),
    ).toHaveAttribute("href", "/producto/cafe-medialuna");
  });
});
```

El test del toast no lleva mock: el clic no pega a ninguna API todavía, así que no hay nada que interceptar. Cuando la Tarea 11 conecte `addItemToCart`, ahí sí va un `vi.fn()` sobre el store.

No hay test de render que espere la animación: la transición CSS no se puede verificar en jsdom, y probarla con timers falsos testea el test.

---

## 11. Definición de Hecho (DoD)

- [ ] `npm run build`, `npm run typecheck`, `npm run lint` y `npm run test` en verde
- [ ] Los tres criterios de runtime de §8 verificados a mano en `npm run dev`, con la consola del navegador limpia
- [ ] `rg "server/repositories|prisma|server-only" src/app src/components/catalog` sin resultados
- [ ] Solo `ProductCard.tsx`, `CategoryNav.tsx` y `error.tsx` con `"use client"`
- [ ] `next build` sin errores de límite cliente-servidor
- [ ] Lighthouse en `/menu` con Performance ≥ 90 en emulación móvil
- [ ] Imágenes servidas por Cloudinary con `f_auto` y `q_auto`, y `width` de 320 a 3840
- [ ] Sin scroll horizontal entre 320 y 1440 px
- [ ] Recorrido completo por teclado, con foco visible en cada control
- [ ] `npm audit --production` sin vulnerabilidades altas ni críticas
- [ ] Consola del navegador sin errores de hidratación
- [ ] `docs/tasks/README.md` actualizado con el estado y la fecha

---

## 12. Dependencias y bloqueos

### 12.1 Depende de

| Tarea | Qué aporta |
|---|---|
| 01 | Layout raíz, `Metadata`, `src/app/not-found.tsx`, alias `@/` |
| 06 | `buildCloudinaryImageUrl`, `ImageTransform`, `remotePatterns` |
| 07 | Esquema de `Product`, `Category`, `BusinessSettings` y seed |
| 08 | `getCatalogForPublic`, `getProductBySlugForPublic`, `getFeaturedProductsForPublic`, `getBusinessSettings`, `CatalogDTO`, `CatalogSection`, `ProductDTO`, `BusinessSettingsDTO`, `OpeningHours`, `hasAvailableProducts`, `countProducts`, `CATALOG_CACHE_TAG`, `ResourceNotFoundError` |
| 09 | `@theme` de Tailwind y las trece primitivas de `src/components/ui/` |

### 12.2 Habilita

| Tarea | Qué necesita de acá |
|---|---|
| 11 | El punto de integración del carrito: `handleAdd` en `ProductCard`, el placeholder del header y el `Sheet` montado en el layout público |
| 13 | `ProductGrid`, `CategorySection` y la ficha de producto, para sumar el selector de cantidad y el botón de handoff a WhatsApp |
| 18 | El panel: las mismas rutas y los mismos tags para previsualizar y revalidar |

### 12.3 Bloqueos

| Bloqueo | Efecto | Resolución |
|---|---|---|
| `Toast` de la Tarea 09 no expone slot de acción | `ProductCard` no puede ofrecer "Deshacer" todavía | La Tarea 11 extiende la primitiva; hasta entonces, el toast de "Agregar" es informativo |
| No existe `ImageLoader` de cliente | `buildCloudinaryImageUrl` no se puede usar directo en `next/image` | Resuelto en §6.2 con el loader isomórfico y su test de equivalencia |
| `SITE_WHATSAPP` sin valor | La ficha no muestra el link a WhatsApp | La Tarea 13 carga el número en `src/config/site.ts` |
| Panel de la Tarea 18 sin existir | No hay forma de revalidar por tag desde la interfaz | El tag `"products"` ya está expuesto por la Tarea 08 y alcanza con `curl` para probar |
| Textos de la home no confirmados | El hero usa copy de ejemplo | Reemplazar por el texto real antes de publicar; los strings están centralizados en el componente |

### 12.4 Fuera de alcance

- El carrito, la persistencia y el badge de cantidad: Tarea 11
- El checkout, el prearmado de WhatsApp y la revalidación de precios: Tarea 13
- El panel de administración y la subida de imágenes: Tarea 18
- Cualquier pago online: no existe en el producto
- Tests end-to-end de recorrido completo: Tarea 19

---

## Anexo — Estado "abierto/cerrado" del local (horario real, ISR-safe)

- **Dominio**: `src/lib/domain/horarios.ts` — `getOpenState(hours, now)` puro, timezone fija `America/Argentina/Mendoza`, soporta cierre de madrugada y días `null`/ausentes. Un `OpeningHours` VACÍO devuelve `null` ("sin informar"): no se muestra banner ni se bloquea nada — distinto de "cerrado".
- **ISR-safe**: el estado NUNCA se computa en el servidor (el HTML puede tener 1 h). `OpenStateBridge` (layout público) lo computa en el navegador y re-evalúa cada 60 s; `OpenStateBanner` solo renderiza cuando está cerrado. Así una página cacheada no puede anunciar un estado viejo.
- **Comportamiento cerrado**: banner prominente en `/menu` y compacto en home ("Hoy no abrimos" / "Ahora estamos cerrados" + próxima apertura + "podés mirar el menú y los precios igual"); el catálogo y los precios se muestran siempre.
- **Carrito bloqueado**: `AddToCartButton` deshabilitado ("Cerrado ahora", misma fuente de verdad: `open-state-store`), y `CheckoutForm` revalida el estado **en el momento del submit** (el local pudo cerrar mientras se completaba el formulario).
- `ClosingMessage` queda para avisos editoriales (feriados, vacaciones), ya no para el estado del día.
