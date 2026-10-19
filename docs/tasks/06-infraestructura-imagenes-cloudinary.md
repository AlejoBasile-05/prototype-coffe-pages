# Tarea 06 — Infraestructura de Imágenes: Cloudinary

| Campo | Valor |
|---|---|
| **ID** | 06 |
| **Fase (DESIGN.md §8.3)** | Fase 1 — Cimientos y Modelado |
| **Depende de** | 01 |
| **Habilita** | 16 |
| **Tipo** | Acceso a Datos — infraestructura |
| **Esfuerzo est.** | 0.5 – 1 día |

---

## 1. Objetivo de la tarea

Dejar lista la plumbing de imágenes del proyecto: **subida firmada** a Cloudinary (nunca unsigned), **validación real** de lo que se sube, **URL de entrega optimizada** y **destrucción del asset huérfano** cuando se reemplaza una foto.

**Criterio de éxito verificable:** existe `buildCloudinaryImageUrl` purando un `publicId` o una URL de Cloudinary y devolviendo una URL con `f_auto,q_auto,dpr_auto`; `next build` no tira error por `next/image` con un dominio de Cloudinary; y ninguna función del proyecto firma un upload sin `CLOUDINARY_API_SECRET`.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 01 (proyecto andamiaje, `server-only`, variables de entorno).

No requiere la Tarea 04: esta capa habla HTTP con Cloudinary, no con Prisma. El servicio de imágenes **no toca la base**; recibe y devuelve datos y la Tarea 16 los persiste con el repositorio de productos.

### 2.1 Por qué Cloudinary y no subir a Supabase Storage

| Criterio | Cloudinary | Supabase Storage |
|---|---|---|
| Redimensionado y `f_auto`/`q_auto` | Nativo, en el CDN | Hay que hacerlo en el cliente o en un hook |
| Peso de la foto en el repo | 0 KB (se guarda la URL) | 0 KB también |
| Cuota en el plan gratuito de Supabase | — | Compite con la base de datos y el Realtime |
| Archivos maliciosos servidos desde nuestro dominio | Servidos desde `res.cloudinary.com`, no desde el nuestro | Servidos desde nuestro dominio, con nuestra cookie |

La última fila es la que decide: un `.svg` subido a nuestro propio bucket se sirve desde nuestro origen y puede ejecutar script. Servido desde `res.cloudinary.com` queda en otro origen, sin acceso a cookies ni a `document.cookie` de la app.

### 2.2 La regla que no se rompe

> **⛔ Upload firmado. SIEMPRE. Nunca unsigned.**

Un upload **unsigned** no requiere credenciales: cualquiera que conozca tu `cloud_name` sube archivos a tu cuenta. Con un upload firmado, el navegador pide la firma al servidor, el servidor la calcula con `CLOUDINARY_API_SECRET`, y el navegador la usa para subir **un archivo y en una carpeta y con un `public_id` determinados**. Sin la firma, no hay nada que Cloudinar.

La regla complementaria: **`CLOUDINARY_API_SECRET` nunca sale del servidor.** No es pública, no va en `.env.local` con prefijo `NEXT_PUBLIC_`, no viaja en el bundle.

### 2.3 El flujo completo, de punta a punta

```
1. Admin elige el archivo (6 MB)          → navegador
2. GET  /api/admin/images/sign            → Route Handler: autoriza y firma
3. { signature, timestamp, apiKey, folder, publicId }  → navegador
4. POST https://api.cloudinary.com/v1_1/<cloud>/image/upload
   (directo, el archivo NO pasa por Next)  → Cloudinary
5. Respuesta con { public_id, secure_url, width, height, format, bytes }
6. image.service.ts valida width/height/format
   └─ si no cumple → destroy + ValidationError
7. El admin guarda el producto             → Server Action → Prisma
```

El paso 4 va **del navegador directo a Cloudinary** a propósito. Si el archivo atravesara el servidor de Next, en Vercel lo limitarían los 4.5 MB de la función y, además, se cobraría ancho de banda en cada subida. El único dato que cruza por el servidor es la firma: unos 200 bytes.

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `src/server/infra/cloudinary.ts` | Firma SHA-1 y llamadas HTTP. `import "server-only"` |
| `src/server/services/image.service.ts` | Orquestación: derivar `publicId`, subir, destruir el asset anterior |
| `src/lib/validation/imagen.ts` | Reglas puras de validación de la imagen, sin I/O — **se define en esta tarea** |
| `src/app/api/admin/images/sign/route.ts` | Route Handler que autoriza y devuelve los parámetros firmados |
| `tests/unit/cloudinary-signature.test.ts` | Verifica el string que se hashea contra un vector conocido |
| `tests/unit/imagen-validation.test.ts` | Verifica MIME, tamaño y dimensiones sobre metadatos sintéticos |
| `tests/unit/image-url.test.ts` | Verifica `buildCloudinaryImageUrl` |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `next.config.ts` | `images.remotePatterns` para `res.cloudinary.com`, `images.formats` |
| `.env.example` | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| `docs/tasks/README.md` | Marcar Tarea 06 |

### 3.3 Eliminar

Ninguno.

---

## 4. Estructura N-Capas

### 4.1 Qué vive en esta capa

| Ubicación | Qué va | Qué NO va |
|---|---|---|
| `src/server/infra/cloudinary.ts` | Hashear la firma, construir el `FormData`, hacer el `fetch`, tipar la respuesta de la API | Decisiones de negocio. "Este producto no puede cambiar de foto" NO va acá |
| `src/server/services/image.service.ts` | Qué MIME se acepta, cuánto pesa, qué `publicId` deriva de un slug, si hay que destruir el asset anterior | `fetch`, `crypto`, `FormData`. La infra hace la llamada HTTP |
| `src/app/api/admin/images/sign/route.ts` | Autorizar, traducir excepción a código HTTP | Lógica de validación de la imagen. No valida el archivo: todavía no lo tiene |

### 4.2 La regla más importante de esta tarea

> **La infra transporta. El servicio decide.**

Si `cloudinary.ts` tuviera un `if (file.size > 6MB) throw`, entonces cambiar el límite a 4 MB sería editar la capa de infraestructura, y la Tarea 19 (endurecimiento) tendría que tocar el mismo archivo que ya usa la Tarea 16. La separación permite que el servicio se testee sin red y que la infra se lea como lo que es: un cliente HTTP.

### 4.3 Reparto específico

| Necesidad | Dónde vive | Razón |
|---|---|---|
| SHA-1 de la firma | `infra/cloudinary.ts` | Es criptografía de integración con el proveedor, no regla del dominio |
| Lista de MIME aceptados | `services/image.service.ts` | Es una decisión del negocio ("aceptamos AVIF y no SVG") |
| Tamaño máximo | `services/image.service.ts` | Cambiable sin tocar la infra |
| `publicId` desde el slug | `services/image.service.ts` | Es una regla del catálogo, no de Cloudinary |
| Constructor de URL de entrega | `services/image.service.ts` | Es una decisión de producto (recorte `fill`, calidad automática) |
| `POST` y `destroy` | `infra/cloudinary.ts` | Transporte |

---

## 5. Convenciones de código (Clean Code + SOLID)

| Decisión | Detalle |
|---|---|
| **SRP** | `cloudinary.ts` tiene una sola responsabilidad: hablar con la API. Tres funciones exportadas: `signCloudinaryParams`, `uploadImageAsset`, `destroyImageAsset`. |
| **DIP** | El servicio depende de las **funciones** de `cloudinary.ts`, no de una clase `CloudinaryClient`. Si mañana se cambia de proveedor, se implementan las mismas tres funciones. |
| **Límite de líneas** | `image.service.ts` ≤ 150 (contexto §13). Si no entra, partir en `image.service.ts` (orquestación) + `image-validation.ts` (puro). |
| **Sin `!` ni `as`** | La respuesta de Cloudinary es `unknown` en la frontera: se valida con type guards, no se castea. Un `as` acá es exactamente el tipo de mentira que rompe en producción un martes. |
| **Errores de dominio** | Los fallos de Cloudinary se envuelven en `ExternalServiceError("cloudinary", cause)` (contexto §3). La UI muestra un mensaje propio; el detalle técnico queda en el log. |
| **Constantes con nombre** | `MAX_IMAGE_BYTES`, `MIN_IMAGE_SIDE`, `PRODUCT_IMAGE_FOLDER`. Ningún número mágico en el medio de una función. |

---

## 6. Pasos de implementación

### 6.1 Instalación y variables

No hay SDK: la API de Cloudinary es HTTP con firma, y usar `@cloudinary/url-gen` o el SDK de Node agregaría dependencias para generar URLs firmadas que el proyecto no necesita. La URL de entrega es una concatenación de parámetros que `next/image` ya sabe pedir.

```bash
# No hay dependencias nuevas.
```

```bash
# .env.local
CLOUDINARY_CLOUD_NAME=modo-miga
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

```bash
# .env.example
# ⛔ Las tres son secretas. Nunca con prefijo NEXT_PUBLIC_.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### 6.2 `src/server/infra/cloudinary.ts`

```ts
/**
 * Cliente HTTP de Cloudinary.
 *
 * ⛔ ESTA CAPA NO DECIDE NADA. Solo firma, arma el `FormData` y hace el
 *    `fetch`. Las reglas ("qué MIME se acepta", "debo destruir el asset
 *    anterior") viven en `@/server/services/image.service`. Ver Tarea 06 §4.2.
 *
 * ⛔ `CLOUDINARY_API_SECRET` nunca sale de acá.
 *
 * No se usa el SDK de Cloudinary a propósito: la firma es un SHA-1 de
 * parámetros ordenados, cinco líneas de `crypto`, y el SDK arrastra
 * dependencias que solo hacen falta para URL firmadas —que acá no se usan,
 * porque las imágenes del catálogo son públicas por definición.
 */
import "server-only";

import { createHash } from "node:crypto";
import { ExternalServiceError } from "@/lib/domain";

/** Carpeta donde viven todas las fotos de producto. */
export const PRODUCT_IMAGE_FOLDER = "modo-miga/products";

/**
 * Valores firmados que Cloudinary espera. Todos se hashean, incluso los
 * que no son obligatorios, porque la firma cubre exactamente lo que se
 * envía: si el navegador altera un parámetro, la firma deja de coincidir.
 */
export type CloudinarySignableParams = Readonly<Record<string, string | number | boolean>>;

/**
 * Firma SHA-1 de los parámetros.
 *
 * El algoritmo, según la documentación de Cloudinary:
 *   1. Se toman TODOS los parámetros que se envían (más `api_key`).
 *   2. Se ordenan por clave, alfabéticamente.
 *   3. Se arman como `clave=valor` unidos por `&`.
 *   4. Se concatena el `api_secret` **sin ningún separador**.
 *   5. SHA-1 en hexadecimal.
 *
 * El paso 4 es el que más se olvida y es el que más falla: `sha1(params + secret)`,
 * nunca `sha1(params) + secret`, nunca `sha1(params + "&" + secret)`.
 */
export const signCloudinaryParams = (
  params: CloudinarySignableParams,
): string => {
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (apiSecret === undefined || apiSecret === "") {
    throw new Error("Falta CLOUDINARY_API_SECRET en el entorno.");
  }

  const conApiKey: CloudinarySignableParams = {
    ...params,
    api_key: process.env.CLOUDINARY_API_KEY ?? "",
  };

  const payload = Object.keys(conApiKey)
    .sort()
    .map((clave) => `${clave}=${String(conApiKey[clave])}`)
    .join("&");

  return createHash("sha1").update(payload + apiSecret).digest("hex");
};

/**
 * Parámetros de una subida firmada de foto de producto.
 *
 * `public_id` es **determinístico** (sale del slug): volver a subir la
 * foto del mismo producto reemplaza el asset en lugar de crear otro.
 * Un `public_id` aleatorio llena la cuenta de huérfanos que nadie va a
 * borrar nunca, y `imagePublicId` (Tarea 03) no sirve para nada.
 */
export interface SignedUploadParams {
  readonly timestamp: number;
  readonly folder: string;
  readonly publicId: string;
}

export const buildSignedUploadParams = (input: {
  readonly folder: string;
  readonly publicId: string;
}): SignedUploadParams => ({
  timestamp: Math.floor(Date.now() / 1000),
  folder: input.folder,
  publicId: input.publicId,
});

/**
 * Metadatos que devuelve Cloudinary al subir.
 *
 * Son la **fuente de verdad** sobre el archivo, no el `File` del
 * navegador. Cloudinary inspecciona los bytes reales: si alguien sube un
 * `script.svg` renombrado a `.jpg`, acá llega `format: "svg"`. Por eso
 * la validación autoritativa va acá y no sobre el `File` del cliente.
 */
export interface CloudinaryUploadResult {
  readonly publicId: string;
  readonly secureUrl: string;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly bytes: number;
}

/** Formatos que Cloudinary reporta y que el proyecto acepta. */
const CLOUDINARY_UPLOAD_ENDPOINT = "image/upload";

const buildUploadUrl = (): string => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (cloudName === undefined || cloudName === "") {
    throw new Error("Falta CLOUDINARY_CLOUD_NAME en el entorno.");
  }
  return `https://api.cloudinary.com/v1_1/${cloudName}/${CLOUDINARY_UPLOAD_ENDPOINT}`;
};

/**
 * Sube un archivo a Cloudinary.
 *
 * El `File` viaja **desde el navegador**, directo a la API de Cloudinary.
 * En el servidor esta función existe para el caso de migraciones por
 * script (Tarea 21) y para los tests. La UI no la usa: la UI pide la
 * firma y sube desde el cliente.
 */
export const uploadImageAsset = async (input: {
  readonly file: File;
  readonly folder: string;
  readonly publicId: string;
}): Promise<CloudinaryUploadResult> => {
  const params = buildSignedUploadParams({ folder: input.folder, publicId: input.publicId });
  const signature = signCloudinaryParams({
    timestamp: params.timestamp,
    folder: params.folder,
    public_id: params.publicId,
    // Reemplaza el asset con el mismo `public_id` en lugar de duplicarlo.
    overwrite: true,
  });

  const apiKey = process.env.CLOUDINARY_API_KEY;
  if (apiKey === undefined) throw new Error("Falta CLOUDINARY_API_KEY en el entorno.");

  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(params.timestamp));
  formData.append("folder", params.folder);
  formData.append("public_id", params.publicId);
  formData.append("overwrite", "true");
  formData.append("signature", signature);

  const respuesta = await fetch(buildUploadUrl(), { method: "POST", body: formData });

  if (!respuesta.ok) {
    // El cuerpo trae el detalle real ("Invalid Signature", "File size too large").
    // Se loguea entero y se devuelve un error de dominio limpio.
    const detalle = await respuesta.text();
    console.error("[cloudinary] upload rechazado", respuesta.status, detalle);
    throw new ExternalServiceError("cloudinary", new Error(`Upload rechazado (${respuesta.status})`));
  }

  return parseUploadResult(await respuesta.json());
};

/**
 * Type guard sobre la respuesta de Cloudinary.
 *
 * ⚠️ La respuesta se trata como `unknown`. Es una llamada a un servicio
 *    externo y el tipo de retorno no está garantizado por TypeScript.
 *    Si Cloudinary cambia una clave, el error tiene que ser un
 *    `ExternalServiceError` con un mensaje claro, no un
 *    `Cannot read properties of undefined` en producción.
 */
const parseUploadResult = (payload: unknown): CloudinaryUploadResult => {
  if (typeof payload !== "object" || payload === null) {
    throw new ExternalServiceError("cloudinary", new Error("Respuesta de upload con forma inesperada"));
  }

  const registro = payload as Record<string, unknown>;
  const { public_id: publicId, secure_url: secureUrl, width, height, format, bytes } = registro;

  const esNumero = (valor: unknown): valor is number =>
    typeof valor === "number" && Number.isFinite(valor);
  const esTexto = (valor: unknown): valor is string =>
    typeof valor === "string" && valor.length > 0;

  if (
    !esTexto(publicId) ||
    !esTexto(secureUrl) ||
    !esNumero(width) ||
    !esNumero(height) ||
    !esTexto(format) ||
    !esNumero(bytes)
  ) {
    throw new ExternalServiceError("cloudinary", new Error("Respuesta de upload incompleta"));
  }

  return { publicId, secureUrl, width, height, format, bytes };
};

/**
 * Destruye un asset.
 *
 * Es idempotente: Cloudinary responde `200` aunque el `public_id` no
 * exista (con `not_found` en el cuerpo). Por eso no hace falta
 * comprobar antes si existe, y por eso se puede llamar en un `finally`
 * sin miedo.
 */
export const destroyImageAsset = async (publicId: string): Promise<void> => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (cloudName === undefined || apiKey === undefined || apiSecret === undefined) {
    throw new Error("Faltan credenciales de Cloudinary en el entorno.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signCloudinaryParams({ timestamp, public_id: publicId, api_key: apiKey });

  const respuesta = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_id: publicId, timestamp, api_key: apiKey, signature }),
    },
  );

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    console.error("[cloudinary] destroy rechazado", respuesta.status, detalle);
    throw new ExternalServiceError("cloudinary", new Error(`Destroy rechazado (${respuesta.status})`));
  }
};
```

### 6.3 `src/server/services/image.service.ts`

```ts
/**
 * Reglas de negocio de las imágenes.
 *
 * La infra (`@/server/infra/cloudinary`) solo hace llamadas HTTP. Las
 * decisiones de qué se acepta, cómo se deriva el `public_id` y si hay
 * que destruir el asset anterior viven acá.
 */
import "server-only";

import { ValidationError } from "@/lib/domain";
import { buildSlug } from "@/lib/validation/slug";
import {
  destroyImageAsset,
  uploadImageAsset,
  type CloudinaryUploadResult,
} from "@/server/infra/cloudinary";

/** Tope del archivo. 6 MB es holgado para una foto de teléfono. */
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/**
 * Lado mayor mínimo, en píxeles.
 *
 * El catálogo muestra tarjetas de hasta 800 px de ancho y la ficha de
 * producto hasta 1200. Menos de 1200 del lado mayor se ve borroso en
 * pantallas grandes, y `c_fill,g_auto` no inventa detalle que no está.
 */
export const MIN_IMAGE_SIDE = 1200;

/**
 * MIME aceptados en la frontera del navegador.
 *
 * ⛔ `image/svg+xml` NO está y no se agrega. Un SVG es código que el
 *    navegador ejecuta. Servido desde `res.cloudinary.com` está a salvo
 *    del mismo origen, pero un SVG con un `<foreignObject>` o con
 *    `<script>` sigue siendo un vector de XSS si alguien lo enlaza o lo
 *    abre directamente. No hay ganancia real: las fotos del catálogo son
 *    raster.
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

const isAllowedMimeType = (mimeType: string): mimeType is AllowedImageMimeType =>
  (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);

/**
 * `public_id` del asset de un producto.
 *
 * ⚠️ Determinista a propósito. Si el slug cambia, el `public_id` cambia
 *    con él y el asset viejo queda huérfano. Por eso el cambio de slug
 *    tiene que destruir el asset anterior: lo hace `replaceProductImage`.
 *
 * Se usa `buildSlug` (Tarea 05 §6.8) y no una normalización propia, para
 * que la identidad del asset y la del producto no puedan divergir.
 */
export const buildImagePublicId = (productSlug: string): string =>
  `modo-miga/products/${buildSlug(productSlug)}`;

/**
 * Chequeo previo, sobre el `File` del navegador.
 *
 * ⚠️ Es ADVISORIO. `file.type` lo declara el navegador y puede mentir:
 *    un `.svg` renombrado a `.jpg` se anuncia como `image/jpeg`. Por eso
 *    la validación que decide es `assertUploadedImageIsUsable`, que corre
 *    sobre los metadatos reales de Cloudinary. Esta función solo evita
 *    subir 20 MB para que el servidor los rechace.
 */
export const validateImageFile = (file: File): void => {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ValidationError(
      { file: [`La imagen supera el máximo de ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`] },
      "La imagen es demasiado pesada",
    );
  }

  // Defensa explícita además de la lista: deja claro en el código que
  // SVG está descartado a propósito, no por olvuido.
  if (file.type === "image/svg+xml" || file.type.endsWith("+xml")) {
    throw new ValidationError({ file: ["SVG no se admite. Subí una foto JPG, PNG, WebP o AVIF."] });
  }

  if (!isAllowedMimeType(file.type)) {
    throw new ValidationError(
      { file: ["Formato no admitido. Usá JPG, PNG, WebP o AVIF."] },
      "Formato de imagen no admitido",
    );
  }

  if (file.size === 0) {
    throw new ValidationError({ file: ["El archivo está vacío."] });
  }
};

/**
 * Chequeo autoritativo, sobre lo que Cloudinary dice del archivo real.
 *
 * Recibe el `format` y las dimensiones reales, no el `File` del cliente.
 * Es la única validación en la que se puede confiar.
 */
export const assertUploadedImageIsUsable = (result: CloudinaryUploadResult): void => {
  if (result.format === "svg" || result.format.endsWith("+xml")) {
    throw new ValidationError(
      { file: ["El archivo es un SVG, no una foto. No se admite."] },
      "Formato de imagen no admitido",
    );
  }

  if (Math.max(result.width, result.height) < MIN_IMAGE_SIDE) {
    throw new ValidationError(
      {
        file: [
          `La imagen mide ${result.width}x${result.height}px. Necesita al menos ${MIN_IMAGE_SIDE}px del lado mayor.`,
        ],
      },
      "La imagen es muy chica",
    );
  }

  if (result.bytes > MAX_IMAGE_BYTES) {
    throw new ValidationError({ file: ["La imagen supera el máximo permitido."] });
  }
};

/**
 * Sube la foto de un producto nuevo.
 *
 * No hay asset anterior que destruir: es la primera foto.
 */
export const uploadProductImage = async (input: {
  readonly file: File;
  readonly slug: string;
}): Promise<{ readonly imageUrl: string; readonly imagePublicId: string }> => {
  validateImageFile(input.file);

  const publicId = buildImagePublicId(input.slug);
  const result = await uploadImageAsset({
    file: input.file,
    folder: "modo-miga/products",
    publicId,
  });

  // Si la validación falla, el asset YA está subido. Destruirlo acá es la
  // diferencia entre un huérfano de 2 MB y ninguno.
  try {
    assertUploadedImageIsUsable(result);
  } catch (error) {
    await destroyImageAsset(publicId);
    throw error;
  }

  return { imageUrl: result.secureUrl, imagePublicId: result.publicId };
};

/**
 * Reemplaza la foto de un producto existente.
 *
 * ⛔ ORDEN CRÍTICO: primero sube, recién después destruye el anterior.
 *    Si se destruyera primero y la subida fallara, el producto queda sin
 *    `imageUrl` —y `imageUrl` es NOT NULL en el schema (Tarea 03 §9).
 *
 * El `public_id` es el mismo (sale del slug, que no cambia), así que
 * Cloudinary **reemplaza** el asset en vez de crear otro: no hay huérfano
 * en el caso normal. El `destroyImageAsset` posterior es la red de
 * seguridad para cuando el slug cambió y el `public_id` es distinto.
 */
export const replaceProductImage = async (input: {
  readonly file: File;
  readonly slug: string;
  readonly previousPublicId: string | null;
}): Promise<{ readonly imageUrl: string; readonly imagePublicId: string }> => {
  const subido = await uploadProductImage({ file: input.file, slug: input.slug });

  if (input.previousPublicId !== null && input.previousPublicId !== subido.imagePublicId) {
    try {
      await destroyImageAsset(input.previousPublicId);
    } catch (error) {
      // El guardado del producto NO se cae por un asset que no se pudo
      // borrar. Queda huérfano y se limpia en la Tarea 21 (mantenimiento).
      console.error("[image] No se pudo destruir el asset anterior", error);
    }
  }

  return subido;
};
```

### 6.4 `buildCloudinaryImageUrl`

```ts
// src/server/services/image.service.ts (continuación)

/**
 * Transforms aplicados en la entrega.
 *
 * · `f_auto` — WebP o AVIF según lo que entienda el navegador. La mitad
 *   del peso sin tocar el archivo original.
 * · `q_auto` — calidad escolhida por Cloudinary según el contenido de la
 *   imagen. Una foto de sándwich no necesita lo mismo que un cartel de
 *   precio.
 * · `dpr_auto` — sube la resolución en pantallas de alta densidad sin
 *   servir el doble de píxeles a los teléfonos viejos.
 * · `c_fill,g_auto` — recorta al centro **de lo que importa**: Cloudinary
 *   detecta dónde está el sujeto. Un `c_fill` con centro geométrico
 *   cortaría justo el sándwich al medio.
 */
export interface ImageTransform {
  readonly width: number;
  readonly height?: number;
  readonly quality?: "auto" | "auto:best" | "auto:good" | number;
  readonly format?: "auto" | "webp" | "avif" | "jpg";
}

/**
 * Construye la URL optimizada de una imagen.
 *
 * Acepta las dos formas que hay en el sistema:
 *   · un `public_id` (`"modo-miga/products/jamon-y-queso"`)
 *   · una URL completa ya guardada en `products.imageUrl`
 *
 * Por qué aceptar las dos: la Tarea 05 siembra URLs de la nube `demo` de
 * Cloudinary, y el `imagePublicId` de esos productos es `null`. Si el
 * helper solo aceptara `publicId`, el catálogo de desarrollo se caería
 * entero. Cuando la URL **no** es de Cloudinary se devuelve tal cual:
 * no se le puede agregar transformaciones a un host ajeno.
 */
export const buildCloudinaryImageUrl = (
  publicIdOrUrl: string,
  transform: ImageTransform,
): string => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (cloudName === undefined || cloudName === "") {
    throw new Error("Falta CLOUDINARY_CLOUD_NAME en el entorno.");
  }

  const source = extractDeliverySource(publicIdOrUrl, cloudName);

  // No es de Cloudinary: se devuelve sin tocar. No inventar un proxy.
  if (source === null) return publicIdOrUrl;

  const params = [
    `f_${transform.format ?? "auto"}`,
    `q_${transform.quality ?? "auto"}`,
    "dpr_auto",
    "c_fill",
    "g_auto",
    `w_${transform.width}`,
    ...(transform.height === undefined ? [] : [`h_${transform.height}`]),
  ].join(",");

  return `https://res.cloudinary.com/${cloudName}/image/upload/${params}/${source}`;
};

/**
 * Saca el `public_id` de una URL de entrega de Cloudinary.
 * Devuelve `null` si la URL no es de Cloudinary.
 */
const extractDeliverySource = (value: string, cloudName: string): string | null => {
  if (!value.startsWith("http")) return value;

  const marcador = `/${cloudName}/image/upload/`;
  const indice = value.indexOf(marcador);
  if (indice === -1) return null;

  // Después del marcador viene `transformaciones/public_id`. Las
  // transformaciones son segmentos separados por `/` que empiezan por una
  // letra en minúscula y contienen parámetros; el `public_id` es el resto.
  const resto = value.slice(indice + marcador.length);
  const [transformaciones, ...restoDelId] = resto.split("/");
  const publicId = restoDelId.join("/");

  const esSegmentoDeTransformacion = (segmento: string): boolean =>
    segmento.length > 0 && /^[a-z]/.test(segmento) && /^(f_|q_|c_|g_|w_|h_|dpr_|e_)/.test(segmento);

  return esSegmentoDeTransformacion(transformaciones ?? "") && publicId.length > 0
    ? publicId
    : resto;
};
```

Ejemplo de salida:

```ts
buildCloudinaryImageUrl("modo-miga/products/jamon-y-queso", { width: 800 })
// → https://res.cloudinary.com/modo-miga/image/upload/f_auto,q_auto,dpr_auto,c_fill,g_auto,w_800/modo-miga/products/jamon-y-queso
```

#### 6.4.1 ⚠️ El archivo no entra en 150 líneas: hay que partirlo

El contexto §13 pone **150 líneas como máximo** para un servicio. Lo que está escrito arriba, junto, no entra. No es una sugerencia de estilo: el límite existe para que un archivo se pueda leer entero de un tirón y para que dos personas no editen el mismo archivo a la vez.

**Partición a aplicar antes de mergear:**

| Archivo nuevo | Símbolos que van | Lleve `server-only` |
|---|---|---|
| `src/lib/validation/imagen.ts` | `MAX_IMAGE_BYTES`, `MIN_IMAGE_SIDE`, `ALLOWED_IMAGE_MIME_TYPES`, `AllowedImageMimeType`, `validateImageFile`, `assertUploadedImageIsUsable` | **No.** Son funciones puras: sin `fetch`, sin `process.env`, sin Prisma |
| `src/server/services/image.service.ts` | `buildImagePublicId`, `buildCloudinaryImageUrl`, `ImageTransform`, `uploadProductImage`, `replaceProductImage` | Sí. Hace I/O contra Cloudinary |

Por qué esta partición y no otra:

- **Capa 0 para las reglas puras.** `validateImageFile` no hace nada de I/O: mira un `File` y lanza `ValidationError`. Va a `src/lib/validation/` (contexto §2), **no** lleva `server-only` y por lo tanto se testea en `tests/unit/imagen-validation.test.ts` sin levantar nada. Es el mismo criterio que la Tarea 04 aplica a los mappers.
- **`assertUploadedImageIsUsable` toma un tipo estructural propio**, no el `CloudinaryUploadResult` de la infra:

  ```ts
  // src/lib/validation/imagen.ts
  export interface ImagenSubidaMetadata {
    readonly format: string;
    readonly width: number;
    readonly height: number;
    readonly bytes: number;
  }
  ```

  Así la capa 0 no depende de la capa 4. El servicio lo arma desde el resultado de Cloudinary y lo pasa. La dependencia sigue siendo `4 → 3 → 0`, que es la del grafo.

- **`buildCloudinaryImageUrl` se queda en el servicio** y no en `src/lib/format/`, aunque parezca un formateador: lee `process.env.CLOUDINARY_CLOUD_NAME`, así que no es puro ni isomórfico.

Esto **no cambia ningún contrato** de la tabla de §7: los importadores siguen importando los mismos símbolos. Solo cambia de archivo. La Tarea 16 importa todo desde `@/server/services/image.service`; los símbolos puros se pueden importar directo de `@/lib/validation/imagen` si la Tarea 16 quiere testearlos sin tocar la capa de servidor.

### 6.5 Route Handler que firma

```ts
// src/app/api/admin/images/sign/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, z } from "zod";
import {
  PRODUCT_IMAGE_FOLDER,
  buildSignedUploadParams,
  signCloudinaryParams,
} from "@/server/infra/cloudinary";
import { buildImagePublicId } from "@/server/services/image.service";

export const runtime = "nodejs";

const FirmarImagenSchema = z.object({
  slug: z.string().min(1).max(80),
});

/**
 * Firma una subida de imagen de producto.
 *
 * ⛔ AUTORIZACIÓN PROVISIONAL.
 *    La autorización real es `verifyAdminSession()` de la Tarea 07
 *    (`@/server/auth/verify-admin`). Ese módulo no existe todavía y esta
 *    tarea solo depende de la 01, así que el endpoint queda cerrado con
 *    un 501 en lugar de abierto.
 *
 *    ⛔ NO cambiar el `501` por un `200` antes de la Tarea 07: sin firma
 *    de sesión, cualquiera que haga un POST a esta ruta sube archivos a
 *    la cuenta de Cloudinary del negocio.
 *
 *    ⛔ La autorización no puede vivir acá como comprobación laxa: aunque
 *    exista la sesión, esta ruta firma para el `slug` que le manden.
 *    Firmar un slug que no corresponde al producto que el admin está
 *    editando es escribir en la carpeta de otro. El control real es que
 *    el servicio de la Tarea 16 valide que el producto existe y es suyo.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const autorizado = false;
  if (!autorizado) {
    return NextResponse.json(
      { error: "Subida de imágenes deshabilitada hasta conectar la autorización (Tarea 07)." },
      { status: 501 },
    );
  }

  try {
    const cuerpo = FirmarImagenSchema.parse(await request.json());
    const publicId = buildImagePublicId(cuerpo.slug);
    const params = buildSignedUploadParams({
      folder: PRODUCT_IMAGE_FOLDER,
      publicId,
    });

    return NextResponse.json({
      signature: signCloudinaryParams({
        timestamp: params.timestamp,
        folder: params.folder,
        public_id: params.publicId,
        overwrite: true,
      }),
      timestamp: params.timestamp,
      folder: params.folder,
      publicId: params.publicId,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Datos de la firma inválidos." }, { status: 400 });
    }
    console.error("[api:images/sign]", error);
    return NextResponse.json({ error: "No se pudo firmar la subida." }, { status: 500 });
  }
}
```

### 6.6 `next.config.ts`

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * ⛔ Lista explícita de hosts. Nunca `dangerouslyAllowSVG` ni un
     *    comodín de dominio: cada host que se agrega es una superficie
     *    abierta del optimizador de imágenes. Cloudinary es el único
     *    origen de imágenes del proyecto.
     *
     *    Un solo patrón alcanza: la nube propia y la nube `demo` del seed
     *    (Tarea 05 §6.4) están en el mismo host y se distinguen por el
     *    primer segmento del path, que es el nombre de la nube.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],

    /**
     * AVIF primero: pesa ~30% menos que WebP a calidad equivalente.
     * `next/image` decide por el `Accept` del navegador, así que no
     * hace falta ninguna detección en el código.
     */
    formats: ["image/avif", "image/webp"],

    /**
     * 1 hora. Las fotos de producto no cambian seguido; un mes
     * invalidaría el cacheo de Cloudinary para todo el catálogo en cada
     * cambio de precio.
     */
    minimumCacheTTL: 3600,
  },
};

export default nextConfig;
```

### 6.7 Verificar

```bash
# 1. La firma se calcula bien. Vector conocido, calculado a mano:
#    params = { api_key: "123", folder: "modo-miga/products", public_id: "x", timestamp: 1700000000 }
#    payload = "api_key=123&folder=modo-miga/products&public_id=x&timestamp=1700000000"
npm run test -- tests/unit/cloudinary-signature.test.ts

# 2. Las reglas de validación son puras: se testean sin nada levantado
npm run test -- tests/unit/imagen-validation.test.ts

# 3. La URL se construye
npm run test -- tests/unit/image-url.test.ts

# 4. El build acepta el dominio de Cloudinary en next/image
npm run build

# 5. Ningún archivo de src/ tiene el secret hardcodeado
rg "CLOUDINARY_API_SECRET" src/ --files-with-matches
# → solo src/server/infra/cloudinary.ts

# 6. El bundle del cliente no lo contiene
rg "CLOUDINARY_API_SECRET" .next/static -l
# → sin resultados
```

---

## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `signCloudinaryParams(params)` | `src/server/infra/cloudinary.ts` | Route Handler de firma, `uploadImageAsset`, `destroyImageAsset` |
| `buildSignedUploadParams({ folder, publicId })` | idem | Route Handler, `uploadImageAsset` |
| `uploadImageAsset({ file, folder, publicId })` | idem | `image.service.ts`, Tarea 21 (script de migración) |
| `destroyImageAsset(publicId)` | idem | `image.service.ts` |
| `CloudinaryUploadResult` | idem | `assertUploadedImageIsUsable` |
| `PRODUCT_IMAGE_FOLDER` | idem | Route Handler, `image.service.ts` |
| `MAX_IMAGE_BYTES`, `MIN_IMAGE_SIDE`, `ALLOWED_IMAGE_MIME_TYPES`, `validateImageFile`, `assertUploadedImageIsUsable` | `src/lib/validation/imagen.ts` (§6.4.1) | **Tarea 16** (validación del input de archivo), 19 (endurecimiento) |
| `buildImagePublicId(slug)` | idem | Tarea 16, Route Handler |
| `validateImageFile(file)` | idem | Tarea 16 |
| `assertUploadedImageIsUsable(result)` | idem | Tarea 16, 19 |
| `uploadProductImage({ file, slug })` | idem | **Tarea 16** (alta de producto) |
| `replaceProductImage({ file, slug, previousPublicId })` | idem | **Tarea 16** (edición de producto) |
| `buildCloudinaryImageUrl(publicIdOrUrl, transform)` | idem | **Tarea 10** (catálogo), 16, 18 (Open Graph) |
| `buildSlug` | `src/lib/validation/slug.ts` (Tarea 05) | `buildImagePublicId` |

**Contratos que se definen en esta tarea** porque no existían: todos los de la tabla anterior. Ninguno depende de un módulo de la Tarea 04 ni de la 08.

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [x] `signCloudinaryParams` devuelve el mismo SHA-1 que el vector calculado a mano (constante en el test, verificado)
- [x] `buildSignedUploadParams` incluye `timestamp` en segundos Unix
- [x] `buildImagePublicId("Jamón y Queso")` devuelve `modo-miga/products/jamon-y-queso`
- [x] `buildCloudinaryImageUrl` genera `f_auto,q_auto,dpr_auto,c_fill,g_auto,w_<ancho>`
- [x] `buildCloudinaryImageUrl` acepta tanto un `public_id` como una URL completa de Cloudinary
- [x] `buildCloudinaryImageUrl` devuelve intacta una URL que no es de Cloudinary
- [x] `next build` compila sin el error "hostname not configured"
- [x] `next/image` optimiza una imagen de `res.cloudinary.com` (`next.config.ts` con el patrón único; el uso real del componente llega en la Tarea 10)
- [x] `POST /api/admin/images/sign` responde `501` hasta que exista la Tarea 07 (verificado con `next start` + curl)

### 8.2 Calidad

- [x] `npm run verify` en verde (93 tests, 9 archivos)
- [x] `npm run build` en verde
- [x] `image.service.ts` ≤ 150 líneas (141) y `src/lib/validation/imagen.ts` también (122); la URL de entrega vive en `image-url.service.ts` (88) y se reexporta — §6.4.1 aplicado en dos pasos
- [x] `cloudinary.ts` no tiene ninguna regla de negocio (ni un `if` sobre MIME o tamaño)
- [x] Ningún tipo de retorno de la infra usa `any`
- [x] `parseUploadResult` valida la respuesta con type guards, sin `as` directo
- [x] Ningún archivo de `src/server/` hardcodea credenciales

### 8.3 Arquitectura

- [x] `cloudinary.ts` tiene `import "server-only"`
- [x] `image.service.ts` tiene `import "server-only"` (hace I/O)
- [x] `buildSlug` se importa de `@/lib/validation/slug`; no hay normalización duplicada
- [x] El Route Handler no valida el archivo: no lo tiene
- [x] `images.remotePatterns` tiene **un solo** patrón, sin comodines de host
- [x] `dangerouslyAllowSVG` no aparece en ningún archivo de código (solo se menciona en este documento, para prohibirlo, y en el comentario de `next.config.ts` quedó redactado sin el flag literal para que el grep de la Tarea 19 no dé falsos positivos)
- [x] El servicio no importa `next/*` ni `react`

### 8.4 Pruebas

- [x] `cloudinary-signature.test.ts`: la firma coincide con el vector conocido
- [x] `cloudinary-signature.test.ts`: el orden de los parámetros no cambia el resultado
- [x] `cloudinary-signature.test.ts`: con `CLOUDINARY_API_SECRET` ausente lanza con mensaje claro
- [x] `image-url.test.ts`: `public_id` plano, URL con transformaciones previas y URL ajena
- [x] `image-url.test.ts`: `height` opcional; sin `height` no aparece `h_` en la URL
- [x] `imagen-validation.test.ts`: archivo de > 6 MB, MIME desconocido y SVG rechazados
- [x] `imagen-validation.test.ts`: `format: "svg"` en los metadatos reales se rechaza aunque el `File` se anunciara como JPEG
- [x] `imagen-validation.test.ts`: 1200x900 pasa y 1199x800 falla
- [ ] Prueba manual de humo contra la API real de Cloudinary — 🔴 **bloqueada**: no hay credenciales reales de Cloudinary todavía (`.env.local` tiene placeholders, igual que Supabase). §13.

### 8.5 Seguridad

- [x] ⛔ Ningún upload unsigned: no existe `upload_preset` ni `unsigned: true` en el proyecto
- [x] ⛔ `CLOUDINARY_API_SECRET` no aparece en `.next/static` después del build (greppeado: sin resultados)
- [x] ⛔ `CLOUDINARY_API_SECRET` no tiene prefijo `NEXT_PUBLIC_` en `.env.example`
- [x] ⛔ SVG está rechazado **dos veces**: por el `file.type` declarado y por el `format` real de Cloudinary
- [x] ⛔ El Route Handler de firma devuelve `501`, no `200`, mientras no haya `verifyAdminSession` (verificado por curl)
- [x] El `public_id` es determinístico: dos subidas del mismo slug no crean dos assets
- [x] El asset huérfano se destruye cuando el `public_id` anterior es distinto del nuevo
- [x] Un fallo al destruir el asset anterior no hace fallar el guardado del producto

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado |
|---|---|
| **MIME engañoso: `.jpg` que en realidad es un SVG** | El `file.type` dice `image/jpeg` y pasa `validateImageFile`. Cloudinary lo sube, detecta los bytes reales y devuelve `format: "svg"`. `assertUploadedImageIsUsable` lo rechaza y `uploadProductImage` destruye el asset en el `catch`. El usuario ve "El archivo es un SVG, no una foto". |
| **Archivo de 20 MB** | `validateImageFile` lo corta antes de subir: no se consume ancho de banda ni tiempo de Cloudinary. El mensaje dice el máximo en MB, no en bytes. |
| **Falla la base después de subir el asset** | La foto quedó en Cloudinary y el producto sin `imageUrl` actualizado. Es el huérfano clásico. Mitigación en esta tarea: `public_id` determinístico, así que el próximo intento de subida **reemplaza** el mismo asset y no agrega otro. La limpieza de huérfanos por fecha es un script de mantenimiento de la Tarea 21. |
| **Falla la subida después de que Cloudinary guardó el archivo** | Edge case real de red. El asset queda sin registro en la base. Con `public_id` determinístico, el reintento del usuario lo pisa. Sin huérfano acumulado. |
| **`public_id` con caracteres especiales** | `buildImagePublicId` los elimina: `buildSlug` deja solo `[a-z0-9-]`. Un nombre de producto con `ñ`, `/`, espacios o un apóstrofe no puede romper la ruta de Cloudinary. Si el nombre es enteramente no-alfanumérico (`"???"`), `buildSlug` devuelve cadena vacía y el `public_id` queda `modo-miga/products/`, que es inválido. **Validar que el slug no esté vacío antes de firmar** en el Route Handler (`FirmarImagenSchema` con `.regex(/[a-z0-9-]/)`). |
| **Slurry de uploads (límite de tasa de Cloudinary)** | El plan gratuito limita ~500 transformations por hora y ~20 uploads por minuto en el Free tier. Con 3 personas en el panel no se llega. Si se llega: el upload devuelve `420`/`429`, `uploadImageAsset` lo envuelve en `ExternalServiceError`, la UI muestra "No se pudo subir la foto, reintentá en un momento". En la Tarea 21, si hace falta, agregar una cola. **Nunca** agregar reintentos automáticos en loop: queman la cuota. |
| **Cloudinary devuelve un asset de 0 bytes** | `result.bytes === 0`. `assertUploadedImageIsUsable` lo rechaza con el chequeo de tamaño vacío. |
| **Imagen de exactamente 1200x900** | Pasa: `Math.max(1200, 900) = 1200`, que es `>= MIN_IMAGE_SIDE`. El criterio es el lado **mayor**, no ambos. |
| **Imagen vertical 900x1600** | Pasa: lado mayor 1600. `c_fill,g_auto` recorta al ancho de la tarjeta centrado en el sujeto. |
| **`overwrite: true` sobre un asset en uso** | Cloudinary reemplaza el binario bajo el mismo `public_id`. Las URLs ya servidas siguen funcionando y muestran la foto nueva. No hay cache-busting en la URL, pero el `minimumCacheTTL` de 1 hora pone el techo. |
| **Dos admins suben la foto del mismo producto a la vez** | Los dos usan el mismo `public_id`. El último `overwrite` gana. El que perdió tiene `previousPublicId` igual al nuevo, así que no intenta destruir nada. Sin asset huérfano, sin error. |
| **`destroyImageAsset` sobre un `public_id` inexistente** | Cloudinary responde `200` con `"result": "not found"`. La función no tira. Por eso se puede llamar en un `finally` sin condición previa. |
| **`CLOUDINARY_CLOUD_NAME` ausente** | `buildCloudinaryImageUrl` y `buildUploadUrl` lanzan con un mensaje que nombra la variable. No devuelven una URL a medio construir, que es peor que fallar. |
| **La red de Cloudinary está caída** | `fetch` rechaza. Se propaga como `TypeError: fetch failed`, no como `ExternalServiceError`. Envolverlo con un `try/catch` alrededor del `fetch` y convertirlo a `ExternalServiceError` si se quiere un mensaje uniforme. **No** implementado en esta versión: se deja explícito como deuda, porque agregar el `try/catch` sin un test que lo cubra es teatro. |
| **El usuario sube un archivo con el mismo nombre que otro producto** | El `public_id` sale del slug, no del nombre del archivo. No hay colisión. |

---

## 10. Pruebas

| Suite | Qué verifica |
|---|---|
| `tests/unit/cloudinary-signature.test.ts` | Que el string hasheado sea el que espera Cloudinary. **Es el test que más importa de la tarea**: un SHA-1 mal armado produce `401 Invalid Signature` en producción y es el error más difícil de diagnosticar sin leer la documentación |
| `tests/unit/imagen-validation.test.ts` | Que se rechace un MIME fuera de la lista, un SVG, un archivo de 20 MB, un lado mayor menor a 1200 y un `format: "svg"` reportado por Cloudinary |
| `tests/unit/image-url.test.ts` | Que la URL de entrega tenga las transformaciones correctas y que no rompa con un `public_id` plano ni con una URL de la nube `demo` |

**Criterio de diseño de las pruebas:**

- Las dos funciones puras (`signCloudinaryParams` y `buildCloudinaryImageUrl`) **se testean sin mocks**: dependen de `process.env` y de `node:crypto`, nada más. Un mock de `fetch` sobre `uploadImageAsset` solo verificaría que el código se llama como se escribió.
- El vector de prueba de la firma se calcula **a mano y se pega en el test como constante**, no se genera con la propia función: si el test usara la función para calcular el valor esperado, probaría que `sha1(x) === sha1(x)`.
- Lo que **no** se testea acá: la subida real. Requiere credenciales y una cuenta de Cloudinary. Es un test de humo manual (§11), y en la Tarea 21 se puede agregar si el proyecto tiene un ambiente de pruebas.

---

## 11. Definición de "Hecho" (Definition of Done)

- [x] Todos los criterios de §8 marcados (salvo el humo real contra Cloudinary — §13)
- [x] `npm run verify` + `npm run build` en verde
- [ ] Prueba manual de humo: con un script de Node, firmar, subir una imagen real y destruirla — 🔴 bloqueada hasta que exista la cuenta de Cloudinary del negocio (§13)
- [x] `docs/tasks/README.md` actualizado
- [ ] Commit: `feat(06): subida firmada a Cloudinary y URLs de entrega optimizadas`
- [ ] PR mergeada a `main`
- [x] **`docs/erd.md` sin cambios** (esta tarea no toca el modelo)

---

## 13. Registro de ejecución y desviaciones

**Fecha:** 2026-09-30 · **Verificación:** `npm run verify` ✅ (93 tests, 9 archivos) · `npm run build` ✅ · `POST /api/admin/images/sign` → **501** verificado con `next start` + curl ✅ · `CLOUDINARY_API_SECRET` solo aparece en `src/server/infra/cloudinary.ts` y **no** en `.next/static` ✅ · sin `upload_preset`/`unsigned` en `src/` ✅

### Bloqueo abierto

- **Prueba de humo real contra Cloudinary.** `.env.local` tiene `CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET` en `PENDIENTE` (mismo bloqueo que Supabase de la Tarea 02). La tarea se verificó con el vector de firma calculado a mano (el error más difícil de diagnosticar, §10) y con las reglas puras. La subida real queda para cuando exista la cuenta del negocio.

### Desviaciones respecto al documento

1. **Partición de §6.4.1 en dos pasos.** El servicio terminó en 215 líneas. Quedó así: `image.service.ts` (141 líneas, orquestación y reglas) + `image-url.service.ts` (88, constructor de URL) + `src/lib/validation/imagen.ts` (122, reglas puras). El contrato de `image.service.ts` no cambió: reexporta `buildCloudinaryImageUrl` e `ImageTransform`.
2. **`/api/admin/images/sign` consume el servicio, no la infra.** La regla ESLint de la Tarea 01 prohíbe que `src/app/**` importe `@/server/infra`, y el pseudocódigo de la tarea lo hacía. Se agregó `signProductImageUpload(slug)` al servicio (firma + parámetros que el cliente necesita, sin el secret) y la ruta solo valida el body con Zod, autoriza (501 provisional) y traduce errores a HTTP.
3. **`FirmarImagenSchema` con regex.** El §9 ya documentaba el caso "slug que queda vacío" y exigía validarlo antes de firmar; la regex quedó en el schema (`/ [a-z0-9]/` exige al menos un caracter alfanumérico).
4. **Zod ya estaba instalado (4.6.5):** la Tarea 05 lo agregó para el seed. No hubo dependencias nuevas.
5. **Env vars con bracket notation** (`process.env["CLOUDINARY_API_SECRET"]`) para respetar el `noPropertyAccessFromIndexSignature`/estilo de las tareas 01–05; el comportamiento es el mismo.
6. **Ningún fetch envuelto en `try/catch`: la deuda explícita de §9 quedó igual que el documento** (un `TypeError` crudo por caída de red, a adoptar cuando haya un test que la cubra). Se prefirió eso a agregar el `try/catch` sin verificación.

> **Antes de mergear:** `rg "CLOUDINARY_API_SECRET" .next/static` no debe devolver resultados, y `rg "upload_preset|unsigned" src/` tampoco. Si aparece cualquiera de los dos, la subida está abierta o el secret está en el bundle.

---

## 12. Dependencias y bloqueos

**Habilita:** 16 (CRUD de productos con subida de foto), 10 y 18 (que usan `buildCloudinaryImageUrl` para las tarjetas y la imagen de Open Graph).

**Decisiones que esta tarea deja establecidas:**

1. El upload es **firmado, nunca unsigned**. La firma se calcula solo en el servidor.
2. El navegador sube **directo a Cloudinary**. El archivo no atraviesa el servidor de Next.
3. La infra (`infra/cloudinary.ts`) solo transporta. El servicio decide.
4. La validación **autoritativa** es la que hace Cloudinary sobre los bytes reales, no la que declara el navegador.
5. SVG está excluido por el `MIME` declarado y por el `format` real. Nunca se acepta.
6. El `public_id` es determinístico a partir del `slug`, vía el mismo `buildSlug` del proyecto.
7. Reemplazar una foto **sube primero y destruye después**, porque `products.imageUrl` es `NOT NULL`.
8. Un fallo al destruir el asset anterior no revierte el guardado: se loguea y el huérfano se limpia en la Tarea 21.
9. `next.config.ts` declara **un solo** host de imágenes: `res.cloudinary.com`. Ni comodines, ni `dangerouslyAllowSVG`.
10. El límite es 6 MB y 1200 px del lado mayor. Los números viven en el servicio, no en la infra.

**Bloqueos y decisiones pendientes:**

- **Autorización del Route Handler.** `POST /api/admin/images/sign` devuelve `501` hasta la Tarea 07. Es intencional, pero es un estado incompleto: **la tarea 06 sola no permite subir imágenes**. La Tarea 07 tiene que reemplazar el `const autorizado = false` por `verifyAdminSession()`.
- **Firma para un slug arbitrario.** Firmar es fácil; que el `slug` corresponda al producto que el admin está editando, no. El endpoint firma lo que le manden. El control real va en el servicio de la Tarea 16, que tiene que validar que el producto existe y que el usuario tiene permiso sobre él. Dejarlo documentado acá porque es el punto donde el diseño de seguridad se pone flojo.
- **`fetch` sin try/catch en la infra.** Una caída de red produce un `TypeError` crudo en lugar de un `ExternalServiceError`. Se deja así a propósito hasta tener un test que lo cubra.
