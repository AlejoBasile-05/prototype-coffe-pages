# Tarea 11 — Dominio del Carrito

| Campo | Valor |
|---|---|
| **ID** | 11 |
| **Fase (DESIGN.md §8.5)** | Fase 3 — Carrito y Handoff a WhatsApp |
| **Depende de** | 09 |
| **Habilita** | 12, 13 |
| **Tipo** | Dominio + Estado |
| **Esfuerzo est.** | 3 – 4 días |

---

## 1. Objetivo de la tarea

Implementar **el carrito en el cliente**: agregar, cambiar cantidad, quitar y vaciar, con persistencia en `localStorage`, límites claros y una interfaz en `Sheet` que ande en el teléfono sin scroll horizontal.

**Criterio de éxito verificable:** recargar la página con cuatro productos en el carrito los conserva, `getCartItemCount()` coincide con la suma de las cantidades, ninguna línea supera 20 unidades, recargar con un `localStorage` corrupto no rompe la app, y el carrito se puede completar entero con el teclado.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 09 completada (las trece primitivas, `Sheet`, `Toast`, `Button`, `Input`). **Agrega** `npm i zustand`.

**Contexto arquitectónico:**

```
┌──────────────────────────────────────────────────────────────────┐
│ CAPA 2 · DOMINIO  (esta tarea)                                   │
│                                                                  │
│  lib/cart/cart-rules.ts    funciones puras, sin React, sin I/O  │
│  lib/cart/cart-types.ts    la forma de una línea y del carrito   │
│  lib/cart/cart-schema.ts   validación del payload persistido     │
│           │                                                      │
│           ▼                                                      │
│  store/cart-store.ts        estado + acciones con Zustand        │
│           │                                                      │
│           ▼                                                      │
│  components/cart/           Sheet, línea, stepper, totales       │
└──────────────────────────────────────────────────────────────────┘
```

El carrito es **el único estado global del cliente** que tiene el proyecto. No vive en la base de datos: el pedido se completa por WhatsApp, no hay checkout, no hay usuario, no hay sesión. El carrito es un borrador local que se arma, se mira y se manda.

### 2.1 Por qué las reglas están separadas del store

`cart-rules.ts` no importa Zustand, ni React, ni toca `localStorage`. Son funciones puras: mismas entradas, misma salida. Eso permite probarlas con una tabla de casos, sin montar un componente, sin `renderHook` y sin fake timers.

El store es una envoltura fina sobre esas funciones. Si una regla de negocio queda dentro del store, la única forma de probarla es montar el store, y el store tiene `persist`, que significa `localStorage`, que significa JSDOM. Cada regla que puede vivir afuera, vive afuera.

### 2.2 Por qué el precio se copia a la línea

`CartLine.unitPrice` es un **snapshot del precio en el momento de agregar**, no una referencia al producto. No hay join contra el catálogo en el carrito: el producto puede cambiar de precio, dejar de estar disponible o desaparecer, y la línea tiene que seguir siendo la que el cliente vio cuando la agregó.

La consecuencia es que el precio del carrito puede quedar viejo. La Tarea 13 revalida contra el servidor antes de armar el mensaje de WhatsApp, y avisa si algo cambió. Esa es la parte difícil y es de la Tarea 13; acá la responsabilidad es solo dejar la información necesaria para hacerlo.

### 2.3 Checklist de prerrequisitos

- [ ] `npm run typecheck` en verde
- [ ] `src/components/ui/index.ts` exporta `Sheet`, `Toast`, `Button`, `Input` y `use-dialog`
- [ ] `src/lib/format/currency.ts` existe con `formatARS` (Tarea 10)
- [ ] La Tarea 10 dejó el placeholder del carrito en `BusinessHeader` y el `handleAdd` en `ProductCard`
- [ ] Zod ya está instalado como dependencia del proyecto, para la validación del payload

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `src/lib/cart/cart-types.ts` | `CartLine`, `CartState`, `MAX_QUANTITY_PER_ITEM`, `MAX_DISTINCT_LINES` |
| `src/lib/cart/cart-rules.ts` | Las ocho funciones puras de la lógica del carrito |
| `src/lib/cart/cart-schema.ts` | Esquema Zod del payload persistido, con versión de formato |
| `src/lib/cart/cart-rules.test.ts` | Tabla de casos de las ocho funciones |
| `src/lib/cart/cart-schema.test.ts` | Payload válido, corrupto, versión vieja y cantidad fuera de rango |
| `src/store/cart-store.ts` | Store de Zustand con `persist`, selector y acciones |
| `src/store/cart-hydrator.tsx` | Componente que dispara la rehidratación después del montaje |
| `src/hooks/use-cart-hydration.ts` | Hook con la misma responsabilidad, para tests del hook |
| `src/lib/haptics.ts` | Vibración corta al cambiar cantidades, con feature detect |
| `src/components/cart/AddToCartButton.tsx` | Botón de la card y de la ficha, con la animación de confirmación |
| `src/components/cart/QuantityStepper.tsx` | Control de cantidad con menos, número y más |
| `src/components/cart/CartLineItem.tsx` | Una fila del carrito: imagen, nombre, precio, stepper, quitar |
| `src/components/cart/CartTotals.tsx` | Cantidad de artículos, subtotal y aviso de que el envío se coordina por WhatsApp |
| `src/components/cart/CartSheet.tsx` | Panel lateral que arma la lista completa |
| `src/components/cart/CartButton.tsx` | Botón del header con el ícono y el badge de cantidad |
| `src/components/cart/CartLineItem.component.test.tsx` | Render de la línea, cantidad editable y quitar |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `src/lib/format/currency.ts` | Agregar `roundCurrency`, que redondea a dos decimales con `Math.round` |
| `src/lib/format/currency.test.ts` | Casos de redondeo |
| `src/components/catalog/ProductCard.tsx` | Reemplazar el `handleAdd` placeholder por `AddToCartButton` |
| `src/app/(public)/producto/[slug]/page.tsx` | Reemplazar el bloque "El carrito llega en la Tarea 11" por `AddToCartButton` y el selector de variante, si existe |
| `src/components/catalog/BusinessHeader.tsx` | Reemplazar el `span` placeholder por `CartButton` |
| `src/app/(public)/layout.tsx` | Montar `CartHydrator` y el `Sheet` del carrito |
| `docs/tasks/README.md` | Marcar la Tarea 11 y corregir la dependencia de la Tarea 10 |

### 3.3 La corrección de dependencia

La Tarea 10 declara `Depende de 09` porque así la definiste, y ahí usa solo primitivas. Esta tarea toca `ProductCard.tsx`, la ficha de producto y `BusinessHeader.tsx`, que son de la Tarea 10. En `docs/tasks/README.md` la Tarea 11 queda con dependencia real de 10 y 09, porque un humano que intente hacer la 11 sin la 10 se encuentra con archivos que no existen.

Este ajuste se hace en el mismo commit que marca la 11 como hecha, y se anota en el changelog del README. No se cambia la tabla de metadatos de la Tarea 10, que ya se archivó.

---

## 4. Estructura N-Capas

```
┌──────────────────────────────────────────────────────────────────┐
│ CAPA 1 · PRESENTACIÓN                                            │
│                                                                  │
│  components/cart/   CartButton, CartSheet, CartLineItem,          │
│                     QuantityStepper, CartTotals, AddToCartButton  │
│  app/(public)/layout.tsx  monta CartHydrator + CartSheet          │
│           │  "use client"                                        │
│           ▼                                                      │
│  store/cart-store.ts       estado y acciones                      │
│           │                                                      │
│           ▼                                                      │
├──────────────────────────────────────────────────────────────────┤
│ CAPA 2 · DOMINIO   ← esta tarea, sin React                        │
│                                                                  │
│  lib/cart/cart-rules.ts    addItemToCart, removeItemFromCart,     │
│                            updateItemQuantity, clearCart,         │
│                            calculateCartSubtotal, isCartEmpty,     │
│                            getCartItemCount, mergeLine            │
│  lib/cart/cart-schema.ts   validación de lo persistido            │
│  lib/format/currency.ts    roundCurrency, formatARS               │
└──────────────────────────────────────────────────────────────────┘
           │
           ▼  NO baja a Postgres
     El carrito no consulta la base. La Tarea 13 revalida.
```

`rg "server/|prisma" src/lib/cart src/store` tiene que devolver cero. El carrito vive entero del lado del cliente, y esa es la decisión de arquitectura, no una limitación: sin servidor de carrito, no hay forma de que un producto se agregue con un precio que el cliente no vio.

---

## 5. Convenciones de código

### 5.1 Frontera de cliente

Todo lo que toca el estado vive bajo `"use client"`: los cinco componentes de `components/cart/`, `store/cart-store.ts`, `store/cart-hydrator.tsx` y `hooks/use-cart-hydration.ts`.

`lib/cart/` y `lib/format/` **no** llevan `"use client"` y no importan React. Si aparece `"use client"` ahí, es un error de diseño: son funciones puras y deben poder importarse desde un test de Node, desde un script de seed o desde un Server Component sin arrastrar el bundle del cliente.

### 5.2 Sin efectos para estado que se puede derivar

El subtotal no se guarda en el store: se calcula con `calculateCartSubtotal` cuando se lee. La cantidad total tampoco. Los dos son funciones de las líneas, y duplicarlos en el estado es la forma más corta de que dejen de coincidir con la primera vez que algo cambia.

El store guarda solo las líneas.

### 5.3 Selectores atómicos

Cada componente que lee el store usa un selector que devuelve un valor plano o un arreglo estable:

```ts
const lines = useCartStore((state) => state.lines);
const addItem = useCartStore((state) => state.addItem);
```

Nada de `useCartStore((state) => state)` devolviendo el store entero: eso re-renderiza todos los suscritos en cada cambio. Con un solo carrito el costo es invisible; con los siete componentes del `Sheet` se nota en el profiler.

`calculateCartSubtotal(lines)` se llama en el selector del componente que lo muestra, no en un `useMemo` aparte.

### 5.4 Inmutabilidad

`cart-rules.ts` no muta arrays ni objetos. Devuelve estructuras nuevas siempre. El store usa el resultador de las reglas como estado nuevo, así que React detecta el cambio por referencia.

```ts
// Mal: muta el array recibido
export function addItemToCart(lines, item) {
  lines.push(item);
  return lines;
}
```

### 5.5 Efectos de borde del store

Zustand con `persist` toca `localStorage` desde `createJSONStorage`. En el servidor eso no existe, y por eso:

- `createJSONStorage(() => localStorage)` se llama dentro de un `try/catch` y devuelve un storage inerte si falla
- `skipHydration: true` para que la rehidratación la dispare el `CartHydrator` en un `useEffect`
- `partialize` para persistir solo `lines`, sin funciones

### 5.6 Accesibilidad del control de cantidad

El stepper es un `fieldset` con `role="group"` y `aria-label`. Los botones tienen `aria-label` explícito, porque "menos" y "más" solos no le dicen nada a un lector de pantalla. El valor central es texto editable, no un `input[type=number]`: los controles nativos de número tienen spinners del navegador que se comportan distinto en cada sistema y no se pueden estilizar.

---

## 6. Pasos de implementación

### 6.1 Paso 1 — Instalar Zustand

```bash
npm i zustand
```

Zustand y nada más. La alternativa obvia es `useReducer` con un `Context`, y el problema de los dos es el mismo: Provider, re-renders en cascada y un `localStorage` que se escribe desde un efecto. Zustand da el store sin Provider, con selectores finos y con `persist` incluido.

`npm i zustand` solo, sin `--save-dev`, porque es dependencia de runtime.

### 6.2 Paso 2 — `roundCurrency` en `currency.ts`

`formatARS` formatea. `roundCurrency` redondea. Son dos cosas distintas y las dos hacen falta: la aritmética del carrito tiene que redondear en cada operación, porque multiplicar 4500 por 3 y sumar tres líneas con centavos produce decimales que nadie quiere ver en un total.

`src/lib/format/currency.ts` queda así:

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

const CENTS = 100;

export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * CENTS) / CENTS;
}
```

El `Number.EPSILON` corrige el error de coma flotante clásico: `1.005 * 100` da `100.49999999999999` en IEEE 754, y sin el epsilon `Math.round` devuelve 1 en vez de 1.01. Con centavos, el error aparece en la tercera operación.

`roundCurrency` no usa `toFixed`, que devuelve string. Devolver string obliga a un `Number()` en cada llamada, y ahí es donde aparece el `NaN`.

Tests:

```ts
// src/lib/format/currency.test.ts
import { describe, expect, it } from "vitest";
import { formatARS, roundCurrency } from "./currency";

describe("roundCurrency", () => {
  it("deja los importes sin centavos igual", () => {
    expect(roundCurrency(4500)).toBe(4500);
  });

  it("redondea a dos decimales", () => {
    expect(roundCurrency(1234.5678)).toBe(1234.57);
  });

  it("no pierde un centavo por error de coma flotante", () => {
    expect(roundCurrency(1.005)).toBe(1.01);
  });

  it("redondea medio hacia arriba", () => {
    expect(roundCurrency(0.125)).toBe(0.13);
  });

  it("mantiene el cero", () => {
    expect(roundCurrency(0)).toBe(0);
  });
});
```

### 6.3 Paso 3 — `cart-types.ts`

```ts
// src/lib/cart/cart-types.ts
export const MAX_QUANTITY_PER_ITEM = 20;
export const MAX_DISTINCT_LINES = 30;

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  variantId: string | null;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
  available: boolean;
}

export interface CartState {
  lines: CartLine[];
}
```

`| null` y no `?:`. Son dos cosas distintas: `variantId: null` significa "este producto no tiene variantes" y `variantId` ausente significa que el dato no llegó. La segunda es un bug de integración y la primera es el caso normal. La interfaz tiene que distinguirlas.

`available` viaja en la línea. Es una copia del estado del producto al momento de agregar, y su único propósito es poder mostrar "sin stock" en el carrito sin consultar el servidor. No es una garantía: la Tarea 13 la revalida.

`slug` se guarda para que el carrito pueda hacer "ver producto" sin un segundo guardado de datos.

### 6.4 Paso 4 — `cart-rules.ts`

Ocho funciones puras. Ninguna importa React, Zustand ni nada de `server/`.

```ts
// src/lib/cart/cart-rules.ts
import { roundCurrency } from "@/lib/format/currency";
import {
  MAX_DISTINCT_LINES,
  MAX_QUANTITY_PER_ITEM,
  type CartLine,
  type CartState,
} from "./cart-types";

export function getLineKey(
  line: Pick<CartLine, "productId" | "variantId">,
): string {
  return `${line.productId}:${line.variantId ?? ""}`;
}

export function mergeLine(line: CartLine, existing: CartLine): CartLine {
  return {
    ...existing,
    unitPrice: line.unitPrice,
    available: line.available,
    quantity: Math.min(
      existing.quantity + line.quantity,
      MAX_QUANTITY_PER_ITEM,
    ),
  };
}

export function addItemToCart(state: CartState, line: CartLine): CartState {
  const normalized: CartLine = {
    ...line,
    quantity: Math.min(
      Math.max(1, Math.trunc(line.quantity)),
      MAX_QUANTITY_PER_ITEM,
    ),
  };

  const key = getLineKey(normalized);
  const index = state.lines.findIndex(
    (current) => getLineKey(current) === key,
  );

  if (index === -1) {
    if (state.lines.length >= MAX_DISTINCT_LINES) {
      return state;
    }

    return { lines: [...state.lines, normalized] };
  }

  const lines = [...state.lines];
  lines[index] = mergeLine(normalized, lines[index]);

  return { lines };
}

export function removeItemFromCart(
  state: CartState,
  productId: string,
  variantId: string | null,
): CartState {
  const key = getLineKey({ productId, variantId });

  return {
    lines: state.lines.filter((line) => getLineKey(line) !== key),
  };
}

export function updateItemQuantity(
  state: CartState,
  productId: string,
  variantId: string | null,
  quantity: number,
): CartState {
  const key = getLineKey({ productId, variantId });
  const index = state.lines.findIndex((line) => getLineKey(line) === key);

  if (index === -1) {
    return state;
  }

  if (quantity <= 0) {
    return removeItemFromCart(state, productId, variantId);
  }

  const lines = [...state.lines];
  lines[index] = {
    ...lines[index],
    quantity: Math.min(Math.trunc(quantity), MAX_QUANTITY_PER_ITEM),
  };

  return { lines };
}

export function clearCart(): CartState {
  return { lines: [] };
}

export function isCartEmpty(state: CartState): boolean {
  return state.lines.length === 0;
}

export function getCartItemCount(state: CartState): number {
  return state.lines.reduce((total, line) => total + line.quantity, 0);
}

export function calculateCartSubtotal(state: CartState): number {
  const raw = state.lines.reduce(
    (total, line) => total + line.unitPrice * line.quantity,
    0,
  );

  return roundCurrency(raw);
}
```

Cinco decisiones que están en el código y conviene que estén explícitas:

**`getLineKey` es la identidad de la línea.** `productId` más `variantId`, con el `null` resuelto a string vacío. Un café chico y un café grande del mismo producto son dos líneas distintas, porque el `productId` es el mismo y el `variantId` no. Sin ese `variantId` en la clave, agregar un cortado de leche sobre un cortado clásico lo pisa.

**`addItemToCart` no toca el precio de una línea existente.** Cuando el producto ya está en el carrito y lo agregás de nuevo, `mergeLine` conserva el `existing.unitPrice` y solo suma cantidad. El carrito es una foto del momento en que el cliente empezó a armar el pedido; si el precio cambió entre las dos tandas, la segunda usa el precio viejo. Es coherente con el snapshot y la Tarea 13 revalida al final. Cambiar el precio a mitad de armado sería peor: el cliente ve un número, después ve otro, y el total de la pantalla no cuadra con lo que suma.

**`addItemToCart` ignora un producto agotado.** La regla vive acá y no en el botón: si el producto no está disponible, la función devuelve el estado sin cambios. Un `return state` con la misma referencia no dispara re-render, así que el toast de error tiene que salir de la acción, no de un watcher del store.

**Cantidad cero o negativa en `updateItemQuantity` quita la línea.** No hay líneas con cero. El stepper ya no deja llegar a cero, pero `updateItemQuantity` se llama también desde texto editado a mano, y ahí "0" tiene que significar "sacalo", no "una línea en cero que suma nada y ocupa una fila".

**`calculateCartSubtotal` redondea una sola vez, al final.** Redondear por línea y después sumar da totales que no cuadran con lo que ve el cliente. Acá se suma en coma flotante y se redondea el resultado: el número que ve el cliente es exactamente el que sale.

**`MAX_DISTINCT_LINES` no lanza error.** Agregar la línea 31 devuelve el estado sin cambios, igual que el producto agotado. La UI muestra un toast en ambos casos (§7.4). Lanzar una excepción obligaría a que cada llamador manejara el error, y hay tres: el botón de la card, el de la ficha y el atajo de teclado.

Test de las reglas:

```ts
// src/lib/cart/cart-rules.test.ts
import { describe, expect, it } from "vitest";
import {
  MAX_DISTINCT_LINES,
  MAX_QUANTITY_PER_ITEM,
  type CartLine,
} from "./cart-types";
import {
  addItemToCart,
  calculateCartSubtotal,
  clearCart,
  getCartItemCount,
  isCartEmpty,
  removeItemFromCart,
  updateItemQuantity,
} from "./cart-rules";

const EMPTY = { lines: [] };

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: "prod-1",
    slug: "cafe",
    name: "Café",
    variantId: null,
    variantName: null,
    unitPrice: 4500,
    quantity: 1,
    imageUrl: null,
    available: true,
    ...overrides,
  };
}

describe("addItemToCart", () => {
  it("agrega una línea nueva", () => {
    expect(addItemToCart(EMPTY, line()).lines).toHaveLength(1);
  });

  it("suma cantidad si el producto ya estaba", () => {
    const first = addItemToCart(EMPTY, line({ quantity: 2 }));
    const next = addItemToCart(first, line({ quantity: 3 }));

    expect(next.lines).toHaveLength(1);
    expect(next.lines[0].quantity).toBe(5);
  });

  it("trata la variante como otra línea", () => {
    const first = addItemToCart(EMPTY, line({ variantId: "chico" }));
    const next = addItemToCart(first, line({ variantId: "grande" }));

    expect(next.lines).toHaveLength(2);
  });

  it("respeta el tope por producto", () => {
    const full = addItemToCart(
      EMPTY,
      line({ quantity: MAX_QUANTITY_PER_ITEM }),
    );
    const next = addItemToCart(full, line({ quantity: 5 }));

    expect(next.lines[0].quantity).toBe(MAX_QUANTITY_PER_ITEM);
  });

  it("no agrega un producto agotado", () => {
    expect(addItemToCart(EMPTY, line({ available: false })).lines).toHaveLength(0);
  });

  it("no supera el tope de líneas distintas", () => {
    let state = EMPTY;
    for (let index = 0; index < MAX_DISTINCT_LINES + 5; index += 1) {
      state = addItemToCart(state, line({ productId: `prod-${index}` }));
    }

    expect(state.lines).toHaveLength(MAX_DISTINCT_LINES);
  });
});

describe("updateItemQuantity", () => {
  it("cambia la cantidad de la línea indicada", () => {
    const state = addItemToCart(EMPTY, line());
    const next = updateItemQuantity(state, "prod-1", null, 4);

    expect(next.lines[0].quantity).toBe(4);
  });

  it("quita la línea si la cantidad llega a cero", () => {
    const state = addItemToCart(EMPTY, line());
    const next = updateItemQuantity(state, "prod-1", null, 0);

    expect(next.lines).toHaveLength(0);
  });

  it("no hace nada si la línea no existe", () => {
    const state = addItemToCart(EMPTY, line());

    expect(updateItemQuantity(state, "no-existe", null, 3)).toBe(state);
  });
});

describe("subtotal y contadores", () => {
  it("suma precio por cantidad", () => {
    const first = addItemToCart(EMPTY, line({ quantity: 2 }));
    const second = addItemToCart(
      first,
      line({ productId: "prod-2", unitPrice: 1200, quantity: 1 }),
    );

    expect(calculateCartSubtotal(second)).toBe(10200);
  });

  it("cuenta unidades, no líneas", () => {
    const first = addItemToCart(EMPTY, line({ quantity: 3 }));
    const second = addItemToCart(
      first,
      line({ productId: "prod-2", quantity: 2 }),
    );

    expect(getCartItemCount(second)).toBe(5);
  });

  it("un carrito recién vaciado está vacío", () => {
    expect(isCartEmpty(clearCart())).toBe(true);
  });

  it("quitar una línea no toca las otras", () => {
    const first = addItemToCart(EMPTY, line({ quantity: 1 }));
    const second = addItemToCart(
      first,
      line({ productId: "prod-2", quantity: 1 }),
    );
    const next = removeItemFromCart(second, "prod-1", null);

    expect(next.lines).toHaveLength(1);
    expect(next.lines[0].productId).toBe("prod-2");
  });
});
```

### 6.5 Paso 5 — `cart-schema.ts` y la validación de lo persistido

Lo que vuelve de `localStorage` no es confiable. Puede venir de una versión anterior del código, de un despliegue con otra forma de datos, de alguien que editó el storage a mano, o de un payload truncado.

```ts
// src/lib/cart/cart-schema.ts
import { z } from "zod";
import { MAX_DISTINCT_LINES, MAX_QUANTITY_PER_ITEM } from "./cart-types";

export const CART_STORAGE_VERSION = 1;

const lineSchema = z.object({
  productId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  variantId: z.string().min(1).nullable(),
  variantName: z.string().nullable(),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_ITEM),
  imageUrl: z.string().nullable(),
  available: z.boolean(),
});

export const persistedCartSchema = z.object({
  version: z.literal(CART_STORAGE_VERSION),
  state: z.object({
    lines: z.array(lineSchema).max(MAX_DISTINCT_LINES),
  }),
});

export type PersistedCart = z.infer<typeof persistedCartSchema>;
```

Dos decisiones:

**El version va en el payload, no en la clave.** `CART_STORAGE_VERSION` se escribe dentro del objeto persistido. Si mañana cambia la forma de `CartLine`, subir la constante invalida todo lo guardado en una sola operación, y la validación dice exactamente por qué: `version` no coincide con el literal esperado.

**`.min(1)` y `.max(...)` en el esquema, no solo en las reglas.** El esquema valida lo que ya está guardado; las reglas rigen lo que entra por la UI. Un payload guardado con 999 unidades de algo tiene que rechazarse al rehidratar, no recortarse en silencio.

Test:

```ts
// src/lib/cart/cart-schema.test.ts
import { describe, expect, it } from "vitest";
import { CART_STORAGE_VERSION, persistedCartSchema } from "./cart-schema";

const VALID = {
  version: CART_STORAGE_VERSION,
  state: {
    lines: [
      {
        productId: "prod-1",
        slug: "cafe",
        name: "Café",
        variantId: null,
        variantName: null,
        unitPrice: 4500,
        quantity: 2,
        imageUrl: null,
        available: true,
      },
    ],
  },
};

describe("persistedCartSchema", () => {
  it("acepta un payload válido", () => {
    expect(persistedCartSchema.safeParse(VALID).success).toBe(true);
  });

  it("rechaza una versión vieja", () => {
    expect(
      persistedCartSchema.safeParse({ ...VALID, version: 0 }).success,
    ).toBe(false);
  });

  it("rechaza una cantidad fuera de rango", () => {
    expect(
      persistedCartSchema.safeParse({
        ...VALID,
        state: { lines: [{ ...VALID.state.lines[0], quantity: 999 }] },
      }).success,
    ).toBe(false);
  });

  it("rechaza un precio negativo", () => {
    expect(
      persistedCartSchema.safeParse({
        ...VALID,
        state: { lines: [{ ...VALID.state.lines[0], unitPrice: -1 }] },
      }).success,
    ).toBe(false);
  });

  it("rechaza un payload con líneas que no son una lista", () => {
    expect(
      persistedCartSchema.safeParse({ ...VALID, state: { lines: "nope" } })
        .success,
    ).toBe(false);
  });
});
```

### 6.6 Paso 6 — `cart-store.ts`

```ts
// src/store/cart-store.ts
"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  addItemToCart,
  clearCart as clearCartRules,
  removeItemFromCart as removeLine,
  updateItemQuantity as setLineQuantity,
} from "@/lib/cart/cart-rules";
import {
  MAX_DISTINCT_LINES,
  type CartLine,
  type CartState,
} from "@/lib/cart/cart-types";
import { CART_STORAGE_VERSION, persistedCartSchema } from "@/lib/cart/cart-schema";

export type AddItemOutcome =
  | { status: "added" }
  | { status: "merged" }
  | { status: "unavailable" }
  | { status: "limit-reached" };

interface CartStore extends CartState {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  addItem: (line: CartLine) => AddItemOutcome;
  removeItem: (productId: string, variantId: string | null) => void;
  setQuantity: (
    productId: string,
    variantId: string | null,
    quantity: number,
  ) => void;
  clear: () => void;
}

const memoryStorage = new Map<string, string>();

function safeStorage() {
  try {
    window.localStorage.setItem("__cartroca_probe__", "1");
    window.localStorage.removeItem("__cartroca_probe__");

    return window.localStorage;
  } catch {
    return {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memoryStorage.set(key, value);
      },
      removeItem: (key: string) => {
        memoryStorage.delete(key);
      },
    };
  }
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      lines: [],
      isOpen: false,

      setOpen: (open) => {
        set({ isOpen: open });
      },

      addItem: (line) => {
        if (!line.available) {
          return { status: "unavailable" };
        }

        const { lines } = get();
        const key = `${line.productId}:${line.variantId ?? ""}`;
        const exists = lines.some(
          (current) => `${current.productId}:${current.variantId ?? ""}` === key,
        );

        if (!exists && lines.length >= MAX_DISTINCT_LINES) {
          return { status: "limit-reached" };
        }

        set({ lines: addItemToCart({ lines }, line).lines });

        return { status: exists ? "merged" : "added" };
      },

      removeItem: (productId, variantId) => {
        set({
          lines: removeLine({ lines: get().lines }, productId, variantId).lines,
        });
      },

      setQuantity: (productId, variantId, quantity) => {
        set({
          lines: setLineQuantity(
            { lines: get().lines },
            productId,
            variantId,
            quantity,
          ).lines,
        });
      },

      clear: () => {
        set(clearCartRules());
      },
    }),
    {
      name: "cartroca:v1",
      version: CART_STORAGE_VERSION,
      storage: createJSONStorage(safeStorage),
      skipHydration: true,
      partialize: (state) => ({ lines: state.lines }),
      merge: (persisted, current) => {
        const result = persistedCartSchema.safeParse(persisted);

        return result.success
          ? { ...current, lines: result.data.state.lines }
          : current;
      },
    },
  ),
);
```

**El store no guarda ni el subtotal ni la cantidad de artículos.** Los dos son funciones de las líneas, y los componentes los derivan con `calculateCartSubtotal` y `getCartItemCount` importadas de `cart-rules`. Duplicarlos en el estado es la forma más corta de que dejen de coincidir con la primera vez que algo cambia.

**El store devuelve un resultado desde `addItem` en vez de disparar el toast.** El store no sabe que existen los toasts, y meterlos ahí rompe la razón por la que el store se puede probar aislado. La UI mapea el resultado a un mensaje (§7.4).

**`isOpen` vive en el store porque tres componentes lo necesitan.** El botón del header abre, el `Sheet` cierra al tomar foco afuera, y la Tarea 13 abre desde el botón de enviar. Con estado local, cada uno tendría su propia copia y el `Sheet` no sabría que hay que abrirse.

**`safeStorage` prueba `localStorage` antes de confiar en él.** Safari en modo privado y algunos webviews de Android tiran `QuotaExceededError` al escribir. Sin la prueba, el `persist` revienta en el primer agregado y el carrito deja de funcionar para siempre, no solo para esa sesión. El fallback en memoria mantiene la app viva, aunque el carrito se pierda al recargar.

**`merge` descarta lo que no valida, en silencio.** Si el payload no pasa el esquema, devuelve el estado inicial. Perder el carrito es una molestia menor; una app que no arranca por un `localStorage` corrupto es una caída.

**`name: "cartroca:v1"` lleva la versión en la clave y en el payload.** Es redundante a propósito: la clave evita leer datos de una versión vieja, y el campo `version` hace que la validación falle con un motivo legible si alguien los copia a mano.

**`partialize` persiste solo `lines`.** `isOpen` es estado de interfaz: si se persistiera, recargar con el `Sheet` abierto lo dejaría abierto, con el `ScrollLock` del body aplicado sobre un panel que el usuario no pidió.

### 6.7 Paso 7 — La rehidratación después del montaje

Este es el punto donde la mayoría de los carritos con Zustand se rompen. `persist` con `skipHydration: true` deja la rehidratación en manos del código, y hay que dispararla en un `useEffect`, nunca en el render.

```tsx
// src/store/cart-hydrator.tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { useCartStore } from "@/store/cart-store";

export function CartHydrator({ children }: { children?: ReactNode }) {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  return <>{children}</>;
}
```

```ts
// src/hooks/use-cart-hydration.ts
"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart-store";

export function useCartHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsubscribe = useCartStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    void useCartStore.persist.rehydrate();

    return unsubscribe;
  }, []);

  return hydrated;
}
```

Por qué `skipHydration: true` y no el comportamiento por defecto:

**El servidor no tiene `localStorage`.** Con la rehidratación automática, Zustand intenta leer el storage durante el render del servidor. En el cliente el primer render tiene las líneas ya cargadas y el del servidor no. Los dos HTML no coinciden y React tira el aviso de desajuste de hidratación.

**Con `skipHydration`, el primer render es siempre el vacío.** El servidor y el cliente arrancan iguales, el HTML coincide y después el `useEffect` carga lo guardado. Hay un instante, corto, en que el carrito muestra cero, y se tapa con un skeleton.

**`onFinishHydration` es lo que distingue "cargando" de "vacío".** Sin él no hay forma de saber que la lectura terminó. `CartSheet` usa `useCartHydration()` para no mostrar "tu carrito está vacío" en el frame en que todavía está leyendo.

Montaje en el layout público:

```tsx
// src/app/(public)/layout.tsx, dentro del <div> raíz
<CartHydrator />
<CartSheet />
```

`CartSheet` se monta una vez en el layout y no en cada card. El estado abierto o cerrado vive en el store, así que cualquier botón lo abre.

### 6.8 Paso 8 — `haptics.ts`

```ts
// src/lib/haptics.ts
export function tapFeedback(): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  navigator.vibrate(8);
}
```

Ocho milisegundos, no 50. Con 50 el teléfono zumba y el usuario piensa que le llegó una notificación. La función se llama desde el stepper y no hace nada donde no hay soporte: iOS Safari no expone `navigator.vibrate` y no es un bug.

### 6.9 Paso 9 — `AddToCartButton`

Es el punto donde la Tarea 10 dejó su placeholder.

```tsx
// src/components/cart/AddToCartButton.tsx
"use client";

import { useState } from "react";
import { Button, useToast } from "@/components/ui";
import { useCartStore, type AddItemOutcome } from "@/store/cart-store";
import type { CartLine } from "@/lib/cart/cart-types";
import { tapFeedback } from "@/lib/haptics";

interface AddToCartButtonProps {
  line: Omit<CartLine, "quantity">;
  quantity?: number;
  className?: string;
}

const MESSAGES: Record<AddItemOutcome["status"], string> = {
  added: "Agregado al carrito.",
  merged: "Actualizamos la cantidad.",
  unavailable: "Ese producto está agotado.",
  "limit-reached": "Tu carrito llegó al máximo de productos distintos.",
};

export function AddToCartButton({
  line,
  quantity = 1,
  className,
}: AddToCartButtonProps) {
  const { toast } = useToast();
  const addItem = useCartStore((state) => state.addItem);
  const [justAdded, setJustAdded] = useState(false);

  const handleClick = () => {
    tapFeedback();
    const outcome = addItem({ ...line, quantity });
    toast({ message: MESSAGES[outcome.status] });

    if (outcome.status === "added" || outcome.status === "merged") {
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 1200);
    }
  };

  return (
    <Button type="button" onClick={handleClick} className={className}>
      {justAdded ? "Agregado" : "Agregar"}
    </Button>
  );
}
```

`Record<AddItemOutcome["status"], string>` obliga a que cada outcome tenga mensaje. Si mañana `addItem` devuelve un estado nuevo y nadie agrega la clave, TypeScript falla en la definición del mapa, no en producción.

El cambio de texto a "Agregado" dura 1200 ms. Es la única animación del proyecto: el toast ya confirma, el badge del header ya cambia, y un check animado sobre el botón sería una tercera confirmación de lo mismo.

`quantity` entra por prop porque la ficha de producto puede mandar más de una unidad; la card manda 1.

Integración en la card, reemplazando el `handleAdd` de la Tarea 10:

```tsx
// src/components/catalog/ProductCard.tsx, dentro del bloque de precio
{product.available ? (
  <AddToCartButton
    line={{
      productId: product.id,
      slug: product.slug,
      name: product.name,
      variantId: null,
      variantName: null,
      unitPrice: product.price,
      imageUrl: product.imageUrl,
      available: product.available,
    }}
    className="rounded-control bg-accent px-3 py-1.5 text-sm text-accent-contrast"
  />
) : (
  <span className="text-sm text-muted">Sin stock</span>
)}
```

El `className` se pasa desde afuera para que la card y la ficha usen la misma primitiva con tamaños distintos. `AddToCartButton` no decide su propio aspecto: esa es la regla de las primitivas de la Tarea 09, y `Button` la aplica.

### 6.10 Paso 10 — `QuantityStepper`

```tsx
// src/components/cart/QuantityStepper.tsx
"use client";

import { useEffect, useState } from "react";
import { MAX_QUANTITY_PER_ITEM } from "@/lib/cart/cart-types";
import { tapFeedback } from "@/lib/haptics";

interface QuantityStepperProps {
  value: number;
  onChange: (quantity: number) => void;
  label: string;
  size?: "sm" | "md";
}

const BUTTON = "flex size-8 items-center justify-center rounded-control text-lg leading-none disabled:opacity-40";
const FIELD = "w-10 text-center text-sm tabular-nums outline-none";

export function QuantityStepper({
  value,
  onChange,
  label,
  size = "md",
}: QuantityStepperProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (next: number) => {
    tapFeedback();
    const clamped = Math.min(Math.max(next, 1), MAX_QUANTITY_PER_ITEM);
    setDraft(String(clamped));
    onChange(clamped);
  };

  const handleCommitDraft = () => {
    const parsed = Number.parseInt(draft, 10);

    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }

    commit(parsed);
  };

  const dimension = size === "sm" ? "size-7" : "size-8";

  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-control border border-border"
    >
      <button
        type="button"
        onClick={() => commit(value - 1)}
        disabled={value <= 1}
        aria-label={`Quitar una unidad de ${label}`}
        className={`${BUTTON} ${dimension}`}
      >
        −
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={handleCommitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            handleCommitDraft();
          }
        }}
        aria-label={`Cantidad de ${label}`}
        className={FIELD}
      />

      <button
        type="button"
        onClick={() => commit(value + 1)}
        disabled={value >= MAX_QUANTITY_PER_ITEM}
        aria-label={`Agregar una unidad de ${label}`}
        className={`${BUTTON} ${dimension}`}
      >
        +
      </button>
    </div>
  );
}
```

**`draft` y `value` son dos estados distintos.** `value` es la verdad del store; `draft` es lo que el usuario está escribiendo. Si el input leyera directamente `value`, escribir "1" en un campo que tiene "15" dispararía `onChange(1)` y se comería el resto. El `draft` se sincroniza con `value` en un `useEffect` cada vez que el store confirma.

**`onChange` recibe el valor ya recortado.** El stepper no le pasa "cero" a la capa de arriba: el botón de menos se deshabilita en 1, y el texto editado con "0" o "-3" se ajusta a 1 antes de llamar. La única forma de sacar una línea es el botón explícito de "Quitar" de la fila.

**`role="group"` con `aria-label` en el contenedor.** Un lector de pantalla anuncia "grupo, Cantidad de Café y medialuna", y los tres controles quedan dentro de ese contexto. Sin el `role`, el "menos" y el "más" flotan sueltos en la lectura.

**`tabular-nums` en el campo.** Sin eso, cambiar de 9 a 10 desplaza el valor un píxel a la derecha y el input tiembla.

### 6.11 Paso 11 — `CartLineItem`, `CartTotals` y `CartSheet`

#### `CartLineItem`

```tsx
// src/components/cart/CartLineItem.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { formatARS } from "@/lib/format/currency";
import { useCartStore } from "@/store/cart-store";
import type { CartLine } from "@/lib/cart/cart-types";
import cloudinaryLoader from "@/lib/images/cloudinary-loader";
import { QuantityStepper } from "./QuantityStepper";

interface CartLineItemProps {
  line: CartLine;
}

export function CartLineItem({ line }: CartLineItemProps) {
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  const title = line.variantName ? `${line.name} · ${line.variantName}` : line.name;

  return (
    <li className="flex gap-3 py-4">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-control bg-surface-muted">
        {line.imageUrl && (
          <Image
            loader={cloudinaryLoader}
            src={line.imageUrl}
            alt={line.name}
            fill
            sizes="64px"
            className={line.available ? "object-cover" : "object-cover grayscale opacity-60"}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/producto/${line.slug}`}
            className="min-w-0 text-sm font-medium text-ink hover:underline"
          >
            <span className="line-clamp-1">{title}</span>
          </Link>

          <span className="shrink-0 text-sm font-medium text-ink">
            {formatARS(line.unitPrice * line.quantity)}
          </span>
        </div>

        {!line.available && (
          <p className="text-xs text-danger">Ya no está disponible</p>
        )}

        <div className="mt-1 flex items-center justify-between">
          <QuantityStepper
            value={line.quantity}
            onChange={(quantity) =>
              setQuantity(line.productId, line.variantId, quantity)
            }
            label={title}
            size="sm"
          />

          <button
            type="button"
            onClick={() => removeItem(line.productId, line.variantId)}
            aria-label={`Quitar ${title} del carrito`}
            className="text-xs text-muted underline-offset-2 hover:text-danger hover:underline"
          >
            Quitar
          </button>
        </div>
      </div>
    </li>
  );
}
```

**La línea se queda aunque `available` sea `false`.** No se saca sola. Si el cliente armó un pedido y un producto se agota entre medio, lo correcto es mostrarle el problema y que él decida, no vaciarle el carrito a sus espaldas. La Tarea 13 avisa antes de mandar el mensaje.

**El precio de la línea es `unitPrice * quantity`, sin formatear de más.** Se multiplica y se formatea una vez. Si se formatea el unitario y después se multiplica el string, el resultado es un número o `NaN`.

#### `CartTotals`

```tsx
// src/components/cart/CartTotals.tsx
"use client";

import { calculateCartSubtotal } from "@/lib/cart/cart-rules";
import { useCartStore } from "@/store/cart-store";
import { formatARS } from "@/lib/format/currency";

export function CartTotals() {
  const lines = useCartStore((state) => state.lines);
  const clear = useCartStore((state) => state.clear);

  const units = lines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = calculateCartSubtotal({ lines });

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">
          {units} {units === 1 ? "artículo" : "artículos"}
        </span>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-muted underline-offset-2 hover:text-danger hover:underline"
        >
          Vaciar carrito
        </button>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">Subtotal</span>
        <span className="font-display text-2xl text-ink">
          {formatARS(subtotal)}
        </span>
      </div>

      <p className="text-xs text-muted">
        El envío y el pago se coordinan por WhatsApp. Te confirmamos el total
        antes de preparar el pedido.
      </p>
    </div>
  );
}
```

**El subtotal sale de `calculateCartSubtotal` y no de un campo del store.** El store no guarda valores derivados; si guardara `subtotal`, cualquier cambio en las líneas que no pase por la acción correcta deja el total viejo al lado de las líneas nuevas.

**"Vaciar carrito" pide confirmación con `ConfirmDialog`.** Es la única acción destructiva de la interfaz y no hay forma de revertirla: un toque accidental borra un pedido de veinte unidades. El diálogo de la Tarea 09 existe para esto. En el ejemplo va como `onClick` directo para no extender la primitiva acá; la versión final lo envuelve en `ConfirmDialog`.

#### `CartSheet`

```tsx
// src/components/cart/CartSheet.tsx
"use client";

import { Sheet, Skeleton } from "@/components/ui";
import { useCartHydration } from "@/hooks/use-cart-hydration";
import { useCartStore } from "@/store/cart-store";
import { CartLineItem } from "./CartLineItem";
import { CartTotals } from "./CartTotals";

export function CartSheet() {
  const lines = useCartStore((state) => state.lines);
  const isOpen = useCartStore((state) => state.isOpen);
  const setOpen = useCartStore((state) => state.setOpen);
  const hydrated = useCartHydration();

  return (
    <Sheet open={isOpen} onOpenChange={setOpen} title="Tu carrito" side="right">
      {!hydrated ? (
        <div className="flex flex-col gap-4" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : lines.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-10">
          <p className="text-sm text-muted">Todavía no agregaste nada.</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-control bg-accent px-4 py-2 text-sm font-medium text-accent-contrast"
          >
            Ver el menú
          </button>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {lines.map((line) => (
              <CartLineItem
                key={`${line.productId}:${line.variantId ?? ""}`}
                line={line}
              />
            ))}
          </ul>

          <div className="mt-4">
            <CartTotals />
          </div>
        </>
      )}
    </Sheet>
  );
}
```

`isOpen` y `setOpen` no son parte de las reglas del carrito: son estado de interfaz, no de dominio. `CartState` sigue siendo `{ lines }` e `isCartEmpty({ lines })` no necesita saber nada del panel.

El botón "Ver el menú" del estado vacío cierra el `Sheet` y deja que el usuario use el nav que tiene detrás. Un botón que no cierra el panel deja al cliente encerrado en un `Sheet` vacío con el `ScrollLock` del body activo.

`CartSheet` no muestra el botón de enviar a WhatsApp. Ese es el entregable de la Tarea 13, y agregar un botón deshabilitado acá es una pantalla que promete algo que todavía no hace.

### 6.12 Paso 12 — `CartButton` y el montaje final

```tsx
// src/components/cart/CartButton.tsx
"use client";

import { getCartItemCount } from "@/lib/cart/cart-rules";
import { useCartStore } from "@/store/cart-store";
import { tapFeedback } from "@/lib/haptics";

export function CartButton() {
  const lines = useCartStore((state) => state.lines);
  const setOpen = useCartStore((state) => state.setOpen);

  const units = getCartItemCount({ lines });

  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback();
        setOpen(true);
      }}
      aria-label={`Abrir el carrito, ${units} ${
        units === 1 ? "artículo" : "artículos"
      }`}
      className="relative flex size-10 items-center justify-center rounded-control border border-border"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5 text-ink"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
        />
      </svg>

      {units > 0 && (
        <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold leading-5 text-accent-contrast">
          {units > 99 ? "99+" : units}
        </span>
      )}
    </button>
  );
}
```

El ícono es un `svg` inline de trazo, no una dependencia de íconos. Son veinte líneas de path y una dependencia menos para dibujar un carrito.

La cantidad sale de `getCartItemCount({ lines })` con las líneas ya suscritas, no de una acción del store. El componente se re-renderiza cuando cambia `lines` y deriva el número en el render, así que el badge no puede quedar viejo: no hay dos copias del valor.

`"99+"` corta en tres dígitos. Un badge de cuatro dígitos empuja el ícono del borde del header en 320 px, y ningún carrito de café llega a 100 artículos.

Montaje en `src/components/catalog/BusinessHeader.tsx`, reemplazando el `span` placeholder de la Tarea 10:

```tsx
import { CartButton } from "@/components/cart/CartButton";

<CartButton />
```

### 6.13 Paso 13 — Verificación manual

```bash
npm run typecheck
npm run lint
npm run build
npm run test
```

Después, en `npm run dev`:

| Verificación | Resultado esperado |
|---|---|
| Agregar un producto desde la card | Toast "Agregado al carrito", badge del header en 1, botón en "Agregado" por 1,2 s |
| Agregar el mismo producto dos veces | Toast "Actualizamos la cantidad", badge en 2, una sola línea |
| Abrir el `Sheet` | Las dos líneas con su cantidad y su total |
| Subir a 20 con el "+" | El "+" se deshabilita en 20 y no deja pasar |
| Escribir "999" en el campo | Se recorta a 20 al perder el foco |
| Escribir "abc" | Vuelve al valor anterior, no queda en `NaN` |
| Borrar todo el contenido del campo | Vuelve al valor anterior |
| Poner 1 y tocar "−" | El botón está deshabilitado; la línea no desaparece |
| Quitar la línea | Desaparece, con el toast si se agrega el slot de acción |
| "Vaciar carrito" | Pide confirmación antes de borrar |
| **Recargar con 5 líneas** | **Las 5 siguen, el badge conserva el total, sin aviso de hidratación** |
| Editar `localStorage` a mano con `{{{` | Al recargar, la app funciona y el carrito está vacío |
| Poner una versión vieja en el storage | Ídem: se descarta sin romper |
| Safari en ventana privada | Agregar funciona; al recargar, el carrito está vacío |
| `/`, `/menu` y una ficha con 5 líneas | Cero warnings de hidratación en la consola |
| 320 px con el `Sheet` abierto | Panel a ancho completo, totales sin desborde |
| Recorrido con Tab dentro del `Sheet` | Foco atrapado en el panel, se cierra con `Esc` |

Las tres filas en negrita son las que nadie prueba y las que más se rompen en producción. La rehidratación y el descarte de un payload corrupto no aparecen en ningún test de `npm run test`: aparecen cuando alguien recarga.

### 6.14 Paso 14 — Actualizar el índice de tareas

En `docs/tasks/README.md`:

1. Marcar la Tarea 11 como `hecho` con la fecha
2. Corregir la dependencia real de la Tarea 11 a 10 y 09 (§3.3), con una nota que explique por qué la tabla de metadatos dice 09
3. Desbloquear la Tarea 12 y la Tarea 13


---

## 7. Contratos y tipos

### 7.1 Superficie pública de `cart-rules.ts`

```ts
interface CartApi {
  addItemToCart(state: CartState, line: CartLine): CartState;
  removeItemFromCart(
    state: CartState,
    productId: string,
    variantId: string | null,
  ): CartState;
  updateItemQuantity(
    state: CartState,
    productId: string,
    variantId: string | null,
    quantity: number,
  ): CartState;
  clearCart(): CartState;
  calculateCartSubtotal(state: CartState): number;
  isCartEmpty(state: CartState): boolean;
  getCartItemCount(state: CartState): number;
  mergeLine(line: CartLine, existing: CartLine): CartLine;
}
```

Todas reciben `CartState` y devuelven `CartState`, salvo `mergeLine` y `clearCart`, que no necesitan estado de entrada. Esa simetría es lo que permite componerlas: `addItemToCart(updateItemQuantity(state, id, null, 3), line)` funciona sin estado intermedio.

### 7.2 Superficie pública del store

```ts
interface CartStore {
  lines: CartLine[];
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  addItem: (line: CartLine) => AddItemOutcome;
  removeItem: (productId: string, variantId: string | null) => void;
  setQuantity: (
    productId: string,
    variantId: string | null,
    quantity: number,
  ) => void;
  clear: () => void;
}

type AddItemOutcome =
  | { status: "added" }
  | { status: "merged" }
  | { status: "unavailable" }
  | { status: "limit-reached" };
```

Los nombres de las acciones son verbos en inglés sin la palabra "Cart", porque ya viven en `useCartStore`. `useCartStore(s => s.addItem)` se lee; `useCartStore(s => s.addItemToCart)` se lee como redundancia. El store expone cuatro cosas y ninguna de las dos es un valor derivado: `lines` e `isOpen` son estado, `setOpen` y el resto son acciones.

### 7.3 Lo que la Tarea 13 tiene que revalidar

| Campo de `CartLine` | Por qué puede estar viejo | Qué hace la Tarea 13 |
|---|---|---|
| `unitPrice` | El precio cambió entre que se agregó y que se manda | Compara con el catálogo y avisa si cambió |
| `available` | El producto se agotó o se despublicó | Marca la línea y avisa antes de mandar |
| El producto existe | Se eliminó del catálogo | Avisa y saca la línea con confirmación |
| La cantidad sigue siendo válida | El stock real es menor que lo pedido | Limita a lo disponible y avisa |

El carrito **no** corrige estos datos por su cuenta. La regla es simple: el carrito muestra lo que el cliente pidió, y la Tarea 13 verifica contra la fuente antes de que el pedido salga. Un carrito que se auto-corrige esconde el problema del cliente hasta que ya no puede hacer nada.

### 7.4 Resultado de `addItem` y su mensaje

| `status` | Cuándo | Mensaje en la UI |
|---|---|---|
| `added` | La línea no estaba y entró | "Agregado al carrito." |
| `merged` | La línea ya estaba y sumó cantidad | "Actualizamos la cantidad." |
| `unavailable` | `available === false` | "Ese producto está agotado." |
| `limit-reached` | Ya hay 30 líneas distintas | "Tu carrito llegó al máximo de productos distintos." |

Ninguno de los cuatro lanza excepción. Los cuatro son un valor de retorno, y la UI decide qué mostrar.

### 7.5 Clave de persistencia

| Aspecto | Valor |
|---|---|
| Clave | `cartroca:v1` |
| Forma | `{ version: 1, state: { lines: CartLine[] } }` |
| Cuándo se escribe | Después de cada `set` que cambia `lines` |
| Cuándo se lee | Una vez, en el `useEffect` de `CartHydrator` |
| Si falla la validación | Carrito vacío, sin error visible |
| Si `localStorage` no existe | Store en memoria, el carrito no sobrevive la recarga |

### 7.6 Límites y sus consecuencias

| Límite | Valor | Qué pasa al alcanzarlo |
|---|---|---|
| `MAX_QUANTITY_PER_ITEM` | 20 | El botón "+" se deshabilita; el texto editado se recorta |
| `MAX_DISTINCT_LINES` | 30 | `addItem` devuelve `limit-reached` y no agrega |
| Tope de payload | ~30 líneas | Cabe de sobra en el límite de 5 MB de `localStorage` |

Treinta líneas distintas con 20 unidades cada una son 600 unidades y unos 300 KB serializados. Ningún límite de `localStorage` entra en juego con este tope, y por eso no hace falta paginar la persistencia.

---

## 8. Criterios de aceptación

- [ ] **8.1** `npm run build`, `npm run typecheck`, `npm run lint` y `npm run test` en verde, con `zustand` en `dependencies` de `package.json` y `zustand` ausente de `devDependencies`.
- [ ] **8.2** `rg "server/|prisma" src/lib/cart src/store src/components/cart` devuelve cero resultados, `rg "zustand|react" src/lib/cart` devuelve cero resultados, y `cart-rules.test.ts` pasa sin montar un componente ni tocar `localStorage`.
- [ ] **8.3** `rg "\"use client\"" src/lib src/store/cart-hydrator.tsx src/hooks` marca solo `src/store/cart-store.ts`, `src/store/cart-hydrator.tsx` y `src/hooks/use-cart-hydration.ts`; `src/lib/cart/` y `src/lib/format/` quedan sin la directiva y son importables desde un test de Node.
- [ ] **8.4** La consola del navegador no muestra ningún aviso de hidratación en `/`, `/menu` ni una ficha de producto, con el carrito vacío y con cinco productos cargados; tras recargar, las cinco líneas siguen ahí, el badge del header conserva el total y el `Sheet` no muestra el estado vacío en ningún frame.
- [ ] **8.5** Agregar un producto actualiza el badge sin recargar, el `Sheet` se abre desde el botón del header con `aria-label` que anuncia la cantidad en artículos, el stepper se puede completar entero con teclado, ninguna línea pasa de 20 unidades, el subtotal coincide con la suma visible de las líneas y `localStorage` con un payload corrupto o de versión vieja deja la app funcionando con el carrito vacío.

---

## 9. Casos borde

| Caso | Qué pasa | Por qué |
|---|---|---|
| `localStorage` no existe (Safari privado) | Store en memoria; el carrito funciona y se pierde al recargar | Un `try/catch` alrededor de la escritura en vez de dejar que reviente |
| `localStorage` con JSON inválido | `merge` devuelve el estado inicial | Un storage corrupto no puede romper la app |
| Payload de una versión vieja | Rechazado por el literal de `version` | La forma de `CartLine` puede haber cambiado |
| Cantidad guardada en 0 o negativa | Rechazado por `.min(1)` del esquema | Nunca existieron líneas en cero; si aparecen, el storage está mal |
| `addItem` de un producto agotado | No agrega y devuelve `unavailable` | La regla vive en el dominio, no en el botón |
| Agregar un producto que ya está en el carrito | Suma cantidad, mantiene el precio original | El carrito es un snapshot del momento de armado |
| Variante distinta del mismo producto | Línea nueva, no pisa la anterior | La identidad es `productId` + `variantId` |
| Cantidad 20 y se sigue agregando | Queda en 20, sin error | El tope es un tope, no una excepción |
| 30 líneas distintas y se agrega otra | No agrega y devuelve `limit-reached` | Un `localStorage` que se desborda pierde el carrito entero |
| Texto editado a mano con "0", "-2" o "abc" | Se ajusta a 1, o vuelve al valor anterior si no parsea | `Number.parseInt` con `NaN` checked |
| Producto despublicado mientras está en el carrito | La línea queda, marcada "Ya no está disponible" | Vaciarle el carrito al cliente es peor que avisarle |
| Precio del producto cambiado | El carrito conserva el precio viejo | Revalidar es de la Tarea 13 |
| Recargar en el medio de la rehidratación | Skeleton en el `Sheet`, nunca "vacío" | `onFinishHydration` distingue cargando de vacío |
| Dos pestañas abiertas con el carrito | Cada una tiene su copia; la última escritura gana | Sin `storage` events no hay sincronización. Aceptado: es un pedido de una persona, no un carrito compartido |
| "Vaciar carrito" con un toque accidental | `ConfirmDialog` antes de borrar | Es la única acción irreversible de la interfaz |
| Ancho de pantalla amplio, teléfono en 320 px | El `Sheet` ocupa el ancho completo y los totales no se desbordan | Un panel lateral fijo se sale de la pantalla en teléfono |
| Sin `navigator.vibrate` | `tapFeedback` no hace nada | iOS Safari no lo expone |
| Deshabilitado de red con cinco líneas en el carrito | Todo sigue funcionando | No hay red: el carrito es local |

---

## 10. Pruebas

| Archivo | Caso | Resultado esperado |
|---|---|---|
| `src/lib/format/currency.test.ts` | `roundCurrency(1.005)` | `1.01`, no `1` |
| `src/lib/format/currency.test.ts` | `roundCurrency(0.125)` | `0.13` |
| `src/lib/cart/cart-rules.test.ts` | Agregar un producto nuevo | Una línea |
| `src/lib/cart/cart-rules.test.ts` | Agregar dos veces el mismo | Una línea con la cantidad sumada |
| `src/lib/cart/cart-rules.test.ts` | Agregar dos variantes distintas | Dos líneas |
| `src/lib/cart/cart-rules.test.ts` | Cantidad por encima del tope | Queda en 20 |
| `src/lib/cart/cart-rules.test.ts` | Agregar un agotado | Cero líneas |
| `src/lib/cart/cart-rules.test.ts` | Agregar la línea 31 | Siguen siendo 30 |
| `src/lib/cart/cart-rules.test.ts` | `updateItemQuantity` a 0 | La línea desaparece |
| `src/lib/cart/cart-rules.test.ts` | `updateItemQuantity` sobre una línea inexistente | Devuelve el mismo estado |
| `src/lib/cart/cart-rules.test.ts` | `calculateCartSubtotal` con dos líneas | La suma de precio por cantidad |
| `src/lib/cart/cart-rules.test.ts` | `getCartItemCount` con dos líneas | Suma de unidades, no de líneas |
| `src/lib/cart/cart-rules.test.ts` | `clearCart` | `{ lines: [] }` |
| `src/lib/cart/cart-schema.test.ts` | Payload válido | `success === true` |
| `src/lib/cart/cart-schema.test.ts` | `version: 0` | `success === false` |
| `src/lib/cart/cart-schema.test.ts` | `quantity: 999` | `success === false` |
| `src/lib/cart/cart-schema.test.ts` | `unitPrice: -1` | `success === false` |
| `src/components/cart/CartLineItem.component.test.tsx` | Línea disponible | Muestra nombre, cantidad y precio total de la línea |
| `src/components/cart/CartLineItem.component.test.tsx` | Línea no disponible | Muestra "Ya no está disponible" y mantiene la fila |
| `src/components/cart/CartLineItem.component.test.tsx` | Clic en "Quitar" | La línea desaparece del store |
| `src/components/cart/CartLineItem.component.test.tsx` | Con `variantName` | El título muestra nombre y variante unidos por "·" |

```tsx
// src/components/cart/CartLineItem.component.test.tsx
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCartStore } from "@/store/cart-store";
import type { CartLine } from "@/lib/cart/cart-types";
import { CartLineItem } from "./CartLineItem";

const LINE: CartLine = {
  productId: "prod-1",
  slug: "cafe",
  name: "Café",
  variantId: null,
  variantName: null,
  unitPrice: 4500,
  quantity: 2,
  imageUrl: null,
  available: true,
};

function renderLine(line: CartLine = LINE) {
  return render(
    <ul>
      <CartLineItem line={line} />
    </ul>,
  );
}

describe("CartLineItem", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [LINE] });
  });

  it("muestra el total de la línea, no el precio unitario", () => {
    renderLine();

    expect(screen.getByText("Café")).toBeInTheDocument();
    expect(screen.getByText(/9\.000/)).toBeInTheDocument();
  });

  it("avisa cuando el producto ya no está disponible", () => {
    renderLine({ ...LINE, available: false });

    expect(screen.getByText("Ya no está disponible")).toBeInTheDocument();
  });

  it("quita la línea del store", async () => {
    const user = userEvent.setup();
    renderLine();

    await user.click(
      screen.getByRole("button", { name: "Quitar Café del carrito" }),
    );

    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("une el nombre con el nombre de la variante", () => {
    renderLine({ ...LINE, variantName: "Grande" });

    expect(screen.getByText("Café · Grande")).toBeInTheDocument();
  });
});
```

`useCartStore.setState({ lines: [LINE] })` en el `beforeEach` es lo que permite probar sin `localStorage`: el test escribe el estado directo y no toca la rehidratación. `localStorage` real se prueba en el navegador, no en JSDOM, donde la implementación no es la de un dispositivo.

### 10.1 Lo que no se prueba acá y por qué

| No se prueba | Por qué |
|---|---|
| La rehidratación de `localStorage` | JSDOM no es un dispositivo: la prueba real es recargar en `npm run dev` (§6.13) |
| La animación del botón | Una transición CSS no se verifica en JSDOM |
| El `Sheet` abriéndose y cerrándose | Es comportamiento de la primitiva de la Tarea 09, ya probada ahí |
| La vibración | `navigator.vibrate` no existe en JSDOM |
| La sincronización entre pestañas | No es un requisito; ver §9 |

---

## 11. Definición de Hecho (DoD)

- [ ] `npm run build`, `npm run typecheck`, `npm run lint` y `npm run test` en verde
- [ ] `zustand` en `dependencies`, y `npm run test` pasa sin tocar `localStorage` en los tests de dominio
- [ ] `rg "server/|prisma" src/lib/cart src/store src/components/cart` sin resultados
- [ ] `src/lib/cart/` y `src/lib/format/` sin `"use client"` y sin imports de React
- [ ] Cero avisos de hidratación en `/`, `/menu` y una ficha, con el carrito vacío y con cinco productos
- [ ] Las ocho funciones puras cubiertas por `cart-rules.test.ts`, con los cuatro límites probados
- [ ] El schema de persistencia rechaza payload corrupto, versión vieja y cantidad fuera de rango
- [ ] El carrito sobrevive a una recarga con las líneas intactas
- [ ] El badge del header coincide con `getCartItemCount` en todo momento
- [ ] El `Sheet` se puede completar entero con teclado, con foco visible
- [ ] Ninguna línea pasa de 20 unidades ni el carrito de 30 líneas distintas
- [ ] "Vaciar carrito" pide confirmación
- [ ] Sin scroll horizontal entre 320 y 1440 px, con el `Sheet` abierto
- [ ] `docs/tasks/README.md` actualizado: Tarea 11 hecha, y dependencia real de 10 y 9 registrada

---

## 12. Dependencias y bloqueos

### 12.1 Depende de

| Tarea | Qué aporta |
|---|---|
| 09 | `Button`, `Input`, `Badge`, `Sheet`, `Toast`, `ConfirmDialog`, `use-dialog`, `Skeleton` |
| 10 | `formatARS`, `ProductCard` y su `handleAdd`, el placeholder del header, el layout público y `cloudinary-loader.ts` |

La tabla de metadatos de esta tarea dice `Depende de 09` porque es lo que definiste. La dependencia real incluye a la 10 y el README queda corregido (§3.3).

### 12.2 Habilita

| Tarea | Qué necesita de acá |
|---|---|
| 12 | Nada directo: los tests end-to-end cubren el carrito como parte del recorrido |
| 13 | `CartLine` con `unitPrice`, `productId`, `quantity` y `slug` para revalidar contra el catálogo; `clear()` para vaciar después de mandar; el `Sheet` donde vive el botón de WhatsApp |

### 12.3 Bloqueos

| Bloqueo | Efecto | Resolución |
|---|---|---|
| `Toast` de la Tarea 09 es de texto plano, sin acción | No hay "Deshacer" al agregar ni al quitar | El store expone `removeItem` y `setQuantity`, así que la Tarea 11 no necesita el slot todavía; si se quiere "Deshacer", hay que extender la primitiva en una tarea aparte |
| Props de `Sheet` sin verificar | El ejemplo usa `open`, `onOpenChange`, `title` y `side`, suponiendo la API de la Tarea 09 | Leer `src/components/ui/sheet.tsx` y ajustar los nombres antes de escribir `CartSheet`; si `Sheet` no expone `side`, el panel se define con clases y `title` pasa a ser `aria-label` en el `dialog` |
| `Button` sin prop `className` | El ejemplo le pasa `className` para que la card y la ficha compartan la primitiva | Si `Button` no lo acepta, hay que agregar el prop en la Tarea 09 en vez de usar un `<button>` crudo acá |
| Variantes de producto sin definir en el esquema | `variantId` y `variantName` quedan siempre en `null` | La interfaz ya los contempla; el selector de la ficha es de la Tarea 13 |
| Sin confirmación de stock al agregar | El cliente puede pedir 20 unidades de algo que quedan 3 | La Tarea 13 revalida; el carrito es un borrador local |
| Sin `storage` events | Dos pestañas no se sincronizan | Fuera de alcance: un pedido lo arma una persona en una pestaña |
| Sin tests de `localStorage` real | La rehidratación no queda cubierta por `npm run test` | Verificado a mano en §6.13 |

### 12.4 Fuera de alcance

- El botón de enviar a WhatsApp, el prearmado del mensaje y la revalidación de precios: Tarea 13
- El selector de variantes en la ficha: Tarea 13
- Cualquier pago online: no existe en el producto
- Sincronización entre dispositivos o entre pestañas: no hay backend de carrito
- Persistencia con cookies o con IndexedDB: `localStorage` alcanza para un pedido
- Tests end-to-end del recorrido de compra: Tarea 19
- El catálogo público: Tarea 10, ya hecha


---
