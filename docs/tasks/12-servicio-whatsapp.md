# Tarea 12 — Servicio de WhatsApp: mensaje y deep-link

| Campo | Valor |
|---|---|
| **ID** | 12 |
| **Fase (DESIGN.md §8.5)** | Fase 3 — Carrito y Handoff a WhatsApp |
| **Depende de** | 11 |
| **Habilita** | 13 |
| **Tipo** | Servicio de dominio puro (Capa 0) |
| **Esfuerzo est.** | 1 – 1.5 días |

---

## 1. Objetivo de la tarea

Construir el **string que llega al chat de WhatsApp del local** y el deep-link que lo abre. Es la pieza más crítica del proyecto: todo lo demás (catálogo, carrito, panel) es navegación; acá se produce el producto final.

El resultado son dos funciones puras: `buildWhatsAppMessage(input)` devuelve un `string` y `buildWhatsAppUrl(phone, message)` devuelve la URL. Sin I/O, sin red, sin base, sin React. Por eso la suite de tests es el artefacto principal de la tarea, no un accesorio.

**Criterio de éxito verificable:** `rg 'from "@/server|from "@/app|from "@/components|from "next/' src/lib/whatsapp/ src/lib/format/phone.ts` devuelve cero resultados, y el mensaje resultante de los 10 casos prioritarios de `DESIGN.md` §13.3 coincide **carácter por carácter** con los literales acordados en la Tarea 00 §6.3.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 11 (dominio del carrito) completada, y Tarea 00 cerrada (el formato del mensaje está elegido por el encargado en `docs/decisiones-negocio.md`).

### 2.1 Contrato asumido de la Tarea 11

Esta tarea **no** implementa el carrito: consume sus tipos. Antes de escribir nada, confirmar que la Tarea 11 dejó estos símbolos donde se los busca:

| Símbolo | Import desde | Para qué se usa acá |
|---|---|---|
| `formatARS(amount: number): string` | `@/lib/format/currency` | Formato de precios en el mensaje |
| `roundCurrency(value: number): number` | `@/lib/format/currency` | Suma de totales sin error de punto flotante |
| `MAX_QUANTITY_PER_ITEM: number` | `@/lib/domain/cart` | Segunda barrera contra cantidades corruptas |
| `CartLine` | `@/lib/domain/cart` | Origen de las líneas del mensaje |

> **Contrato en dos partes, y esto no es negociable:** `formatARS` y `roundCurrency` deben vivir en `@/lib/format/currency` y `MAX_QUANTITY_PER_ITEM` en `@/lib/domain/cart`, **no** dentro de `src/store/cart-store.ts`. Si la Tarea 11 los dejó en el store, hay que moverlos a Capa 0 antes de seguir: una función de formato que arrastra Zustand no puede entrar en un test de Node ni en el bundle de `whatsapp-url.service.ts`. Mover una constante no rompe nada; una dependencia circular sí.

> **`formatARS` y el espacio que `Intl` mete.** `new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })` devuelve `"$ 3.700"` con un **espacio duro (U+00A0)** entre el símbolo y el número. El mensaje acordado en la Tarea 00 §6.3 dice `$3.700`, sin espacio. `renderPrice` (en `message-variants.ts`) normaliza el U+00A0 para que el resultado sea determinista aunque la Tarea 11 todavía no lo haga. Si más adelante `formatARS` normaliza, `renderPrice` queda como un passthrough inofensivo.

### 2.2 Qué se acuerda acá y no se vuelve a tocar

- El handoff es un **deep-link `wa.me`**. Nunca la API de WhatsApp Business Platform (ADR-2 de `DESIGN.md`).
- El pedido **no se persiste en el servidor**. No hay tabla `Order` (ADR-4). El mensaje se arma en el navegador (ADR-13 de la Tarea 00: la validación de cliente es UX).
- El formato del mensaje es un **parámetro con default**, no una constante hardcodeada en el cuerpo de la función. La Tarea 00 §6.3 propone tres variantes porque el formato se ajusta con pedidos reales en la primera semana (`DESIGN.md` ADR y Tarea 22).

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `src/lib/format/phone.ts` | `sanitizePhoneDigits`, `normalizeArgentinePhone`, `formatArgentinePhoneForDisplay`, tipo `E164Phone` |
| `src/lib/whatsapp/message-contract.ts` | Tipos de entrada y salida del mensaje, constante de variante, `lineTotal`, `orderTotal` |
| `src/lib/whatsapp/message-variants.ts` | Las tres plantillas de mensaje (Variantes A, B y C de la Tarea 00 §6.3) |
| `src/lib/whatsapp/message-truncation.ts` | Encaje del mensaje en el límite de longitud, sin truncar a ciegas |
| `src/lib/whatsapp/whatsapp-message.service.ts` | Servicio de dominio: valida, sanea y delega. Sin `import "server-only"` |
| `src/lib/whatsapp/whatsapp-url.service.ts` | `buildWhatsAppUrl(phone, message)` con `encodeURIComponent` |
| `tests/unit/format/phone.test.ts` | Normalización de teléfono en 6 formatos, entradas inválidas, caracteres de control |
| `tests/unit/whatsapp/whatsapp-message.service.test.ts` | Los 10 casos de `DESIGN.md` §13.3 más los bordes de §9 |
| `tests/unit/whatsapp/whatsapp-url.service.test.ts` | Encoding, set de caracteres permitido, teléfono inválido |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `src/server/services/settings-normalizers.ts` | **Delegar** en `@/lib/format/phone` y borrar su copia de `normalizeArgentinePhone`. Ver §4.3 |
| `src/lib/domain/index.ts` | Reexportar `./cart` si la Tarea 11 no lo hizo |
| `vitest.config.ts` | Confirmar que `src/lib/**` está en el `include` de cobertura (Tarea 01) |
| `docs/tasks/README.md` | Marcar Tarea 12 |

### 3.3 Eliminar

Ninguno.

---

## 4. Estructura N-Capas

### 4.1 Qué vive en esta capa

| Capa | Qué va acá | Qué NO va acá |
|---|---|---|
| 0 · `lib/` | Construcción del mensaje, normalización de teléfono, encoding, truncado | **Ninguna I/O.** Sin `fetch`, sin Prisma, sin Supabase, sin `Date.now()` dentro del mensaje |
| 3 · Servicio | — | Nada. Los servicios con I/O no participan |
| 1 · Presentación | — | Nada |

### 4.2 La regla más importante de esta tarea

> **`whatsapp-message.service.ts` NO lleva `import "server-only"`.**

Es la aplicación literal de la regla del contexto compartido §11: los servicios puros (sin I/O) no llevan el centinela porque tienen que ser testeables y ejecutables en el navegador. `buildWhatsAppMessage` corre **en el cliente** (Tarea 13, paso 2 del handoff). Si el archivo tuviera `server-only`, el build de la Tarea 13 fallaría al importar el módulo desde un Client Component.

| Módulo | `server-only` | Motivo |
|---|---|---|
| `src/lib/format/phone.ts` | **No** | Función pura, usada por el cliente y por el panel admin |
| `src/lib/whatsapp/*` | **No** | Idem. Sin `fetch`, sin base, sin `next/*` |
| `src/server/services/cart-validation.service.ts` (Tarea 13) | **Sí** | Consulta la base |

El criterio no es la carpeta: es **si hay I/O**. Un archivo en `src/server/` sin I/O tampoco lo lleva, y un archivo en `src/lib/` con I/O es un error de diseño.

### 4.3 Por qué el teléfono vive en `lib/format/` y no en `services/`

La Tarea 08 ya définit `normalizeArgentinePhone` en `src/server/services/settings-normalizers.ts`, con el mismo algoritmo. Dejar las dos copias es la forma segura de que divergan: la Tarea 17 valida el número del local y la Tarea 13 el del cliente, y si un día se corrige una regla en un lado y no en el otro, el local recibe pedidos a un número viejo.

**Resolución:** `src/lib/format/phone.ts` es la **única implementación**. `settings-normalizers.ts` la importa y la reetiqueta:

```ts
// src/server/services/settings-normalizers.ts  — extracto de la Tarea 08, corregido
import { normalizeArgentinePhone } from "@/lib/format/phone";

/** Reetiqueta el error de `phone` a `whatsappPhone` para el formulario de ajustes. */
export const normalizeBusinessSettings = (stored: StoredSettings): BusinessSettingsDTO => {
  try {
    return { ...stored, whatsappPhone: normalizeArgentinePhone(stored.whatsappPhone) };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ValidationError(
        { whatsappPhone: error.fieldErrors.phone ?? [] },
        error.message,
      );
    }
    throw error;
  }
};
```

> `ValidationError` guarda los errores por campo en `fieldErrors` (contexto compartido §3). La versión de Capa 0 usa la clave genérica `phone`, porque no sabe si es el número del negocio o el del cliente; quien la llama decide con qué nombre mostrarlo. La función de Capa 0 **no** importa nada de `src/server/`.

### 4.4 Reparto de responsabilidades entre los cinco módulos

Un archivo por razón de cambio. Los cinco cambian por motivos distintos: el contrato, las plantillas, el truncado, la validación y la URL.

```
message-contract.ts     →  QUÉ es un mensaje (tipos) y cuánto vale (aritmética pura)
        ▲
        │
message-variants.ts     →  CÓMO se ve (las tres plantillas)
        ▲
        │
message-truncation.ts   →  QUÉ CABE (recorte por prioridad)
        ▲
        │
whatsapp-message.service.ts →  VALIDA y SANEA antes de delegar
```

`whatsapp-url.service.ts` es independiente: solo necesita el teléfono.

> **Por qué existe `message-contract.ts` y no un `types.ts`:** `message-variants.ts` y `whatsapp-message.service.ts` necesitan los mismos tipos, y `message-truncation.ts` necesita los mismos Helpers. Si los tipos vivieran en el servicio, el módulo de plantillas tendría que importar al servicio y el servicio al módulo de plantillas: un ciclo. Los tipos van en el archivo del medio, que es el que nadie importa por efectos. Sigue la convención de la Tarea 04, donde `src/lib/domain/product.ts` es un archivo de tipos sin lógica.

---

## 5. Convenciones de código (Clean Code + SOLID)

**Principio aplicado: SRP estricto + funciones puras sin estado.**

- **Una responsabilidad por archivo.** Si `whatsapp-message.service.ts` supera las 150 líneas del contexto compartido §13, el archivo está mal partido, no es un archivo largo.
- **Puro es puro.** Mismo input, mismo output. Sin `Date`, sin `Math.random`, sin lectura de `window`, sin `localStorage`. Por eso los tests no necesitan mocks: el único mock posible sería el reloj, y no se usa.
- **Errores de dominio, nunca `throw new Error()`.** `ValidationError` con `fieldErrors` lijados a los **nombres de campo del formulario de la Tarea 13** (`fullName`, `phone`, `address`, `notes`). Así la Tarea 13 mapea el error al input sin un diccionario de traducción.
- **Sin `any`, sin `!`, sin `@ts-expect-error`.** El branding de `E164Phone` se resuelve con un type guard justificado (§6.1), que es la excepción explícita del contexto compartido §11.
- **Constantes con nombre.** `MAX_MESSAGE_LENGTH`, `MAX_QUANTITY_PER_ITEM`, `MAX_ITEM_NAME_LENGTH`, `WHATSAPP_BASE_URL`, `LINE_BREAK_MODE`. Ningún número mágico en una línea de template.
- **Un solo punto de verdad por formato.** `formatARS` formatea precios, `renderPrice` normaliza el resultado, `lineTotal` y `orderTotal` arman la aritmética. La plantilla nunca multiplica.

---

## 6. Pasos de implementación

### 6.1 `src/lib/format/phone.ts`

```ts
import { ValidationError } from "@/lib/domain";

/** Prefijo internacional de Argentina. Sin `+`, como exige `wa.me`. */
const COUNTRY_CODE = "54";

/** E.164 admite 10 u 11 dígitos después del `9` móvil. Nada más. */
const E164_PATTERN = /^54\d{10,11}$/;

/** Un teléfono escrito a mano nunca pasa de esto. Corta entradas absurdas antes de procesarlas. */
const MAX_INPUT_LENGTH = 32;

/** Caracteres de control y de control bidireccional. Se eliminan de toda entrada. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

/**
 * Teléfono argentino en E.164 sin `+`, listo para `wa.me`.
 *
 * El branding no es decorativo: obliga a que quien arma una URL pase por
 * `normalizeArgentinePhone` o por el type guard. Un `string` suelto se
 * confunde con un teléfono ya normalizado y termina en un enlace roto.
 */
export type E164Phone = string & { readonly __brand: "E164Phone" };

/**
 * Se queda solo con los dígitos.
 *
 * ⛔ No aplica reglas de país: quitar el `00` internacional o agregar el
 * `54` es responsabilidad de `normalizeArgentinePhone`. Esta función
 * responde una sola pregunta, "qué queda si borro todo lo que no es un
 * número", y por eso sirve también para limpiar el teléfono del cliente
 * antes de guardarlo en `sessionStorage`.
 */
export const sanitizePhoneDigits = (raw: string): string =>
  raw.replace(CONTROL_CHARS, "").replace(BIDI_CONTROLS, "").replace(/\D/g, "");

/**
 * Type guard de E.164.
 *
 * ⛔ Capa 0 no puede usar `as`: el único `as` permitido en el proyecto es
 * el de un type guard justificado, y este lo es. Un `digits as E164Phone`
 * compila y miente: acepta `549` como si fuera un teléfono válido y el
 * deep-link manda al cliente a un número inexistente.
 */
export const isE164Phone = (value: string): value is E164Phone => E164_PATTERN.test(value);

/**
 * Lleva cualquier forma de escribir un teléfono argentino a E.164 sin `+`.
 *
 * Acepta: `2615551234`, `+54 9 261 555-1234`, `0261 555 1234`,
 * `54 261 555 1234`, `0054 9 261 555-1234`, con espacios, guiones y
 * paréntesis.
 *
 * Reglas, en orden:
 *  1. Se queda solo con los dígitos.
 *  2. Saca el prefijo internacional `00`.
 *  3. Si no arranca con `54`: si arranca con `0` (formato `0261…`) reemplaza
 *     ese `0` por `54`; si no, le antepone `54`.
 *  4. `540…` es un `54` seguido del `0` del `0…` local. Se saca ese `0`.
 *  5. Un número de 12 dígitos sin el `9` móvil se asume celular y se le
 *     agrega el `9`, que es como funciona WhatsApp en Argentina.
 *
 * ⛔ No intenta arreglar la notación heredada `54 261 15 555-1234`: es
 * ambigua (el `15` se confunde con un prefijo real) y adivinar mal rompe el
 * pedido. Ante la duda lanza `ValidationError` y pide escribirlo como lo
 * muestra WhatsApp.
 *
 * ⚠️ La regla 5 es una suposición documentada, no una certeza. Por eso el
 * formulario muestra el valor ya normalizado antes de confirmar.
 *
 * **El código de área no se valida.** La tarea separa el teléfono del
 * cliente del teléfono del local, y un cliente que retira en San Rafael
 * puede estar en otra provincia. `261` es lo que usa el negocio, no una
 * regla del catálogo.
 */
export const normalizeArgentinePhone = (input: string): E164Phone => {
  let digits = sanitizePhoneDigits(input);

  if (digits.length === 0) {
    throw new ValidationError({ phone: ["Ingresá un número de teléfono."] }, "Teléfono inválido");
  }

  if (digits.length > MAX_INPUT_LENGTH) {
    throw new ValidationError(
      { phone: ["El número es demasiado largo. Revisá que no se haya pegado otra cosa."] },
      "Teléfono inválido",
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

  if (!isE164Phone(digits)) {
    throw new ValidationError(
      { phone: ["El número no es válido. Escribilo como WhatsApp lo muestra, por ejemplo +54 9 261 555-1234."] },
      "Teléfono inválido",
    );
  }

  // El type guard de arriba ya estrechó `digits` a `E164Phone`: TypeScript
  // mantiene el estrechamiento en el resto del bloque, así que acá no hace
  // falta ningún `as`.
  return digits;
};

/**
 * Formato legible para mostrar en la UI: `+54 9 261 555-1234`.
 *
 * El cliente escribe el teléfono y necesita ver que se normalizó como
 * espera antes de confirmar. Mostrarlo crudo (`5492615551234`) genera
 * dudas y correcciones.
 */
export const formatArgentinePhoneForDisplay = (phone: E164Phone): string => {
  const area = phone.slice(4, 7);
  const rest = phone.slice(7);
  return `+54 9 ${area} ${rest.slice(0, 3)}-${rest.slice(3)}`;
};
```

> `formatArgentinePhoneForDisplay` no se usa dentro del mensaje (el local ya conoce el formato de sus clientes). Vive acá porque es el hermano de testeo de `normalizeArgentinePhone` y la Tarea 13 lo usa en el hint del campo teléfono.

### 6.2 `src/lib/whatsapp/message-contract.ts`

```ts
/**
 * Contrato de la construcción del mensaje de WhatsApp.
 *
 * Tipos, constantes y la aritmética derivada que todos los consumidores
 * necesitan. Sin plantillas, sin validación y sin efectos: si este archivo
 * hiciera una de esas cosas, alguien lo importaría por efecto y el ciclo
 * volvería.
 */
import { formatARS, roundCurrency } from "@/lib/format/currency";

/** Modalidad de entrega. Los mismos valores que el `enum` del picker de la Tarea 13. */
export type Fulfillment = "delivery" | "pickup";

/**
 * Las tres variantes de la Tarea 00 §6.3.
 *
 * ⛔ No hay una cuarta sin que el encargado la pida. El formato se ajusta
 * con pedidos reales en la primera semana (Tarea 22) y ese ajuste se hace
 * acá, no sobre el código que arma el mensaje.
 */
export type MessageVariant = "detailed" | "minimal" | "hybrid";

/**
 * Variante por defecto. Cambiar esta constante cambia producción en el
 * próximo deploy, sin tocar lógica ni plantillas.
 */
export const DEFAULT_MESSAGE_VARIANT: MessageVariant = "hybrid";

/** Nombre de cada variante, para la pantalla de QA y el log de la Tarea 22. */
export const MESSAGE_VARIANT_LABELS: Readonly<Record<MessageVariant, string>> = {
  detailed: "Detallada",
  minimal: "Mínima",
  hybrid: "Híbrida con notas",
};

/** Una línea del carrito tal como viaja al mensaje. */
export interface WhatsAppCartLine {
  readonly productId: string;
  readonly name: string;
  readonly variantName: string | null;
  /** Instantánea del precio con el `priceDelta` ya aplicado. La revalida el checkout. */
  readonly unitPrice: number;
  readonly quantity: number;
}

/** Datos del cliente. `phone` entra en cualquier formato: lo normaliza el servicio. */
export interface WhatsAppCustomer {
  readonly fullName: string;
  readonly phone: string;
  readonly fulfillment: Fulfillment;
  readonly address: string | null;
  readonly notes: string | null;
}

/** Datos del negocio. `whatsappPhone` en E.164 sin `+`, como lo guarda la Tarea 08. */
export interface WhatsAppBusiness {
  readonly name: string;
  readonly whatsappPhone: string;
}

export interface BuildWhatsAppMessageInput {
  readonly items: readonly WhatsAppCartLine[];
  readonly customer: WhatsAppCustomer;
  readonly business: WhatsAppBusiness;
  /** Por defecto `DEFAULT_MESSAGE_VARIANT`. */
  readonly variant?: MessageVariant;
}

/** Lo que devuelve `buildWhatsAppOrder`. `text` es el producto final. */
export interface WhatsAppOrderMessage {
  readonly text: string;
  /** `true` si hubo que recortar notas o ítems. La UI avisa en el checkout. */
  readonly isTruncated: boolean;
  readonly omittedItemCount: number;
  /** `true` si las notas entraron en el mensaje. */
  readonly hasNotes: boolean;
  /** Total de los ítems que quedaron, ya redondeado. */
  readonly total: number;
}

/** Total de una línea. `roundCurrency` en el medio, no al final de la suma. */
export const lineTotal = (line: WhatsAppCartLine): number =>
  roundCurrency(line.unitPrice * line.quantity);

/** Total del pedido. Suma de líneas ya redondeadas: `0.1 + 0.2` nunca llega acá. */
export const orderTotal = (lines: readonly WhatsAppCartLine[]): number =>
  roundCurrency(lines.reduce((sum, line) => sum + lineTotal(line), 0));
```

> **Por qué `roundCurrency` va en `lineTotal` y no solo en el total:** `0.1 + 0.2` da `0.30000000000000004`, y con 20 líneas de precios con centavos el total acumulado llega a `$3.700,000000001`. Si el precio de la línea viene ya redondeado, el total de la suma redondeada es exactamente el total redondeado. Además `formatARS` con `es-AR` redondea a 2 decimales, así que un valor como ese se vería `$ 3.700,00` con la coma mal puesta o `$ 3.701` según el caso.

### 6.3 `src/lib/whatsapp/message-variants.ts`

```ts
/**
 * Las tres plantillas del mensaje.
 *
 * Reciben datos **ya validados y saneados** por el servicio. Este módulo no
 * decide si un dato es correcto: solo lo escribe. Esa separación es la que
 * permite testear el formato exacto sin levantar un carrito.
 */
import { formatARS } from "@/lib/format/currency";
import { lineTotal, orderTotal } from "./message-contract";
import type {
  BuildWhatsAppMessageInput,
  MessageVariant,
  WhatsAppBusiness,
  WhatsAppCartLine,
  WhatsAppCustomer,
} from "./message-contract";

export interface RenderMessageLinesInput extends BuildWhatsAppMessageInput {
  readonly variant: MessageVariant;
  /** Aviso de recorte. Ocupa el lugar de las notas: nunca se mezclan. */
  readonly notice: string | null;
}

/**
 * Precio en el mensaje.
 *
 * `Intl` en `es-AR` mete un espacio duro (U+00A0) entre el símbolo y el
 * número: `"$ 3.700"`. El mensaje acordado en la Tarea 00 §6.3 dice
 * `$3.700`. Normalizar acá hace que el resultado sea determinista sin
 * depender de cómo implemente `formatARS` la Tarea 11. Si esa función ya
 * normaliza el espacio, esta línea es un passthrough.
 */
const renderPrice = (amount: number): string => formatARS(amount).replace(/\u00A0/g, "");

/** `2 x Jamón y Queso (Doble)`, la parte variable de una línea. */
const renderItemLabel = (line: WhatsAppCartLine): string => {
  const variant = line.variantName === null ? "" : ` (${line.variantName})`;
  return `${line.quantity} x ${line.name}${variant}`;
};

const renderItemLine = (line: WhatsAppCartLine): string =>
  `• ${renderItemLabel(line)} — ${renderPrice(lineTotal(line))}`;

const greeting = (business: WhatsAppBusiness): string =>
  `¡Hola! Quiero hacer un pedido en *${business.name}*:`;

const customerLines = (customer: WhatsAppCustomer): string[] => {
  const lines = [`Nombre: ${customer.fullName}`, `Teléfono: ${customer.phone}`];
  if (customer.fulfillment === "delivery") {
    // El servicio garantiza que `address` no es null cuando es delivery.
    lines.push(`Entrega en: ${customer.address ?? ""}`.trimEnd());
  } else {
    lines.push("Retiro en el local");
  }
  return lines;
};

const notesLine = (customer: WhatsAppCustomer): string[] => {
  if (customer.notes === null || customer.notes.length === 0) return [];
  return ["", `Comentarios: ${customer.notes}`];
};

/**
 * Bloque común de las variantes A y C. La única diferencia entre las dos es
 * el bloque de comentarios, y por eso comparten el esqueleto en vez de estar
 * dos plantillas copiadas que se desincronizan con el primer cambio.
 */
const renderWithDataBlock = (input: RenderMessageLinesInput, withNotes: boolean): string[] => {
  const { items, customer, business, notice } = input;

  return [
    greeting(business),
    "",
    ...items.map(renderItemLine),
    "",
    `*Total: ${renderPrice(orderTotal(items))}*`,
    "",
    "*Mis datos:*",
    ...customerLines(customer),
    ...(withNotes ? notesLine(customer) : []),
    ...(notice === null ? [] : ["", notice]),
    "",
    "¡Gracias!",
  ];
};

/** Variante A de la Tarea 00 §6.3. Sin comentarios: el bloque es literal. */
const renderDetailed = (input: RenderMessageLinesInput): string[] =>
  renderWithDataBlock(input, false);

/** Variante C: la detallada más el bloque de comentarios. Es la que se usa por defecto. */
const renderHybrid = (input: RenderMessageLinesInput): string[] =>
  renderWithDataBlock(input, true);

/**
 * Variante B: mínima. Sin precios por línea, sin negritas, sin despedida.
 *
 * Es literal a la Tarea 00 §6.3. Sirve para medir en la primera semana si el
 * local lee mejor el resumen corto o el pedido detallado (Tarea 22).
 */
const renderMinimal = (input: RenderMessageLinesInput): string[] => {
  // ⛔ `business` no se desestructura: la variante corta no menciona el
  // nombre del local. Pedir un dato para no usarlo hace que la firma prometa
  // una dependencia que el renderer no tiene.
  const { items, customer } = input;
  const entrega =
    customer.fulfillment === "delivery"
      ? `entrega en ${customer.address ?? ""}`.trimEnd()
      : "retiro en el local";
  return [
    "Hola! Mi pedido:",
    ...items.map(renderItemLabel),
    `Total: ${renderPrice(orderTotal(items))}`,
    `Soy ${customer.fullName}, tel ${customer.phone}, ${entrega}.`,
    ...(input.notice === null ? [] : [input.notice]),
  ];
};

const RENDERERS: Readonly<Record<MessageVariant, (input: RenderMessageLinesInput) => string[]>> = {
  detailed: renderDetailed,
  minimal: renderMinimal,
  hybrid: renderHybrid,
};

export const renderMessageLines = (input: RenderMessageLinesInput): readonly string[] =>
  RENDERERS[input.variant](input);
```

> **`business.name` no se escapa de negritas.** El nombre del negocio viene de los ajustes del panel, que solo puede editar el encargado. Es el único campo sin saneo de `*` a propósito: si el nombre del local fuera `Miga *Premium*`, el cliente **querría** ver la negrita.

### 6.4 `src/lib/whatsapp/message-truncation.ts`

```ts
/**
 * Encaje del mensaje en el límite de longitud.
 *
 * WhatsApp admite miles de caracteres, pero el mensaje lo lee una persona en
 * un teléfono mientras atiende a otro cliente. El límite de acá es de
 * **legibilidad**, no de la plataforma.
 */
import { lineTotal, orderTotal } from "./message-contract";
import type {
  MessageVariant,
  WhatsAppBusiness,
  WhatsAppCartLine,
  WhatsAppCustomer,
  WhatsAppOrderMessage,
} from "./message-contract";
import { renderMessageLines } from "./message-variants";

/** Tope del mensaje. Pasado este número se recorta, nunca se corta. */
export const MAX_MESSAGE_LENGTH = 1800;

/**
 * Tope del nombre de un producto dentro del mensaje.
 *
 * Es el **único** campo que se puede cortar por la mitad, y solo cuando ya
 * no entra ninguna otra solución. Un precio a medio escribir `$ 2.90` se lee
 * como otro precio, y el encargado cobra de más.
 */
export const MAX_ITEM_NAME_LENGTH = 60;

const NOTES_OMITTED_NOTICE =
  "Comentarios: no entran en el mensaje, te los escribo acá en el chat";

const NAME_SHORTENED_NOTICE =
  "el nombre del producto va recortado, te lo escribo completo en el chat";

const itemsOmittedNotice = (count: number): string =>
  count === 1
    ? "+ 1 producto más: el total es parcial, el resto lo coordinamos en el chat"
    : `+ ${count} productos más: el total es parcial, el resto lo coordinamos en el chat`;

export interface TruncationContext {
  readonly variant: MessageVariant;
  readonly items: readonly WhatsAppCartLine[];
  readonly customer: WhatsAppCustomer;
  readonly business: WhatsAppBusiness;
}

/**
 * ⚠️ `withNotes: false` no es un detalle: es lo que hace verdad el aviso de
 * "los comentarios no entran en el mensaje". Si se renderiza el contexto
 * entero, el aviso queda mintiendo y el mensaje duplica el texto largo dos
 * veces, que es justo lo que se estaba tratando de evitar.
 */
const render = (
  context: TruncationContext,
  items: readonly WhatsAppCartLine[],
  notice: string | null,
  withNotes: boolean,
): string =>
  renderMessageLines({
    ...context,
    items,
    notice,
    customer: withNotes ? context.customer : { ...context.customer, notes: null },
  }).join("\n");

/**
 * Un aviso por cada cosa que se perdió, en el orden en que se intentó
 * perder. Tres motivos, tres textos, y ninguno se deduce del mensaje: si el
 * recorte no se dice, el encargado completa el pedido con lo que le parece.
 */
const buildNotice = (
  omittedItems: number,
  notesOmitted: boolean,
  nameShortened = false,
): string | null => {
  const parts: string[] = [];
  if (omittedItems > 0) parts.push(itemsOmittedNotice(omittedItems));
  if (notesOmitted) parts.push(NOTES_OMITTED_NOTICE);
  if (nameShortened) parts.push(NAME_SHORTENED_NOTICE);
  return parts.length === 0 ? null : parts.join(" ");
};

const hasNotes = (customer: WhatsAppCustomer): boolean =>
  customer.notes !== null && customer.notes.length > 0;

/** Índice de descarte: precio total de línea ascendente. */
const discardOrder = (items: readonly WhatsAppCartLine[]): WhatsAppCartLine[] =>
  [...items].sort((a, b) => lineTotal(a) - lineTotal(b));

const shortenName = (name: string): string =>
  name.length <= MAX_ITEM_NAME_LENGTH
    ? name
    : `${name.slice(0, MAX_ITEM_NAME_LENGTH - 1).trimEnd()}…`;

const result = (
  text: string,
  kept: readonly WhatsAppCartLine[],
  isTruncated: boolean,
  omittedItemCount: number,
  withNotes: boolean,
): WhatsAppOrderMessage => ({
  text,
  isTruncated,
  omittedItemCount,
  hasNotes: withNotes,
  total: orderTotal(kept),
});

/**
 * Devuelve el mensaje más completo que entra en `MAX_MESSAGE_LENGTH`.
 *
 * El orden de intento es fijo y es una decisión de producto:
 *  1. Mensaje completo, con notas.
 *  2. Sin notas. Las notas son texto libre: se pueden repetir en el chat.
 *  3. Ítems de a uno, del más barato al más caro, hasta que entre.
 *  4. Último recurso: un solo ítem con el nombre recortado.
 *
 * En ningún caso se devuelve un mensaje que aclare que quedó incompleto sin
 * decirlo. Si entra cortado, entra diciendo qué se cortó.
 */
export const buildFittingMessage = (context: TruncationContext): WhatsAppOrderMessage => {
  const { items, customer } = context;
  const full = render(context, items, null, true);

  if (full.length <= MAX_MESSAGE_LENGTH) {
    // La variante `detailed` no incluye las notas nunca, así que informar
    // `hasNotes: true` ahí sería mentir sobre lo que se mandó.
    return result(full, items, false, 0, hasNotes(customer) && context.variant !== "detailed");
  }

  const withoutNotes = render(context, items, buildNotice(0, true), false);

  if (withoutNotes.length <= MAX_MESSAGE_LENGTH) {
    return result(withoutNotes, items, true, 0, false);
  }

  // `Set` por identidad de objeto: las líneas del carrito son objetos
  // distintos aunque repetidas dos veces, y el orden de la lista no cambia
  // al filtrar, que es lo que espera el local.
  const dropped = new Set<WhatsAppCartLine>();

  // `slice(0, -1)`: nunca se descarta el último ítem. Un pedido sin líneas
  // no es un pedido recortado, es un pedido vacío, y eso lo bloquea el
  // servicio antes de llegar acá.
  for (const candidate of discardOrder(items).slice(0, -1)) {
    dropped.add(candidate);
    const kept = items.filter((line) => !dropped.has(line));
    const text = render(context, kept, buildNotice(dropped.size, true), false);

    if (text.length <= MAX_MESSAGE_LENGTH) {
      return result(text, kept, true, dropped.size, false);
    }
  }

  const mostRelevant = discardOrder(items).at(-1);

  if (mostRelevant === undefined) {
    // `items` no vacío está garantizado por el servicio. El chequeo evita
    // el `!` prohibido y hace explícita la precondición.
    return result(withoutNotes, items, true, 0, false);
  }

  const kept: readonly WhatsAppCartLine[] = [
    { ...mostRelevant, name: shortenName(mostRelevant.name) },
  ];

  // El nombre recortado es el único campo que se corta por la mitad, así que
  // necesita su propio aviso: sin él, el encargado ve "Miga Premium…" y no
  // tiene forma de saber que le mandaron la mitad del nombre. ⛔ El precio
  // nunca se toca, ni acá ni en ningún paso.
  const text = render(
    context,
    kept,
    buildNotice(items.length - 1, true, shortenName(mostRelevant.name) !== mostRelevant.name),
    false,
  );

  return result(text, kept, true, items.length - 1, false);
};
```

> `Array.prototype.at` devuelve `T | undefined`, así que el último recurso queda tipado sin `!`. El descarte usa `lineTotal`, la misma aritmética que la línea del mensaje, para que el orden de descarte y el total mostrado no puedan calcular distinto.

### 6.5 `src/lib/whatsapp/whatsapp-message.service.ts`

```ts
/**
 * Servicio de dominio: arma el mensaje de WhatsApp.
 *
 * ⛔ SIN `import "server-only"` (contexto compartido §11). No hay I/O acá:
 * ni base, ni red, ni reloj, ni sistema de archivos. La función corre en el
 * navegador de la Tarea 13 y se testea sin mocks.
 */
import { MAX_QUANTITY_PER_ITEM } from "@/lib/domain/cart";
import { ValidationError } from "@/lib/domain";
import { isE164Phone, normalizeArgentinePhone, sanitizePhoneDigits } from "@/lib/format/phone";
import { buildFittingMessage } from "./message-truncation";
import {
  DEFAULT_MESSAGE_VARIANT,
  type BuildWhatsAppMessageInput,
  type WhatsAppBusiness,
  type WhatsAppCartLine,
  type WhatsAppCustomer,
  type WhatsAppOrderMessage,
} from "./message-contract";

/** Caracteres que no pueden viajar en un mensaje de chat. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Marcas bidireccionales. Un U+202E en el nombre de un producto invierte
 * visualmente el texto que viene después en el teléfono del encargado: es el
 * truco clásico para mandar "Miga" y que se lea "ag iM". Se eliminan.
 */
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

const MAX_NAME_LENGTH = 80;
const MAX_ADDRESS_LENGTH = 240;
const MIN_ADDRESS_LENGTH = 10;
const MAX_NOTES_LENGTH = 500;

/**
 * Limpieza de texto libre.
 *
 * - Normaliza los finales de línea a `\n`.
 * - Borra caracteres de control y marcas bidireccionales.
 * - Borra el `*`: en WhatsApp abre y cierra negritas, así que un producto
 *   llamado `Miga *Premium*` desalinea todo el mensaje de abajo.
 * - Colapsa espacios y tabulaciones, y recorta cada línea.
 */
const cleanText = (value: string): string =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .replace(BIDI_CONTROLS, "")
    .replace(/\*/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();

const validateLine = (line: WhatsAppCartLine): WhatsAppCartLine => {
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY_PER_ITEM) {
    throw new ValidationError(
      { cart: [`"${line.name}" tiene una cantidad inválida. Volvé al carrito y revisala.`] },
      "Carrito inválido",
    );
  }

  if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
    throw new ValidationError(
      { cart: [`"${line.name}" tiene un precio inválido.`] },
      "Carrito inválido",
    );
  }

  return {
    ...line,
    name: cleanText(line.name),
    variantName: line.variantName === null ? null : cleanText(line.variantName),
  };
};

/**
 * Las claves de `fieldErrors` son los nombres de campo del formulario de la
 * Tarea 13: la UI mapea el error al input sin diccionario de traducción.
 */
const validateCustomer = (customer: WhatsAppCustomer): WhatsAppCustomer => {
  const fullName = cleanText(customer.fullName);

  if (fullName.length < 2 || fullName.length > MAX_NAME_LENGTH) {
    throw new ValidationError(
      { fullName: ["Ingresá tu nombre."] },
      "Datos del cliente incompletos",
    );
  }

  // Normalizar y no solo sanear: el local recibe el teléfono como lo ve
  // WhatsApp, y si el cliente se equivocó al escribirlo lo detecta antes
  // de abrir el chat, no cuando ya no puede corregirlo.
  const phone = normalizeArgentinePhone(customer.phone);

  const notes = customer.notes === null ? null : cleanText(customer.notes);
  if (notes !== null && notes.length > MAX_NOTES_LENGTH) {
    throw new ValidationError(
      { notes: [`Las notas pueden tener hasta ${MAX_NOTES_LENGTH} caracteres.`] },
      "Datos del cliente incompletos",
    );
  }

  if (customer.fulfillment === "pickup") {
    return { fullName, phone, fulfillment: "pickup", address: null, notes };
  }

  const address = customer.address === null ? "" : cleanText(customer.address);

  if (address.length < MIN_ADDRESS_LENGTH || address.length > MAX_ADDRESS_LENGTH) {
    throw new ValidationError(
      { address: ["Ingresá la dirección de entrega, entre 10 y 240 caracteres."] },
      "Falta la dirección de entrega",
    );
  }

  return { fullName, phone, fulfillment: "delivery", address, notes };
};

/** El teléfono del negocio no tiene formulario que lo corrija: el error es para el encargado. */
const validateBusiness = (business: WhatsAppBusiness): WhatsAppBusiness => {
  const name = cleanText(business.name);

  if (name.length === 0) {
    throw new ValidationError(
      { businessName: ["El negocio no tiene nombre configurado."] },
      "Negocio sin configurar",
    );
  }

  const digits = sanitizePhoneDigits(business.whatsappPhone);

  if (!isE164Phone(digits)) {
    throw new ValidationError(
      {
        whatsappPhone: [
          "El número de WhatsApp del local no está bien configurado. Corregilo en Ajustes.",
        ],
      },
      "Número de WhatsApp inválido",
    );
  }

  return { name, whatsappPhone: digits };
};

/**
 * Arma el mensaje completo con el detalle del truncado.
 *
 * La Tarea 13 usa esta función porque necesita saber si el mensaje se
 * recortó para avisarle al cliente. `buildWhatsAppMessage` es el caso común.
 */
export const buildWhatsAppOrder = (input: BuildWhatsAppMessageInput): WhatsAppOrderMessage => {
  if (input.items.length === 0) {
    // Un `string` vacío rompería el deep-link y el local recibiría un chat
    // en blanco. Un error de dominio lo frena en el cliente, con un mensaje
    // que se puede mostrar.
    throw new ValidationError(
      { cart: ["Tu carrito está vacío. Agregá al menos un producto."] },
      "No hay productos para enviar",
    );
  }

  return buildFittingMessage({
    variant: input.variant ?? DEFAULT_MESSAGE_VARIANT,
    items: input.items.map(validateLine),
    customer: validateCustomer(input.customer),
    business: validateBusiness(input.business),
  });
};

/**
 * El producto final del proyecto: el texto que llega al chat del local.
 *
 * Devuelve un `string` y nada más, que es lo que necesita la mayoría de los
 * llamadores. Para el detalle del truncado, `buildWhatsAppOrder`.
 */
export const buildWhatsAppMessage = (input: BuildWhatsAppMessageInput): string =>
  buildWhatsAppOrder(input).text;
```

### 6.6 `src/lib/whatsapp/whatsapp-url.service.ts`

```ts
/**
 * Deep-link de WhatsApp.
 *
 * ⛔ Sin `import "server-only"`. Sin I/O: arma un string. Lo mismo lo usa
 * el botón flotante del catálogo (Tarea 10) y la página de éxito (Tarea 13).
 */
import { ValidationError } from "@/lib/domain";
import { isE164Phone, normalizeArgentinePhone, sanitizePhoneDigits } from "@/lib/format/phone";

export const WHATSAPP_BASE_URL = "https://wa.me";

/**
 * Cómo viajan los saltos de línea.
 *
 * `"lf"` envía `\n` como `%0A`, que es lo correcto y funciona en todas las
 * versiones de WhatsApp vigentes.
 *
 * `"crlf"` reemplaza por `%0D%0A`. Es el arreglo para clientes antiguos que
 * pegan todo en una sola línea, y **no** se activa a ciegas: primero hay que
 * ver el problema en un teléfono real (§9, fila "saltos de línea pegados").
 * Cambiar acá es cambiar una constante.
 */
export const LINE_BREAK_MODE: "lf" | "crlf" = "lf";

/** `wa.me` tolera el `+` y los espacios, pero no los necesita y algunos clientes fallan. */
const toDestination = (phone: string): string => {
  const digits = sanitizePhoneDigits(phone);
  return isE164Phone(digits) ? digits : normalizeArgentinePhone(phone);
};

const encodeMessage = (message: string): string => {
  const encoded = encodeURIComponent(message);
  return LINE_BREAK_MODE === "crlf" ? encoded.replace(/%0A/g, "%0D%0A") : encoded;
};

/**
 * Arma la URL que abre el chat con el mensaje ya escrito.
 *
 * `encodeURIComponent` no es opcional: sin él, un `&` en la dirección corta
 * el parámetro `text`, un `#` trunca la URL y los acentos rompen el draft.
 */
export const buildWhatsAppUrl = (phone: string, message: string): string => {
  let destination: string;

  try {
    destination = toDestination(phone);
  } catch {
    // Se re-lanza con la clave del campo del panel, no la del cliente.
    throw new ValidationError(
      { whatsappPhone: ["El número de WhatsApp del local no está bien configurado. Corregilo en Ajustes."] },
      "No se puede abrir WhatsApp",
    );
  }

  if (message.length === 0) {
    throw new ValidationError(
      { message: ["El mensaje está vacío. No hay nada que enviar."] },
      "No se puede abrir WhatsApp",
    );
  }

  return `${WHATSAPP_BASE_URL}/${destination}?text=${encodeMessage(message)}`;
};
```

### 6.7 Modificar `settings-normalizers.ts` (Tarea 08)

Borrar la copia local de `normalizeArgentinePhone` y dejar el reenvío de §4.3. Los tests de la Tarea 08 (`tests/unit/settings.service.test.ts`) siguen siendo válidos: cambió de archivo, no de comportamiento.

---

## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `buildWhatsAppMessage(input): string` | `src/lib/whatsapp/whatsapp-message.service.ts` | **Tarea 13** (handoff), Tarea 10 (botón flotante) |
| `buildWhatsAppOrder(input): WhatsAppOrderMessage` | idem | Tarea 13 (aviso de truncado) |
| `buildWhatsAppUrl(phone, message): string` | `src/lib/whatsapp/whatsapp-url.service.ts` | Tarea 13 (link y botón), Tarea 10 |
| `MessageVariant` · `DEFAULT_MESSAGE_VARIANT` · `MESSAGE_VARIANT_LABELS` | `src/lib/whatsapp/message-contract.ts` | Tarea 13 (página de éxito), Tarea 22 (ajuste de formato) |
| `WhatsAppCartLine` · `WhatsAppCustomer` · `WhatsAppBusiness` | idem | Tarea 13 (mapeo desde `CartState`) |
| `lineTotal(line)` · `orderTotal(lines)` | idem | Tarea 13 (`OrderSummary`) |
| `MAX_MESSAGE_LENGTH` | `src/lib/whatsapp/message-truncation.ts` | Tarea 13 (copy del aviso) |
| `normalizeArgentinePhone(input): E164Phone` | `src/lib/format/phone.ts` | Tarea 08, 13, 17 |
| `sanitizePhoneDigits(raw): string` | idem | Tarea 13 (borrador del formulario) |
| `formatArgentinePhoneForDisplay(phone): string` | idem | Tarea 13 (hint del campo teléfono) |
| `E164Phone` | idem | Todo el código que arma URLs |
| `LINE_BREAK_MODE` | `src/lib/whatsapp/whatsapp-url.service.ts` | Ajuste manual si un cliente viejo rompe los saltos |

**Firma más delicada de la tarea:** `buildWhatsAppMessage` recibe **un objeto** con `items`, `customer`, `business` y `variant`, no cuatro argumentos posicionales. Tres argumentos en ese orden son indistinguibles en el call site: dos objetos con la misma forma y el bug aparece en producción, no en el compilador.

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [ ] `buildWhatsAppMessage` reproduce **carácter por carácter** la Variante C de la Tarea 00 §6.3 con los datos de ejemplo (`2 x Classic Jamón y Queso — $2.900`, `*Total: $3.700*`, `Retiro en el local`)
- [ ] La Variante A no incluye el bloque `Comentarios:` y la Variante B no incluye precios por línea
- [ ] `DEFAULT_MESSAGE_VARIANT` es `hybrid` y se puede cambiar sin tocar ninguna función
- [ ] Las tres variantes se pueden pasar por parámetro y producen tres mensajes distintos
- [ ] El total usa `roundCurrency` y coincide con la suma de las líneas para precios con centavos
- [ ] Un carrito vacío lanza `ValidationError`, nunca devuelve `""`
- [ ] El mensaje con más de 1800 caracteres se recorta, dice qué se recortó y no corta ningún precio por la mitad
- [ ] Un producto con nombre larguísimo entra entero; si no entra, solo se recorta el nombre y con puntos suspensivos
- [ ] `buildWhatsAppUrl` devuelve `https://wa.me/<13 dígitos>?text=<mensaje codificado>`
- [ ] Los saltos de línea viajan como `%0A` y las tildes se conservan
- [ ] El teléfono del cliente aparece normalizado con prefijo `54` y `9` móvil

### 8.2 Calidad

- [ ] `npm run verify` en verde
- [ ] `npm run build` en verde
- [ ] Ningún archivo de `src/lib/whatsapp/` ni `src/lib/format/phone.ts` tiene `import "server-only"`
- [ ] `rg 'fetch\(|prisma\.|Date\.now|process\.env' src/lib/whatsapp/ src/lib/format/phone.ts` → cero resultados
- [ ] `rg ': any|@ts-ignore|@ts-expect-error' src/lib/` → cero resultados
- [ ] Ningún archivo supera 150 líneas
- [ ] No hay archivos `utils.ts`, `helpers.ts` ni `misc.ts` en `src/lib/`

### 8.3 Arquitectura — verificación obligatoria

- [ ] `rg 'from "@/server|from "@/app|from "@/components|from "next/|from "react"' src/lib/whatsapp/ src/lib/format/phone.ts` → cero resultados
- [ ] `normalizeArgentinePhone` existe en **un solo lugar** del proyecto: `src/lib/format/phone.ts`
- [ ] `settings-normalizers.ts` importa la versión de Capa 0 y no la reimplementa
- [ ] Las funciones son puras: el mismo input produce el mismo output sin tocar `Date`, `Math.random` ni variables globales
- [ ] Los errores son `ValidationError` de `@/lib/domain`, con las claves de campo de la Tarea 13
- [ ] El branding de `E164Phone` se resuelve con un type guard comentado, no con un `as`
- [ ] `renderMessageLines` no valida nada: recibe datos ya validados

### 8.4 Pruebas

- [ ] Mínimo 12 casos en `whatsapp-message.service.test.ts` (la suite entregada tiene 18)
- [ ] Mínimo 8 casos en `phone.test.ts`
- [ ] Los 10 casos prioritarios de `DESIGN.md` §13.3 tienen un test cada uno
- [ ] Hay un test que verifica que la URL no tiene espacios crudos ni caracteres fuera del set permitido
- [ ] Hay un test de mensaje exactamente en 1800 caracteres (no se recorta) y de 1801 (se recorta)
- [ ] Hay un test de normalización en 6 formatos: `2615551234`, `+54 9 261 555-1234`, `0261 555 1234`, `54 261 555 1234`, `5492615551234`, `0054 9 261 555-1234`
- [ ] Hay tests de entrada vacía, con letras y con longitud absurda
- [ ] Hay un test de doble encoding: un `%` en el texto produce `%25` **una sola vez** en la URL
- [ ] Los tests son deterministas y corren en `environment: "node"` sin mocks
- [ ] Todos los `it()` usan el formato `debe <comportamiento>`

### 8.5 Seguridad y documentación

- [ ] Los caracteres de control y las marcas bidireccionales (`U+202A`–`U+202E`) se eliminan de todo texto del cliente
- [ ] El `*` se elimina del texto del cliente, del producto y de la variante, para que nadie pueda romper las negritas del mensaje
- [ ] Un número de teléfono con formato inválido no llega a la URL: se lanza `ValidationError`
- [ ] `buildWhatsAppUrl` nunca interpola texto sin codificar en el query string
- [ ] El documento explica por qué `*texto*` y no `**texto**`
- [ ] El documento explica cómo se cambia `LINE_BREAK_MODE` y cómo se verifica en un teléfono real
- [ ] `docs/decisiones-negocio.md` tiene la variante elegida anotada por el encargado

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado |
|---|---|
| Carrito vacío | `ValidationError` con `cart: ["Tu carrito está vacío…"]`. **Nunca** un string vacío: `wa.me?text=` abre un chat en blanco y el local no sabe qué pasó |
| Producto con acentos, `ñ`, `&`, `#` | Se escriben tal cual en el mensaje. En la URL viajan como `%C3%B3`, `%26`, `%23`. El `&` de la URL es `%26`, no el separador de parámetros |
| Dirección con `#` y `&` | La URL sigue siendo válida: `encodeURIComponent` convierte el `&` en `%26`, que ya no corta el `?text=` |
| Producto con variante | La línea incluye ` (Doble)` y el precio ya tiene el `priceDelta` aplicado |
| Nombre de producto con `*` | El `*` se elimina. WhatsApp interpretaría el resto como negrita y desalinearía el mensaje |
| Texto con `%` | Doble encoding: `encodeURIComponent` produce `%25`. Un segundo `encodeURIComponent` produciría `%2525` y el local leería `100%25` |
| Notas con saltos de línea | Se conservan como `\n`, viajan como `%0A` y no rompen el bloque de datos |
| Notas con emojis | Se conservan. Los emojis son UTF-8 de 4 bytes: verificar que la URL no se corte (test de longitud de URL) |
| Comillas y apóstrofes | Se conservan. `encodeURIComponent` no escapa `'` por defecto, y `wa.me` lo tolera |
| Mensaje > 1800 caracteres | 1) se quitan las notas con aviso, 2) si no alcanza, se descartan ítems del más barato al más caro con un aviso que aclara que el total es parcial, 3) si no alcanza, se recorta el nombre del ítem más caro. El precio nunca se parte |
| Mensaje exactamente en 1800 | No se recorta. El límite es `<=`, no `<` |
| Un solo producto con nombre de 400 caracteres | Se recorta a 60 con `…` y el aviso dice que el detalle está en el chat |
| 30 líneas distintas | Entra completo si el total queda bajo 1800. Si no, se descartan las más baratas |
| Precio con centavos (`1450.55`, cantidad 3) | `$ 4.351,65` sin residuo de punto flotante. Con `roundCurrency` en `lineTotal` |
| Tres líneas de `$0,10` | El total es exactamente `0.3`, no `0.30000000000000004`. Con `roundCurrency` en `lineTotal` |
| Cantidad `0` o negativa | `ValidationError`. La cantidad la limita la Tarea 11; esto es la segunda barrera |
| Cantidad mayor a `MAX_QUANTITY_PER_ITEM` | `ValidationError` que manda a revisar el carrito. Un `localStorage` corrupto (riesgo R3 de `DESIGN.md`) no puede generar un pedido de 9999 unidades |
| Precio `NaN`, `Infinity` o negativo | `ValidationError` |
| Teléfono con `+54 9 261 555-1234` | `5492615551234` |
| Teléfono con `0261 555 1234` | `5492615551234` |
| Teléfono local `2615551234` | `5492615551234` (se asume celular y se agrega el `9`) |
| Teléfono con `0054 9 261 555-1234` | `5492615551234` (se saca el prefijo internacional) |
| Teléfono con typo: `2615551` | `ValidationError`. **No** se "corrige" adivinando: un número mal escrito es un pedido perdido |
| Teléfono con letras: `261 ABC 1234` | Se descartan las letras y se normaliza. Si lo que queda no es válido, `ValidationError` |
| Cliente que no quiere dejar teléfono | El campo es **obligatorio** en el esquema de la Tarea 13: sin teléfono el local no puede coordinar la entrega. El mensaje nunca sale sin él, porque `validateCustomer` normaliza y falla antes |
| Teléfono del negocio mal configurado | `ValidationError` con la clave `whatsappPhone` y un mensaje que le dice al encargado dónde corregirlo. El enlace no se arma con un número inventado |
| `business.name` vacío | `ValidationError`. Un mensaje sin nombre de negocio no se sabe de quién es |
| Caracteres de control (`\u0000`, `\u0007`, `\u001B`) | Se eliminan. Un `\u0007` en un mensaje se ve como texto roto en el chat |
| Marcas bidireccionales (`U+202E`) | Se eliminan. Es la técnica de suplantar el nombre de un producto en pantalla |
| Salto de línea pegado en un cliente viejo | No se resuelve por código. Se cambia `LINE_BREAK_MODE` a `"crlf"` después de **verificar el problema en un teléfono real**. Ver §12 |
| Nombre de negocio con `*` | Se conserva. Es el único campo sin sanear: el nombre del local es del encargado y si quiere negrita, la tiene |
| `variantName` vacío (`""`) | Se trata como `null`: la línea no muestra paréntesis vacíos |
| Notas que son solo espacios | Se_clean_ean a `""` y el bloque `Comentarios` no se agrega |

---

## 10. Pruebas

| Suite | Qué verifica |
|---|---|
| `tests/unit/format/phone.test.ts` | Normalización en 6 formatos, `00` internacional, vacío, letras, longitud absurda, caracteres de control, `formatArgentinePhoneForDisplay` |
| `tests/unit/whatsapp/whatsapp-message.service.test.ts` | Los 10 casos de `DESIGN.md` §13.3, las tres variantes, truncado en 3 etapas, límite exacto, 30 líneas, punto flotante, campos inválidos |
| `tests/unit/whatsapp/whatsapp-url.service.test.ts` | Set de caracteres permitido, `%0A`, doble encoding, teléfono inválido, mensaje vacío, `LINE_BREAK_MODE` |

```ts
// tests/unit/whatsapp/whatsapp-message.service.test.ts
import { describe, expect, it } from "vitest";
import { buildWhatsAppMessage, buildWhatsAppOrder } from "@/lib/whatsapp/whatsapp-message.service";
import { MAX_MESSAGE_LENGTH } from "@/lib/whatsapp/message-truncation";
import { ValidationError } from "@/lib/domain";
import type { BuildWhatsAppMessageInput, WhatsAppCartLine } from "@/lib/whatsapp/message-contract";

const BUSINESS = { name: "Mi Negocio", whatsappPhone: "5492615551234" } as const;

const customer = (overrides: Partial<BuildWhatsAppMessageInput["customer"]> = {}) => ({
  fullName: "Juan Pérez",
  phone: "2615551234",
  fulfillment: "pickup" as const,
  address: null,
  notes: null,
  ...overrides,
});

const line = (overrides: Partial<WhatsAppCartLine> = {}): WhatsAppCartLine => ({
  productId: "p1",
  name: "Classic Jamón y Queso",
  variantName: null,
  unitPrice: 1450,
  quantity: 1,
  ...overrides,
});

describe("buildWhatsAppMessage", () => {
  it("debe armar la Variante C con los literales de la Tarea 00", () => {
    const message = buildWhatsAppMessage({
      items: [line({ quantity: 2 }), line({ productId: "p2", name: "Bebida Coca 500ml", unitPrice: 800 })],
      customer: customer({ fulfillment: "delivery", address: "San Rafael, Av. San Martín 1234" }),
      business: BUSINESS,
    });

    expect(message).toBe(
      [
        "¡Hola! Quiero hacer un pedido en *Mi Negocio*:",
        "",
        "• 2 x Classic Jamón y Queso — $2.900",
        "• 1 x Bebida Coca 500ml — $800",
        "",
        "*Total: $3.700*",
        "",
        "*Mis datos:*",
        "Nombre: Juan Pérez",
        "Teléfono: 5492615551234",
        "Entrega en: San Rafael, Av. San Martín 1234",
        "",
        "¡Gracias!",
      ].join("\n"),
    );
  });

  it("debe escribir Retiro en el local y omitir la dirección cuando es retiro", () => {
    const message = buildWhatsAppMessage({ items: [line()], customer: customer(), business: BUSINESS });

    expect(message).toContain("Retiro en el local");
    expect(message).not.toContain("Entrega en:");
  });

  it("debe conservar los acentos sin romper el mensaje", () => {
    const message = buildWhatsAppMessage({
      items: [line({ name: "Ñoqui de queso gratinado" })],
      customer: customer(),
      business: BUSINESS,
    });

    expect(message).toContain("Ñoqui de queso gratinado");
    expect(message).not.toContain("\\u00f1");
  });

  it("debe sacar el asterisco del texto del cliente para no romper las negritas", () => {
    const message = buildWhatsAppMessage({
      items: [line({ name: "Miga *Premium*" })],
      customer: customer({ notes: "sin *mayonesa*" }),
      business: BUSINESS,
    });

    expect(message).toContain("Miga Premium");
    expect(message).toContain("Comentarios: sin mayonesa");
  });

  it("debe borrar los caracteres de control y las marcas bidireccionales", () => {
    const message = buildWhatsAppMessage({
      items: [line({ name: "Miga\u0000Premium\u202e" })],
      customer: customer({ fullName: "Juan\u0000 Pérez" }),
      business: BUSINESS,
    });

    expect(message).not.toContain("\u0000");
    expect(message).not.toContain("\u202e");
  });

  it("debe lanzar ValidationError con un carrito vacío, sin devolver un string vacío", () => {
    expect(() => buildWhatsAppMessage({ items: [], customer: customer(), business: BUSINESS })).toThrow(
      ValidationError,
    );
  });

  it("debe sumar el total con roundCurrency, sin residuo de punto flotante", () => {
    const order = buildWhatsAppOrder({
      items: [
        line({ productId: "a", unitPrice: 0.1, quantity: 1 }),
        line({ productId: "b", unitPrice: 0.1, quantity: 1 }),
        line({ productId: "c", unitPrice: 0.1, quantity: 1 }),
      ],
      customer: customer(),
      business: BUSINESS,
    });

    // Sin `roundCurrency`, la suma da 0.30000000000000004.
    expect(order.total).toBe(0.3);
    expect(order.text).toContain("*Total: $0,30*");
  });

  it("debe recortar las notas primero y decirlo en el mensaje", () => {
    const order = buildWhatsAppOrder({
      items: [line()],
      customer: customer({ notes: "a".repeat(MAX_MESSAGE_LENGTH) }),
      business: BUSINESS,
    });

    expect(order.isTruncated).toBe(true);
    expect(order.hasNotes).toBe(false);
    expect(order.text).toContain("no entran en el mensaje");
  });

  it("debe avisar que el total es parcial cuando descarta ítems", () => {
    const order = buildWhatsAppOrder({
      items: Array.from({ length: 30 }, (_, index) =>
        line({
          productId: `p${index}`,
          name: `Sándwich de jamón y queso con tomate y palta ${index}`,
          unitPrice: 1000,
          quantity: 1,
        }),
      ),
      customer: customer(),
      business: BUSINESS,
    });

    expect(order.isTruncated).toBe(true);
    expect(order.omittedItemCount).toBeGreaterThan(0);
    expect(order.text).toContain("el total es parcial");
  });

  it("debe recortar solo el nombre del producto y jamás un precio", () => {
    const order = buildWhatsAppOrder({
      items: [line({ name: "Sándwich ".repeat(300), unitPrice: 1450, quantity: 1 })],
      customer: customer(),
      business: BUSINESS,
    });

    expect(order.text).toContain("Sándwich Sándwich Sándwich Sándwich Sándwich Sándwich Sándw…");
    expect(order.text).toContain("— $1.450");
    // El nombre recortado necesita su propio aviso: acá no se descartó ningún
    // ítem, así que el aviso NO puede ser el del "total parcial", que se
    // reserva para los ítems que quedaron afuera.
    expect(order.omittedItemCount).toBe(0);
    expect(order.text).toContain("va recortado");
    expect(order.text).not.toContain("el total es parcial");
    expect(order.text.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
  });

  it("debe quitar las notas del mensaje cuando avisa que no entran", () => {
    const notas = "Sin mayonesa, sin cebolla, con la salsa aparte. ".repeat(40);
    const order = buildWhatsAppOrder({
      items: Array.from({ length: 8 }, (_, index) =>
        line({ productId: `p${index}`, name: `Sándwich ${index}`, unitPrice: 1000, quantity: 1 }),
      ),
      customer: customer({ notes: notas }),
      business: BUSINESS,
    });

    expect(order.isTruncated).toBe(true);
    expect(order.hasNotes).toBe(false);
    expect(order.text).toContain("no entran en el mensaje");
    // ⛔ El aviso y el texto de las notas no pueden estar los dos: el aviso
    // sería falso.
    expect(order.text).not.toContain("sin la salsa aparte");
  });

  it("debe dejar intacto un nombre largo que entra sin recorte", () => {
    const name = "Sándwich ".repeat(40);

    const order = buildWhatsAppOrder({
      items: [line({ name, unitPrice: 1450, quantity: 1 })],
      customer: customer(),
      business: BUSINESS,
    });

    expect(order.isTruncated).toBe(false);
    expect(order.text).toContain(name);
  });

  it("debe no truncar un mensaje que entra justo en el límite", () => {
    // Se arma un pedido y se mide: el caso del borde se prueba con el valor
    // real del renderer, no con un número inventado.
    const base = buildWhatsAppMessage({ items: [line()], customer: customer(), business: BUSINESS });
    const relleno = "x".repeat(MAX_MESSAGE_LENGTH - base.length);

    const justo = buildWhatsAppOrder({
      items: [line({ name: `Classic Jamón y Queso ${relleno}` })],
      customer: customer(),
      business: BUSINESS,
    });

    expect(justo.text.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    expect(justo.isTruncated).toBe(false);
  });

  it("debe informar hasNotes en false con la variante detailed aunque el cliente mande notas", () => {
    // `detailed` no tiene línea de comentarios: informar `true` sería una
    // mentira sobre lo que se mandó.
    const order = buildWhatsAppOrder({
      items: [line()],
      customer: customer({ notes: "sin mayonesa" }),
      business: BUSINESS,
      variant: "detailed",
    });

    expect(order.hasNotes).toBe(false);
    expect(order.text).not.toContain("sin mayonesa");
  });

  it("debe sostener treinta líneas sin desbordar el límite", () => {
    const order = buildWhatsAppOrder({
      items: Array.from({ length: 30 }, (_, index) =>
        line({ productId: `p${index}`, name: `Sándwich de la casa ${index}`, unitPrice: 2500, quantity: 1 }),
      ),
      customer: customer(),
      business: BUSINESS,
    });

    expect(order.text.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    expect(order.total).toBe(75000);
  });

  it("debe rechazar una cantidad fuera de rango", () => {
    expect(() =>
      buildWhatsAppMessage({ items: [line({ quantity: 0 })], customer: customer(), business: BUSINESS }),
    ).toThrow(ValidationError);
  });

  it("debe usar la variante que le piden, no la de default", () => {
    const minimal = buildWhatsAppMessage({
      items: [line()], customer: customer(), business: BUSINESS, variant: "minimal",
    });
    const detailed = buildWhatsAppMessage({
      items: [line()], customer: customer(), business: BUSINESS, variant: "detailed",
    });

    expect(minimal).not.toContain("¡Gracias!");
    expect(minimal).not.toContain("$1.450");
    expect(detailed).toContain("¡Gracias!");
  });
});
```

```ts
// tests/unit/whatsapp/whatsapp-url.service.test.ts
import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl } from "@/lib/whatsapp/whatsapp-url.service";
import { ValidationError } from "@/lib/domain";

/** `encodeURIComponent` deja pasar exactamente estos caracteres sin escapar. */
const QUERY_ALLOWED = /^[A-Za-z0-9\-_.!~*'()%]*$/;

describe("buildWhatsAppUrl", () => {
  it("debe armar la URL con el teléfono en E.164 y el mensaje codificado", () => {
    const url = buildWhatsAppUrl("5492615551234", "Hola");

    expect(url).toBe("https://wa.me/5492615551234?text=Hola");
  });

  it("debe enviar los saltos de línea como %0A", () => {
    const url = buildWhatsAppUrl("5492615551234", "uno\ndos");

    expect(url).toContain("uno%0Ados");
    expect(url).not.toContain("%0D");
  });

  it("debe escapar el ampersand y la almohadilla de la dirección", () => {
    const url = buildWhatsAppUrl("5492615551234", "Entrega en: Av. Sur 123 & Norte #4");

    expect(url).toContain("%26");
    expect(url).toContain("%23");
    expect(url.split("?text=")[1]).not.toContain("&");
  });

  it("debe no tener espacios crudos ni caracteres fuera del set permitido", () => {
    const url = buildWhatsAppUrl("+54 9 261 555-1234", "¡Hola! Total: $3.700 — año 2026\n");

    expect(url).not.toContain(" ");
    expect(url.slice(url.indexOf("?text=") + 6)).toMatch(QUERY_ALLOWED);
  });

  it("debe codificar el signo de porcentaje una sola vez", () => {
    const url = buildWhatsAppUrl("5492615551234", "descuento 10% — ¡gracias!");

    expect(url).toContain("10%25");
    expect(url).not.toContain("%2525");
  });

  it("debe normalizar el teléfono antes de armar la URL", () => {
    expect(buildWhatsAppUrl("+54 9 261 555-1234", "Hola")).toContain("/5492615551234?");
    expect(buildWhatsAppUrl("0261 555 1234", "Hola")).toContain("/5492615551234?");
  });

  it("debe lanzar ValidationError con un teléfono que no es válido", () => {
    expect(() => buildWhatsAppUrl("261555", "Hola")).toThrow(ValidationError);
  });

  it("debe lanzar ValidationError con un mensaje vacío", () => {
    expect(() => buildWhatsAppUrl("5492615551234", "")).toThrow(ValidationError);
  });
});
```

```ts
// tests/unit/format/phone.test.ts
import { describe, expect, it } from "vitest";
import {
  formatArgentinePhoneForDisplay,
  isE164Phone,
  normalizeArgentinePhone,
  sanitizePhoneDigits,
} from "@/lib/format/phone";
import { ValidationError } from "@/lib/domain";

describe("normalizeArgentinePhone", () => {
  it("debe normalizar un número local de diez dígitos agregando el 9 móvil", () => {
    expect(normalizeArgentinePhone("2615551234")).toBe("5492615551234");
  });

  it("debe normalizar el formato internacional con espacios, guiones y el 9 móvil", () => {
    expect(normalizeArgentinePhone("+54 9 261 555-1234")).toBe("5492615551234");
  });

  it("debe reemplazar el cero de la forma 0261 por el prefijo 54", () => {
    expect(normalizeArgentinePhone("0261 555 1234")).toBe("5492615551234");
  });

  it("debe agregar el 9 móvil a un 54 261 que no lo tiene", () => {
    expect(normalizeArgentinePhone("54 261 555 1234")).toBe("5492615551234");
  });

  it("debe dejar intacto un número que ya está en E.164", () => {
    expect(normalizeArgentinePhone("5492615551234")).toBe("5492615551234");
  });

  it("debe sacar el prefijo internacional 00", () => {
    expect(normalizeArgentinePhone("0054 9 261 555-1234")).toBe("5492615551234");
  });

  it("debe sacar el cero de un 540261 escrito como teléfono fijo", () => {
    expect(normalizeArgentinePhone("540261 555 1234")).toBe("5492615551234");
  });

  it("debe rechazar un teléfono vacío", () => {
    expect(() => normalizeArgentinePhone("")).toThrow(ValidationError);
  });

  it("debe rechazar un teléfono con letras cuando no queda nada válido", () => {
    expect(() => normalizeArgentinePhone("no tengo teléfono")).toThrow(ValidationError);
  });

  it("debe rechazar la notación heredada ambigua con el 15", () => {
    expect(() => normalizeArgentinePhone("54 261 15 555-1234")).toThrow(ValidationError);
  });

  it("debe rechazar una cadena absurdamente larga", () => {
    expect(() => normalizeArgentinePhone("5492615551234".repeat(5))).toThrow(ValidationError);
  });

  it("debe reportar el error con la clave phone para que el formulario lo muestre", () => {
    expect.assertions(2);
    try {
      normalizeArgentinePhone("");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(Object.keys(error.fieldErrors)).toContain("phone");
      }
    }
  });
});

describe("sanitizePhoneDigits", () => {
  it("debe dejar solo los dígitos", () => {
    expect(sanitizePhoneDigits("+54 (261) 555-1234")).toBe("542615551234");
  });

  it("debe devolver cadena vacía si no hay dígitos", () => {
    expect(sanitizePhoneDigits("abc")).toBe("");
  });
});

describe("formatArgentinePhoneForDisplay", () => {
  it("debe mostrar el teléfono en el formato que usa WhatsApp", () => {
    expect(formatArgentinePhoneForDisplay("5492615551234")).toBe("+54 9 261 555-1234");
  });
});
```

> En `phone.test.ts` el `catch` se estrecha con `instanceof`, sin `as`: el `catch` de TypeScript es `unknown` y leer `fieldErrors` sobre `unknown` no compila. `expect.assertions(2)` hace que el test falle si la función no tira, en vez de pasar en silencio.

---

## 11. Definición de "Hecho" (Definition of Done)

- [ ] Todos los criterios de §8 marcados
- [ ] `npm run verify` + `npm run build` en verde
- [ ] Los 3 archivos de test pasan: 18 casos en el del mensaje, 8 en el de la URL y 14 en el del teléfono
- [ ] `rg 'normalizeArgentinePhone' src/` devuelve **una sola** implementación
- [ ] `rg 'server-only' src/lib/whatsapp/ src/lib/format/phone.ts` → cero resultados
- [ ] `docs/tasks/README.md` actualizado
- [ ] Commit: `feat(12): mensaje de WhatsApp como función pura con suite de encoding y truncado`
- [ ] PR mergeada a `main`
- [ ] **Prueba manual en un teléfono real**: copiar una URL de la suite, pegarla en el navegador del teléfono y confirmar que el mensaje llega con los saltos de línea, las negritas y los acentos correctos

> **Antes de mergear:** mandar el mensaje de la Variante C al WhatsApp real del local desde un teléfono real (requisito de salida de `DESIGN.md` §8.5 y riesgo R2). Los tests verifican el string; solo el dispositivo verifica el render.

---

## 12. Dependencias y bloqueos

**Habilita:** 13 (el checkout arma el mensaje y el link), y en cascada 18, 20.

**Decisiones que esta tarea deja establecidas:**

1. `buildWhatsAppMessage` es una **función pura de Capa 0** sin `import "server-only"`: corre en el navegador y se testea sin mocks.
2. `src/lib/format/phone.ts` es la **única** implementación de `normalizeArgentinePhone` en el proyecto. La Tarea 08 la importa, no la reimplementa.
3. El teléfono se normaliza a E.164 **sin `+`**, con prefijo `54` y `9` móvil agregado, y sin validar el código de área.
4. El formato del mensaje es un **parámetro con default** (`MessageVariant`), con las tres variantes de la Tarea 00 §6.3. Cambiar `DEFAULT_MESSAGE_VARIANT` cambia producción sin tocar lógica.
5. Las negritas de WhatsApp se escriben `*texto*`, **nunca** `**texto**`. WhatsApp interpreta un asterisco a cada lado y dos no producen negrita: muestran dos asteriscos literales.
6. El `*` se elimina de todo texto que venga del cliente, del producto o de la variante. El nombre del negocio es la única excepción, porque lo edita el encargado.
7. `encodeURIComponent` es obligatorio y los saltos de línea viajan como `%0A`. `LINE_BREAK_MODE = "crlf"` existe como ajuste documentado, no como defecto.
8. El límite de 1800 caracteres es de **legibilidad**, no de plataforma. El orden de recorte es: notas, después ítems del más barato al más caro. Se avisa siempre en el mensaje qué se recortó.
9. **Nunca** se trunca un precio ni la mitad de un nombre sin puntos suspensivos. El nombre es el único campo cortable, y solo como último recurso.
10. Los totales se arman con `roundCurrency` en la línea, no sobre la suma acumulada.
11. Un carrito vacío lanza `ValidationError`. Se descartó devolver un string de error: terminaría dentro de una URL `wa.me` y el local recibiría un mensaje sin sentido.
12. `whatsapp-message.service.ts` devuelve metadata (`isTruncated`, `omittedItemCount`, `hasNotes`, `total`) mediante `buildWhatsAppOrder`; `buildWhatsAppMessage` es el caso común que devuelve `string`.
13. **El pedido no existe fuera del chat.** Esta tarea no agrega persistencia, tabla `Order` ni endpoint de pedidos (ADR-4).

**Cómo se ajusta el formato en producción (primera semana, Tarea 22):**

1. Cambiar `DEFAULT_MESSAGE_VARIANT` en `src/lib/whatsapp/message-contract.ts` y mergear. Es un commit de una línea.
2. Si hace falta una variante nueva, agregarla a `MessageVariant` y a `RENDERERS` en `message-variants.ts`, más su bloque en `MESSAGE_VARIANT_LABELS`. Ningún otro archivo cambia.
3. Si el local no quiere la Variante C, se pone `"detailed"`. Si quiere solo cantidad y nombre, `"minimal"`.

> **Lo que esta tarea NO hace, a propósito:** no integra la API de WhatsApp Business Platform, no guarda pedidos, no manda mensajes, no abre WhatsApp por sí misma. Solo produce dos strings. La Tarea 13 decide cuándo y cómo se usan.
