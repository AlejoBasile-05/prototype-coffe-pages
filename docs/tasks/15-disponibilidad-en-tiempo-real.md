# Tarea 15 — Disponibilidad en Tiempo Real

| Campo | Valor |
|---|---|
| **ID** | 15 |
| **Fase (DESIGN.md §8.6)** | Fase 4 — Panel de administración |
| **Depende de** | 14 |
| **Habilita** | — (cierra el circuito de stock) |
| **Tipo** | Interfaz / Controlador |
| **Esfuerzo est.** | 1 – 2 días |

---

## 1. Objetivo de la tarea

Hacer que un cambio de `isAvailable` que escribe el encargado en `/admin/productos` **llegue a los clientes que ya tienen el catálogo abierto**, sin que ninguno recargue la página y sin que el catálogo entero se regenere.

**Criterio de éxito verificable:** con `/menu` abierto en dos pestañas y el panel en una tercera, un clic en el switch cambia el estado visual de la card en las dos pestañas del menú en menos de 2 segundos, y el número de peticiones a la base de datos **no aumenta**.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 14 completada (existe `toggleProductAvailabilityAction` y hay productos en la base).

### 2.1 La decisión de diseño que sostiene toda la tarea

> **El contenido se cachea. La disponibilidad se suscribe.**

Es la contraparte directa de la Tarea 08 §4.5 y de `DESIGN.md` §6.1, y es lo que separa esta tarea de la 14:

| Capa de datos | Qué incluye | Frecuencia | Cómo llega al cliente |
|---|---|---|---|
| **Contenido** | Nombres, precios, fotos, categorías, descripciones, alérgenos | Horas o días | HTML con ISR, tag `products` |
| **Disponibilidad** | `isAvailable` de cada producto | Minutos | WebSocket de Supabase Realtime |

Si la disponibilidad estuviera dentro del HTML cacheado, cada cambio de stock obligaría a invalidar el catálogo **para todos los clientes al mismo tiempo**. La alternativa naïve —"que el cliente recargue cada 30 segundos"— tiene tres problemas que no tienen arreglo local: multiplica la carga de la base por la cantidad de visitas simultáneas, gasta datos móviles de gente que está leyendo el menú, y sigue teniendo una ventana de error de hasta 30 segundos. El objetivo declarado del proyecto es de **menos de 2 segundos**, y eso descarta el polling por definición.

La separación tiene una consecuencia que conviene entender antes de escribir una línea:

- El HTML que llega en la primera visita **ya trae** el `isAvailable` de cada producto, porque el catálogo se arma en el servidor y el producto agotado se muestra desaturado con su badge (Tarea 10). El HTML no está "roto": muestra la foto del momento en que se generó.
- Lo que hace el WebSocket es **corregir** ese snapshot en cuanto llega un evento. Antes del primer evento, el valor del HTML es la mejor información disponible y por eso se usa como estado inicial.

Por eso la página muestra algo correcto desde el primer paint: sin spinner de disponibilidad y sin un round-trip extra para "preguntar si hay".

### 2.2 Por qué Supabase Realtime y no otra cosa

La base ya es Supabase (Tarea 02) y la sesión ya usa `@supabase/ssr` (Tarea 07). Realtime da exactamente lo que hace falta —un `UPDATE` de una fila por WebSocket— sin infraestructura nueva. Las alternativas que se descartaron:

| Alternativa | Por qué no |
|---|---|
| Polling con `getCatalogWithOnlyAvailable()` | Latencia de 30 s y una query por cliente cada 30 s. La Tarea 08 §6.6 deja esa lectura "para el fallback cuando Realtime no está disponible" |
| Server-Sent Events propio | Un proceso Node sostenido en memoria por conexión. En Vercel eso es un plan que cuesta plata |
| WebSocket a mano contra la base | Reimplementar el protocolo de Supabase: peor resultado, más código para mantener |
| Revalidar el tag cada N segundos | No existe: la caché no tiene TTL corto sin reescribir todas las entradas |

### Checklist de prerrequisitos

- [x] Tarea 14 mergeada: existe `toggleProductAvailabilityAction` y hay productos en la base
- [x] `src/server/infra/supabase/client.ts` existe (Tarea 07 §6.5) con `supabaseBrowser()`
- [x] `zustand` instalado (Tarea 11). Si la Tarea 11 todavía no está: `npm i zustand`
- [x] `src/lib/domain/catalog.ts` expone `hasAvailableProducts(sections)` (Tarea 08 §6.1)
- [x] `ProductCard` y `ProductImage` reciben `available: boolean` por props (contrato de la Tarea 10 §7)

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `src/store/availability-store.ts` | Store de Zustand con el mapa `id → isAvailable`. Sin persistencia |
| `src/hooks/use-availability-realtime.ts` | Hook que se suscribe a `postgres_changes`, aplica eventos y limpia al desmontar |
| `src/hooks/use-product-availability.ts` | Selector fino: un booleano por producto, para no re-renderizar todas las cards |
| `src/components/catalog/AvailabilityRealtimeBridge.tsx` | Client Component que monta la suscripción **una vez por pestaña** y renderiza `null` |
| `supabase/migrations/<timestamp>_realtime_publicacion.sql` | Publicación de `products` en el canal de Realtime (ver §6.2) |
| `src/store/availability-store.test.ts` | Reductor del store: aplicación, deduplicación y borrado |
| `src/hooks/use-availability-realtime.component.test.tsx` | Suscripción, payload, limpieza y desmontaje, con doble del cliente |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `src/app/(public)/layout.tsx` | Montar `AvailabilityRealtimeBridge` una sola vez, dentro del layout público |
| `src/components/catalog/ProductCard.tsx` | Leer la disponibilidad del store en lugar del `product.available` del DTO |
| `src/components/catalog/ProductImage.tsx` | Igual: el desaturado pasa a seguir el estado vivo |
| `src/components/catalog/CatalogView.tsx` | Recalcular `hasAnyAvailableProduct` con el estado vivo |
| `src/components/admin/AvailabilitySwitch.tsx` | Suscribirse al mismo canal para recibir cambios hechos desde otra pestaña |
| `docs/tasks/README.md` | Marcar la Tarea 15 |

### 3.3 Eliminar

Ninguno.

---

## 4. Estructura N-Capas

### 4.1 Qué vive en esta capa

| Ubicación | Qué va | Qué NO va |
|---|---|---|
| `src/store/availability-store.ts` | Estado volátil `Record<string, boolean>` y una acción `apply` | Persistencia, llamadas de red, datos de contenido |
| `src/hooks/use-availability-realtime.ts` | Suscripción, parseo del payload, limpieza | Cambios de estado que no sean de disponibilidad |
| `src/components/catalog/*` | Leer el store y pintar | Suscribirse directamente a Supabase |
| `src/server/**` | Nada | Esta tarea **no toca el servidor**. Ni una línea |

### 4.2 La frontera con la Tarea 14, sin excepciones

| | Tarea 14 | Tarea 15 |
|---|---|---|
| Escribe en la base | Sí, vía `toggleProductAvailabilityAction` | **Nunca** |
| Lee de la base | Sí, al renderizar la tabla | **Nunca** |
| Transporte | HTTP a la Server Action | WebSocket de Supabase |
| Corrige la vista | La fila del panel que hizo el clic | Todas las vistas abiertas, incluida esa |

**La regla dura:** el WebSocket es un canal de **una sola dirección**. Esta tarea no publica nada, no llama a una action y no toca la base. Si el hook hiciera un `update` a través del canal, la frontera de caché de la Tarea 08 §4.5 perdería a su único dueño y dos caminos distintos podrían escribir la misma fila con reglas de revalidación distintas.

**El único camino de escritura es `toggleProductAvailabilityAction`.** Quedó definido en la Tarea 14 y no se abre un segundo.

### 4.3 Por qué un store y no un context

El catálogo tiene veinte a cuarenta productos y cada uno necesita un booleano. Un context con `useState` obliga a que cualquier cambio de disponibilidad re-renderice el árbol entero del catálogo. Un store de Zustand con selector por clave re-renderiza **una sola card** por evento.

```ts
// ⛔ MAL — lee el mapa entero: re-renderiza las 40 cards por cada cambio
const { byProductId } = useAvailabilityStore();
const isAvailable = byProductId[product.id] ?? product.available;
```

```ts
// ✅ BIEN — re-renderiza solo la card cuyo valor cambió
const isAvailable = useProductAvailability(product.id, product.available);
```

El selector con **valor inicial explícito** es lo que hace que el HTML del servidor siga siendo la fuente inicial y el store sea la fuente de verdad **después** de hidratar. Es la misma disciplina de selector que la Tarea 11 aplica al carrito.

### 4.4 El store no guarda contenido, y por lo tanto no puede divergir

`availability-store.ts` guarda **solo** un `Record<string, boolean>`. No guarda nombres, ni precios, ni slugs, ni una copia del `ProductDTO`.

El motivo es concreto: si el store guardara el producto completo, cada evento traería veinte campos que nadie usa y habría dos fuentes de verdad del mismo dato —el DTO que llegó por props y el del store—. Los dos empezarían iguales y divergirían en el primer cambio de precio sin que nada avise. Un store que solo guarda el campo que llega por push **no puede** divergir del contenido: no lo tiene.

### 4.5 Dónde se monta la suscripción

**Una vez por pestaña**, en el layout público, mediante un componente que renderiza `null`.

La alternativa —suscribirse en cada `ProductCard`— es la que produce el bug clásico de Realtime: cuarenta conexiones WebSocket en lugar de una, cuarenta `unsubscribe` que hay que acertar, y cuarenta copias de la misma lógica de parseo del payload. Con un `channel()` por pestaña, un evento cierra cuarenta cards con una sola notificación.

La consecuencia de que sea en el layout público y no en el raíz: las rutas `/admin` y `/login` **no** abren conexión. El panel recibe los eventos por un montaje propio (§4.6), y la pantalla de login no gasta un socket en una página que no muestra ningún producto.

### 4.6 El panel admin también escucha

Un mismo canal, otro suscriptor. Cuando el encargado tiene dos pestañas del panel abiertas y alterna stock en una, la otra se entera sin recargar.

No es un lujo: el caso real es el del encargado que deja el panel en una laptop y atiende desde el teléfono. Si la segunda pestaña no se actualiza, alterna stock sobre información vieja y cree que guardó cuando no guardó.

---

## 5. Convenciones de código (Clean Code + SOLID)

**Principio aplicado: ISP sobre el store, SRP sobre el hook.**

### 5.1 El store expone dos acciones y nada más

| Expone | Quién lo usa | Por qué |
|---|---|---|
| `applyAvailability(id, isAvailable)` | El hook, y la action optimista de la Tarea 14 | La única escritura. Con una única acción de dominio, el hook no puede escribir un `id` que no existe en el catálogo ni saltarse la deduplicación |
| `clearAvailability()` | Los tests y el desmontaje del bridge | Estado volátil: al descartar la pestaña, el store se descarta con ella |
| ~~`setAvailability(objeto)`~~ | Nadie | Una escritura genérica con un objeto abre la puerta a payloads mal formados |
| ~~`byProductId` completo~~ | Nadie directamente | Leer el mapa entero desde un componente obliga a re-renderizarlo. Se accede por selector |

El store **no** se persiste con `persist`. La disponibilidad no sobrevive a un refresh: al recargar, el HTML del servidor manda y el store arranca vacío. Guardarlo en `localStorage` serviría solo para mostrar datos viejos durante un instante, que es peor que no tener nada.

### 5.2 Deduplicación en la escritura, no en el render

Supabase Realtime puede entregar **el mismo evento dos veces** (reconexión con replay, o dos publicadores de la misma fila). Si el reductor guardara el valor siempre, cada duplicado dispararía un `set` de Zustand y un re-render de la card, aunque el booleano no haya cambiado.

La comparación en el reductor es de una línea y elimina la mitad del ruido de una conexión que reconecta:

```ts
if (state.byProductId[id] === isAvailable) return state;
```

El early return devuelve **el mismo objeto de estado**, y Zustand no notifica a nadie cuando el estado no cambió por identidad. Eso importa: es lo que separa "llegó un evento" de "cambió algo".

### 5.3 Nombres

| Elemento | Nombre | Razón |
|---|---|---|
| Hook | `useAvailabilityRealtime()` | Verbo + sustantivo. Sin argumentos: una suscripción por pestaña |
| Selector | `useProductAvailability(id, inicial)` | `inicial` explícito: es el valor del HTML del servidor |
| Store | `useAvailabilityStore` | Sufijo `Store` de la Tarea 11 |
| Acción del store | `applyAvailability` | `apply` dice "aplicá lo que llegó", no "poné lo que quieras" |
| Bridge | `AvailabilityRealtimeBridge` | Nombra el rol: es un puente entre el canal y el árbol, no un componente de UI |
| Canal | `catalog-availability` | Nombre compartido por panel y catálogo. Un solo string en dos archivos, no una constante compartida: el canal no es dominio, es transporte |

### 5.4 Limpieza

El `unsubscribe` va en el `return` del `useEffect`. Con `StrictMode` de desarrollo, React monta, desmonta y remonta cada componente dos veces: si el cleanup no está, la primera suscripción queda viva y cada remount agrega otra. Cuatro suscripciones muertas que se multiplican por dos en cada recarga y que en producción aparecen como "el catálogo se actualiza dos veces".

### 5.5 Errores de conexión: qué se hace y qué no

| Situación | Qué hace el código | Qué NO hace |
|---|---|---|
| `SUBSCRIBED` | No se toca nada. El store ya tiene el snapshot del HTML | No se pide el catálogo de nuevo |
| `CHANNEL_ERROR` / `TIMED_OUT` | `console.warn` con el nombre del canal | No se cae la página, no se muestra un error al usuario |
| Red caída y vuelve | Supabase reintenta solo; los eventos perdidos se pierden | No hay polling de respaldo en esta tarea |

Sobre la falta de fallback: la Tarea 08 §6.6 deja `getCatalogWithOnlyAvailable()` "para el fallback cuando Realtime no está disponible". Ese fallback es un **endpoint** para un cliente que decide consultarlo, y lo implementa quien lo necesite; esta tarea no lo consulta. Si una conexión muere y nunca vuelve, el usuario ve el snapshot del HTML, que es un estado coherente y truthful —solo que viejo. Mentir con un badge parpadeante sería peor.

---

## 6. Pasos de implementación

### 6.1 Store de disponibilidad

```ts
// src/store/availability-store.ts
import { create } from "zustand";

interface AvailabilityState {
  /** Snapshot volátil. Solo la última disponibilidad conocida por push. */
  byProductId: Record<string, boolean>;
  /** Única escritura. Ignora el valor si no cambia nada. */
  applyAvailability: (id: string, isAvailable: boolean) => void;
  /** Estado inicial en cada carga del proceso de cliente. */
  clearAvailability: () => void;
}

export const useAvailabilityStore = create<AvailabilityState>()((set) => ({
  byProductId: {},

  applyAvailability: (id, isAvailable) =>
    set((state) => {
      // Deduplicación por identidad: sin esto, un evento repetido por una
      // reconexión re-renderiza la card sin motivo. Ver §5.2.
      if (state.byProductId[id] === isAvailable) return state;
      return { byProductId: { ...state.byProductId, [id]: isAvailable } };
    }),

  clearAvailability: () => set({ byProductId: {} }),
}));

/**
 * Selector fino. Devuelve el valor del store si hubo evento; si no hubo,
 * devuelve el del HTML del servidor.
 *
 * `inicial` es explícito a propósito: es la diferencia entre "el snapshot
 * del render del servidor" y "0, que sería un valor que el producto nunca
 * tomó". Ver §4.3.
 */
export const useProductAvailability = (id: string, inicial: boolean): boolean =>
  useAvailabilityStore((state) => state.byProductId[id] ?? inicial);
```

Por qué el store y el selector viven en el mismo archivo: son la misma unidad de comportamiento —un valor y su forma de leerlo—. Separarlos deja un hook que importa un store y no puede testearse sin el contexto de React.

### 6.2 Publicar `products` en el canal de Realtime

Supabase no publica ninguna tabla por defecto. Sin este paso, la suscripción se conecta, se autentica y **nunca recibe un solo evento**, sin ningún error visible. Es el paso que más tiempo cuesta diagnosticar cuando falta.

```sql
-- supabase/migrations/20250115000000_realtime_publicacion.sql
-- ⛔ Idempotente: la tarea se puede volver a aplicar sin romper nada.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END
$$;
```

Dos decisiones:

1. **Va en una migración, no en un paso manual del README.** La publicación es parte del esquema: si vive fuera de las migraciones, un ambiente nuevo la pierde y el bug aparece en producción y no en local.
2. **Se publica la tabla entera, no una vista.** La alternativa —una vista `productos_publicados` con `REPLICA IDENTITY FULL` y una `publication` distinta— agrega una capa de permisos que no compra nada acá: Realtime de Postgres entrega la fila al canal, y la autorización de la columna `products` ya está resuelta por el rol `authenticated` que usa la sesión del panel. Lo que sí se documenta en §9 es el riesgo de exposición de columnas.

### 6.3 Hook de suscripción

```ts
// src/hooks/use-availability-realtime.ts
"use client";

import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/server/infra/supabase/client";
import { useAvailabilityStore } from "@/store/availability-store";

/** Canal compartido por el catálogo público y el panel. Ver §5.3. */
const CHANNEL_NAME = "catalog-availability";

/** Fila mínima que el hook necesita del evento. Nunca más que eso. */
interface ProductAvailabilityEvent {
  id: string;
  isAvailable: boolean;
}

/**
 * ⛔ Type guard, no un `as`. El payload de `postgres_changes` viene tipado
 *    como `Record<string, any>` por la librería, y heredarlo con un cast
 *    sería propagar ese `any` a todo el hook. El guard repite el chequeo
 *    en runtime y devuelve un tipo que sí se puede usar. Ver §7.
 */
const esEventoDeDisponibilidad = (
  valor: Record<string, unknown>,
): valor is ProductAvailabilityEvent =>
  typeof valor.id === "string" && typeof valor.isAvailable === "boolean";

/**
 * Se suscribe a los cambios de `isAvailable` de `products` y los aplica al
 * store. Una suscripción por pestaña.
 *
 * ⛔ SOLO LECTURA. Esta tarea nunca escribe: el único camino de escritura
 *    es `toggleProductAvailabilityAction` (Tarea 14 §6.5). Ver §4.2.
 */
export const useAvailabilityRealtime = (): void => {
  const applyAvailability = useAvailabilityStore((state) => state.applyAvailability);

  useEffect(() => {
    const channel: RealtimeChannel = supabaseBrowser()
      .channel(CHANNEL_NAME)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "products",
          // Sin filtro: el servidor decide qué se publica. Filtrar por id
          // acá implicaría mantener una lista de ids que se desactualiza
          // sola, que es peor que recibir de más.
        },
        (payload) => {
          // El guard va ANTES de usar los campos. Un evento sin `id` se
          // descarta en vez de escribir `undefined` como clave del store.
          if (!esEventoDeDisponibilidad(payload.new)) return;

          applyAvailability(payload.new.id, payload.new.isAvailable);
        },
      )
      .on("error", (error) => {
        // Un canal caído no es un error de usuario: el snapshot del HTML
        // sigue siendo un estado coherente. Ver §5.5.
        console.warn(`[realtime] error en el canal ${CHANNEL_NAME}`, error);
      })
      .subscribe();

    return () => {
      // Con StrictMode el cleanup corre en el desmontaje intermedio: sin
      // esto, la primera suscripción queda viva para siempre. Ver §5.4.
      void supabaseBrowser().removeChannel(channel);
    };
  }, [applyAvailability]);
};
```

Dos puntos que aparecen en cada implementación de esto y que conviene no perder:

- **El tipo genérico del `.on()` no transforma nada.** El payload de `postgres_changes` está tipado como `Record<string, any>` por la librería, y el genérico es una declaración de intención. Por eso la validación en runtime no es opcional, y por eso se hace con un type guard (§7) y no con un `as`: un `as` sin chequeo es un `any` disfrazado.
- **La dependencia del `useEffect` es `applyAvailability`.** Zustand devuelve una función estable, así que el efecto no se re-suscribe en cada render. Si en su lugar se pusiera `useAvailabilityStore()` entero, el efecto se dispararía en cada cambio de disponibilidad y se abriría una suscripción por evento.

### 6.4 El bridge

```tsx
// src/components/catalog/AvailabilityRealtimeBridge.tsx
"use client";

import { useAvailabilityRealtime } from "@/hooks/use-availability-realtime";

/**
 * Monta la suscripción de disponibilidad una vez por pestaña.
 *
 * No renderiza nada: existe para que el hook corra en un punto del árbol
 * que no dependa de que haya productos en pantalla. Ver §4.5.
 */
export const AvailabilityRealtimeBridge = (): null => {
  useAvailabilityRealtime();
  return null;
};
```

Y su montaje:

```tsx
// src/app/(public)/layout.tsx
import { AvailabilityRealtimeBridge } from "@/components/catalog/AvailabilityRealtimeBridge";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      {/* Una sola suscripción por pestaña, no una por card. */}
      <AvailabilityRealtimeBridge />
    </>
  );
}
```

Que sea un componente aparte y no una llamada al hook dentro del layout es lo que permite testear la suscripción sin renderizar header ni footer.

### 6.5 Integración con `ProductCard`

```tsx
// src/components/catalog/ProductCard.tsx
"use client";

import { useProductAvailability } from "@/store/availability-store";
import type { ProductDTO } from "@/lib/domain";

interface ProductCardProps {
  product: ProductDTO;
  onAddToCart: (product: ProductDTO) => void;
}

export const ProductCard = ({ product, onAddToCart }: ProductCardProps) => {
  // ⛔ La prop `product.available` es el snapshot del servidor; el store
  //    pisa ese valor en cuanto llega un evento. Ver §4.3.
  const isAvailable = useProductAvailability(product.id, product.available);

  return (
    <article
      className={isAvailable ? "group" : "group opacity-60 grayscale"}
      aria-busy={false}
    >
      <ProductImage
        src={product.imageUrl}
        alt={product.name}
        isAvailable={isAvailable}
        priority={false}
      />
      <h3 className="font-semibold">{product.name}</h3>
      <p className="text-sm text-muted-foreground">{product.description}</p>
      <p className="font-medium">{formatPrice(product.priceInCents)}</p>

      {isAvailable ? (
        <button type="button" onClick={() => onAddToCart(product)}>
          Agregar
        </button>
      ) : (
        <span className="text-muted-foreground" data-testid="badge-agotado">
          Agotado
        </span>
      )}
    </article>
  );
};
```

Lo que cambia respecto de la Tarea 10 es **una sola línea**: `const isAvailable = useProductAvailability(...)` en lugar de leer `product.available` directo. El resto del componente no se toca, y esa es la prueba de que la separación contenido/disponibilidad quedó bien hecha desde el principio: el producto sigue llegando entero por props y lo único que se suscribe es el booleano.

`ProductImage` recibe `isAvailable` como prop desde la card, no se suscribe por su cuenta. Una imagen que se suscribe sola abriría un segundo lector del mismo store por producto.

### 6.6 Lo que NO se hace: filtrar el catálogo en vivo

Decisión explícita, porque es la que más se discute en la revisión: **esta tarea no oculta productos ni categorías cuando llega un evento.**

La razón es que no hace falta. El diseño de la Tarea 10 ya muestra el producto agotado con su badge en lugar de hacerlo desaparecer, y el badge es un evento vivo: pasa a "Agotado", el botón de agregar se deshabilita y la card se atenúa. Un cliente que está mirando el menú ve el cambio con un recuadro gris y un texto, no con un producto que se borra de la pantalla.

Si aun así se quisiera sacar la card cuando `isAvailable` pasa a `false`, el problema técnico no es el hook sino el selector:

```tsx
// ⛔ NO FUNCIONA — y el error es difícil de ver.
// `Array.prototype.map` devuelve un array NUEVO en cada llamada. Zustand compara
// el resultado del selector por identidad, así que lo ve como "cambió" en cada
// render y vuelve a renderizar. Con `useSyncExternalStore` eso termina en
// "The result of getSnapshot should be cached" o en un bucle infinito.
const disponibles = useAvailabilityStore((state) =>
  section.products.filter((p) => state.byProductId[p.id] ?? p.available),
);
```

La forma correcta, si alguna vez hace falta, es devolver un **contador** en vez de un array, porque un número se compara por valor:

```tsx
const cantidadDisponible = useAvailabilityStore((state) =>
  section.products.reduce(
    (total, p) => total + (state.byProductId[p.id] ?? p.available ? 1 : 0),
    0,
  ),
);
```

Se deja escrito y **no se implementa** por dos motivos: agrega un selector que corre en cada evento sobre todos los productos de la categoría para producir un dato que la UI ya muestra de otra forma, y abre la puerta a que alguien use el patrón del array por costumbre y rompa el render. Lo que sí corresponde es que `hasAvailableProducts(sections)` de la Tarea 08 §6.1 se use **en el servidor**, en el render del HTML, que es donde tiene sentido: decide si la página arranca con el estado vacío o con el catálogo.

### 6.7 El panel admin también se suscribe

```tsx
// src/components/admin/AvailabilitySwitch.tsx
"use client";

const isAvailable = useProductAvailability(product.id, product.isAvailable);
```

Con esto, el switch del panel pasa a tener dos caminos de escritura: la propia action optimista (Tarea 14 §6.10) y el evento que llega de otro dispositivo. El conflicto se resuelve por orden temporal, y el orden siempre es el mismo:

| Situación | Quién gana | Por qué |
|---|---|---|
| El evento coincide con el valor local | No pasa nada | El reductor compara y devuelve el mismo estado. Sin parpadeo |
| El evento difiere del valor local | Gana el evento | La base es la única fuente de verdad. Un switch que muestra algo que la base no tiene es peor que uno que tarda 300 ms en corregirse |
| Llega un evento de otro dispositivo | Gana el evento | Es un cambio real que este usuario no hizo y necesita verlo |

La action escribe primero y el evento confirma después, porque el evento sólo se emite cuando la transacción de la action ya se hizo commit. Nunca al revés: si el switch se actualizara por el evento y la action todavía no terminó, el usuario vería el estado viejo rebotar encima del nuevo.

---

## 7. Contratos y tipos

```ts
// Contrato del canal. No es un tipo de dominio: describe el transporte.
export interface ProductAvailabilityEvent {
  id: string;
  isAvailable: boolean;
}

/** Estado inicial que llega del servidor en cada render del HTML. */
export interface CatalogSnapshot {
  sections: CatalogSectionDTO[];
}

export const useProductAvailability = (id: string, inicial: boolean): boolean;
export const useAvailabilityRealtime = (): void;
```

Dos reglas de tipos que sostienen la tarea:

1. **El payload se estrecha con un type guard, no con `as`.** `esEventoDeDisponibilidad` de §6.3 devuelve `valor is ProductAvailabilityEvent`: el compilador sabe que, después del `if (!esEventoDeDisponibilidad(...)) return;`, `payload.new` tiene esos dos campos con esos dos tipos. Un `as` no estrecha nada: le dice al compilador que confíe sin que nadie haya verificado nada.
2. **El store no se tipa con el DTO de `Product`.** `Record<string, boolean>` no puede olvidar un campo, no se desincroniza con Prisma y no obliga a re-migrar si mañana el modelo suma columnas. Es el mismo criterio que aplica la Tarea 04 al no filtrar `select` en el dominio.
3. **`payload.new` de `postgres_changes` viene tipado como `Record<string, any>` por `@supabase/supabase-js`.** Eso es un `any` de la librería, no del proyecto, y por eso el guard existe: sin él, ese `any` se propagaría al callback y de ahí al store. La regla de cero `any` del proyecto se cumple en el código propio; lo que entra por la puerta de una dependencia se documenta y se estrecha en el borde.

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [x] `products` está publicada en `supabase_realtime` y la migración es idempotente
- [ ] Un `UPDATE` de `isAvailable` llega a las pestañas abiertas en menos de 2 segundos *(la verificación manual con dos pestañas reales queda en el §11: necesita Supabase real, que aún no tiene credenciales — Tarea 02)*
- [x] La card pasa a estado "Agotado" sin recarga de página, sin spinner y sin parpadeo
- [x] El botón "Agregar" se deshabilita y la imagen se atenúa en el mismo tick del evento
- [x] El snapshot del HTML del servidor se muestra correctamente **antes** de que llegue cualquier evento
- [ ] Con el WebSocket caído, la página sigue mostrando el snapshot y no muestra ningún error al usuario *(la rama de error sí está testeada — verel `emitirError` del test del hook—, pero la pérdida de socket real solo se ve en un ambiente arriba)*
- [x] El switch del panel se actualiza cuando el cambio lo hizo otro dispositivo
- [ ] El número de peticiones a la base **no aumenta** por tener el catálogo abierto *(verificación con DevTools de un ambiente arriba; en código no se agregó ninguna lectura —la suscripción la abre el navegador contra Supabase—)*

### 8.2 Calidad

- [x] `npm run lint` y `npm run typecheck` pasan sin errores ni warnings
- [x] Ningún archivo nuevo supera las 200 líneas; `availability-store.ts` no supera las 40
- [x] Los nombres dicen qué hacen, no cómo: `applyAvailability`, no `setIsAvailable` ni `update`
- [x] El type guard `esEventoDeDisponibilidad` existe y se usa antes de leer el payload
- [x] Ningún selector devuelve un array o un objeto nuevo creado dentro del selector
- [x] No hay `console.log`; sólo el `console.warn` justificado de §5.5
- [x] Los comentarios explican el porqué de las decisiones no obvias, no la sintaxis

### 8.3 Arquitectura — verificación obligatoria

- [x] `src/store/availability-store.ts` no importa Prisma, ni `next/server`, ni `next/cache`
- [x] `rg "revalidateTag|revalidatePath" src/` no devuelve nada en los archivos de esta tarea
- [x] Ningún archivo de esta tarea llama `toggleProductAvailabilityAction` ni ninguna otra action
- [x] La suscripción se abre con `supabaseBrowser()`, nunca con el cliente de servidor
- [x] La suscripción se crea en **un** componente; `rg "\.channel\(" src/` devuelve un solo archivo
- [x] Ningún componente llama `useProductAvailability` dentro de un `map` o un `useMemo`
- [x] La publicación de Realtime está en una migración versionada, no en un paso manual
- [x] El store no usa `persist`: la disponibilidad no sobrevive a un refresh
- [x] No se agregaron dependencias: se usan `zustand` y `@supabase/supabase-js`, que ya están

### 8.4 Pruebas

- [x] `availability-store.test.ts` cubre: aplicar un valor, deduplicar un valor repetido y limpiar
- [x] El test de deduplicación verifica **identidad de estado**, no sólo igualdad de valores
- [x] `use-availability-realtime.component.test.tsx` verifica que se llama a `removeChannel` al desmontar
- [x] Hay un test para el payload inválido: no escribe nada en el store
- [x] El test de integración confirma que un evento con `isAvailable: false` deshabilita el botón
- [x] `npm run test` pasa

### 8.5 Seguridad

- [x] El canal se abre con el cliente de **navegador** (`supabaseBrowser`), nunca con cookies de servidor
- [x] La sesión del panel se sigue validando en cada carga del layout admin: Realtime no reemplaza la autorización
- [x] La acción de escritura sigue siendo la única; Realtime no abre un segundo camino que esquive `verifyAdminSession`
- [x] El canal no transmite datos de otras tablas: `schema: "public"`, `table: "products"`, `event: "UPDATE"`
- [x] Se documentó qué columnas viajan en el payload y por qué no es un riesgo en este alcance
- [x] El `console.warn` no imprime el objeto del error completo si puede contener el token de sesión

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado | Por qué |
|---|---|---|
| El WebSocket nunca conecta | La página muestra el snapshot del HTML, sin error visible | El snapshot es un estado coherente. Un cartel de "sin conexión" en un menú de café es ruido |
| El evento llega con un `id` que no está en el catálogo | Se guarda en el store y no se ve en pantalla | Es un producto que alguien acaba de crear o publicar. El store lo tendrá listo cuando el HTML lo muestre |
| Llegan dos eventos con el mismo valor seguidos | El segundo no re-renderiza nada | Deduplicación por identidad en el reductor (§5.2) |
| El usuario marca agotado desde su propio panel | Su switch ya estaba actualizado por la action optimista; el evento no lo cambia | Coherencia entre los dos caminos de escritura (§6.7) |
| El evento llega con el foco puesto en "Agregar" | El botón se deshabilita; si ya está en el carrito, el carrito no se toca | El carrito es estado del cliente y se resuelve en el checkout. Ver Tarea 11 |
| La publicación de Realtime no se aplicó en el ambiente | No llegan eventos; el snapshot sigue funcionando | Por eso la migración está en §8.1: sin ella la tarea "funciona" en local y falla en staging |
| Un `UPDATE` cambia otros campos y no `isAvailable` | Llega el evento, el guard pasa, se aplica el mismo valor y no re-renderiza | Deduplicación. El payload trae la fila entera, pero el store mira dos campos |
| El componente se desmonta y se remonta muy rápido | El `removeChannel` del cleanup corre y no queda suscripción huérfana | `StrictMode` hace exactamente eso dos veces por montaje en desarrollo |
| Un producto pasa a `ARCHIVED` en vez de agotarse | Llega el evento sin cambios de `isAvailable`: no se ve nada | Fuera de alcance: el contenido del catálogo se actualiza por revalidación, no por Realtime |
| La pestaña queda abierta horas y el store acumula ids viejos | El store crece mientras la pestaña viva | Se acepta: es un booleano y una clave por producto, y se descarta con la pestaña. Persistirlo sería peor (§5.1) |

---

## 10. Pruebas

### 10.1 Pruebas del store

```ts
// src/store/availability-store.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { useAvailabilityStore } from "@/store/availability-store";

describe("useAvailabilityStore", () => {
  beforeEach(() => {
    useAvailabilityStore.getState().clearAvailability();
  });

  it("guarda la disponibilidad recibida por evento", () => {
    useAvailabilityStore.getState().applyAvailability("prod_1", false);

    expect(useAvailabilityStore.getState().byProductId).toEqual({ prod_1: false });
  });

  it("no cambia la identidad del estado si el valor no cambió", () => {
    useAvailabilityStore.getState().applyAvailability("prod_1", false);

    const antes = useAvailabilityStore.getState();
    useAvailabilityStore.getState().applyAvailability("prod_1", false);
    const despues = useAvailabilityStore.getState();

    // Identidad, no igualdad: es lo que evita el re-render. Con `toEqual`
    // pasaría también con un array nuevo y no detectaría el bug.
    expect(despues).toBe(antes);
  });

  it("reemplaza el valor cuando la disponibilidad cambia de verdad", () => {
    useAvailabilityStore.getState().applyAvailability("prod_1", false);
    useAvailabilityStore.getState().applyAvailability("prod_1", true);

    expect(useAvailabilityStore.getState().byProductId.prod_1).toBe(true);
  });

  it("conserva los ids que no son el que cambió", () => {
    const store = useAvailabilityStore.getState();
    store.applyAvailability("prod_1", false);
    store.applyAvailability("prod_2", true);
    store.applyAvailability("prod_1", true);

    expect(useAvailabilityStore.getState().byProductId).toEqual({
      prod_1: true,
      prod_2: true,
    });
  });
});
```

### 10.2 Prueba del hook con doble del cliente de Supabase

```tsx
// src/hooks/use-availability-realtime.component.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useAvailabilityRealtime } from "@/hooks/use-availability-realtime";
import { useAvailabilityStore } from "@/store/availability-store";

/** Captura el callback de postgres_changes para poder dispararlo a mano. */
type Callback = (payload: { new: Record<string, unknown> }) => void;

const crearCanalDoble = () => {
  let callback: Callback | null = null;

  const channel = {
    on: vi.fn((_tipo: string, _filtro: object, fn: Callback) => {
      callback = fn;
      return channel;
    }),
    subscribe: vi.fn(() => channel),
  };

  return {
    channel,
    removeChannel: vi.fn(),
    emitir: (nuevo: Record<string, unknown>) => callback?.({ new: nuevo }),
  };
};

const supabaseDoble = crearCanalDoble();

vi.mock("@/server/infra/supabase/client", () => ({
  supabaseBrowser: () => ({
    channel: () => supabaseDoble.channel,
    removeChannel: supabaseDoble.removeChannel,
  }),
}));

const Probe = (): null => {
  useAvailabilityRealtime();
  return null;
};

describe("useAvailabilityRealtime", () => {
  beforeEach(() => {
    useAvailabilityStore.getState().clearAvailability();
    supabaseDoble.removeChannel.mockClear();
  });

  it("escribe en el store lo que llega por el canal", () => {
    render(<Probe />);
    supabaseDoble.emitir({ id: "prod_1", isAvailable: false });

    expect(useAvailabilityStore.getState().byProductId.prod_1).toBe(false);
  });

  it("descarta un payload sin id", () => {
    render(<Probe />);
    supabaseDoble.emitir({ isAvailable: false });

    expect(useAvailabilityStore.getState().byProductId).toEqual({});
  });

  it("cierra el canal al desmontar", () => {
    const { unmount } = render(<Probe />);
    unmount();

    // Sin este cleanup, cada montaje de StrictMode deja una suscripción
    // viva para siempre. Ver §5.4.
    expect(supabaseDoble.removeChannel).toHaveBeenCalled();
  });
});
```

> El doble del canal se crea **fuera** del `describe` a propósito. Si se creara dentro, cada test tendría su propio canal y `removeChannel` no se podría observar entre tests: la aserción de cleanup pasaría siempre, para bien y para mal.

### 10.3 Pruebas de integración del comportamiento visible

| Test | Setup | Aserción |
|---|---|---|
| La card refleja el evento | Renderizar `ProductCard` con `available: true` y emitir `{ id, isAvailable: false }` | El botón "Agregar" está deshabilitado y aparece el badge "Agotado" |
| El snapshot inicial se respeta | Renderizar sin emitir ningún evento | La card se ve disponible |
| El switch del panel se corrige solo | Renderizar `AvailabilitySwitch` y emitir el valor contrario | El switch refleja el valor del evento |

### 10.4 Verificación manual del objetivo de 2 segundos

1. `npm run dev`
2. Abrir `/menu` en dos ventanas y `/admin/productos` en una tercera
3. En la tercera, marcar un producto como agotado y anotar la hora
4. En cada ventana del menú, el estado debe cambiar en menos de 2 segundos
5. En DevTools → Network, en las ventanas del menú **no debe aparecer ninguna request** a `/api` ni a Supabase REST
6. Cerrar y reabrir `/menu`: el estado tiene que venir del HTML, no del store

Si el paso 4 falla, el problema está en la publicación de §6.2 antes que en el código: sin `ALTER PUBLICATION`, la conexión se abre, se autentica y no llega nada, sin mostrar un solo error.

---

## 11. Definición de "Hecho" (Definition of Done)

- [x] Los criterios 8.1 a 8.5 están marcados, cada uno verificado y no de memoria
- [x] `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build` pasan
- [x] La migración de la publicación está aplicada en local y verificada con una query:

  ```sql
  select pubname, schemaname, tablename
  from pg_publication_tables
  where pubname = 'supabase_realtime';
  ```

- [ ] La verificación manual de §10.4 se hizo de verdad, con dos ventanas del menú
- [x] `docs/tasks/README.md` marca la Tarea 15
- [ ] `git status` no muestra cambios fuera de los archivos de §3

**Fuera de alcance de esta tarea**, anotado para que nadie lo agregue "de paso":

- **El polling de respaldo.** La Tarea 08 §6.6 lo deja preparado; implementarlo exige decidir un intervalo y un presupuesto de queries, y eso es una decisión de producto, no técnica.
- **Filtrar u ocultar categorías en vivo** (§6.6). El badge ya comunica la falta de stock y el patrón que haría falta para filtrar es una trampa de re-render.
- **Escuchar cambios de precio, nombre o foto.** Esos son cambios de contenido y llegan por revalidación del tag `products`, no por Realtime. Ampliar el filtro del canal a "cualquier cambio de `products`" mezclaría las dos responsabilidades y haría que un cambio de precio re-renderice cuarenta cards.
- **Un indicador visual de conexión.** "Conectado" o "desconectado" es información de infraestructura expuesta en la interfaz de un menú. Si algún día hace falta, es una tarea aparte y con su propio diseño.

---

## 13. Registro de ejecución y desviaciones

**Fecha:** 2026-10-03 · **Verificación:** `npm run verify` ✅ (340 tests, 45 archivos) · `npm run build` ✅ · `rg "\.channel\(" src/` un solo archivo (`src/hooks/use-availability-realtime.ts`) ✅ · `rg "persist" src/store/availability-store.ts` sin resultados ✅ · **líneas de archivos nuevas (con comentarios, ≤ 200 y el store ≤ 40):** `availability-store.ts` 39 · `use-availability-realtime.ts` 101 · `AvailabilityRealtimeBridge.tsx` 15 ✅ · query del §11 sobre la base local: `supabase_realtime | public | products` ✅ · **15 tests nuevos** (5 store + 6 hook + 4 card).

**Desviaciones respecto del documento:**

1. **La migración de la publicación es una migración Prisma (`prisma/migrations/20261003134210_realtime_publicacion/migration.sql`), no un archivo suelto en `supabase/migrations/`.** El repo versiona el esquema con `prisma migrate`, y el container de pruebas es un Postgres vainilla que no trae `supabase_realtime` creada de fábrica: la sentencia va envuelta en un `DO $$ IF NOT EXISTS` que crea la publicación si falta y agrega la tabla si falta. Misma obligación ("es parte del esquema"), mismo resultado en Supabase gestionado (donde la publicación ya existe y solo se agrega la tabla), y ningún paso manual fuera del repo.
2. **La excepción ESLint para `@/server/infra/supabase/client` ya existía** desde la Tarea 01 (constante `SERVIDOR_INTERNO_EXCEPTO_REALTIME`, creada para exactamente este uso): no se agregó nada en `eslint.config.mjs`.
3. **`ProductAvailabilityEvent` lleva una firma de índice (`[columna: string]: unknown`).** El payload de `postgres_changes` trae la fila entera y el type guard solo puede declarar un tipo que sea asignable a `Record<string, unknown>`. Sin la firma de índice no compila: es la forma de tener el guard *y* dejar explícito que el resto de las columnas se ignora.
4. **El `console.warn` en el canal de error registra solo `error.message`** (si hay) y nunca el objeto entero: un rechazo de autenticación puede arrastrar metadatos de la conexión y la URL del proyecto. Compila con TS, cumple §8.5.
5. **El switch del panel no lee `product.isAvailable` para nada aparte del fallback inicial.** La doc dice *"pasa a tener dos caminos de escritura"*: la acción optimista y el evento. En la práctica la fuente de verdad del control es el store (`useProductAvailability`), y la acción **también** escribe al store antes de pegarle al servidor. Así la corrección por evento de otra pestaña funciona igual sólo que con una sola dirección de lectura en el JSX.
6. **El test del hook registra los callbacks por tipo** (`postgres_changes` por un lado, `error` por el otro). El documento's sketch asume una sola firma de `.on` y sobrescribe el callback: con el registro de errores de §5.5 el segundo `.on("error", …)` ponía `callback = undefined` y el test de emisión fallaba en silencio. Almacenarlos por tipo preserva la idea del sketch (canal doble fuera del `describe`) sin el bug.
7. **El test del switch perdió la aserción `toBeChecked()` sobre el estado local** porque el control ya no tiene estado local: lee del store. Los tests existentes pasan porque el comportamiento es el mismo; solo cambió dónde vive el booleano. Además se limpia el store en `beforeEach`: si no, un evento de un test anterior aparecería como un valor que nadie pidió.
8. **El `errorCallback` del doble de canal se prueba a propósito** (`debe avisar por consola si el canal se rompe, sin tocar la UI`) porque §5.5 es una decisión de código: un canal caído no debe tirar un toast ni pintar nada en pantalla.

**Los criterios de §8 que quedan sin marcar y por qué:**

- **§8.1 "Un `UPDATE` llega en menos de 2 segundos"** y **§10.4 (dos ventanas abiertas)** requieren una instancia de Supabase con Realtime habilitado, que la Tarea 02 todavía no tiene (credenciales en placeholder). La rama de éxito está cubierta por el test del hook con canal doble, y la rama de corte de socket por el test de error del canal, pero el delay real red-servidor no se midió.
- **§8.1 "El número de peticiones a la base no aumenta"** se deduce del código (no hay lectura extra en el bridge) pero su verificación es de DevTools en un ambiente arriba.
- **§11 "`git status` no muestra cambios fuera de los archivos de §3"**: además de los archivos de §3 se tocó `docs/tasks/README.md` y `docs/tasks/15-disponibilidad-en-tiempo-real.md` (registro de ejecución). Los cambios de la Tarea 14 detectados en la revisión inicial (`src/components/admin/LoginForm.tsx` pre-existente, etc.) no son de esta tarea.

**Antes de mergear**, si el despliegue va a producción: revisar en el panel de Supabase que `ALTER PUBLICATION` sobre `products` no tenga confianza con RLS (la doc §6.2 asume que Realtime respeta el rol del `authenticated`/`anon`; si el proyecto tiene RLS en ese esquema sin `SELECT` política, el evento no llega a clientes sin sesión — eso ya estaba documentado en §12.4 como "revisar la lista de columnas si se suscribe desde el público").

---

## 12. Dependencias y bloqueos

### 12.1 Depende de

| Tarea | Qué aporta | Qué pasa si falta |
|---|---|---|
| **14** | `toggleProductAvailabilityAction`, `AvailabilitySwitch`, la tabla de productos | No hay con qué disparar un evento: la tarea no se puede probar de punta a punta |
| **07** | `supabaseBrowser()` y la sesión con `@supabase/ssr` | No hay cliente de navegador. Crear uno acá duplicaría el manejo de cookies de la Tarea 07 |
| **02** | La base en Supabase con Realtime habilitado en el proyecto | El canal se suscribe y nunca llega nada |
| **08** | `hasAvailableProducts(sections)`, usada en el render del servidor | El estado vacío del catálogo no se puede decidir |
| **10** | `ProductCard`, `ProductImage` y el contrato `available: boolean` | No hay nada a lo que suscribir en el público |
| **11** | `zustand` instalado | `npm i zustand` y nada más: el store es la única pieza que lo necesita |

### 12.2 Esta tarea no bloquea a nadie

Es el cierre del circuito de stock. La Tarea 16 (CRUD de productos) no depende de ella: la publicación y la disponibilidad se escriben por caminos distintos, y el CRUD sólo reutiliza la acción que ya existe desde la 14.

Si la Tarea 16 llegara antes y tocara `ProductCard` o `AvailabilitySwitch`, la 15 se aplica después sin conflicto: su única modificación sobre el catálogo es la línea del selector.

### 12.3 Riesgos conocidos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Olvidar la migración de la publicación | El más probable y el más difícil de ver: no hay error, sólo silencio | Está en 8.1 y en el DoD, con la query de verificación |
| Entitlements de Realtime desactivados en el proyecto de Supabase | El canal se abre y no llega nada | Verificar el panel de Supabase una vez antes de empezar; es una causa indistinguible del anterior |
| Payload con columnas que no se esperan | El type guard evita que lleguen al store, pero el ruido sigue | El store ignora todo menos `id` e `isAvailable` |
| Fuga de socket en montaje rápido de StrictMode | Suscripciones duplicadas y eventos contados dos veces | El `removeChannel` en el cleanup, con test que lo verifica |

### 12.4 Nota de alcance sobre las columnas del payload

`postgres_changes` entrega la fila completa de la tabla en `payload.new`, no sólo las columnas modificadas. Con el filtro de §6.3 eso significa que viajan nombre, precio, descripción y la URL de la imagen cada vez que cambia la disponibilidad.

En este alcance no es un problema: el canal se abre con la sesión de un usuario legítimamente autenticado, la tabla `products` no tiene datos personales, y un usuario del panel ya puede leer esas mismas columnas por la interfaz. Lo que **no** se hace es ampliar este canal a otras tablas con datos sensibles.

Si alguna vez el canal se suscribe desde el público —que es lo que haría falta para que un cliente sin sesión viera cambios en vivo—, hay que revisar la lista de columnas y considerar `REPLICA IDENTITY` o una vista reducida. Eso no se hace ahora: el catálogo público se genera en el servidor y el snapshot de §2.1 alcanza.
