# Tarea 13 — UI de Checkout y handoff a WhatsApp

| Campo | Valor |
|---|---|
| **ID** | 13 |
| **Fase (DESIGN.md §8.5)** | Fase 3 — Carrito y Handoff a WhatsApp |
| **Depende de** | 12 |
| **Habilita** | 18, 20 |
| **Tipo** | Presentación + Controlador |
| **Esfuerzo est.** | 3 – 4 días |

---

## 1. Objetivo de la tarea

Construir el flujo que lleva desde el carrito hasta el chat de WhatsApp abierto con el pedido escrito. Dos páginas, ocho componentes, un esquema de validación y un endpoint público de revalidación de precios.

El flujo completo, en tres pasos:

```
1. /checkout          el cliente completa nombre, teléfono, modalidad y dirección
2. el navegador       buildWhatsAppMessage() + buildWhatsAppUrl()  [funciones puras de la Tarea 12]
3. /checkout/exito    muestra la URL real y abre el chat de WhatsApp
```

**Criterio de éxito verificable:** desde `/menu`, agregar un producto, completar el checkout y tocar el botón deja un chat de WhatsApp abierto con el pedido completo, verificado en un teléfono real por el encargado (requisito de salida de `DESIGN.md` §8.5).

---

## 2. Contexto y dependencias

**Requiere:** Tarea 12 completa (funciones puras del mensaje y la URL) y Tarea 11 (store del carrito) y Tarea 09 (primitivas de UI).

### 2.1 El hecho arquitectónico que define esta tarea

> **El carrito vive en el navegador y el checkout no persiste el pedido en el servidor.**

No hay tabla `Order` (ADR-4 de `DESIGN.md`). No hay endpoint que reciba el pedido. No hay confirmación en la base. El único registro de una venta es el chat de WhatsApp del local.

Consecuencias directas, y no son detalles de implementación:

| Consecuencia | Por qué |
|---|---|
| `buildWhatsAppMessage` corre **en el cliente** | No hay servidor que lo corra. Por eso en la Tarea 12 no lleva `server-only` |
| El Server Component de `/checkout` no lee el carrito | Está en `localStorage`. Solo pasa los datos del negocio al cliente |
| La revalidación de precios es un **GET público**, no un post del pedido | Solo consulta; no escribe |
| Al limpiar el carrito, la página de éxito tiene que reconstruir la URL | Perder el carrito no puede perder el pedido |

### 2.2 Contratos que se consumen

| Símbolo | De dónde | Para qué |
|---|---|---|
| `buildWhatsAppMessage(input): string` | Tarea 12 | Armar el texto en el navegador |
| `buildWhatsAppOrder(input): WhatsAppOrderMessage` | Tarea 12 | Saber si el mensaje se recortó y avisar |
| `buildWhatsAppUrl(phone, message): string` | Tarea 12 | Armar el deep-link |
| `DEFAULT_MESSAGE_VARIANT` | Tarea 12 | Mandar el mismo formato que usa el resto del sitio |
| `CartState`, `CartLine` | Tarea 11 | Leer líneas, cantidades, snapshot de precio |
| `MAX_QUANTITY_PER_ITEM` | Tarea 11 | Mostrar el tope en el stepper del resumen |
| `formatARS` · `orderTotal` | Tarea 11 | Resumen y total |
| `getBusinessSettings(deps)` | Tarea 08 | Nombre y teléfono del local en el Server Component |
| `findPublishedProducts(options?)` | Tarea 04 | Precios vigentes en la revalidación |
| `Button` · `Input` · `Textarea` · `Badge` · `EmptyState` · `useToast` | Tarea 09 | Toda la UI. **Nunca** HTML crudo con estilos sueltos |

> **Contrato que el checkout consume de `CartLine` (Tarea 11).** No se redeclara el tipo: se importa `@/lib/cart/cart-types` y se usan estos seis campos. Los otros cuatro (`slug`, `imageUrl`, `available`, `variantId`) los define la Tarea 11 y el checkout no los necesita para armar el mensaje.
>
> ```ts
> // src/lib/cart/cart-types.ts — DEFINIDO EN LA TAREA 11. No redeclarar.
> export interface CartLine {
>   readonly productId: string;
>   readonly slug: string;
>   readonly name: string;
>   readonly variantId: string | null;   // ⛔ distinto de variantName: el id de la variante, no su etiqueta
>   readonly variantName: string | null;
>   readonly unitPrice: number;          // Instantánea del precio con el priceDelta ya aplicado
>   readonly quantity: number;
>   readonly imageUrl: string | null;
>   readonly available: boolean;         // Copia del stock al momento de agregar. NO es garantía: acá se revalida
> }
> ```
>
> `WhatsAppCartLine` (Tarea 12) es un subconjunto de `CartLine` —los mismos seis campos menos `variantId`—, así que una `CartLine` es asignable a `WhatsAppCartLine` por tipado estructural y se pasa directo, sin mapper. El checkout solo tiene que proyectar el campo `available` al `CartLineReference` que espera la revalidación.

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `src/app/(public)/checkout/page.tsx` | Server Component. Lee los ajustes del negocio y monta el formulario |
| `src/app/(public)/checkout/exito/page.tsx` | Server Component de la pantalla de éxito. Metadata `noindex` |
| `src/components/checkout/CheckoutForm.tsx` | Orquestador del formulario: estado, validación, handoff |
| `src/components/checkout/CustomerFields.tsx` | Nombre y teléfono |
| `src/components/checkout/FulfillmentPicker.tsx` | Envío o retiro |
| `src/components/checkout/AddressField.tsx` | Visible y requerido solo si es envío |
| `src/components/checkout/NotesField.tsx` | Comentarios opcionales con contador |
| `src/components/checkout/OrderSummary.tsx` | Resumen de solo lectura, con precio tachado y línea no comprable |
| `src/components/checkout/WhatsAppHandoff.tsx` | El botón final y el enlace de respaldo |
| `src/components/checkout/CheckoutClient.tsx` | Envuelve el formulario: guarda de hidratación, redirección de carrito vacío |
| `src/components/checkout/CheckoutSuccess.tsx` | Pantalla de éxito: reconstruye el mensaje desde el snapshot |
| `src/components/checkout/use-cart-validation.ts` | Hook que consulta `/api/cart/validate` y compara con la instantánea |
| `src/components/checkout/handoff-snapshot.ts` | Lectura y escritura del snapshot de `sessionStorage`, con guard de runtime |
| `src/components/checkout/index.ts` | Barrel de exports del módulo |
| `src/hooks/use-checkout-draft.ts` | Persistencia del formulario en `sessionStorage` |
| `src/server/schemas/checkout.schema.ts` | Contrato Zod del checkout |
| `src/server/services/cart-validation.service.ts` | Revalidación de precio y disponibilidad. **Con** `server-only` |
| `src/app/api/cart/validate/route.ts` | Route Handler público, GET, `no-store` |
| `src/components/checkout/CheckoutForm.component.test.tsx` | Casos de UI: envío, retiro, errores, doble clic |
| `src/components/checkout/WhatsAppHandoff.component.test.tsx` | Enlace de respaldo, bloqueo de popup, mensaje recortado |
| `tests/unit/checkout/checkout.schema.test.ts` | Reglas del esquema Zod |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `src/components/cart/CartSheet.tsx` | El botón "Continuar" navega a `/checkout` en vez de hacer el handoff directo |
| `src/config/navigation.ts` | Agregar `/checkout` y `/checkout/exito` |
| `src/app/(public)/layout.tsx` | Verificar que el `ToastViewport` esté montado (el redireccionamiento del carrito vacío lo usa) |
| `docs/tasks/README.md` | Marcar Tarea 13 |

### 3.3 Eliminar

Ninguno.

---

## 4. Estructura N-Capas

### 4.1 Qué vive en esta capa

| Capa | Qué va acá | Qué NO va acá |
|---|---|---|
| 1 · Presentación | Las dos páginas, los ocho componentes, el estado del formulario, el `sessionStorage` | Nada. No arma el mensaje a mano ni calcula totales |
| 2 · Route Handler | `GET /api/cart/validate`: parsear la query, delegar, responder | **Ninguna regla de negocio.** No decide si un precio "cambió mucho" |
| 3 · Servicio | `cart-validation.service.ts`: comparar snapshot contra catálogo vigente | No lee la query string, no responde |
| 0 · `lib/` | `buildWhatsAppMessage`, `buildWhatsAppUrl` (Tarea 12) | Nada nuevo |

### 4.2 La regla más importante de esta tarea

> **El checkout no persiste el pedido. "Confirmar" significa abrir WhatsApp.**

El único control de autorización y de integridad del pedido es la conversación misma: el encargado lee el mensaje, ve el precio y confirma. No hay estado en el servidor que pueda quedar desincronizado con la base de clientes, no hay tabla que migrar, no hay datos personales guardados.

**Consecuencia operativa que hay que decir en voz alta:** si el cliente abre el chat y no envía el mensaje, el local nunca se entera. No hay lista de "carritos abandonados" y no la va a haber. Es el precio de no tener persistencia, y es el flujo que el negocio ya viene haciendo.

### 4.3 `checkout.schema.ts` vive en `src/server/` y **no** lleva `server-only`

`src/server/schemas/` es la casa de los contratos Zod del proyecto (contexto compartido §2). Este esquema no hace I/O, no lee cookies, no importa Prisma: es una función de validación. Por la regla del contexto compartido §11 (los módulos puros **no** llevan el centinela) **no** lleva `import "server-only"`, y por eso el mismo esquema valida en el navegador y en el endpoint.

> **El criterio, una sola vez:** el centinela se pone por la presencia de I/O, no por la carpeta. Un esquema Zod en `src/server/` que se importa en un Client Component es correcto. Si algún día este esquema necesita leer la base o una cookie, se parte: la versión reducida se va a `src/lib/validation/` y la del servidor se queda acá. Esa partición no se hace hoy porque no hay nada que partir.

### 4.4 Reparto de responsabilidades

| Componente | Responsabilidad | NO sabe |
|---|---|---|
| `CheckoutClient` | Hidratación del carrito, redirección si está vacío | Los campos del formulario |
| `CheckoutForm` | Estado, validación, mapeo carrito → `WhatsAppOrderMessage` | Cómo se ve cada campo |
| `CustomerFields` · `FulfillmentPicker` · `AddressField` · `NotesField` | Presentación de un campo, nada más | La existencia del carrito |
| `OrderSummary` | Mostrar líneas y totales de solo lectura | Cómo se envía el pedido |
| `WhatsAppHandoff` | Abrir el chat, con enlace de respaldo | Los datos del formulario (llegan ya armados) |

---

## 5. Convenciones de código (Clean Code + SOLID)

**Principio aplicado: ISP en los componentes y DIP en el servicio.**

- **Componentes chicos.** Ninguno pasa las 200 líneas del contexto compartido §13. Si `CheckoutForm` se pasa, es que tiene dos razones de cambio: se parte.
- **`"use client"` por archivo, no por componente.** Es lo que hace la Tarea 09. El Server Component de la ruta no lo lleva; los componentes del módulo, sí.
- **DIP en el servicio de validación:** recibe el repositorio por parámetro, igual que los servicios de la Tarea 08. No importa `prisma` ni `@/server/repositories` en el cuerpo del módulo; el Route Handler es el punto de composición.
- **Los componentes no conocen el formato del mensaje.** Reciben `text` y `url` ya construidos. Si mañana cambia la plantilla, no se toca un solo componente.
- **Zod para los límites, `ValidationError` para el dominio.** El formulario usa `checkoutSchema.safeParse`; el mensaje usa `buildWhatsAppMessage`. Son dos capas de validación con propósitos distintos y no se mezclan.
- **`readonly` en todas las props.** Contexto compartido §11.
- **Cero `any`, cero `!`, cero `@ts-expect-error`.**

---

## 6. Pasos de implementación

### 6.1 `src/server/schemas/checkout.schema.ts`

```ts
/**
 * Contrato de validación del checkout.
 *
 * ⛔ NO lleva `import "server-only"` (contexto compartido §11): no hay I/O
 * acá. El mismo esquema valida en el navegador, para UX, y en el Route
 * Handler, para seguridad (ADR-13 de `DESIGN.md`).
 */
import { z } from "zod";
import { normalizeArgentinePhone } from "@/lib/format/phone";
import type { E164Phone } from "@/lib/format/phone";
import type { WhatsAppCustomer } from "@/lib/whatsapp/message-contract";

export const FULFILLMENT_VALUES = ["delivery", "pickup"] as const;

export const MIN_ADDRESS_LENGTH = 10;
export const MAX_ADDRESS_LENGTH = 240;
export const MAX_NOTES_LENGTH = 500;

/**
 * El teléfono se **transforma** a E.164, no se valida con una regex aparte.
 *
 * Una regex que acepta `2615551234` y una que acepta `+54 9 261 555-1234`
 * son dos reglas que se desincronizan. Delegar en `normalizeArgentinePhone`
 * hace que el formulario, el mensaje y el panel de ajustes compartan la
 * misma definición de "teléfono válido" (Tarea 12 §4.3).
 *
 * `z.NEVER` es el centinela de Zod para "transformación fallida": corta la
 * cadena sin ensuciar el tipo de salida.
 */
const phoneField = z
  .string()
  .trim()
  .min(1, "Ingresá tu teléfono.")
  .max(32, "El teléfono es demasiado largo.")
  .transform((value, ctx): E164Phone | typeof z.NEVER => {
    try {
      return normalizeArgentinePhone(value);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "El teléfono no es válido. Escribilo como +54 9 261 555-1234.",
      });
      return z.NEVER;
    }
  });

const baseSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Ingresá tu nombre.")
    .max(80, "El nombre puede tener hasta 80 caracteres."),
  phone: phoneField,
  fulfillment: z.enum(FULFILLMENT_VALUES, {
    errorMap: () => ({ message: "Elegí si querés envío o retiro." }),
  }),
  address: z
    .string()
    .trim()
    .max(MAX_ADDRESS_LENGTH, `La dirección puede tener hasta ${MAX_ADDRESS_LENGTH} caracteres.`)
    .optional(),
  notes: z
    .string()
    .trim()
    .max(MAX_NOTES_LENGTH, `Las notas pueden tener hasta ${MAX_NOTES_LENGTH} caracteres.`)
    .optional(),
});

/**
 * La dirección es condicional, y `superRefine` es el lugar correcto para una
 * regla que depende de otro campo. Con un `refine` sobre `address` sola, Zod
 * no puede mirar `fulfillment`.
 */
export const checkoutSchema = baseSchema.superRefine((value, ctx) => {
  if (value.fulfillment === "pickup") return;

  const address = value.address ?? "";

  if (address.length === 0) {
    ctx.addIssue({ path: ["address"], code: "custom", message: "Ingresá la dirección de entrega." });
    return;
  }

  if (address.length < MIN_ADDRESS_LENGTH) {
    ctx.addIssue({
      path: ["address"],
      code: "custom",
      message: `La dirección es demasiado corta. Incluí calle, número y barrio.`,
    });
  }
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Estado del formulario, con los campos opcionales siempre presentes. */
export interface CheckoutDraft {
  readonly fullName: string;
  readonly phone: string;
  readonly fulfillment: (typeof FULFILLMENT_VALUES)[number];
  readonly address: string;
  readonly notes: string;
}

export const EMPTY_CHECKOUT_DRAFT: CheckoutDraft = {
  fullName: "",
  phone: "",
  fulfillment: "pickup",
  address: "",
  notes: "",
};

/**
 * Convierte el error de Zod en el mapa que consume el formulario.
 *
 * `error.flatten().fieldErrors` trae `string[] | undefined` por clave. Sin
 * este filtro, `Record<string, readonly string[]>` no se puede afirmar sin
 * un `as`, y los valores `undefined` se cuelan en el render.
 */
export const toFieldErrors = (
  error: z.ZodError,
): Readonly<Record<string, readonly string[]>> => {
  const result: Record<string, readonly string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") continue;
    const current = result[key] ?? [];
    result[key] = [...current, issue.message];
  }

  return result;
};

/**
 * Traduce el draft al contrato de la Tarea 12.
 *
 * Vive acá y no en el componente porque es el único punto del proyecto donde
 * se cruzan el schema del checkout y el contrato del mensaje. Si mañana el
 * mensaje necesita un campo más, se cambia en un archivo.
 */
export const toWhatsAppCustomer = (draft: CheckoutDraft): WhatsAppCustomer => ({
  fullName: draft.fullName.trim(),
  phone: draft.phone,
  fulfillment: draft.fulfillment,
  // ⛔ Sin `|| null`: una dirección vacía es `""`, que es distinto de "no
  // pidió delivery", y el mensaje los trata distinto.
  address: draft.fulfillment === "delivery" ? draft.address.trim() : null,
  notes: draft.notes.trim() === "" ? null : draft.notes.trim(),
});
```

### 6.2 `src/server/services/cart-validation.service.ts`

```ts
import "server-only";

import { roundCurrency } from "@/lib/format/currency";
import type { ProductDTO } from "@/lib/domain";

/**
 * Por qué el servicio existe: el carrito guarda una **instantánea** del
 * precio. Entre que el cliente agregó el sándwich y presionó "Enviar" pueden
 * pasar diez minutos y cambiar el precio. Mandar un precio viejo genera una
 * discusión que el encargado tiene que resolver en el chat, que es
 * exactamente lo que este proyecto quiere evitar.
 *
 * ⛔ No lee la query string ni responde: eso es del Route Handler.
 */

/** Motivo por el que una línea no se puede enviar. */
export type CartLineIssue = "FUERA_DE_CATALOGO" | "PRODUCTO_AGOTADO" | "VARIANTE_NO_DISPONIBLE";

/** Lo único que el endpoint necesita saber: qué se quiere comprar. */
export interface CartLineReference {
  readonly productId: string;
  readonly variantId: string | null;
}

export interface ValidatedCartLine {
  readonly productId: string;
  readonly variantId: string | null;
  /** `false` si el producto fue archivado o despublicado. */
  readonly isInCatalog: boolean;
  readonly isAvailable: boolean;
  /** Precio vigente con el `priceDelta` aplicado. `null` si ya no existe. */
  readonly currentUnitPrice: number | null;
  /** Si hay `issue`, la línea no se puede enviar. */
  readonly issue: CartLineIssue | null;
}

export interface CartValidationResult {
  readonly lines: readonly ValidatedCartLine[];
  /** Hay al menos una línea que no se puede enviar. */
  readonly hasBlockingIssues: boolean;
}

/** Solo la parte del repositorio que este servicio necesita (DIP). */
export interface CartAvailabilityReader {
  findPublishedProducts(options?: { readonly onlyAvailable?: boolean }): Promise<ProductDTO[]>;
}

const buildValidatedLine = (
  reference: CartLineReference,
  product: ProductDTO | undefined,
): ValidatedCartLine => {
  if (product === undefined) {
    return {
      productId: reference.productId,
      variantId: reference.variantId,
      isInCatalog: false,
      isAvailable: false,
      currentUnitPrice: null,
      issue: "FUERA_DE_CATALOGO",
    };
  }

  const variant =
    reference.variantId === null
      ? undefined
      : product.variants.find((item) => item.id === reference.variantId);

  const isVariantUnavailable =
    reference.variantId !== null && (variant === undefined || !variant.isAvailable);

  return {
    productId: reference.productId,
    variantId: reference.variantId,
    isInCatalog: true,
    isAvailable: product.isAvailable,
    currentUnitPrice: roundCurrency(product.price + (variant?.priceDelta ?? 0)),
    issue: isVariantUnavailable
      ? "VARIANTE_NO_DISPONIBLE"
      : product.isAvailable
        ? null
        : "PRODUCTO_AGOTADO",
  };
};

/**
 * Consulta el estado y el precio vigente de las líneas del carrito.
 *
 * Los productos se piden **todos** los publicados, incluidos los agotados. Si
 * se pidieran solo los disponibles, un producto que se agotó aparecería como
 * "fuera de catálogo" y el mensaje sería falso. La diferencia entre "no
 * existe" y "existe pero no hay" importa: la primera pide una línea nueva,
 * la segunda ofrece esperar.
 */
export const validateCartLines = async (
  dependencies: { readonly productRepository: CartAvailabilityReader },
  references: readonly CartLineReference[],
): Promise<CartValidationResult> => {
  const products = await dependencies.productRepository.findPublishedProducts();
  const byId = new Map(products.map((product) => [product.id, product]));

  const lines = references.map((reference) => buildValidatedLine(reference, byId.get(reference.productId)));

  return {
    lines,
    hasBlockingIssues: lines.some((line) => line.issue !== null),
  };
};
```

> La consulta va una sola vez y el cruce es un `Map`: 30 líneas son 30 búsquedas de memoria, no 30 queries.

> **Por qué el servicio no recibe el precio del carrito.** El endpoint responde una sola pregunta: "¿esto sigue existiendo, sigue disponible y cuánto vale hoy?". La comparación con el precio que tenía el cliente la hace el navegador, que es donde está la instantánea, y son dos números: no hay nada que confiar. Mandar el precio por la URL además lo expondría en el historial del navegador y en los logs del servidor. El servicio devuelve el valor de verdad; quién compara, cada uno con lo suyo.

### 6.3 `src/app/api/cart/validate/route.ts`

```ts
import { NextResponse } from "next/server";
import { findPublishedProducts } from "@/server/repositories/product.repository";
import { validateCartLines } from "@/server/services/cart-validation.service";
import type { CartLineReference } from "@/server/services/cart-validation.service";

/**
 * Revalidación de precio y disponibilidad del carrito.
 *
 * Endpoint **público**: no guarda nada, no devuelve datos del cliente y solo
 * lee lo que el catálogo público ya muestra. No requiere sesión porque no hay
 * sesión: el cliente no tiene cuenta y no va a tenerla.
 *
 * Amigable con rate limit por diseño (§9):
 *  · Es `GET`, o sea que un proxy con caché lo puede cachear. Acá se fuerza
 *    `no-store` porque el dato caduca en minutos.
 *  · `MAX_LINES_PER_REQUEST` acota el trabajo: una request con 5000 ids se
 *    rechaza con 400 antes de tocar la base.
 *  · No hay rate limit propio. Agregarlo es envolver la función, no
 *    reescribirla (la Tarea 19 endurece la red).
 *
 * `MAX_LINES_PER_REQUEST` no se exporta: los Route Handlers de Next solo
 * exportan los métodos HTTP y la configuración de la ruta. Vive acá y punto.
 */

/** 30 es holgado para un carrito real de sándwiches y acota el trabajo por request. */
const MAX_LINES_PER_REQUEST = 30;

/** `productId` o `productId:variantId`. Los ids de Prisma no tienen dos puntos. */
const LINE_PATTERN = /^[a-zA-Z0-9_-]{1,36}(:[a-zA-Z0-9_-]{1,36})?$/;

export const dynamic = "force-dynamic";

const parseLine = (raw: string): CartLineReference | null => {
  if (!LINE_PATTERN.test(raw)) return null;

  const [productId, variantId] = raw.split(":");

  if (productId === undefined || productId.length === 0) return null;

  return { productId, variantId: variantId ?? null };
};

type ParsedRequest =
  | { readonly ok: true; readonly lines: readonly CartLineReference[] }
  | { readonly ok: false; readonly error: string };

const parseRequest = (searchParams: URLSearchParams): ParsedRequest => {
  const raw = searchParams.getAll("line");

  if (raw.length === 0) {
    return { ok: false, error: "Mandá al menos un producto con el parámetro line." };
  }

  if (raw.length > MAX_LINES_PER_REQUEST) {
    return {
      ok: false,
      error: `Se pueden validar hasta ${MAX_LINES_PER_REQUEST} productos por request.`,
    };
  }

  const parsed = raw.map(parseLine);

  if (parsed.some((line) => line === null)) {
    return { ok: false, error: "Alguno de los productos enviados no tiene un formato válido." };
  }

  return {
    ok: true,
    lines: parsed.filter((line): line is CartLineReference => line !== null),
  };
};

const noStore = { "Cache-Control": "no-store, max-age=0" } as const;

export async function GET(request: Request): Promise<NextResponse> {
  const parsed = parseRequest(new URL(request.url).searchParams);

  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400, headers: noStore });
  }

  try {
    // Punto de composición: el handler es el único lugar del proyecto que
    // junta el repositorio con el servicio.
    const result = await validateCartLines({ productRepository: { findPublishedProducts } }, parsed.lines);

    return NextResponse.json(
      { ok: true, ...result, checkedAt: new Date().toISOString() },
      { headers: noStore },
    );
  } catch (error) {
    console.error("[api:cart/validate]", error);
    return NextResponse.json(
      { ok: false, error: "No pudimos validar el carrito." },
      { status: 500, headers: noStore },
    );
  }
}
```

> **`new Date()` acá y no en el mensaje.** `checkedAt` es metadata de la respuesta HTTP, no contenido del pedido: la Tarea 12 sigue siendo pura. `dynamic = "force-dynamic"` evita que Next intente cachear el handler.

### 6.4 `src/hooks/use-checkout-draft.ts`

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_CHECKOUT_DRAFT, type CheckoutDraft } from "@/server/schemas/checkout.schema";

/**
 * Borrador del formulario de checkout.
 *
 * `sessionStorage` y no `localStorage` a propósito: el borrador muere con la
 * pestaña, no con el navegador. Un nombre, un teléfono y una dirección
 * guardados para siempre en `localStorage` son un dato personal del cliente
 * quedándose en un dispositivo compartido. El carrito sí vive en
 * `localStorage` (Tarea 11) porque no tiene nada personal.
 *
 * El borrador se limpia apenas se abre WhatsApp: si el usuario vuelve atrás
 * y presiona "Enviar" otra vez, lo que quiere es mandar el mismo pedido, no
 * arrancar de nuevo con datos viejos.
 */
const STORAGE_KEY = "modo-miga:checkout-draft:v1";

const isCheckoutDraft = (value: unknown): value is CheckoutDraft => {
  if (typeof value !== "object" || value === null) return false;

  const record = value as Record<string, unknown>;
  const validFulfillment = record.fulfillment === "delivery" || record.fulfillment === "pickup";

  return (
    typeof record.fullName === "string" &&
    typeof record.phone === "string" &&
    validFulfillment &&
    typeof record.address === "string" &&
    typeof record.notes === "string"
  );
};

const readDraft = (): CheckoutDraft => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return EMPTY_CHECKOUT_DRAFT;
    const parsed: unknown = JSON.parse(raw);
    return isCheckoutDraft(parsed) ? parsed : EMPTY_CHECKOUT_DRAFT;
  } catch {
    // JSON corrupto o `sessionStorage` bloqueado (modo privado de algunos
    // navegadores). Perder el borrador no puede romper el checkout.
    return EMPTY_CHECKOUT_DRAFT;
  }
};

export function useCheckoutDraft() {
  const [draft, setDraft] = useState<CheckoutDraft>(EMPTY_CHECKOUT_DRAFT);
  const [isRestored, setIsRestored] = useState(false);

  // ⛔ Nunca leer `sessionStorage` durante el render: el servidor no tiene
  // ventana y el primer render del cliente tiene que coincidir con el del
  // servidor (riesgo R4 de `DESIGN.md`).
  useEffect(() => {
    setDraft(readDraft());
    setIsRestored(true);
  }, []);

  const update = useCallback((patch: Partial<CheckoutDraft>): void => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Cuota llena o almacenamiento deshabilitado: el formulario sigue
        // funcionando, solo no se recupera si el usuario se va.
      }
      return next;
    });
  }, []);

  const clear = useCallback((): void => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Mismo caso que arriba.
    }
    setDraft(EMPTY_CHECKOUT_DRAFT);
  }, []);

  return { draft, update, clear, isRestored } as const;
}
```

> El `as Record<string, unknown>` del type guard es el `as` justificado que permite la regla §11: no silencia al compilador, convierte `unknown` en algo indexable para poder verificar la forma. El comentario lo dice.

### 6.5 `src/components/checkout/CheckoutClient.tsx`

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import { useCartStore } from "@/store/cart-store";
import { CheckoutForm } from "./CheckoutForm";
import { OrderSummary } from "./OrderSummary";
import type { BusinessSettingsDTO } from "@/lib/domain";

/**
 * Envuelve el checkout y resuelve los dos estados que no son del formulario:
 * la hidratación del carrito y el carrito vacío.
 *
 * Vive en un componente aparte porque `useRouter` y `useEffect` obligan a
 * que el archivo sea cliente, y el Server Component de la ruta tiene que
 * poder seguir siendo servidor.
 */
export function CheckoutClient({ business }: { readonly business: BusinessSettingsDTO }) {
  const router = useRouter();
  const { show } = useToast();
  const lines = useCartStore((state) => state.lines);
  const isHydrated = useCartStore((state) => state.isHydrated);

  useEffect(() => {
    // Antes de hidratar no se sabe si el carrito está vacío: redirigir en
    // ese momento manda al menú a un cliente que sí tenía productos.
    if (!isHydrated) return;

    if (lines.length === 0) {
      show("Tu carrito está vacío. Elegí algo del menú para hacer el pedido.", "info");
      router.replace("/menu");
    }
  }, [isHydrated, lines.length, router, show]);

  if (!isHydrated || lines.length === 0) {
    return <CheckoutSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-40 pt-6 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <CheckoutForm business={business} />
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <OrderSummary reviews={reviews} />
        </aside>
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6" aria-busy="true" role="status">
      <span className="sr-only">Cargando tu pedido…</span>
      <div className="h-8 w-56 animate-pulse rounded-control bg-cream" />
      <div className="mt-6 h-40 animate-pulse rounded-card bg-cream" />
    </div>
  );
}
```

> `router.replace` y no `push`: el checkout vacío no debe quedar en el historial. Si el usuario vuelve con el botón atrás, tiene que caer en el carrito, no en un formulario vacío.

### 6.6 `src/components/checkout/CheckoutForm.tsx`

```tsx
"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import { orderTotal } from "@/lib/whatsapp/message-contract";
import {
  checkoutSchema,
  toFieldErrors,
  toWhatsAppCustomer,
} from "@/server/schemas/checkout.schema";
import { useCartStore } from "@/store/cart-store";
import { useCheckoutDraft } from "@/hooks/use-checkout-draft";
import { WhatsAppHandoff } from "./WhatsAppHandoff";
import { saveHandoffSnapshot } from "./handoff-snapshot";
import { CustomerFields } from "./CustomerFields";
import { FulfillmentPicker } from "./FulfillmentPicker";
import { AddressField } from "./AddressField";
import { NotesField } from "./NotesField";
import { useCartValidation } from "./use-cart-validation";
import type { BusinessSettingsDTO } from "@/lib/domain";

/** Errores por campo, para pasarle un string a cada `Input`. */
type FieldErrors = Readonly<Record<string, readonly string[]>>;

const firstError = (errors: FieldErrors, field: string): string | undefined => errors[field]?.[0];

interface CheckoutFormProps {
  readonly business: BusinessSettingsDTO;
}

export function CheckoutForm({ business }: CheckoutFormProps) {
  const router = useRouter();
  const { show } = useToast();
  const lines = useCartStore((state) => state.lines);
  const clearCart = useCartStore((state) => state.clearCart);
  const { draft, update, clear } = useCheckoutDraft();
  const { reviews, hasBlockingIssues, isValidating } = useCartValidation();

  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    // El control principal es un `<button type="submit">`, así que el clic
    // nunca navega: por eso el `preventDefault` va primero, siempre.
    event.preventDefault();

    // Doble clic: mientras se arma el pedido no se vuelve a Submit.
    if (isSubmitting) return;

    setIsSubmitting(true);

    const parsed = checkoutSchema.safeParse(draft);

    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error);
      setErrors(fieldErrors);

      // El foco va al primer control con error: un mensaje de error que no
      // recibe el foco es invisible para quien navega con teclado o lector
      // de pantalla.
      const firstField = Object.keys(fieldErrors)[0];
      if (firstField !== undefined) {
        formRef.current?.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus();
      }

      setIsSubmitting(false);
      return;
    }

    setErrors({});

    // Un producto que ya no se puede comprar hace que el pedido sea
    // imposible de cumplir (§6.9). Acá se corta, y no en el chat.
    if (hasBlockingIssues) {
      show("Hay productos del carrito que ya no están disponibles. Revisá el resumen.", "error");
      setIsSubmitting(false);
      return;
    }

    // La instantánea del pedido viaja a la pantalla de éxito por
    // `sessionStorage`: es lo único que sobrevive a la navegación. Se arma
    // con `parsed.data`, o sea con los datos ya validados y normalizados, y
    // nunca con `draft`: la pantalla de éxito no vuelve a pasar por Zod.
    saveHandoffSnapshot({
      items: lines,
      customer: toWhatsAppCustomer(parsed.data),
      total: orderTotal(lines),
    });

    // El carrito se limpia recién acá, no antes. Si algo falla entre este
    // punto y el chat, el cliente todavía tiene su carrito.
    clear();
    router.push("/checkout/exito");
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <CustomerFields
        fullName={draft.fullName}
        phone={draft.phone}
        onFullNameChange={(value) => update({ fullName: value })}
        onPhoneChange={(value) => update({ phone: value })}
        errors={errors}
      />

      <FulfillmentPicker value={draft.fulfillment} onChange={(value) => update({ fulfillment: value })} />

      {draft.fulfillment === "delivery" && (
        <AddressField
          value={draft.address}
          onChange={(value) => update({ address: value })}
          error={firstError(errors, "address")}
        />
      )}

      <NotesField
        value={draft.notes}
        onChange={(value) => update({ notes: value })}
        error={firstError(errors, "notes")}
      />

      <WhatsAppHandoff
        business={business}
        lines={lines}
        customer={toWhatsAppCustomer(draft)}
        total={orderTotal(lines)}
        reviews={reviews}
        isValidating={isValidating}
        disabled={isSubmitting}
      />
    </form>
  );
}
```

> El snapshot guarda **datos, no texto**: el mensaje se arma una sola vez, en la pantalla de éxito, con las funciones puras de la Tarea 12. `toWhatsAppCustomer` es el único lugar del proyecto que traduce el schema del checkout al contrato del mensaje, y por eso vive en `checkout.schema.ts` (§6.1).

### 6.7 `src/components/checkout/WhatsAppHandoff.tsx`

Dentro del formulario **no hay ningún `<a href="https://wa.me/...">`**, y es una decisión, no un olvido. Un enlace no dispara `onSubmit`: si el ancla fuera el control principal, el formulario vacío mandaría un pedido sin nombre ni teléfono. La validación tiene que vivir en un `submit`.

El `<a>` real vive en `/checkout/exito` (§6.11), que es donde ya no hay nada que validar.

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { buildWhatsAppOrder } from "@/lib/whatsapp/whatsapp-message.service";
import { ValidationError } from "@/lib/domain";
import { formatARS } from "@/lib/format/currency";
import type { BusinessSettingsDTO } from "@/lib/domain";
import type { WhatsAppCartLine, WhatsAppCustomer } from "@/lib/whatsapp/message-contract";
import type { CartLineReview } from "./use-cart-validation";

export interface WhatsAppHandoffProps {
  readonly business: BusinessSettingsDTO;
  /** `CartLine` de la Tarea 11, asignable a `WhatsAppCartLine` (§2.2). */
  readonly lines: readonly WhatsAppCartLine[];
  /** Datos a medio cargar: solo los usa el preview, que captura el error. */
  readonly customer: WhatsAppCustomer;
  readonly total: number;
  readonly reviews: readonly CartLineReview[] | null;
  readonly isValidating: boolean;
  readonly disabled?: boolean;
}

/**
 * El control que cierra el pedido.
 *
 * Un `<button type="submit">` y nada más: valida, avisa y manda a la pantalla
 * de éxito. Toda la lógica de la URL vive allá, porque acá el pedido todavía
 * no está validado y un mensaje armado con datos a medio cargar no sirve.
 */
export function WhatsAppHandoff(props: WhatsAppHandoffProps) {
  const { business, lines, customer, total, reviews, isValidating, disabled = false } = props;
  const [showPreview, setShowPreview] = useState(false);

  if (lines.length === 0) return null;

  const priceChanges = reviews?.filter((review) => review.isPriceChanged) ?? [];
  const blocking = reviews?.filter((review) => review.issue !== null) ?? [];

  return (
    <div className="flex flex-col gap-3">
      {isValidating && (
        <p role="status" className="text-sm text-ink-muted">
          Verificando disponibilidad y precios...
        </p>
      )}

      {priceChanges.length > 0 && (
        <p role="status" className="rounded-control border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-ink">
          {priceChanges.length === 1
            ? "Un producto cambió de precio. Te mandamos el precio de hoy."
            : `${priceChanges.length} productos cambiaron de precio. Te mandamos los precios de hoy.`}
        </p>
      )}

      {blocking.length > 0 && (
        <p role="alert" className="rounded-control border border-clay/35 bg-clay/8 px-3 py-2 text-sm text-ink">
          Hay productos del carrito que ya no se pueden pedir. Quitalos del pedido para continuar.
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" disabled={disabled} className="w-full">
        Enviar pedido por WhatsApp — {formatARS(total)}
      </Button>

      <details
        className="text-sm text-ink-muted"
        onToggle={(event) => setShowPreview(event.currentTarget.open)}
      >
        <summary className="cursor-pointer select-none">Ver el mensaje que se va a enviar</summary>
        {showPreview && <OrderPreview lines={lines} customer={customer} business={business} />}
      </details>
    </div>
  );
}
```

El preview del mensaje va **dentro de un `try/catch`**, y no es un detalle de estilo: `buildWhatsAppOrder` lanza `ValidationError` si falta el nombre o el teléfono, y el `<details>` se renderiza con el formulario todavía vacío. Sin el `catch`, el primer cliente que abre "ver el mensaje" antes de escribir su nombre ve una pantalla en blanco.

```tsx
// Mismo archivo, función local. No necesita archivo propio ni export.
function OrderPreview({
  lines,
  customer,
  business,
}: {
  readonly lines: readonly WhatsAppCartLine[];
  readonly customer: WhatsAppCustomer;
  readonly business: BusinessSettingsDTO;
}) {
  // ⛔ Sin `useMemo`: el preview se abre a mano, se calcula una vez y no
  // tiene un costo que valga memoizar.
  try {
    const order = buildWhatsAppOrder({
      items: lines,
      customer,
      business: { name: business.name, whatsappPhone: business.whatsappPhone },
    });

    return (
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-control bg-cream p-3 font-mono text-xs">
        {order.text}
      </pre>
    );
  } catch (error) {
    // El preview es una cortesía. Si los datos todavía no dan, se lo dice
    // y el checkout sigue funcionando como si nada.
    const message = error instanceof ValidationError ? error.message : "No pudimos armar el mensaje.";

    return <p className="mt-2 text-sm text-ink-muted">Completá tus datos para ver el mensaje.</p>;
  }
}
```

> `catch` declara `error` y solo usa la validación para decidir el mensaje de la UI, no para renderizar el texto crudo de la excepción: un mensaje de error interno en pantalla es una fuga de información. La función pura sigue lanzando `ValidationError`; el que decide qué se muestra es el componente.

### 6.8 `src/components/checkout/OrderSummary.tsx`

```tsx
"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { formatARS } from "@/lib/format/currency";
import { orderTotal } from "@/lib/whatsapp/message-contract";
import { useCartStore } from "@/store/cart-store";
import type { CartLineReview } from "./use-cart-validation";

interface OrderSummaryProps {
  /** `null` mientras no se sabe: no se muestra ni precio nuevo ni error. */
  readonly reviews: readonly CartLineReview[] | null;
}

const ISSUE_TEXT = {
  FUERA_DE_CATALOGO: "Ya no está en el menú",
  PRODUCTO_AGOTADO: "Se agotó",
  VARIANTE_NO_DISPONIBLE: "Esa variante no está disponible",
} as const;

/**
 * Resumen de solo lectura. Nunca edita el carrito: el carrito se edita en el
 * `CartSheet` (Tarea 11). Un segundo lugar para cambiar cantidades es un
 * segundo lugar donde se desincroniza.
 *
 * Lo único que sí hace, y a propósito, es **sacar** una línea que ya no se
 * puede pedir: quitar algo que no existe no es editar el carrito, es
 * arreglar un pedido imposible.
 */
export function OrderSummary({ reviews }: OrderSummaryProps) {
  const lines = useCartStore((state) => state.lines);
  const removeLine = useCartStore((state) => state.removeLine);
  const [isExpanded, setIsExpanded] = useState(false);

  if (lines.length === 0) return null;

  const findReview = (productId: string, variantId: string | null): CartLineReview | undefined =>
    reviews?.find(
      (review) => review.productId === productId,
    );

  const total = orderTotal(lines);

  return (
    <section aria-labelledby="resumen-del-pedido" className="rounded-card border border-line-strong bg-paper p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="resumen-del-pedido" className="font-display text-lg text-ink">
          Tu pedido
        </h2>
        <Badge tone="neutral">
          {lines.length} {lines.length === 1 ? "producto" : "productos"}
        </Badge>
      </div>

      {/* En mobile el resumen arranca plegado: el formulario es lo importante. */}
      <button
        type="button"
        onClick={() => setIsExpanded((open) => !open)}
        aria-expanded={isExpanded}
        aria-controls="resumen-lineas"
        className="mt-3 text-sm font-medium text-crust-deep underline sm:hidden"
      >
        {isExpanded ? "Ocultar el detalle" : "Ver el detalle"}
      </button>

      <ul
        id="resumen-lineas"
        className={`${isExpanded ? "block" : "hidden"} mt-3 flex flex-col gap-3 sm:block`}
      >
        {lines.map((line) => {
          const review = findReview(line.productId, line.variantId ?? null);

          return (
            <li
              // La identidad de una línea es producto + variante: el mismo
              // producto puede estar dos veces con variantes distintas.
              key={`${line.productId}:${line.variantId ?? "-"}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-ink">
                  {line.quantity} x {line.name}
                  {line.variantName !== null && <span className="text-ink-muted"> ({line.variantName})</span>}
                </p>

                {review?.isPriceChanged === true && review.currentUnitPrice !== null && (
                  <p className="mt-1 text-xs text-ink-muted">
                    <span className="line-through">{formatARS(line.unitPrice)}</span>{" "}
                    <span className="font-medium text-ink">{formatARS(review.currentUnitPrice)} c/u</span>
                  </p>
                )}

                {review?.issue != null && (
                  <p role="alert" className="mt-1 text-xs text-clay-deep">
                    {ISSUE_TEXT[review.issue]}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="tabular-nums text-ink">{formatARS(line.unitPrice * line.quantity)}</span>

                {review?.issue != null && (
                  <Button variant="ghost" size="sm" onClick={() => removeLine(line.productId, line.variantId ?? null)}>
                    Quitar
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 flex items-baseline justify-between border-t border-line-strong pt-3">
        <span className="text-sm text-ink-muted">Total</span>
        <span className="font-display text-xl text-ink">{formatARS(total)}</span>
      </p>
    </section>
  );
}
```

> El precio que se muestra es **el del carrito**, no el de la revalidación. El total que se manda al chat es el del carrito también, por la decisión de §6.9: si el precio cambió, el cliente ve el tachado y el nuevo, y el chat resuelve. Cambiar el total en pantalla sin cambiar el mensaje mandaría dos números distintos al encargado.

### 6.9 Revalidación de precios en el cliente

**Decisión: se revalida contra el endpoint público, y el envío no se bloquea si el endpoint falla.**

| Alternativa | Qué implica | Por qué no |
|---|---|---|
| (a) Revalidar contra `/api/cart/validate` | Un GET antes de habilitar el envío. El cliente ve el precio real antes de mandar | Un request extra por checkout, que se paga solo cuando el carrito está desactualizado |
| (b) Confiar en el carrito y que el encargado lo corrija | Cero requests, cero estados de carga | El cliente manda `$2.900` y el local responde "son $3.200". Cada pedido desactualizado es una discusión, y el chat sigue siendo el canal de la discusión |
| (c) No revalidar y congelar el precio al agregar al carrito | El precio queda fijo hasta el checkout | Un precio congelado para siempre es peor que uno viejo: el local pierde plata sin avisar |

**Se elige (a), con dos matices que hacen que la decisión sea defendible:**

1. **Falla abierta.** Si `/api/cart/validate` da error o timeout, el envío se habilita igual y el mensaje se arma con el precio del carrito. Un problema de red no puede impedir una venta. Se avisa con un toast informativo, no con un bloqueo.
2. **Un precio que cambió no bloquea; un producto que no se puede comprar, sí.** El cliente puede querer seguir con lo que hay, y el chat resuelve el precio en dos líneas. Un producto archivado o agotado, en cambio, hace que el pedido sea imposible de cumplir, y mandarlo igual le genera al encargado un trabajo que no quería.

```tsx
// src/components/checkout/use-cart-validation.ts
"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart-store";
import { useToast } from "@/components/ui";
import type { ValidatedCartLine } from "@/server/services/cart-validation.service";

/** Lo que devuelve el endpoint. Solo se usa el lado del cliente. */
interface ValidationResponse {
  readonly ok: boolean;
  readonly lines: readonly ValidatedCartLine[];
  readonly hasBlockingIssues: boolean;
}

const isValidationResponse = (value: unknown): value is ValidationResponse => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.ok === true && Array.isArray(record.lines);
};

/** Líneas del cliente con el precio vigente y el motivo del bloqueo. */
export interface CartLineReview {
  readonly productId: string;
  readonly currentUnitPrice: number | null;
  readonly isPriceChanged: boolean;
  readonly issue: ValidatedCartLine["issue"];
}

export function useCartValidation() {
  const lines = useCartStore((state) => state.lines);
  const { show } = useToast();

  const [reviews, setReviews] = useState<readonly CartLineReview[] | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (lines.length === 0) return;

    const controller = new AbortController();
    const query = lines
      .map((line) => `line=${encodeURIComponent(`${line.productId}:${line.variantId ?? ""}`)}`)
      .join("&");

    setIsValidating(true);

    fetch(`/api/cart/validate?${query}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("http"))))
      .then((payload: unknown) => {
        // ⛔ Un cuerpo que no matchea el contrato NO es "todo bien".
        // Tratarlo como válido mostraría un precio viejo con sello verde,
        // que es el peor de los tres resultados posibles.
        if (!isValidationResponse(payload)) throw new Error("contrato");

        // La comparación de precios la hace el navegador: son dos números y
        // no hay nada en que confiar. El endpoint nunca ve el precio del
        // cliente (§6.2).
        setReviews(
          payload.lines.map((line) => {
            const snapshot = lines.find(
              (item) => item.productId === line.productId && (item.variantId ?? null) === line.variantId,
            );
            return {
              productId: line.productId,
              currentUnitPrice: line.currentUnitPrice,
              isPriceChanged:
                line.currentUnitPrice !== null && snapshot !== undefined
                  ? line.currentUnitPrice !== snapshot.unitPrice
                  : false,
              issue: line.issue,
            };
          }),
        );
      })
      .catch(() => {
        // Falla abierta. `reviews` queda en `null`, que es el estado que
        // significa "no sabemos": la UI no muestra ni.ok ni warnings.
        setReviews(null);
        show("No pudimos verificar los precios. Se mandan los del carrito.", "info");
      })
      .finally(() => setIsValidating(false));

    return () => controller.abort();
  }, [lines, show]);

  return {
    reviews,
    isValidating,
    /** Hay una línea que no se puede comprar. Bloquea el envío. */
    hasBlockingIssues: reviews?.some((review) => review.issue !== null) ?? false,
    /** Hay al menos un precio distinto al del carrito. No bloquea. */
    hasPriceChanges: reviews?.some((review) => review.isPriceChanged) ?? false,
  };
}
```

`OrderSummary` recibe `reviews` y, por cada línea, muestra una de tres cosas: nada, el precio del carrito tachado al lado del vigente, o el `issue` con un botón "Quitar". Mientras `hasBlockingIssues` sea `true`, el submit de `WhatsAppHandoff` queda deshabilitado y `CheckoutForm` corta el envío con un toast (§6.6).

### 6.10 `src/app/(public)/checkout/page.tsx`

```tsx
import type { Metadata } from "next";
import { getBusinessSettings } from "@/server/services/settings.service";
import { findBusinessSettings } from "@/server/repositories/settings.repository";
import { CheckoutClient } from "@/components/checkout";

export const metadata: Metadata = {
  title: "Finalizar pedido",
  description: "Completá tus datos y enviá el pedido por WhatsApp.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  // El punto de composición: el Server Component arma el servicio con el
  // repositorio (Tarea 08 §12).
  const business = await getBusinessSettings({
    settingsRepository: { findBusinessSettings },
  });

  return (
    <div>
      <h1 className="sr-only">Finalizar pedido</h1>
      <CheckoutClient business={business} />
    </div>
  );
}
```

### 6.11 `src/app/(public)/checkout/exito/page.tsx`

```tsx
import type { Metadata } from "next";
import { getBusinessSettings } from "@/server/services/settings.service";
import { findBusinessSettings } from "@/server/repositories/settings.repository";
import { CheckoutSuccess } from "@/components/checkout";

/**
 * `noindex` obligatorio: es una pantalla de transición, no una página del
 * sitio. Que un buscador la indexe no aporta nada y la mete en el sitemap
 * con un `no-store` adentro.
 */
export const metadata: Metadata = {
  title: "Pedido listo",
  robots: { index: false, follow: false },
};

export default async function CheckoutSuccessPage() {
  const business = await getBusinessSettings({
    settingsRepository: { findBusinessSettings },
  });

  return <CheckoutSuccess business={business} />;
}
```

`CheckoutSuccess` es un Client Component que reconstruye el pedido desde `sessionStorage`. Acá vive el `<a href="https://wa.me/...">` real, porque acá ya no hay nada que validar.

```tsx
// src/components/checkout/handoff-snapshot.ts
"use client";

import type { WhatsAppCartLine, WhatsAppCustomer } from "@/lib/whatsapp/message-contract";

/** Una versión por payload: cambiar la forma es cambiar la clave. */
export const HANDOFF_KEY = "modo-miga:checkout-handoff:v1";

/**
 * Lo que se guarda entre el submit y la pantalla de éxito.
 *
 * ⛔ Se guardan **datos, no el mensaje ya armado**. El texto se produce acá,
 * con las funciones puras de la Tarea 12, una sola vez: si se guardara el
 * texto en el submit, el mismo pedido existiría en dos lugares y la primera
 * edición de una de las dos funciones rompería el checkout en silencio.
 *
 * Se guardan los datos porque el carrito ya está limpio cuando se llega acá:
 * sin snapshot no hay forma de recuperar las líneas.
 */
export interface HandoffSnapshot {
  readonly items: readonly WhatsAppCartLine[];
  readonly customer: WhatsAppCustomer;
  readonly total: number;
}

/**
 * ⛔ Guard de runtime, no solo de tipos: `sessionStorage` es del navegador y
 * cualquiera puede escribir en él desde la consola. Un `as` acá sería una
 * mentira que el usuario puede desmentir.
 */
const isCartLine = (value: unknown): value is WhatsAppCartLine => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.productId === "string" &&
    typeof record.name === "string" &&
    typeof record.unitPrice === "number" &&
    typeof record.quantity === "number" &&
    Number.isInteger(record.quantity) &&
    record.quantity > 0 &&
    (record.variantName === null || typeof record.variantName === "string")
  );
};

const isCustomer = (value: unknown): value is WhatsAppCustomer => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.fullName === "string" &&
    typeof record.phone === "string" &&
    (record.fulfillment === "delivery" || record.fulfillment === "pickup") &&
    (record.address === null || typeof record.address === "string") &&
    (record.notes === null || typeof record.notes === "string")
  );
};

export const isHandoffSnapshot = (value: unknown): value is HandoffSnapshot => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.items) &&
    record.items.length > 0 &&
    record.items.every(isCartLine) &&
    isCustomer(record.customer) &&
    typeof record.total === "number" &&
    Number.isFinite(record.total)
  );
};

export const saveHandoffSnapshot = (snapshot: HandoffSnapshot): boolean => {
  try {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    // Pestaña en modo privado sin almacenamiento, cuota llena o JSON
    // circular. El checkout sigue funcionando: la pantalla de éxito muestra
    // el estado vacío y el cliente vuelve al menú.
    return false;
  }
};

export const readHandoffSnapshot = (): HandoffSnapshot | null => {
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isHandoffSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const clearHandoffSnapshot = (): void => {
  try {
    window.sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    // Si no se puede borrar, se ignora: el snapshot tiene fecha de vencimiento
    // en la práctica (la próxima compra lo sobreescribe).
  }
};
```

> El snapshot se versiona en la clave, no con un campo `version`. Si la forma cambia de verdad, se sube a `v2` y el snapshot `v1` se ignora solo: no hace falta un campo, ni un `if` para migrar, ni código de compatibilidad que nadie va a borrar.

```tsx
// src/components/checkout/CheckoutSuccess.tsx
"use client";

import { useEffect, useState } from "react";
import { Button, EmptyState, buttonClassName, useToast } from "@/components/ui";
import { buildWhatsAppOrder } from "@/lib/whatsapp/whatsapp-message.service";
import { buildWhatsAppUrl } from "@/lib/whatsapp/whatsapp-url.service";
import { clearHandoffSnapshot, readHandoffSnapshot, type HandoffSnapshot } from "./handoff-snapshot";
import { formatARS } from "@/lib/format/currency";
import type { BusinessSettingsDTO } from "@/lib/domain";

interface CheckoutSuccessProps {
  readonly business: BusinessSettingsDTO;
}

export function CheckoutSuccess({ business }: CheckoutSuccessProps) {
  const { show } = useToast();
  const [snapshot, setSnapshot] = useState<HandoffSnapshot | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const [isPopupBlocked, setIsPopupBlocked] = useState(false);

  useEffect(() => {
    setSnapshot(readHandoffSnapshot());
    setIsRestored(true);
  }, []);

  // El snapshot se borra cuando el cliente mandó el pedido, no antes: si
  // vuelve atrás con el botón del navegador, el pedido sigue ahí.
  useEffect(() => {
    if (snapshot === null) return;
    const timer = window.setTimeout(() => clearHandoffSnapshot(), 30 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [snapshot]);

  // `sessionStorage` no existe en el servidor. Sin este early return, el
  // primer render del Server Component revienta.
  if (!isRestored) return null;

  if (snapshot === null) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <EmptyState
          title="Tu pedido ya está en el chat"
          message="Si ya presionaste enviar, tu pedido llegó a WhatsApp. Si querés hacer otro, volvé al menú."
        />
        <a href="/menu" className={`${buttonClassName("primary", "md")} mt-4`}>
          Volver al menú
        </a>
      </div>
    );
  }

  // La única vez que se arma el mensaje en todo el flujo. Es una función
  // pura: no hay red, no hay estado, no puede fallar por otra cosa que no
  // sea un snapshot inválido, que el guard de arriba ya filtró.
  const order = buildWhatsAppOrder({
    items: snapshot.items,
    customer: snapshot.customer,
    business: { name: business.name, whatsappPhone: business.whatsappPhone },
  });

  const url = buildWhatsAppUrl(business.whatsappPhone, order.text);

  const openInNewTab = (): void => {
    const opened = window.open(url, "_blank", "noopener,noreferrer");

    if (opened === null) {
      setIsPopupBlocked(true);
      show("Tu navegador bloqueó la ventana. Usá el enlace de arriba.", "info");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="font-display text-2xl text-ink">Pedido listo</h1>
      <p className="mt-2 text-ink-muted">
        Te dejamos el pedido escrito. Revisalo en WhatsApp y presioná enviar: el local lo confirma
        por el mismo chat.
      </p>

      {order.isTruncated && (
        <p role="status" className="mt-4 rounded-control border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-ink">
          El mensaje es largo, así que se recortaron los comentarios y algunos productos. El total
          que figura es parcial: en el chat coordinamos el resto.
        </p>
      )}

      {isPopupBlocked && (
        <p role="alert" className="mt-4 rounded-control border border-clay/35 bg-clay/8 px-3 py-2 text-sm text-ink">
          No pudimos abrir la ventana de WhatsApp. Tocá el enlace de arriba para enviar el pedido.
        </p>
      )}

      <pre className="mt-6 max-h-72 overflow-auto whitespace-pre-wrap rounded-card bg-cream p-4 font-mono text-sm">
        {order.text}
      </pre>

      {/*
        Control principal: enlace real, con la pinta de botón.

        ⛔ No es un `onClick` con `window.open` porque un `window.open` puede
        ser bloqueado y el cliente se queda sin salida. Un `<a
        target="_blank">` también nace del gesto del usuario, así que no lo
        bloquea ningún popup blocker, y además el cliente ve a dónde lo lleva,
        lo puede copiar y lo puede volver a tocar si algo falló.
      */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${buttonClassName("primary", "lg")} mt-6 w-full`}
      >
        Abrir WhatsApp con el pedido — {formatARS(snapshot.total)}
      </a>

      <Button variant="secondary" size="sm" onClick={openInNewTab} className="mt-3 w-full">
        Abrir en una ventana nueva
      </Button>

      <a href="/menu" className={`${buttonClassName("ghost", "sm")} mt-3 w-full`}>
        Volver al menú
      </a>
    </div>
  );
}
```

> **Por qué el snapshot tiene fecha de vencimiento.** Se borra a los 30 minutos y en cada nueva compra. `sessionStorage` muere con la pestaña, pero el botón "atrás" del navegador no: sin la limpieza, un cliente que vuelve al checkout dos horas después encuentra el pedido viejo en la pantalla de éxito y lo manda dos veces.

### 6.12 `CustomerFields.tsx`, `FulfillmentPicker.tsx`, `AddressField.tsx`, `NotesField.tsx`

Los cuatro son cableados de primitivas. El patrón es el mismo en todos: `Input`/`Textarea` de la Tarea 09 ya resuelven `label`, `aria-invalid`, `aria-describedby` y el `role="alert"` del error. Lo que agrega cada uno es lo que la primitiva no sabe.

```tsx
// src/components/checkout/CustomerFields.tsx
"use client";

import { Input } from "@/components/ui";
import { formatArgentinePhoneForDisplay, normalizeArgentinePhone } from "@/lib/format/phone";
import { ValidationError } from "@/lib/domain";

interface CustomerFieldsProps {
  readonly fullName: string;
  readonly phone: string;
  readonly onFullNameChange: (value: string) => void;
  readonly onPhoneChange: (value: string) => void;
  readonly errors: Readonly<Record<string, readonly string[]>>;
}

/**
 * El teléfono se muestra normalizado mientras se escribe.
 *
 * Es la mitigación del riesgo R2: el `9` móvil es invisible para quien no lo
 * conoce y el cliente no lo va a agregar por su cuenta. Mostrar
 * `+54 9 261 555-1234` debajo del campo, en vivo, hace que el error se ve
 * antes de confirmar.
 */
export function CustomerFields(props: CustomerFieldsProps) {
  const { fullName, phone, onFullNameChange, onPhoneChange, errors } = props;

  const preview = ((): string | null => {
    if (phone.trim().length < 8) return null;
    try {
      return formatArgentinePhoneForDisplay(normalizeArgentinePhone(phone));
    } catch (error) {
      return error instanceof ValidationError ? null : null;
    }
  })();

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="font-display text-lg text-ink">Tus datos</legend>

      <Input
        name="fullName"
        label="Nombre y apellido"
        value={fullName}
        onChange={(event) => onFullNameChange(event.target.value)}
        error={errors.fullName?.[0]}
        autoComplete="name"
        required
        maxLength={80}
        enterKeyHint="next"
      />

      <Input
        name="phone"
        label="Teléfono de WhatsApp"
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(event) => onPhoneChange(event.target.value)}
        error={errors.phone?.[0]}
        hint={preview === null ? "Con o sin el 9. Lo normalizamos nosotros." : `Va a figurar como ${preview}`}
        autoComplete="tel"
        required
        maxLength={32}
        enterKeyHint="next"
      />
    </fieldset>
  );
}
```

```tsx
// src/components/checkout/FulfillmentPicker.tsx
"use client";

import { useId } from "react";
import { joinClasses } from "@/lib/ui/classes";

/**
 * Envío o retiro, con `role="radiogroup"`.
 *
 * ⛔ No es un `<select>`: son dos opciones excluyentes que se eligen una vez
 * y definen si la dirección es obligatoria. Dos botones grandes con el
 * estado marcado son más rápidos de tocar en un teléfono y no dependan del
 * `<select>` nativo, que se ve distinto en cada sistema.
 */
export function FulfillmentPicker({
  value,
  onChange,
}: {
  readonly value: "delivery" | "pickup";
  readonly onChange: (value: "delivery" | "pickup") => void;
}) {
  const groupId = useId();

  const options = [
    { value: "delivery" as const, title: "Envío", hint: "Te lo llevamos a tu dirección" },
    { value: "pickup" as const, title: "Retiro", hint: "Pasás a buscarlo por el local" },
  ];

  return (
    <fieldset className="flex flex-col gap-2">
      <legend id={groupId} className="mb-1.5 text-sm font-medium text-ink">
        ¿Cómo lo querés recibir?
      </legend>
      <div role="radiogroup" aria-labelledby={groupId} className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <label
              key={option.value}
              className={joinClasses(
                "flex min-h-11 cursor-pointer flex-col justify-center rounded-control border px-4 py-3 transition-colors",
                isSelected
                  ? "border-crust-deep bg-crust/8 text-ink"
                  : "border-line-strong bg-paper text-ink hover:bg-cream",
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="fulfillment"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => onChange(option.value)}
                  className="size-4 accent-crust-deep"
                />
                <span className="font-medium">{option.title}</span>
              </span>
              <span className="mt-0.5 pl-6 text-xs text-ink-muted">{option.hint}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
```

```tsx
// src/components/checkout/AddressField.tsx
"use client";

import { Textarea } from "@/components/ui";
import { MAX_ADDRESS_LENGTH, MIN_ADDRESS_LENGTH } from "@/server/schemas/checkout.schema";

/**
 * Solo existe si el cliente eligió envío. Montarlo y desmontarlo según la
 * modalidad hace que el `autocomplete="street-address"` y el `aria` sigan
 * siendo correctos: no hay un input escondido que un lector de pantalla
 * anuncie como un campo más.
 */
export function AddressField({
  value,
  onChange,
  error,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
}) {
  return (
    <Textarea
      name="address"
      label="Dirección de entrega"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      hint={`Entre ${MIN_ADDRESS_LENGTH} y ${MAX_ADDRESS_LENGTH} caracteres. Incluí calle, número, piso y una referencia. ${value.length}/${MAX_ADDRESS_LENGTH}`}
      autoComplete="street-address"
      required
      rows={3}
      maxLength={MAX_ADDRESS_LENGTH}
    />
  );
}
```

```tsx
// src/components/checkout/NotesField.tsx
"use client";

import { Textarea } from "@/components/ui";
import { MAX_NOTES_LENGTH } from "@/server/schemas/checkout.schema";

export function NotesField({
  value,
  onChange,
  error,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
}) {
  return (
    <Textarea
      name="notes"
      label="Comentarios (opcional)"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      hint={`Sin mayonesa, sin cebolla, cambios de la última vez o lo que necesites. ${value.length}/${MAX_NOTES_LENGTH}`}
      rows={3}
      maxLength={MAX_NOTES_LENGTH}
    />
  );
}
```

### 6.13 `src/components/checkout/index.ts`

```ts
export { CheckoutClient } from "./CheckoutClient";
export { CheckoutForm } from "./CheckoutForm";
export { CheckoutSuccess } from "./CheckoutSuccess";
export { CustomerFields } from "./CustomerFields";
export { FulfillmentPicker } from "./FulfillmentPicker";
export { AddressField } from "./AddressField";
export { NotesField } from "./NotesField";
export { OrderSummary } from "./OrderSummary";
export { WhatsAppHandoff, type WhatsAppHandoffProps } from "./WhatsAppHandoff";
```

> Un export por componente, y solo los que se usan afuera del directorio. `use-cart-validation` y `handoff-snapshot` **no** se exportan: son implementación interna del checkout, y exportarlos desde el índice los convierte en API pública de la app sin que nadie lo haya pedido.

### 6.14 Botón fijo abajo en mobile

El botón de enviar tiene que estar siempre visible sin hacer scroll, porque es la única acción de la pantalla:

```tsx
// Dentro de CheckoutForm, envolviendo el WhatsAppHandoff
<div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-strong bg-paper/95 px-4 py-3 backdrop-blur-sm
                sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
  {/* `env(safe-area-inset-bottom)` evita que el botón quede bajo el gesto
      de "ir al inicio" del iPhone. */}
  <div className="mx-auto w-full max-w-5xl pb-[env(safe-area-inset-bottom)] sm:pb-0">
    <WhatsAppHandoff … />
  </div>
</div>
```

El contenedor de la página lleva `pb-40` para que el contenido no quede nunca debajo del botón fijo.

### 6.15 Tests

```tsx
// src/components/checkout/CheckoutForm.component.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutForm } from "./CheckoutForm";
import { ToastProvider } from "@/components/ui";
import { useCartStore } from "@/store/cart-store";
import type { BusinessSettingsDTO } from "@/lib/domain";

const push = vi.fn();

// El router es el límite del componente: se mockea, no se testea.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// La revalidación es red. Se mockea para que estos tests mideen el
// formulario, no el endpoint. El endpoint tiene sus propios tests.
vi.mock("./use-cart-validation", () => ({
  useCartValidation: () => ({ reviews: null, isValidating: false, hasBlockingIssues: false, hasPriceChanges: false }),
}));

/** Los siete campos de `BusinessSettingsDTO` (Tarea 08). El handoff usa dos. */
const BUSINESS: BusinessSettingsDTO = {
  name: "Mi Negocio",
  whatsappPhone: "5492615551234",
  address: null,
  instagramUrl: null,
  openingHours: {},
  closingMessage: null,
  legalNotice: null,
};

const fillValidDraft = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/Nombre/), "Juan Pérez");
  await user.type(screen.getByLabelText(/Teléfono/), "2615551234");
};

const renderForm = () =>
  render(
    <ToastProvider>
      <CheckoutForm business={BUSINESS} />
    </ToastProvider>,
  );

beforeEach(() => {
  push.mockReset();
  useCartStore.setState({
    lines: [
      { productId: "prod_1", variantId: null, name: "Miga de jamón", variantName: null, unitPrice: 2900, quantity: 1 },
    ],
  });
});

describe("CheckoutForm", () => {
  it("debe bloquear el envío con el teléfono inválido y no navegar", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Nombre/), "Juan Pérez");
    await user.type(screen.getByLabelText(/Teléfono/), "123");
    await user.click(screen.getByRole("button", { name: /Enviar pedido/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/teléfono/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("debe pedir la dirección solo cuando elige envío", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByLabelText(/Dirección de entrega/)).toBeNull();

    await user.click(screen.getByRole("radio", { name: /Envío/ }));

    expect(screen.getByLabelText(/Dirección de entrega/)).toBeInTheDocument();
  });

  it("debe llevar el foco al primer campo con error", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /Enviar pedido/ }));

    await waitFor(() => expect(screen.getByLabelText(/Nombre/)).toHaveFocus());
  });

  it("debe limpiar el carrito y navegar a la pantalla de éxito con el draft válido", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValidDraft(user);

    await user.click(screen.getByRole("button", { name: /Enviar pedido/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/checkout/exito"));
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("debe cortar el envío si un producto ya no se puede pedir", async () => {
    vi.doMock("./use-cart-validation", () => ({
      useCartValidation: () => ({ reviews: [], isValidating: false, hasBlockingIssues: true, hasPriceChanges: false }),
    }));
    const user = userEvent.setup();
    renderForm();
    await fillValidDraft(user);

    await user.click(screen.getByRole("button", { name: /Enviar pedido/ }));

    expect(push).not.toHaveBeenCalled();
  });
});
```

> El test del botón de "enviar" usa `getByRole("button")` y no `getByRole("link")` a propósito: el control del formulario es un `submit`, y el `<a>` real vive en la pantalla de éxito. Un test que busque un link acá estaría probando un botón.

#### Servicio de validación

```ts
// tests/unit/checkout/cart-validation.service.test.ts
import { describe, expect, it } from "vitest";
import { validateCartLines } from "@/server/services/cart-validation.service";
import type { ProductDTO } from "@/lib/domain";

/** ⛔ `environment: "node"`: el servicio es de servidor y no toca el DOM. */
const product = (overrides: Partial<ProductDTO> = {}): ProductDTO => ({
  id: "p1",
  slug: "classic",
  name: "Classic",
  description: null,
  price: 1000,
  isAvailable: true,
  isFeatured: false,
  sortOrder: 0,
  allergens: [],
  categoryId: "c1",
  variants: [{ id: "v1", name: "Sin cebolla", priceDelta: 100, isAvailable: true }],
  ...overrides,
});

/** El doble implementa solo el puerto, no `ProductRepository` entero. */
const reader = (products: readonly ProductDTO[]) => ({
  productRepository: { findPublishedProducts: async () => [...products] },
});

describe("validateCartLines", () => {
  it("debe devolver el precio vigente con el priceDelta de la variante", async () => {
    const result = await validateCartLines(reader([product()]), [{ productId: "p1", variantId: "v1" }]);

    expect(result.lines[0]?.currentUnitPrice).toBe(1100);
    expect(result.hasBlockingIssues).toBe(false);
  });

  it("debe marcar FUERA_DE_CATALOGO con precio null, no con cero", async () => {
    const result = await validateCartLines(reader([]), [{ productId: "no-existe", variantId: null }]);

    expect(result.lines[0]?.issue).toBe("FUERA_DE_CATALOGO");
    // ⛔ Cero significaría "gratis" y el cliente vería un pedido de $0.
    expect(result.lines[0]?.currentUnitPrice).toBeNull();
    expect(result.hasBlockingIssues).toBe(true);
  });

  it("debe distinguir producto agotado de producto inexistente", async () => {
    const result = await validateCartLines(reader([product({ isAvailable: false })]), [
      { productId: "p1", variantId: null },
    ]);

    expect(result.lines[0]?.issue).toBe("PRODUCTO_AGOTADO");
    // Agotado igual tiene precio: el cliente lo ve y puede esperar.
    expect(result.lines[0]?.currentUnitPrice).toBe(1000);
  });

  it("debe marcar la variante que no existe sin tirar abajo la línea", async () => {
    const result = await validateCartLines(reader([product()]), [{ productId: "p1", variantId: "v99" }]);

    expect(result.lines[0]?.issue).toBe("VARIANTE_NO_DISPONIBLE");
    expect(result.lines[0]?.isInCatalog).toBe(true);
  });

  it("debe pedir los agotados también, para no reportarlos como inexistentes", async () => {
    const pedidos: unknown[] = [];
    const deps = {
      productRepository: {
        findPublishedProducts: async (options?: { readonly onlyAvailable?: boolean }) => {
          pedidos.push(options);
          return [product({ isAvailable: false })];
        },
      },
    };

    await validateCartLines(deps, [{ productId: "p1", variantId: null }]);

    // Si se pidieran solo los disponibles, un agotado sería indistinguible de
    // un producto que ya no existe.
    expect(pedidos).toEqual([undefined]);
  });
});
```

#### Route Handler

```ts
// tests/unit/checkout/cart-validate-route.test.ts
import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cart/validate/route";
import type { ProductDTO } from "@/lib/domain";

vi.mock("@/server/repositories/product.repository", () => ({
  findPublishedProducts: vi.fn(),
}));

const call = (query: string): Promise<Response> => GET(new Request(`https://modo-miga.test/api/cart/validate?${query}`));

const stubRepository = (products: readonly ProductDTO[] = []): void => {
  vi.mocked(findPublishedProducts).mockResolvedValue([...products]);
};

describe("GET /api/cart/validate", () => {
  it("debe responder 200 con no-store y el estado de cada línea", async () => {
    stubRepository();

    const response = await call("line=p1");
    const body = (await response.json()) as { ok: boolean; hasBlockingIssues: boolean };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(body.ok).toBe(true);
    expect(body.hasBlockingIssues).toBe(true);
  });

  it("debe rechazar con 400 una request sin líneas", async () => {
    expect((await call("")).status).toBe(400);
  });

  it("debe rechazar con 400 más de 30 líneas", async () => {
    const query = Array.from({ length: 31 }, (_, i) => `line=p${i}`).join("&");

    expect((await call(query)).status).toBe(400);
  });

  it("debe rechazar con 400 un id con formato inválido antes de tocar la base", async () => {
    stubRepository();
    const response = await call("line=p1&line=${DROP TABLE}&variant=x");

    expect(response.status).toBe(400);
    expect(findPublishedProducts).not.toHaveBeenCalled();
  });

  it("debe responder 500 si el repositorio revienta, sin filtrar el error", async () => {
    vi.mocked(findPublishedProducts).mockRejectedValue(new Error("connection string: user:pass@host"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await call("line=p1");
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    // El mensaje del cliente es genérico: la connection string no sale.
    expect(body.error).not.toContain("user:pass");
  });
});
```

> El caso del 500 importa más de lo que parece: el `catch` del handler es el único lugar donde una excepción de Prisma llega a la respuesta. Un `error: error.message` ahí publica la cadena de conexión en el navegador.

#### Snapshot de `sessionStorage`

```ts
// tests/unit/checkout/handoff-snapshot.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HANDOFF_KEY,
  clearHandoffSnapshot,
  isHandoffSnapshot,
  readHandoffSnapshot,
  saveHandoffSnapshot,
  type HandoffSnapshot,
} from "@/components/checkout/handoff-snapshot";

const SNAPSHOT: HandoffSnapshot = {
  items: [
    { productId: "p1", name: "Classic", variantName: null, unitPrice: 1450, quantity: 2 },
  ],
  customer: {
    fullName: "Juan Pérez",
    phone: "5492615551234",
    fulfillment: "pickup",
    address: null,
    notes: null,
  },
  total: 2900,
};

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handoffSnapshot", () => {
  it("debe escribir y leer el snapshot sin perder un campo", () => {
    expect(saveHandoffSnapshot(SNAPSHOT)).toBe(true);
    expect(readHandoffSnapshot()).toEqual(SNAPSHOT);
  });

  it("debe devolver null cuando no hay nada guardado", () => {
    expect(readHandoffSnapshot()).toBeNull();
  });

  it("debe descartar un snapshot corrupto en vez de confiar en él", () => {
    // ⛔ `sessionStorage` es del navegador: cualquiera puede escribir desde la
    // consola. Un snapshot a medio validar muestra una URL con `undefined`.
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ items: [{ name: 1 }] }));

    expect(readHandoffSnapshot()).toBeNull();
  });

  it("debe devolver false sin romper cuando sessionStorage lanza", () => {
    vi.spyOn(window.sessionStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(saveHandoffSnapshot(SNAPSHOT)).toBe(false);
  });

  it("debe rechazar una cantidad cero o negativa escrita a mano", () => {
    expect(
      isHandoffSnapshot({ ...SNAPSHOT, items: [{ ...SNAPSHOT.items[0], quantity: 0 }] }),
    ).toBe(false);
  });
});
```

#### Pantalla de éxito

```tsx
// src/components/checkout/CheckoutSuccess.component.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutSuccess } from "./CheckoutSuccess";
import { HANDOFF_KEY } from "./handoff-snapshot";
import { ToastProvider } from "@/components/ui";
import type { BusinessSettingsDTO } from "@/lib/domain";

const BUSINESS: BusinessSettingsDTO = {
  name: "Mi Negocio",
  whatsappPhone: "5492615551234",
  address: null,
  instagramUrl: null,
  openingHours: {},
  closingMessage: null,
  legalNotice: null,
};

const SNAPSHOT = {
  items: [{ productId: "p1", name: "Classic", variantName: null, unitPrice: 1450, quantity: 1 }],
  customer: {
    fullName: "Juan Pérez",
    phone: "5492615551234",
    fulfillment: "pickup" as const,
    address: null,
    notes: null,
  },
  total: 1450,
};

const renderSuccess = () =>
  render(
    <ToastProvider>
      <CheckoutSuccess business={BUSINESS} />
    </ToastProvider>,
  );

beforeEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("CheckoutSuccess", () => {
  it("debe mostrar el enlace real a wa.me con el mensaje ya armado", async () => {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(SNAPSHOT));
    renderSuccess();

    const link = await screen.findByRole("link", { name: /Abrir WhatsApp con el pedido/ });

    expect(link).toHaveAttribute("href", expect.stringContaining("https://wa.me/5492615551234?text="));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("debe mostrar el estado vacío si entra directo por URL sin snapshot", async () => {
    renderSuccess();

    expect(await screen.findByText(/Tu pedido ya está en el chat/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Abrir WhatsApp/ })).toBeNull();
  });

  it("debe sobrevivir a un refresh con el snapshot todavía guardado", async () => {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(SNAPSHOT));
    const { unmount } = renderSuccess();
    await screen.findByRole("link", { name: /Abrir WhatsApp/ });
    unmount();

    renderSuccess();

    expect(await screen.findByRole("link", { name: /Abrir WhatsApp/ })).toBeInTheDocument();
  });

  it("debe avisar que el navegador bloqueó la ventana y dejar el enlace", async () => {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(SNAPSHOT));
    vi.spyOn(window, "open").mockReturnValue(null);
    const user = userEvent.setup();
    renderSuccess();

    await user.click(await screen.findByRole("button", { name: /Abrir en una ventana nueva/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/bloqueó/i);
    expect(screen.getByRole("link", { name: /Abrir WhatsApp/ })).toBeInTheDocument();
  });

  it("debe avisar que el mensaje quedó recortado", async () => {
    const notas = "Sin mayonesa, sin cebolla, con la salsa aparte. ".repeat(40);
    window.sessionStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({
        ...SNAPSHOT,
        items: Array.from({ length: 8 }, (_, index) => ({
          productId: `p${index}`,
          name: `Sándwich ${index}`,
          variantName: null,
          unitPrice: 1000,
          quantity: 1,
        })),
        customer: { ...SNAPSHOT.customer, notes: notas },
      }),
    );
    renderSuccess();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/recort/i));
  });
});
```

```ts
// tests/unit/checkout/checkout.schema.test.ts
import { describe, expect, it } from "vitest";
import { checkoutSchema, toFieldErrors } from "@/server/schemas/checkout.schema";

const base = {
  fullName: "Juan Pérez",
  phone: "2615551234",
  fulfillment: "pickup" as const,
  address: "",
  notes: "",
};

describe("checkoutSchema", () => {
  it("debe normalizar el teléfono a E.164 en la salida", () => {
    const parsed = checkoutSchema.safeParse(base);

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.phone).toBe("5492615551234");
  });

  it("debe exigir dirección con envío y no exigirla con retiro", () => {
    const sinDireccion = checkoutSchema.safeParse({ ...base, fulfillment: "delivery" });
    const conRetiro = checkoutSchema.safeParse(base);

    expect(sinDireccion.success).toBe(false);
    expect(conRetiro.success).toBe(true);
  });

  it("debe rechazar una dirección de menos de 10 caracteres", () => {
    const parsed = checkoutSchema.safeParse({ ...base, fulfillment: "delivery", address: "San Rafael" });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(toFieldErrors(parsed.error).address?.[0]).toMatch(/corta/i);
    }
  });

  it("debe rechazar un teléfono con letras que no deja nada válido", () => {
    const parsed = checkoutSchema.safeParse({ ...base, phone: "no tengo" });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(Object.keys(toFieldErrors(parsed.error))).toContain("phone");
    }
  });

  it("debe aceptar notas de hasta 500 caracteres y rechazar una más", () => {
    expect(checkoutSchema.safeParse({ ...base, notes: "a".repeat(500) }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, notes: "a".repeat(501) }).success).toBe(false);
  });
});
```

---

## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `checkoutSchema` · `toFieldErrors` · `toWhatsAppCustomer` | `src/server/schemas/checkout.schema.ts` | `CheckoutForm`, tests |
| `CheckoutInput` · `CheckoutDraft` | idem | `CheckoutForm`, `useCheckoutDraft` |
| `validateCartLines(deps, references)` | `src/server/services/cart-validation.service.ts` | `GET /api/cart/validate` |
| `CartLineReference` · `ValidatedCartLine` · `CartLineIssue` | idem | Route Handler, `useCartValidation` |
| `GET /api/cart/validate?line=<id[:variante]>` | `src/app/api/cart/validate/route.ts` | `CheckoutForm` |
| `WhatsAppHandoffProps` | `src/components/checkout/WhatsAppHandoff.tsx` | `CheckoutForm` |
| `HANDOFF_KEY` · `HandoffSnapshot` · `saveHandoffSnapshot` · `readHandoffSnapshot` · `clearHandoffSnapshot` | `src/components/checkout/handoff-snapshot.ts` | `CheckoutForm`, `CheckoutSuccess` |
| `CheckoutClient` · `CheckoutSuccess` | `src/components/checkout/` | Las dos rutas |
| `useCheckoutDraft()` | `src/hooks/use-checkout-draft.ts` | `CheckoutForm` |
| `useCartValidation()` · `CartLineReview` | `src/components/checkout/use-cart-validation.ts` | `CheckoutForm`, `OrderSummary` |

**Firma más delicada de la tarea:** `validateCartLines(dependencies, references)` recibe el repositorio por parámetro en lugar de importarlo. Con el import directo, el test necesita una base de datos para verificar una comparación de precios, que es lógica pura. Con la interfaz mínima `CartAvailabilityReader`, el test pasa un `Map` y verifica el comportamiento en milisegundos.

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [ ] `/checkout` muestra nombre, teléfono, modalidad, dirección condicional, notas y resumen
- [ ] La dirección **solo** aparece y **solo** es requerida con envío
- [ ] El teléfono se muestra normalizado en vivo debajo del campo
- [ ] `OrderSummary` lista cada línea con su cantidad, variante y precio, y el total en grande con `formatARS`
- [ ] El mensaje se arma **una sola vez** en `/checkout/exito`, con `buildWhatsAppOrder` de la Tarea 12
- [ ] El control principal de `/checkout/exito` es un `<a href target="_blank" rel="noopener noreferrer">` real contra `wa.me`
- [ ] Hay además un `Button` con `window.open`, y si devuelve `null` se avisa que hubo bloqueo
- [ ] El control del formulario es un `<button type="submit">` y valida antes de navegar
- [ ] Un doble clic en enviar no navega dos veces
- [ ] El carrito se limpia **después** de guardar el snapshot, nunca antes
- [ ] La página de éxito sobrevive a un refresh gracias al snapshot en `sessionStorage`
- [ ] Entrar directo a `/checkout/exito` sin snapshot muestra el estado vacío, no un error
- [ ] Un producto que dejó de estar disponible bloquea el envío y ofrece quitar la línea
- [ ] Un producto que salió del catálogo bloquea el envío y explica que ya no existe
- [ ] Un precio que cambió muestra el valor vigente y no bloquea
- [ ] Si la revalidación falla por red, el envío sigue habilitado y se avisa

### 8.2 Calidad

- [ ] `npm run verify` en verde
- [ ] `npm run build` en verde
- [ ] Ningún componente de `src/components/checkout/` pasa 200 líneas
- [ ] El Route Handler pasa 120 líneas
- [ ] `rg ': any|@ts-ignore|@ts-expect-error' src/components/checkout/ src/app/api/cart/ src/server/services/cart-validation.service.ts` → cero resultados
- [ ] El botón de enviar es fijo abajo en mobile y siempre visible a 360 px
- [ ] El resumen es colapsable arriba en mobile y expandido en desktop

### 8.3 Arquitectura — verificación obligatoria

- [ ] `rg 'prisma' src/app src/components` → cero resultados
- [ ] `rg 'from "@/server/repositories' src/components` → cero resultados
- [ ] `src/app/api/cart/validate/route.ts` es el único punto que compone servicio y repositorio
- [ ] `cart-validation.service.ts` lleva `import "server-only"` y el esquema Zod **no**
- [ ] Los Server Components de las dos rutas **no** llevan `"use client"`
- [ ] Ningún componente **arma el mensaje a mano**: los tres que lo necesitan llaman a `buildWhatsAppOrder` de la Tarea 12
- [ ] El mensaje se arma en un solo lugar del flujo, no en el formulario y en la pantalla de éxito
- [ ] `cart-validation.service.ts` recibe el repositorio por parámetro (DIP)
- [ ] No hay tabla `Order`, ni `POST` de pedidos, ni acción de servidor que reciba el pedido
- [ ] `rg 'localStorage' src/components/checkout/` → cero resultados. Borrador y snapshot van en `sessionStorage`
- [ ] `sessionStorage` se lee con guard de runtime. El único `as` permitido es `as Record<string, unknown>` dentro del type guard, que es un narrowing de `unknown`: no hay `as` que le crea a un dato del navegador
- [ ] Los `useEffect` que leen almacenamiento corren en `useEffect`, nunca durante el render

### 8.4 Pruebas

- [ ] Mínimo 4 casos en `CheckoutForm.component.test.tsx`, con nombres `debe <comportamiento>`
- [ ] Mínimo 5 casos en `checkout.schema.test.ts`
- [ ] Hay un caso que verifica que la dirección no existe en el DOM con retiro
- [ ] Hay un caso que verifica que el foco va al primer campo con error
- [ ] Hay un caso que verifica que el teléfono inválido no navega
- [ ] Hay un caso que verifica que el carrito queda vacío y que se navega a `/checkout/exito`
- [ ] Hay un caso que verifica que un producto no comprable corta el envío
- [ ] Mínimo 6 casos en `CheckoutSuccess.component.test.tsx`: `<a>` real, popup bloqueado, mensaje recortado, refresh y entrada directa por URL
- [ ] Mínimo 5 casos en `handoff-snapshot.test.ts`: escribe, lee, descarta un snapshot corrupto, no rompe si `sessionStorage` lanza
- [ ] Mínimo 5 casos en `cart-validation.service.test.ts`, todos con el repositorio pasado por parámetro
- [ ] Mínimo 4 casos en el test del Route Handler: 200, 400 sin líneas, 400 con más de 30, 500 con repositorio que revienta

### 8.5 Seguridad y documentación

- [ ] El endpoint de validación es `GET`, responde `Cache-Control: no-store` y no acepta más de 30 líneas
- [ ] El endpoint no devuelve ningún dato del cliente: solo estado del producto y precio vigente
- [ ] Los identificadores que llegan por query string se validan contra una regex antes de tocar la base
- [ ] El formulario valida en el cliente **y** el endpoint valida en el servidor (ADR-13)
- [ ] El número del local no se acepta desde el cliente para armar el enlace: sale de `BusinessSettingsDTO`
- [ ] `rel="noopener noreferrer"` en todos los enlaces que abren WhatsApp
- [ ] Las dos pantallas tienen `robots: { index: false }`
- [ ] El documento explica por qué el pedido no se persiste y qué se pierde al no persistirlo
- [ ] El documento explica el comportamiento por navegador del bloqueador de popups

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado |
|---|---|
| Carrito vacío al entrar a `/checkout` | `router.replace("/menu")` con un toast informativo. **Nunca** un formulario vacío, que invite a completar datos para nada |
| Carrito vacío antes de hidratar | Se muestra un skeleton. No se redirige: el servidor no sabe qué hay en `localStorage` |
| El usuario presiona atrás del navegador desde `/checkout/exito` | Vuelve a `/checkout` con el carrito ya limpio: el `CheckoutClient` lo detecta y redirige al menú. Sin formulario a medias |
| Refresh en `/checkout/exito` | El snapshot de `sessionStorage` reconstruye el mensaje y el enlace. Si el snapshot ya se consumió, estado vacío con enlace al menú |
| Doble clic en enviar | `isSubmitting` bloquea el segundo submit. En el `<a>`, `onBeforeOpen` es idempotente (`clearCart` sobre un carrito vacío no hace nada) |
| El navegador bloquea el popup | `window.open` devuelve `null`: se avisa con `role="alert"` y el `<a>` sigue arriba, destacado. El carrito **no** se limpia |
| Computadora sin WhatsApp Desktop | `wa.me` no encuentra la app y redirige a `web.whatsapp.com` con el mismo borrador. Funciona sin cambios |
| Producto que se volvió no disponible entre agregar y pagar | La línea muestra "Agotado" con un botón "Quitar del pedido". El `<a>` del handoff queda deshabilitado mientras exista |
| Producto que desapareció del catálogo | La línea dice que ya no está disponible y ofrece quitarla. Distinto del anterior: el primero puede volver, el segundo no |
| Variante que ya no existe o está agotada | Se marca `VARIANTE_NO_DISPONIBLE` y se propone la línea sin variante, que es lo que el cliente quiso pedir |
| El precio cambió | Se muestra "Ahora $3.200 (estabas en $2.900)" con un botón "Actualizar precios". No bloquea el envío |
| La revalidación da error o timeout | Falla abierta: se habilita el envío con los precios del carrito y un toast informativo |
| La revalidación devuelve un cuerpo inválido | Se trata como error, no como "todo bien". Mostrar un precio viejo con sello verde es peor que no avisar |
| Envío con dirección de 300 caracteres | `maxLength` de 240 en el `Textarea` y validación de Zod. El contador del hint muestra el avance |
| Dirección de 8 caracteres | Error de Zod en `superRefine`: "La dirección es demasiado corta. Incluí calle, número y barrio." |
| Teléfono con error de tipeo (`261555` ) | `ValidationError` con el mensaje que muestra el ejemplo esperado. El cliente puede corregir antes de perder el pedido |
| Cliente que no quiere dejar teléfono | El campo es obligatorio. Sin teléfono el local no puede coordinar ni confirmar la entrega, y el pedido no sirve |
| Mensaje que supera el límite | La Tarea 12 lo recorta y devuelve `isTruncated`. `WhatsAppHandoff` muestra un `role="status"` explicando que el total es parcial |
| `sessionStorage` bloqueado (modo privado) | `try/catch` en cada acceso: el checkout funciona, el borrador simplemente no se recupera |
| `localStorage` con el carrito corrupto (riesgo R3) | Lo resuelve el reparseo validado con Zod de la Tarea 11. Si sobrevive algo corrupto, la segunda barrera de la Tarea 12 lanza `ValidationError` por cantidad o precio |
| El cliente escribe `<script>` en las notas | React escapa el texto al renderizar y `encodeURIComponent` lo neutraliza en la URL. Aparece literal en el mensaje de WhatsApp, que es texto plano |
| El negocio no tiene teléfono cargado | `buildWhatsAppUrl` lanza `ValidationError` con un mensaje que dice dónde corregirlo, y el botón no se renderiza |
| Cambios de precio entre la revalidación y el clic | La ventana es de segundos y el precio se coordina en el chat. Cubrirla exigiría un lock de precio, que es un sistema de inventario, no un catálogo |
| Usuario en una PC sin WhatsApp | `wa.me` redirige a la web. El borrador se conserva. Nada que hacer del lado del código |
| Un producto con precio `$0` (promoción) | `unitPrice: 0` es válido: `lineTotal` da `0` y `formatARS(0)` da `$0`. El mensaje lo muestra |

---

## 10. Pruebas

| Suite | Qué verifica |
|---|---|
| `CheckoutForm.component.test.tsx` | Validación de UI, dirección condicional, foco al primer error, previsualización del teléfono |
| `WhatsAppHandoff.component.test.tsx` | Enlace de respaldo, bloqueo de popup, doble clic, aviso de truncado, contenido del `href` |
| `tests/unit/checkout/checkout.schema.test.ts` | Reglas de Zod: normalización, dirección condicional, límites de longitud |
| `tests/integration/cart-validation.service.test.ts` | Comparación contra la base real: producto agotado, archivado, variante caída, precio cambiado |

> La suite de `cart-validation.service.ts` es de integración a propósito: la lógica interesante (indexar productos, cruzar líneas, detectar el agotado) es pura, pero el dato de entrada tiene que salir de la base real para que el test sirva. Un `Map` mockeado verificaría que el código se llama como se escribió, no que el servicio funciona.

**Criterio de diseño de los tests de UI:** se prueba el **comportamiento visible** (el campo aparece, el foco está, el enlace apunta a la URL correcta), nunca el estado interno. El único `vi.mock` permitido es el de `window.open`, porque su comportamiento depende del navegador y no hay forma de ejercitar el bloqueo de otra manera.

---

## 11. Definición de "Hecho" (Definition of Done)

- [ ] Todos los criterios de §8 marcados
- [ ] `npm run verify` + `npm run build` en verde
- [ ] `rg 'prisma' src/app src/components` sin resultados
- [ ] `docs/tasks/README.md` actualizado
- [ ] Commit: `feat(13): checkout con handoff a WhatsApp y revalidación de precios`
- [ ] PR mergeada a `main`
- [ ] **Prueba manual en un teléfono real Android e iPhone**: menú → carrito → checkout → chat abierto con el pedido completo, y confirmado por el encargado
- [ ] **Prueba manual en una PC sin WhatsApp Desktop**: el enlace debe abrir la web con el borrador
- [ ] Verificado con el bloqueador de popups activo que aparece el enlace de respaldo

> **Antes de mergear:** abrir el checkout con el carrito vacío (tiene que redirigir al menú), completar un pedido de entrega con dirección y uno de retiro sin dirección, y recargar la página de éxito. Los tres son los caminos donde un error no se ve en la suite.

---

## 12. Dependencias y bloqueos

**Habilita:** 18 (SEO: las dos pantallas son `noindex` y la Tarea 18 tiene que excluirlas del sitemap), 20 (estrategia de pruebas).

**Decisiones que esta tarea deja establecidas:**

1. **El checkout no persiste el pedido.** No hay tabla `Order`, no hay `POST` de pedidos, no hay Server Action que reciba el pedido. El único registro es el chat (ADR-4).
2. El mensaje se arma **en el navegador**, una sola vez en `/checkout/exito`, con funciones puras de Capa 0. Por eso la Tarea 12 no lleva `server-only`.
3. El control principal en `/checkout/exito` es un **`<a href>` real**, con `target="_blank"` y `rel="noopener noreferrer"`. `window.open` queda como atajo y como detector de bloqueo.
4. El carrito se limpia **después** de guardar el snapshot y **antes** de navegar, nunca antes de validar. Si algo falla, el cliente conserva su carrito.
5. El checkout guarda un **snapshot de los datos ya validados** en `sessionStorage` antes de limpiar el carrito, y la pantalla de éxito arma el mensaje una sola vez con las funciones puras de la Tarea 12. Así un refresh no rompe el pedido aunque el carrito ya esté vacío.
6. **La revalidación de precios se hace contra un endpoint público** y **falla abierta**: si el endpoint no responde, el envío se habilita igual. Un problema de red no puede impedir una venta.
7. Un **precio que cambió no bloquea** el envío; un **producto que no existe o está agotado, sí**. El precio se coordina en el chat; un producto inexistente hace el pedido imposible.
8. El **borrador del formulario va en `sessionStorage`**, no en `localStorage`: no deja datos personales de clientes en un dispositivo compartido.
9. El esquema Zod vive en `src/server/schemas/` y **no** lleva `server-only`, porque no tiene I/O y valida en cliente y servidor.
10. `cart-validation.service.ts` **sí** lleva `server-only` y recibe el repositorio por parámetro.
11. El carrito vacío al entrar al checkout **redirige al menú**, no muestra un formulario.
12. El botón de enviar es **sticky abajo** en mobile, con `env(safe-area-inset-bottom)`.
13. No hay cuenta de cliente, ni login en el checkout, ni historial de pedidos. El cliente no necesita identificarse para pedir.

**Riesgos que esta tarea deja abiertos, con dueño:**

| Riesgo | Dueño | Cuándo se cierra |
|---|---|---|
| El popup bloqueado en un navegador exótico | QA manual | Tarea 22, con los primeros pedidos reales |
| El mensaje recortado en un carrito grande genera un total parcial | Tarea 22 | Se ajusta `MAX_MESSAGE_LENGTH` o se saca el producto más caro del carrito en el flujo |
| La revalidación suma latencia en una red mala | Tarea 21 (deploy) | Medir en producción y decidir si se hace al montar el carrito en vez de al enviar |
