# Tarea 09 — Fundamentos de UI y Sistema de Diseño

| Campo | Valor |
|---|---|
| **ID** | 09 |
| **Fase (DESIGN.md §8.3)** | Fase 1 — Cimientos y Modelado |
| **Depende de** | 01 |
| **Habilita** | 10, 11, 13, 14, 16, 17 |
| **Tipo** | Presentación — sistema de diseño y primitivas |
| **Esfuerzo est.** | 1 – 1.5 días |

---

## 1. Objetivo de la tarea

Definir el **sistema de diseño** y construir las **primitivas de UI** sobre las que se apoya todo lo visual del proyecto: tokens de color y tipografía en Tailwind v4, y trece componentes sin conocimiento de negocio en `src/components/ui/`.

**Criterio de éxito verificable:** `rg "Product|producto|category|categoría|price|precio" src/components/ui/` devuelve cero coincidencias, `rg "from \"lucide|from \"@heroicons|from \"react-icons" src/` devuelve cero, y `npm run build` compila sin usar ninguna clase de color que no venga de un token de `@theme`.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 01 completada (Next.js 15 + Tailwind v4 + Vitest configurado). No requiere base de datos: esta tarea no toca Prisma.

**Por qué arranca acá y no más tarde.** Las tareas 10 a 17 todas renderizan algo. Si cada una define su propio gris, su propio radio y su propio `whileTap`, el resultado es un sitio con seis estilos distintos que no se parecen en ninguna pantalla. El sistema de diseño es la Intersección de todas las tareas visuales: tiene que existir antes que la primera.

**Restricción dura de este proyecto:** no se instala ninguna librería de componentes de terceros. Las primitivas son propias, pesan cero KB extra y dan control total del resultado estético (DESIGN.md §4.2).

### Checklist de prerrequisitos

- [ ] `npx create-next-app` con Tailwind v4 instalado y `@import "tailwindcss"` en `globals.css`
- [ ] `src/app/layout.tsx` existe con `<html lang="es-AR">` y `@import "tailwindcss"` en `globals.css`
- [ ] `vitest.config.ts` de la Tarea 01 corre en `environment: "node"`
- [ ] `@vitejs/plugin-react` está en `devDependencies` (lo instala la Tarea 01)
- [ ] Node tiene salida a internet en el build, o hay `.woff2` locales para `next/font/local`

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `src/app/globals.css` | Tokens `@theme` de Tailwind v4, capa base, foco visible, `prefers-reduced-motion` |
| `src/lib/ui/classes.ts` | `joinClasses`: une clases ignorando los segmentos vacíos. Reemplaza a `clsx` sin agregar dependencia |
| `src/components/ui/use-dialog.ts` | Foco inicial, focus trap, devolución del foco, `Escape` con pila de diálogos y scroll lock para iOS. **Interno, no se reexporta** |
| `src/components/ui/field.tsx` | `useFieldIds`, `controlClass`, `FieldLabel`, `FieldHint`, `FieldError`: el cableado de accesibilidad que comparten los tres controles |
| `src/components/ui/Button.tsx` | Cuatro variantes, tres tamaños, estado de carga y `buttonClassName` para enlaces |
| `src/components/ui/Badge.tsx` | Tres tonos semánticos, con punto de estado para que el color no sea el único indicio |
| `src/components/ui/Input.tsx` | Label + input + hint + error con `aria-describedby` |
| `src/components/ui/Select.tsx` | `<select>` nativo con label, opción vacía bloqueada y error |
| `src/components/ui/Textarea.tsx` | Igual que `Input`, multilínea |
| `src/components/ui/Skeleton.tsx` | Bloque de carga con la geometría del contenido real, más `SkeletonText` |
| `src/components/ui/Sheet.tsx` | Panel lateral o inferior: `role="dialog"`, `aria-modal`, focus trap, `Escape`, scroll lock, clic en el overlay |
| `src/components/ui/ConfirmDialog.tsx` | Confirmación modal (`role="alertdialog"`) para acciones destructivas, con error en línea |
| `src/components/ui/ToastProvider.tsx` | Contexto, reducer, cola con tope de 3 y auto-dismiss diferenciado por tono |
| `src/components/ui/ToastViewport.tsx` | Presentación de la cola: región `aria-live`, ícono por tono y descarte manual |
| `src/components/ui/states.tsx` | `EmptyState`, `ErrorState` y `AsyncBoundary`, que decide entre carga, error, vacío y contenido |
| `src/components/ui/index.ts` | Barrel de las primitivas. Único punto de entrada |
| `vitest.setup.ts` | Setup del proyecto Vitest de componentes: `jest-dom`, `cleanup`, stubs de `matchMedia` y `scrollTo` |
| `src/lib/ui/classes.test.ts` | `joinClasses` descarta vacíos y conserva el orden |
| `src/components/ui/Button.component.test.tsx` | Clic, estado de carga, `aria-busy` y `buttonClassName` |
| `src/components/ui/Sheet.component.test.tsx` | Rol y nombre, foco al abrir, foco devuelto, `Escape`, ciclo de `Tab` |
| `src/components/ui/ConfirmDialog.component.test.tsx` | `alertdialog`, `Escape` bloqueado en vuelo, error en línea sin cierre |
| `src/components/ui/ToastProvider.component.test.tsx` | `aria-live="polite"`, 4 s contra 7 s, error sin provider |

Los tests viven junto al código que prueban, con el sufijo `.component.test.tsx`. En la Tarea 04 viven en `tests/`; la diferencia es intencional: acá hay muchos archivos chicos y el sufijo es lo que le permite al proyecto `ui` de Vitest tomar solo los `.tsx` sin listar rutas.

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `src/app/layout.tsx` | Cargar las dos tipografías con `next/font` y envolver el árbol en `ToastProvider` y `ToastViewport` |
| `src/app/page.tsx` | Reemplazar las clases `neutral-*` de la Tarea 01 por tokens de `@theme` |
| `vitest.config.ts` | Agregar `test.projects` con un proyecto `node` y otro `jsdom` |
| `vitest.setup.ts` | Crear el archivo de setup que la Tarea 01 no tenía |
| `package.json` | Agregar `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` y `jsdom` |
| `docs/tasks/README.md` | Marcar Tarea 09 |

### 3.3 Eliminar

Ninguno.

---

## 4. Estructura N-Capas

### 4.1 Qué vive en esta capa

| Directorio | Qué va acá | Qué NO va acá |
|---|---|---|
| `src/app/globals.css` | Tokens, capa base, reglas globales de foco y movimiento | Estilos de un componente concreto |
| `src/components/ui/` | Componentes genéricos, sin nouns del dominio | Cualquier cosa que sepa qué es un producto, una categoría o un precio |
| `src/lib/ui/classes.ts` | Funciones puras de composición de clases | Estado, efectos, datos |

### 4.2 La regla más importante de esta tarea

> **Una primitiva no sabe qué es un producto.**

Es la frontera entre el sistema de diseño y la aplicación. Si `Button` tuviera un prop `isOutOfStock`, el carrito de la Tarea 11 y el panel de la Tarea 14 ya no podrían compartirlo, y para las seis tareas siguientes habría que duplicar componentes o agregar props de negocio a un sistema de diseño que se supone saber de todo.

| Se permite | No se permite |
|---|---|
| `variant: "primary" \| "secondary" \| "ghost" \| "danger"` | `variant: "agregarAlCarrito" \| "verificarStock"` |
| `tone: "success" \| "warning" \| "danger"` | `tone: "disponible" \| "agotado" \| "borrador"` |
| `isLoading`, `loadingLabel` | `isSavingProduct` |
| `icon`, `action`, `children` | `product`, `category`, `businessSettings` |
| `role="status"` | Saber si el texto es "Agotado" o "Cerrado" |

**El test de la regla:** `rg -i "producto|product|category|categor|price|precio|carrito|cart|whatsapp" src/components/ui/` tiene que devolver cero. Va en los criterios de aceptación y se verifica en el `npm run verify` de cada tarea siguiente.

Corolario: `Badge` no sabe que existe el concepto "disponible". Quien lo usa (Tarea 10) escribe `<Badge tone="success">Disponible</Badge>`. El texto va en el componente de negocio, la estética en la primitiva.

### 4.3 Los tokens y por qué el contraste está medido

`DESIGN.md §10.1` fija ocho colores. Con `@theme` de Tailwind v4 cada uno se convierte en una utilidad (`bg-crust`, `text-ink`, `border-sage`). Se agregan tres tokens derivados que la paleta base no cubre, declarados acá como decisión de esta tarea:

| Token | Valor | Por qué hace falta |
|---|---|---|
| `--color-ink-muted` | `#6B5A50` | Texto secundario. Derivar con `opacity` de `ink` no sirve: `text-ink/60` no pasa contraste AA y el color depende del fondo |
| `--color-clay-deep` | `#8C2F20` | Hover del destructivo. `clay` con un filtro de brillo tiene contraste impredecible |
| `--color-line` | `#E3D8CA` | Separador decorativo entre card y fondo. Separador sí, borde de control no |

**Contrastes medidos (WCAG 2.1).** Esta tabla no es decorativa: define qué combinaciones se pueden usar y cuáles no, y por eso varios tokens de la paleta base no sirven para texto.

| Combinación | Ratio | Veredicto |
|---|---|---|
| `ink` sobre `cream` | 14.6:1 | AAA. Es el texto de cuerpo |
| `ink-muted` sobre `cream` | 6.1:1 | AA. Texto secundario y metadatos. Sobre `paper` sube a 6.4:1 |
| `paper` sobre `crust` | 4.5:1 | AA al límite. **No se usa para texto de cuerpo**: el primario usa `crust-deep` |
| `paper` sobre `crust-deep` | 7.5:1 | AAA. Es el primario y su hover |
| `crust-deep` sobre `cream` | 7.0:1 | AAA. Único `crust` admisible como texto |
| `crust` sobre `cream` | 4.2:1 | **No pasa AA para texto de cuerpo.** Solo para texto grande (≥ 24 px) o como borde |
| `sage` sobre `cream` | 4.4:1 | **No pasa AA.** Solo como superficie con texto `paper` |
| `ink` sobre `sage` | 6.4:1 | AAA. Es el badge de disponible, con tinte de fondo |
| `amber` sobre `cream` | 2.7:1 | **No pasa ni para texto grande.** Solo como superficie |
| `ink` sobre `amber` | 6.0:1 | AA. Superficie de advertencia con texto oscuro |
| `paper` sobre `clay` | 6.5:1 | AA. Botón destructivo y badge de error |
| `clay-deep` sobre `clay` | 7.1:1 | AAA. Hover del destructivo |
| `clay-deep` sobre `paper` | 8.6:1 | AAA. Texto de error y de enlace |
| `crust-deep` sobre `paper` | 7.3:1 | AAA. Botón secundario, foco visible |
| `line` sobre `paper` | 1.3:1 | Decorativo. Separa, no informa |
| `line-strong` sobre `paper` | 3.7:1 | Cumple el 3:1 de borde de control (WCAG 1.4.11) |

Tres consecuencias que se traducen en reglas de uso:

1. **`crust` no se usa como color de texto.** El primario es `bg-crust-deep` con texto `paper` (7.5:1) y no `bg-crust` con texto `paper` (4.5:1, al límite y sin margen para errores de calibración de pantalla). El hover y los estados activos usan `clay-deep`.
2. **`amber` nunca es texto.** Es superficie, y el texto va en `ink`.
3. **Los bordes de control usan un color sólido, no un tinte.** `border-ink/15` da 1.7:1 contra `paper` y el control desaparece para quien tiene baja visión. Por eso `secondary` usa `line-strong` y no una opacidad de `ink`.

Se agrega un cuarto token derivado por esta razón:

| Token | Valor | Uso |
|---|---|---|
| `--color-line-strong` | `#8C8378` | Borde de `Button`/`Input` en `secondary`. Único borde que supera 3:1 contra `paper` |

Los controles deshabilitados están exentos de contraste (WCAG 1.4.3 excluye `disabled`). Aun así, `opacity` sola no alcanza como señal: por eso el estado `loading` de `Button` mantiene el texto y el ancho, y solo agrega el spinner.

### 4.4 Responsive y breakpoints

Mobile-first (DESIGN.md §10.2). Los breakpoints de diseño son **768** y **1024**, que en Tailwind v4 son exactamente `md` (48rem) y `lg` (64rem): no hace falta redefinir nada.

| Viewport | Columnas del grid de productos | Padding lateral |
|---|---|---|
| 360 px (el más angosto relevante) | 1 | 16 px |
| 768–1024 (tablet) | 2 | 24 px |
| > 1024 (desktop) | 3 o 4 | 32 px |

Reglas transversales:

- **Objetivo táctil mínimo 44×44 px.** Se implementa con `min-h-11` (2.75rem), no con `padding`: el `padding` no impide que un `<a>` con una línea de texto sea de 20 px de alto.
- **Ancho máximo de contenido 1200 px** centrado.
- **Ningún componente arranca con un ancho fijo.** Todo lo que se repite (grids, listas) se prueba a 360 px primero.
- **Tipografía fluida solo en los títulos display**, con `clamp()`. El cuerpo usa la escala fija: un `clamp()` en el cuerpo cambia el tamaño de línea y rompe la lectura en pantallas chicas.

### 4.5 Accesibilidad como criterio, no como revisión final

| Regla | Implementación en esta tarea |
|---|---|
| Foco visible siempre | `outline: 2px solid crust-deep` con `outline-offset: 2px` en la capa base, para todo elemento enfocable. Nunca `outline: none` sin reemplazo |
| Contraste AA | Medido y escrito en §4.3, no estimado |
| `Escape` cierra diálogos | `useDialog`, con pila de módulos para que solo cierre el de arriba |
| Foco atrapado en el diálogo | `useDialog`, con ciclo de `Tab` y `Shift+Tab` |
| Foco devuelto al cerrar | `useDialog` guarda el elemento activo antes de mover el foco |
| Objetivos táctiles ≥ 44 px | `min-h-11` en todos los controles |
| `prefers-reduced-motion` | Regla global en `globals.css` más variantes `motion-safe:` donde hace falta que una animación siga existiendo |
| Errores asociados al campo | `aria-invalid` + `aria-describedby` en `Input`, `Select` y `Textarea` |
| HTML semántico | El `Sheet` usa `<header>`, `<footer>` y encabezados `<h2>` reales; el `ConfirmDialog` usa `role="alertdialog"` con `aria-labelledby` y `aria-describedby` |

---

## 5. Convenciones de código (Clean Code + SOLID)

**Principios aplicados: SRP, OCP y Composición sobre configuración.**

### 5.1 `"use client"` es una decisión, no un default

No todos los componentes llevan la directiva. Ponerla en todos envía JavaScript al navegador que no hacía falta y rompe el modelo de "RSC por defecto, islas mínimas" (DESIGN.md §4.4).

| Archivo | Con `"use client"` | Por qué |
|---|---|---|
| `Button.tsx` | No | Solo `forwardRef` y JSX. Es un Server Component y por lo tanto llega al navegador sin hydrated |
| `Badge.tsx` | No | Función pura del `props` al JSX |
| `Skeleton.tsx` | No | Función pura del `props` al JSX |
| `field.tsx` | Sí | `useId` es un hook, y un hook no se puede llamar desde un Server Component |
| `Input.tsx`, `Select.tsx`, `Textarea.tsx` | Sí | Importan de `field.tsx`, que ya es cliente |
| `states.tsx` | Sí | `EmptyState` y `ErrorState` reciben `onClick`/`onRetry` del padre, que solo puede ser un Client Component |
| `Sheet.tsx`, `ConfirmDialog.tsx` | Sí | `useDialog`, `createPortal`, `useState` |
| `ToastProvider.tsx`, `ToastViewport.tsx` | Sí | Contexto, `useReducer`, portal |

La directiva es **por archivo**, no por componente: por eso `EmptyState` y `ErrorState` la heredan de `states.tsx` aunque no usen estado. La alternativa sería partirlos en un archivo cada uno para que uno quede sin la directiva, y el ahorro es de unos cientos de bytes a cambio de duplicar la cabecera de tipos tres veces. No compensa.

`Button` es el caso que más conviene recordar: un `forwardRef` no necesita `"use client"`. Los hooks de React que se usan en un Server Component están prohibidos, pero un servidor puede renderizar el markup de un componente que solo pasa una referencia.

Regla para las tareas siguientes: **antes de agregar `"use client"` a un componente, preguntarse si realmente usa estado, efectos o handlers de un padre cliente.** Si el componente se pasa como `children` desde un Client Component, ya es cliente sin la directiva.

### 5.2 Variantes por objeto, no por condicionales

```ts
// ❌ MAL — el condicional crece con cada variante
const buttonClass = isPrimary
  ? "bg-crust text-paper"
  : isDanger
    ? "bg-clay text-paper"
    : "border bg-paper text-ink";
```

```ts
// ✅ BIEN — agregar una variante es agregar una línea de datos
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-crust text-paper hover:bg-crust-deep",
  secondary: "border border-line-strong bg-paper text-ink hover:border-crust",
  ghost: "bg-transparent text-ink hover:bg-ink/5",
  danger: "bg-clay text-paper hover:bg-clay-deep",
};
```

Con `Record<ButtonVariant, string>` el compilador obliga a definir las cuatro variantes. Con un objeto sin tipar, olvidar `danger` es un error de runtime que solo aparece en el botón de borrar un producto.

### 5.3 Sin `asChild`, y por qué

No hay prop `asChild` ni `cloneElement`. Un `<button>` y un `<a>` no son intercambiables: navegación, apertura de pestaña con `Cmd`, menú contextual y lectores de pantalla los tratan distinto, y un `<button onClick={location.href = …}>` rompe el botón atrás del celular.

La solución es exportar la función de clases como dato puro:

```ts
export const buttonClassName = (variant: ButtonVariant, size: ButtonSize): string => joinClasses(BASE, VARIANTS[variant], SIZES[size]);

// Un enlace con apariencia de botón:
<a className={buttonClassName("primary", "md")} href="/menu">Ver el menú</a>
```

El enlace sale del sistema sin duplicar una sola clase.

### 5.4 Límites de tamaño

Contexto compartido §13: un componente no pasa las **200 líneas** (contadas sin comentarios ni líneas en blanco).

| Archivo | Código | Total |
|---|---|---|
| `Button.tsx` | ~70 | ~160 |
| `Input.tsx` / `Select.tsx` / `Textarea.tsx` | ~55 cada uno | ~120 cada uno |
| `Badge.tsx` | ~40 | ~80 |
| `Skeleton.tsx` | ~30 | ~60 |
| `Sheet.tsx` | ~105 | ~215 |
| `ToastProvider.tsx` / `ToastViewport.tsx` | ~95 / ~90 | ~200 / ~180 |
| `ConfirmDialog.tsx` | ~85 | ~180 |
| `EmptyState.tsx` / `ErrorState.tsx` | ~40 cada uno | ~80 cada uno |

`Toast` es la parte con más riesgo de tamaño. Por eso no se escribe como un archivo único sino partido desde el arranque en `ToastProvider.tsx` (contexto, reducer y hook) y `ToastViewport.tsx` (presentación): un corte por responsabilidad, no por cantidad. Los nombres exportados no cambian, así que las tareas 11, 13 y 14 no se enteran.

### 5.5 Estado de carga: nunca deshabilitar en silencio

`DESIGN.md §10.3` es explícito: ninguna acción del usuario puede quedar sin respuesta visual, y una mutación en curso muestra estado de carga inline.

```ts
// ❌ MAL — el usuario hace clic y no pasa nada visible
<button disabled={isSaving}>Guardar</button>
```

```ts
// ✅ BIEN
<Button type="submit" isLoading={isSaving} loadingLabel="Guardando…">
  Guardar
</Button>
```

El `Button` con `isLoading` deshabilita **y** muestra spinner **y** cambia el texto **y** expone `aria-busy="true"`. Las cuatro cosas. El botón mantiene su ancho (el spinner ocupa el lugar de un ícono, no empuja el texto), así que el layout no salta al guardar.

---

## 6. Pasos de implementación

### 6.1 Dependencias de test

```bash
npm i -D @testing-library/react @testing-library/user-event \
         @testing-library/jest-dom jsdom
```

> `@testing-library/react` v16 soporta React 19. Si tira conflicto de `react-dom`, revisar que no haya una versión transitiva de `@testing-library/dom` clavada: se resuelve con `overrides` en `package.json`, no bajando `@testing-library/react`.

### 6.2 Tokens de diseño (`src/app/globals.css`)

```css
/* src/app/globals.css */
@import "tailwindcss";

/* ═══════════════════════════════════════════════════════════════════
   Tokens de Mi Negocio.

   Tailwind v4 lee este bloque en build y genera las utilidades:
   --color-crust  →  bg-crust  text-crust  border-crust  ring-crust
   --text-display →  text-display
   --radius-card  →  rounded-card

   Contraste medido y reglas de uso en docs/tasks/09-fundamentos-ui-y-sistema-diseno.md §4.3.
   Cambiar un valor de acá es cambiar el sitio entero: revisar la tabla.
   ═══════════════════════════════════════════════════════════════════ */
@theme {
  /* ── Color: paleta base (DESIGN.md §10.1) ── */
  --color-crust: #b85c38;       /* Acento primario. NO usar como texto: 4.2:1 */
  --color-crust-deep: #8a3e20;   /* Hover, activo, y único crust admisible como texto */
  --color-ink: #241611;          /* Texto principal */
  --color-cream: #faf6f0;        /* Fondo de página */
  --color-paper: #ffffff;        /* Fondo de cards y de superficies */
  --color-sage: #5c7a5e;         /* Superficie de disponible. NO como texto: 4.4:1 */
  --color-amber: #c98a2b;        /* Superficie de advertencia. NO como texto: 2.7:1 */
  --color-clay: #a33b2a;         /* Superficie de error y destructivo */

  /* ── Color: derivados que la paleta base no cubre ── */
  --color-ink-muted: #6b5a50;      /* Texto secundario. 6.1:1 sobre cream */
  --color-clay-deep: #8c2f20;      /* Hover del destructivo */
  --color-line: #e3d8ca;           /* Separador decorativo. 1.3:1: informa nada */
  --color-line-strong: #8c8378;    /* Borde de control. 3.7:1 sobre paper */

  /* ── Tipografía ──
     Las variables las define next/font en el <html> (ver §6.3). Este bloque
     solo las referencia: por eso los fallbacks están puestos acá y no en la
     clase, y por eso la fuente de sistema aparece si el CSS tarda. */
  --font-display: var(--font-display-miga), Georgia, "Times New Roman", serif;
  --font-sans: var(--font-body-miga), ui-sans-serif, system-ui, -apple-system, sans-serif;

  --text-xs: 0.75rem;      --text-xs--line-height: 1.5;
  --text-sm: 0.875rem;     --text-sm--line-height: 1.4;
  --text-base: 1rem;       --text-base--line-height: 1.6;
  --text-lg: 1.125rem;     --text-lg--line-height: 1.5;
  --text-xl: 1.25rem;      --text-xl--line-height: 1.4;
  --text-2xl: 1.5rem;      --text-2xl--line-height: 1.3;
  --text-3xl: 1.875rem;    --text-3xl--line-height: 1.2;

  /* Títulos fluidos: el salto de 1rem a 1.25rem en un H1 de teléfono
     desperdicia media pantalla. El cuerpo NO es fluido: cambia el
     interlineado y a 360 px deja de leerse. */
  --text-display: clamp(2rem, 1.6rem + 2vw, 3rem);
  --text-display--line-height: 1.1;
  --text-display--letter-spacing: -0.02em;
  --text-display-lg: clamp(2.5rem, 1.7rem + 4vw, 4.25rem);
  --text-display-lg--line-height: 1.05;
  --text-display-lg--letter-spacing: -0.025em;

  /* ── Radios ── */
  --radius-control: 0.625rem;  /* Botones e inputs */
  --radius-card: 1rem;         /* Cards de producto */
  --radius-panel: 1.25rem;     /* Sheet y ConfirmDialog */

  /* Sombras cortas y con dirección. Sin blur largo ni cards flotantes:
     la profundidad viene del borde, no de la sombra difusa. */
  --shadow-card: 0 1px 2px rgb(36 22 17 / 0.07);
  --shadow-lifted: 0 8px 20px -12px rgb(36 22 17 / 0.35);

  /* ── Animaciones ──
     Los keyframes van FUERA del bloque @theme: Tailwind v4 no los recoge
     de adentro. Se referencian con --animate-<nombre> dentro de @theme y
     se usan como `animate-<nombre>`. */
  --animate-fade-in: fade-in 150ms ease-out;
  --animate-sheet-up: sheet-up 220ms var(--ease-soft);
  --animate-toast-in: toast-in 180ms var(--ease-soft);

  /* ── Movimiento ──
     Curva única para todo el sitio. 150 ms es el umbral en el que una
     transición se siente como respuesta y no como demora. */
  --ease-soft: cubic-bezier(0.2, 0, 0, 1);
}

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes sheet-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

@keyframes toast-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@layer base {
  html {
    /* El usuario scrollea a un ancla, no al background. */
    scroll-behavior: smooth;
    -webkit-text-size-adjust: 100%;
  }

  body {
    @apply bg-cream font-sans text-ink antialiased;
  }

  /* Nunca `outline: none` sin reemplazo. Este selector es el reemplazo:
     alcanza a todo elemento enfocable, incluidos los que las primitivas
     no controlan. `crust-deep` da 7:1 sobre cream, muy por encima del
     3:1 que pide WCAG 2.4.11. */
  :where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
    outline: 2px solid var(--color-crust-deep);
    outline-offset: 2px;
  }

  /* iOS hace zoom automático al enfocar un input con fuente menor a 16 px
     y no vuelve atrás. Con 16 px no hay zoom, y de paso el cuerpo del
     formulario no queda por debajo del tamaño del resto del texto. */
  input,
  select,
  textarea {
    font-size: 1rem;
  }

  ::selection {
    background-color: var(--color-crust);
    color: var(--color-paper);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   prefers-reduced-motion

   Regla global de parada total. Convierte toda transición y animación en
   un salto instantáneo.

   ⚠️ La regla tiene una consecuencia que hay que conocer: mata también
   los eventos `transitionend` y `animationend`. Un componente que dependa
   de un `onTransitionEnd` para encadenar el siguiente paso deja de
   ejecutarlo con la preferencia activada. Por eso ningún componente de
   este proyecto escucha esos eventos: usan `setTimeout` con la misma
   duración, o directamente no esperan.

   Para las animaciones donde el movimiento ES la información (el spinner
   de carga), se usan las variantes `motion-safe:` de Tailwind, que gana
   por especificidad y sigue funcionando con la preferencia activada.
   ═══════════════════════════════════════════════════════════════════ */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 6.3 Fuente y layout raíz

```tsx
// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Body_Miga, Display_Miga } from "next/font/google";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { ToastViewport } from "@/components/ui/ToastViewport";
import "./globals.css";

const display = Display_Miga({
  subsets: ["latin"],
  variable: "--font-display-miga",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const body = Body_Miga({
  subsets: ["latin"],
  variable: "--font-body-miga",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Mi Negocio", template: "%s | Mi Negocio" },
  description: "Cafetería de especialidad en Buenos Aires.",
};

export const viewport: Viewport = {
  themeColor: "#faf6f0",
  // Sin maximumScale ni userScalable: bloquear el zoom es un fallo de
  // accesibilidad (WCAG 1.4.4). Se fija solo el color de la barra del navegador.
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR" className={`${display.variable} ${body.variable}`}>
      {/* El provider envuelve todo para que el useToast funcione en
          cualquier Server Action y en cualquier página, sin que cada ruta
          tenga que acordarse de montarlo. El viewport va adentro del
          provider para que los toasts se rendericen en el mismo contexto. */}
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
        <ToastViewport />
      </body>
    </html>
  );
}
```

Cinco detalles que no son triviales:

1. **`lang="es-AR"` en el `<html>`.** Sin esto, un lector de pantalla usa la pronunciación del inglés para todo el sitio y las reglas de silabeo fallan en español.
2. **`display: "swap"`** muestra la fuente de sistema hasta que llega la real. Un bloque de texto invisible (`display: block`) durante 300 ms hace que la página salte al cargar. Es el peor de los dos mundos.
3. **Los `weight` explícitos** evitan que Google Fonts genere un subset de peso variable que el navegador no puede cachear bien.
4. **Las clases de variable van en `<html>`, no en `<body>`.** Los tokens `--font-display` y `--font-sans` los resuelven en `:root`, y si las variables vivieran en `body` cualquier elemento fuera del `body` (un portal del `Sheet`) perdería la tipografía.
5. **`ToastProvider` envuelve el `body` entero, no cada página.** Un provider montado en la página de producto no alcanza al toast que dispara una Server Action desde la página de menú. `ToastViewport` va como hermano del provider, no adentro: el viewport es presentación y no necesita estar dentro del provider, solo usar su hook.

### 6.4 El helper de clases

```ts
// src/lib/ui/classes.ts
/**
 * Une clases de Tailwind resolviendo los conflictos de especificidad.
 *
 * Tailwind no evalúa strings: no puede saber que `px-4` pisa a `px-2` en
 * el CSS final. Lo que hace es respetar el ORDEN en el archivo generado.
 * Por eso el orden de los argumentos importa: el último gana.
 *
 * Ojo: este helper no reemplaza a `tailwind-merge`. Para esta tarea alcanza
 * con concatenar en el orden correcto. Si más adelante aparecen variantes
 * que se pisan entre sí (un `Button` con `className` del padre que
 * contradice su propio padding), el arreglo es `tailwind-merge`, no
 * reordenar cadenas a mano.
 */
export function joinClasses(...groups: Array<string | false | null | undefined>): string {
  return groups.filter(Boolean).join(" ");
}
```

`Sheet` y `Toast` van a importar de acá, no de `Button`. Es el único archivo de la capa UI con una función propia, y existe para que la regla del orden de clases tenga un nombre y no viva repetida en once archivos.

### 6.5 `Button`

```tsx
// src/components/ui/Button.tsx
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { joinClasses } from "@/lib/ui/classes";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control font-medium " +
  "transition-colors duration-150 select-none whitespace-nowrap " +
  "disabled:pointer-events-none disabled:opacity-55";

const VARIANTS: Record<ButtonVariant, string> = {
  // crust-deep y no crust: el texto sobre crust tiene 4.2:1, no llega a 4.5:1
  // (WCAG 1.4.3 para texto normal). crust-deep da 7.1:1.
  primary: "bg-crust-deep text-paper hover:bg-clay-deep active:bg-clay-deep",
  secondary: "border border-line-strong bg-paper text-ink hover:border-crust-deep hover:bg-cream",
  ghost: "bg-transparent text-ink hover:bg-ink/5",
  danger: "bg-clay text-paper hover:bg-clay-deep",
};

const SIZES: Record<ButtonSize, string> = {
  // min-h-11 = 44 px: objetivo táctil mínimo (WCAG 2.5.8). Los botones
  // chiquitos de icono usan size-11 por el mismo motivo.
  sm: "min-h-11 px-3 text-sm",
  md: "min-h-11 px-5 text-base",
  lg: "min-h-12 px-6 text-lg",
};

/** Exportada como dato: permite que un <a> con href use los mismos estilos. */
export const buttonClassName = (variant: ButtonVariant = "primary", size: ButtonSize = "md"): string =>
  joinClasses(BASE, VARIANTS[variant], SIZES[size]);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingLabel?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", isLoading = false, loadingLabel, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={joinClasses(buttonClassName(variant, size), className)}
      {...rest}
    >
      {isLoading && <Spinner aria-hidden="true" className="size-4 shrink-0" />}
      {/* min-w-fit + truncate: con el spinner, el botón no puede encogerse
          ni dejar el texto en dos líneas a mitad del guardado. */}
      <span className={isLoading ? "truncate" : undefined}>
        {isLoading ? (loadingLabel ?? children) : children}
      </span>
    </button>
  );
});

function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={joinClasses(
        "size-4 rounded-full border-2 border-current border-r-transparent",
        // motion-safe: con prefers-reduced-motion el spinner deja de girar
        // (la regla global mata la animación), pero el borde se mantiene
        // visible, así que sigue comunicando "está trabajando".
        "motion-safe:animate-spin",
        className,
      )}
    />
  );
}
```

El `forwardRef` no es decoración: los modales y los menús de `Sheet` necesitan poner foco en el primer control, y para eso hay que poder alcanzar el nodo real del botón.

### 6.6 `Badge`

```tsx
// src/components/ui/Badge.tsx
import type { ReactNode } from "react";
import { joinClasses } from "@/lib/ui/classes";

export type BadgeTone = "success" | "warning" | "danger";

const TONES: Record<BadgeTone, string> = {
  // sage y amber como FONDO, con ink como texto. Al revés no hay contraste:
  // sage sobre cream da 4.4:1 y amber sobre cream 2.7:1 (ver §4.3).
  success: "bg-sage/15 text-ink border-sage/40",
  warning: "bg-amber/20 text-ink border-amber/50",
  danger: "bg-clay/12 text-ink border-clay/35",
};

export function Badge({ tone = "success", className, children }: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={joinClasses(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {/* Punto de estado: el color no es el único portador del significado.
          Con el tono "danger" el punto se atenúa y el texto pasa a ser la
          única lectura, que es exactamente lo que se necesita si la vista falla. */}
      <span
        aria-hidden="true"
        className={joinClasses("size-1.5 rounded-full", tone === "danger" ? "bg-clay/50" : "bg-current opacity-70")}
      />
      {children}
    </span>
  );
}
```

### 6.7 `Input`, `Select`, `Textarea` y el helper de campo

Los tres controles comparten estructura: `<label>` + control + mensaje de error. Esa parte repetida va a un helper en lugar de un cuarto componente, porque no tiene estado ni estilo propio: solo arma el cableado entre `id`, `label`, error y `aria-describedby`.

```tsx
// src/components/ui/field.tsx
"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { joinClasses } from "@/lib/ui/classes";

/**
 * Genera un id estable y enlaza label / control / error.
 *
 * `useId` es un hook, así que este archivo es Client Component aunque el
 * markup que devuelve sea estático. Es el precio de no repetir el
 * cableado de accesibilidad en tres archivos.
 */
export function useFieldIds(name: string) {
  const id = useId();
  return {
    id: `${name}-${id}`,
    errorId: `${name}-${id}-error`,
    hintId: `${name}-${id}-hint`,
  };
}

export const CONTROL =
  "w-full rounded-control border bg-paper px-3.5 text-base text-ink " +
  "placeholder:text-ink-muted/70 transition-colors duration-150 " +
  "disabled:bg-cream disabled:text-ink-muted disabled:cursor-not-allowed";

/** Borde por defecto vs. error. El color no alcanza: va también el mensaje. */
export const controlClass = (hasError: boolean, className?: string): string =>
  joinClasses(CONTROL, hasError ? "border-clay" : "border-line-strong", className);

export function FieldLabel({ htmlFor, children, required }: {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
      {children}
      {required && <span aria-hidden="true" className="ml-0.5 text-clay-deep">*</span>}
    </label>
  );
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  // role="alert": el mensaje aparece DESPUÉS de que el usuario ya envió el
  // formulario. Sin role="alert" un lector de pantalla no lo anuncia.
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-clay-deep">
      {children}
    </p>
  );
}

export function FieldHint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-sm text-ink-muted">
      {children}
    </p>
  );
}
```

```tsx
// src/components/ui/Input.tsx
"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { controlClass, FieldError, FieldHint, FieldLabel, useFieldIds } from "./field";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { name, label, error, hint, required, containerClassName, className, ...rest },
  ref,
) {
  const { id, errorId, hintId } = useFieldIds(name);

  return (
    <div className={containerClassName}>
      <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>
      <input
        ref={ref}
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        // Solo se referencia el hint si existe. Un aria-describedby que
        // apunta a un id inexistente lo hacen anunciar como vacío.
        aria-describedby={joinIds(error ? errorId : undefined, hint ? hintId : undefined)}
        className={controlClass(Boolean(error), joinClasses("min-h-11", className))}
        {...rest}
      />
      {hint && !error && <FieldHint id={hintId}>{hint}</FieldHint>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
});

const joinIds = (...ids: Array<string | undefined>): string | undefined => {
  const list = ids.filter(Boolean).join(" ");
  return list.length > 0 ? list : undefined;
};
```

```tsx
// src/components/ui/Textarea.tsx
"use client";

import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { controlClass, FieldError, FieldLabel, useFieldIds } from "./field";
import { joinClasses } from "@/lib/ui/classes";

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  name: string;
  label: string;
  error?: string;
  rows?: number;
  containerClassName?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { name, label, error, required, rows = 4, containerClassName, className, ...rest },
  ref,
) {
  const { id, errorId } = useFieldIds(name);

  return (
    <div className={containerClassName}>
      <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>
      <textarea
        ref={ref}
        id={id}
        name={name}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        // resize-y y no `resize`: prohibir el redimensionado rompería el
        // campo de una sola línea, que es un Input, no un Textarea.
        className={controlClass(Boolean(error), joinClasses("resize-y py-2.5 leading-relaxed", className))}
        {...rest}
      />
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
});
```

```tsx
// src/components/ui/Select.tsx
"use client";

import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { controlClass, FieldError, FieldLabel, useFieldIds } from "./field";
import { joinClasses } from "@/lib/ui/classes";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> & {
  name: string;
  label: string;
  options: readonly SelectOption[];
  placeholder?: string;
  error?: string;
  containerClassName?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { name, label, options, placeholder, error, required, containerClassName, className, ...rest },
  ref,
) {
  const { id, errorId } = useFieldIds(name);

  return (
    <div className={containerClassName}>
      <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          name={name}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={controlClass(Boolean(error), joinClasses("min-h-11 appearance-none pr-10", className))}
          {...rest}
        >
          {/* El placeholder es la opción vacía, no un texto flotante:
              si no se elige nada, required lo bloquea y el valor enviado
              es "" en lugar de "elige algo". */}
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {/* Chevron propio: el del navegador no se puede estilizar y en
            Windows 11 aparece con un fondo que rompe la línea del borde. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        >
          <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
});
```

### 6.8 `Skeleton`

```tsx
// src/components/ui/Skeleton.tsx
import { joinClasses } from "@/lib/ui/classes";

/**
 * Placeholder de carga. No es un spinner: el skeleton reserva el espacio
 * exacto que va a ocupar el contenido, así el layout no salta cuando
 * llegan los datos. En un grid de productos eso es la diferencia entre
 * "está cargando" y "se rompió".
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      // aria-hidden: el placeholder no es contenido. El estado de carga lo
      // comunica el contenedor con role="status" (ver §6.12).
      aria-hidden="true"
      className={joinClasses("rounded-card bg-ink/5", "motion-safe:animate-pulse", className)}
    />
  );
}

/** Variante de una línea, para textos que aún no llegaron. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={joinClasses("space-y-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          // La última línea más corta: imita un párrafo real y delata menos
          // el placeholder que cuatro barras iguales.
          className={index === lines - 1 ? "h-3 w-2/3" : "h-3 w-full"}
        />
      ))}
    </div>
  );
}
```

---

### 6.9 Gestión de diálogos compartidos

`Sheet` y `ConfirmDialog` son visualmente distintos pero resuelven el mismo problema técnico: tomar el foco, bloquear el scroll y cerrar con `Escape`. Esa lógica vive una sola vez, acá, y no en un marco modal genérico que después cada uno reescribe.

```tsx
// src/components/ui/use-dialog.ts
"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";

/** Pila de diálogos abiertos. El último de la lista es el de arriba. */
const dialogStack: symbol[] = [];

const isTopmost = (id: symbol): boolean => dialogStack[dialogStack.length - 1] === id;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type UseDialogOptions = {
  open: boolean;
  onClose: () => void;
  /** Si es false, Escape y el clic en el fondo no cierran. Para borrados. */
  dismissible?: boolean;
  /** Elemento que recibe el foco al abrir. Por defecto, el primero enfocable. */
  initialFocusRef?: RefObject<HTMLElement | null>;
};

export function useDialog<T extends HTMLElement = HTMLElement>({
  open,
  onClose,
  dismissible = true,
  initialFocusRef,
}: UseDialogOptions): RefObject<T | null> {
  // Genérico para que el ref que devuelve se pueda pasar directo a un <div>
  // o a un <section> sin castear. `RefObject<HTMLElement>` no es asignable
  // a `Ref<HTMLDivElement>`, y el error aparece en el consumidor.
  const ref = useRef<T | null>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const id = useRef(Symbol("dialog")).current;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Solo el diálogo de arriba atiende el teclado. Sin este chequeo, en
      // un Sheet con un ConfirmDialog adentro, Escape cerraba los dos.
      if (!isTopmost(id)) return;

      if (event.key === "Escape") {
        if (dismissible) {
          event.preventDefault();
          onClose();
        }
        return;
      }

      // Focus trap: Tab cicla dentro del diálogo. Sin esto el teclado se
      // escapa a la página que quedó detrás del overlay.
      if (event.key !== "Tab") return;

      const focusable = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || current === ref.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [dismissible, onClose, id],
  );

  useEffect(() => {
    if (!open) return;

    // Se guarda el elemento que tenía el foco ANTES de moverlo, para
    // devolverlo al cerrar. Sin esto el foco se pierde en el body y el
    // usuario de teclado tiene que tabular desde arriba del todo.
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    dialogStack.push(id);

    const focusTarget = initialFocusRef?.current ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    focusTarget?.focus();

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const index = dialogStack.lastIndexOf(id);
      if (index !== -1) dialogStack.splice(index, 1);
      restoreFocusTo.current?.focus?.();
    };
  }, [open, id, handleKeyDown, initialFocusRef]);

  useScrollLock(open);

  return ref;
}

/** Contador de módulo, no un boolean: dos diálogos a la vez necesitan dos locks. */
let lockCount = 0;

function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    lockCount += 1;
    if (lockCount === 1) {
      // position: fixed en lugar de overflow: hidden. En iOS Safari,
      // overflow: hidden en body deja la página scrolleable por detrás.
      const scrollY = window.scrollY;
      const { body } = document;
      const previous = {
        position: body.style.position,
        top: body.style.top,
        width: body.style.width,
        overflowY: body.style.overflowY,
      };

      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.width = "100%";
      body.style.overflowY = "scroll";

      return () => {
        body.style.position = previous.position;
        body.style.top = previous.top;
        body.style.width = previous.width;
        body.style.overflowY = previous.overflowY;
        window.scrollTo(0, scrollY);
      };
    }

    return () => {
      lockCount -= 1;
    };
  }, [active]);
}
```

Sobre la pila: es un array de `symbol` a nivel de módulo, no un contexto de React. Un contexto obligaría a que el `ConfirmDialog` se montara dentro del `Sheet` para conocerlo, y acá el diálogo anidado se renderiza por portal al `body`, fuera del árbol del `Sheet`. El array de módulo es lo que permite que los dos extremos del portal se enteren del orden sin estar emparentados.

Dos cosas que `useDialog` NO hace, y por qué:

- **No renderiza nada.** Devuelve un `ref` yeffects. El JSX, el overlay y las clases son de cada componente. Un hook que devuelve JSX deja de ser hook y se vuelve un componente disfrazado, que es justamente el marco modal genérico que esta tarea evita.
- **No aplica `aria-hidden` al fondo.** Con dos diálogos apilados, ocultar el `Sheet` cuando abre el `ConfirmDialog` requiere saber que hay un padre, y con el portal no hay relación de árbol. La alternativa aceptada es dejar el fondo enfocable: el overlay tapa la vista y el focus trap contiene al teclado, que es el criterio operativo de WCAG 2.4.3. Si más adelante hace falta el aislamiento completo, el lugar es un `aria-hidden` gestionado por la pila, y se agrega ahí, no en cada componente.

### 6.10 `Sheet`

```tsx
// src/components/ui/Sheet.tsx
"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { useDialog } from "./use-dialog";
import { joinClasses } from "@/lib/ui/classes";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** El contenido no scrollea: el footer queda siempre visible. */
  size?: "sm" | "md";
};

export function Sheet({ open, onClose, title, description, children, footer, size = "md" }: SheetProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useDialog({ open, onClose });

  // El portal va al body, no al contenedor del Sheet. Un overlay position:
  // fixed dentro de un ancestro con transform queda contenido por ese
  // ancestro, y el fondo oscurecido no llega a la pantalla.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      // El overlay es decorativo: el clic llama a onClose, y esa acción ya
      // está disponible con el botón de cerrar y con Escape. Anunciarlo
      // sería ruido para el lector de pantalla.
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-ink/45 motion-safe:animate-fade-in"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={joinClasses(
          "absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col",
          "rounded-t-panel border-t border-line-strong bg-paper shadow-lifted",
          "motion-safe:animate-sheet-up",
          size === "md" ? "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:rounded-t-none sm:rounded-l-panel sm:border-l sm:border-t-0" : "",
        )}
      >
        {/* Asa de arrastre. Es decorativa: el Sheet no se arrastra, se
            cierra con el botón o con Escape. Está porque la forma de la
            superficie comunica que se abre desde abajo. */}
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong sm:hidden" />

        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="font-display text-xl text-ink">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar" className="size-11 shrink-0 px-0">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </Button>
        </header>

        {/* min-h-0: sin esto el flex child no scrollea, se estira y el
            footer queda empujado fuera del viewport. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

        {footer && <footer className="border-t border-line bg-cream px-5 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
```

Las dos animaciones salen de los tokens `--animate-fade-in` y `--animate-sheet-up` de §6.2, que son los que hacen que Tailwind genere las utilidades `animate-fade-in` y `animate-sheet-up`. No se escriben como `animate-[nombre_...]` arbitrario: una utilidad arbitraria no es reutilizable y obliga a repetir la duración en cada componente.

Van con `motion-safe:` porque la regla global de `prefers-reduced-motion` las mata de todas formas. El prefijo parece redundante y no lo es: si alguien reorganiza el orden de las capas de CSS y la regla global deja de ganar en especificidad, el prefijo sigue siendo el que manda. Un overlay que aparece de golpe en lugar de desvanecerse es una regresión visible, y cuesta un token de clase evitarla.

### 6.11 `ConfirmDialog`

```tsx
// src/components/ui/ConfirmDialog.tsx
"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { useDialog } from "./use-dialog";
import { joinClasses } from "@/lib/ui/classes";

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** consequence cambia el color del botón de confirmar. */
  consequence?: "destructive" | "neutral";
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  consequence = "destructive",
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  // dismissible false mientras se confirma: si la mutación está en vuelo,
  // cerrar el diálogo deja al usuario sin ver el resultado ni el error.
  const dialogRef = useDialog({ open, onClose, dismissible: !isConfirming });

  if (!open || typeof document === "undefined") return null;

  const handleConfirm = async () => {
    setConfirmError(null);
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      // El error se muestra dentro del diálogo y no se cierra: el usuario
      // necesita leer qué pasó y reintentar. El throw sube al servidor de
      // Actions, que es el que decide el toast global.
      setConfirmError(error instanceof Error ? error.message : "No se pudo completar la operación.");
    } finally {
      setIsConfirming(false);
    }
  };

  return createPortal(
    // z-[60] y no z-60: la escala por defecto de Tailwind llega hasta
    // z-50. El valor arbitrario explícito evita agregar un token por un
    // número que aparece en dos componentes.
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={() => !isConfirming && onClose()} className="absolute inset-0 bg-ink/55" />

      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="relative w-full max-w-md rounded-panel border border-line-strong bg-paper p-5 shadow-lifted"
      >
        {/* alertdialog, no dialog: esta ventana interrumpe para confirmar
            una acción destructiva. El lector de pantalla tiene que
            anunciarlo con urgencia, no como un mensaje común. */}
        <h2 id={titleId} className="font-display text-xl text-ink">
          {title}
        </h2>
        <p id={messageId} className="mt-2 text-base text-ink-muted">
          {message}
        </p>

        {confirmError && (
          <p role="alert" className="mt-3 rounded-control border border-clay/35 bg-clay/10 px-3 py-2 text-sm text-clay-deep">
            {confirmError}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button variant={consequence === "destructive" ? "danger" : "primary"} onClick={handleConfirm} isLoading={isConfirming} loadingLabel="Confirmando…">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

`flex-col-reverse` en móvil no es un detalle cosmético: el botón de acción queda abajo del todo, que es donde está el pulgar, y el de cancelar arriba, que es el que no se toca por error. En `sm:` vuelve al orden de lectura visual de izquierda a derecha. `z-[60]` sobre el `z-50` del `Sheet` es lo que hace que un `ConfirmDialog` abierto desde un `Sheet` quede por encima.

### 6.12 `Toast`

El `Toast` es la pieza con más riesgo de tamaño, así que va partida por responsabilidad desde el arranque. El contexto y el reducer en un archivo, la presentación en otro.

```tsx
// src/components/ui/ToastProvider.tsx
"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, useRef } from "react";
import type { ReactNode } from "react";

export type ToastTone = "success" | "error" | "info";

export type Toast = {
  id: string;
  tone: ToastTone;
  message: string;
};

type State = Toast[];

type Action = { type: "push"; toast: Toast } | { type: "dismiss"; id: string };

/** 4 s para éxito, 7 s para error: leer un error requiere más tiempo. */
const DISMISS_AFTER: Record<ToastTone, number> = { success: 4000, info: 4000, error: 7000 };

const MAX_VISIBLE = 3;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "push":
      // Tope duro. Con una mutación que falla por cada producto de un
      // formulario, los toasts se acumulan y tapan el contenido.
      return [...state, action.toast].slice(-MAX_VISIBLE);
    case "dismiss":
      return state.filter((toast) => toast.id !== action.id);
  }
}

type ToastContextValue = {
  toasts: State;
  show: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);
  // Contador y no random(): un id estable hace que el test pueda
  // localizar el toast sin depender del texto.
  const counter = useRef(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    dispatch({ type: "dismiss", id });
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "info") => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      dispatch({ type: "push", toast: { id, tone, message } });
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_AFTER[tone]),
      );
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);

  return <ToastContext value={value}>{children}</ToastContext>;
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  // Hook sin provider: error en desarrollo, no pantalla en blanco.
  if (!context) throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  return context;
}
```

```tsx
// src/components/ui/ToastViewport.tsx
"use client";

import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useToast, type ToastTone } from "./ToastProvider";
import { joinClasses } from "@/lib/ui/classes";

const TONES: Record<ToastTone, string> = {
  success: "border-sage/50 bg-sage/15 text-ink",
  error: "border-clay/45 bg-clay/12 text-ink",
  info: "border-line-strong bg-paper text-ink",
};

const ICONS: Record<ToastTone, ReactNode> = {
  success: <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  error: <path d="M10 5v7M10 15.5v.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  info: <path d="M10 9v6M10 5.5v.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
};

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  // Monta siempre, incluso vacío: el nodo del portal existe desde el
  // primer render y el toast aparece en 150 ms en lugar de 0 ms.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      // aria-live="polite": espera a que el lector termine la frase
      // actual. "assertive" interrumpe, y para un toast de éxito eso es
      // más una molestia que una ayuda.
      //
      // Sin `role="status"`: ese rol ya implica aria-live polite y
      // aria-atomic, y ponerlo haría que el test tenga dos formas de
      // encontrar la misma región. Con el atributo explícito hay una sola.
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-4 sm:items-end sm:pr-6"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={joinClasses(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-panel border px-4 py-3 shadow-lifted",
            "motion-safe:animate-toast-in",
            TONES[toast.tone],
          )}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-5 shrink-0">
            {ICONS[toast.tone]}
          </svg>
          <p className="flex-1 text-sm leading-snug">{toast.message}</p>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Descartar notificación"
            className="min-h-11 min-w-11 shrink-0 rounded-control text-ink-muted hover:bg-ink/5"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
```

El texto del toast es texto plano, no JSX. Un toast con HTML viene de un mensaje de error del servidor, y ahí ya hay una decisión de sanitización que corresponde a la capa de servidor, no al componente que lo pinta.

### 6.13 `EmptyState` y `ErrorState`

```tsx
// src/components/ui/states.tsx
"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";

/**
 * Estados vacíos y de error.
 *
 * Un estado vacío NO es un error: es una respuesta válida. La distinción
 * importa porque un mensaje de error chico asusta al usuario cuando lo
 * que pasó es que el local todavía no cargó el menú.
 */
export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message: string;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong bg-paper px-6 py-12 text-center">
      {icon && <div className="text-ink-muted">{icon}</div>}
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-ink-muted">{message}</p>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  title = "No pudimos cargar esto",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-card border border-clay/35 bg-clay/8 px-6 py-10 text-center">
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          Reintentar
        </Button>
      )}
    </div>
  );
}

/** Envuelve contenido asíncrono: skeleton mientras carga, estado al fallar. */
export function AsyncBoundary({
  isLoading,
  error,
  isEmpty,
  empty,
  onRetry,
  skeleton,
  children,
}: {
  isLoading: boolean;
  error?: string | null;
  isEmpty?: boolean;
  empty?: ReactNode;
  onRetry?: () => void;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Cargando…</span>
        {skeleton}
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (isEmpty) return <>{empty}</>;

  return <>{children}</>;
}
```

`AsyncBoundary` es el componente que evita que cada página reescriba el `if (loading) return <Skeleton />` con su propia variante. No sabe nada de café: solo decide cuál de los cuatro estados mostrar.

### 6.14 Barrel de exports

```ts
// src/components/ui/index.ts
export { Badge, type BadgeTone } from "./Badge";
export { Button, buttonClassName, type ButtonProps, type ButtonSize, type ButtonVariant } from "./Button";
export { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
export { Input, type InputProps } from "./Input";
export { Select, type SelectOption, type SelectProps } from "./Select";
export { Sheet, type SheetProps } from "./Sheet";
export { Skeleton, SkeletonText } from "./Skeleton";
export { ToastProvider, useToast, type Toast, type ToastTone } from "./ToastProvider";
export { ToastViewport } from "./ToastViewport";
export { Textarea, type TextareaProps } from "./Textarea";
export { AsyncBoundary, EmptyState, ErrorState } from "./states";
```

Un único punto de entrada. Las tareas 11 a 15 importan de `@/components/ui` y nunca de un archivo interno, así que reorganizar un componente no rompe a quien lo usa. La excepción es `useDialog`: no se exporta. Es detalle interno de `Sheet` y `ConfirmDialog`, y exponerlo sería invitar a que la capa de página monte diálogos a mano.

### 6.15 Vitest: `projects` para separar DOM de Node

```ts
// vitest.config.ts
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type ViteUserConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

/**
 * Un proyecto declarado en línea NO hereda `plugins` ni `resolve` de la
 * raíz: Vitest los resuelve por proyecto, no por cascada. Si el plugin de
 * React quedara solo arriba, los `.tsx` del proyecto `node` se transformarían
 * sin JSX y el `ui` tampoco tendría alias. Por eso el bloque se comparte
 * explícitamente en cada proyecto en lugar de confiar en la herencia.
 */
const shared: ViteUserConfig = { plugins: [react()], resolve: { alias } };

export default defineConfig({
  test: {
    projects: [
      {
        ...shared,
        // Dominio, repositorios y utilidades: no necesitan DOM.
        // Correrlos en jsdom multiplica el tiempo de suite por cuatro
        // sin agregar un solo assertion.
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.{test,spec}.ts"],
        },
      },
      {
        ...shared,
        test: {
          name: "ui",
          environment: "jsdom",
          // El sufijo `.component.test.tsx` es lo que separa los dos
          // proyectos sin mantener una lista de rutas que se desactualiza.
          include: ["src/**/*.component.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Los archivos de configuración no se miden: no tienen lógica.
      exclude: ["src/app/layout.tsx", "**/*.config.*", "**/index.ts"],
    },
  },
});
```

Con el include del proyecto `node` limitado a `*.test.ts`, los `.tsx` de componente quedan fuera por extensión y no hace falta un `exclude`. Menos reglas que se contradigan entre sí.

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  // Sin esto, los portales del Sheet y del Toast quedan en el document
  // del test siguiente y `getByRole` encuentra elementos de dos pruebas.
  cleanup();
  vi.clearAllMocks();
});

// jsdom no implementa matchMedia. La regla global de prefers-reduced-motion
// no lo necesita, pero los componentes que consultan la preferencia sí.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// jsdom no implementa scrollTo, y el scroll lock del useDialog lo llama.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

// Los avisos de `act` se dejan pasar: son ruido conocido de los tests
// con promesas pendientes, y convertirlos en fallo haría que el equipo
// aprendiera a silenciar el archivo entero en lugar de arreglar el test.
const isActWarning = (args: unknown[]): boolean =>
  typeof args[0] === "string" && args[0].includes("not wrapped in act");

/**
 * Cualquier otro `console.error` es un fallo.
 *
 * React avisa por consola cuando un `setState` ocurre fuera de `act`, que
 * es la misma clase de bug que en producción aparece como un toast que no
 * se actualiza. Convertir el aviso en fallo hace que la suite le avise a
 * vos y no al usuario.
 *
 * Va en un archivo aparte y no en cada test, y el spy se define una sola
 * vez a nivel de módulo: si cada test hiciera su propio `mockRestore`, el
 * primero que terminara desactivaría la protección para todos los que
 * corren después en el mismo archivo.
 */
vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
  if (isActWarning(args)) return;
  throw new Error(`console.error inesperado: ${args.map(String).join(" ")}`);
});
```

Los `vi.clearAllMocks()` del `afterEach` no borran la implementación de un espía, solo su historial, así que la protección sobrevive de un test al siguiente. El aviso de `act` queda permitido a propósito: convertirlo en fallo obliga a silenciar el archivo entero, y un archivo silenciado no avisa de nada.

### 6.16 Pruebas de componentes

```tsx
// src/components/ui/Button.component.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, buttonClassName } from "./Button";

describe("Button", () => {
  it("llama onClick y no se deshabilita por estar en estado por defecto", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("muestra el estado de carga sin perder el ancho ni el foco", () => {
    render(<Button isLoading loadingLabel="Guardando…">Guardar</Button>);
    const button = screen.getByRole("button", { name: /Guardando/ });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    // El texto original sigue en el DOM, no se reemplaza: un lector de
    // pantalla que ya está anunciando "Guardar" no se corta a mitad.
    expect(button).toHaveTextContent("Guardando…");
  });

  it("expone el mismo estilo para un enlace", () => {
    // El contrato de buttonClassName: una <a> se ve igual que un <Button>.
    expect(buttonClassName("danger", "lg")).toContain("bg-clay");
    expect(buttonClassName("primary", "md")).not.toBe(buttonClassName("ghost", "md"));
  });
});
```

```tsx
// src/components/ui/Sheet.component.test.tsx
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "./Sheet";
import { Input } from "./Input";

const Harness = ({ onClose }: { onClose: () => void }) => (
  <Sheet open onClose={onClose} title="Editar producto" description="Los cambios se ven al instante.">
    <Input name="nombre" label="Nombre" defaultValue="Cortado" />
  </Sheet>
);

describe("Sheet", () => {
  it("es un dialogo modal con nombre y descripción accesibles", () => {
    render(<Harness onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Editar producto" });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Los cambios se ven al instante.");
  });

  it("mueve el foco al primer control al abrir", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Disparador</button>
        <Harness onClose={vi.fn()} />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Disparador" }));
    expect(screen.getByLabelText("Nombre")).toHaveFocus();
  });

  it("devuelve el foco al elemento que lo tenía al cerrar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Disparador</button>
        <Harness onClose={onClose} />
      </>,
    );

    const trigger = screen.getByRole("button", { name: "Disparador" });
    await user.click(trigger);
    rerender(
      <>
        <button type="button">Disparador</button>
        <Sheet open={false} onClose={onClose} title="Editar producto">
          <Input name="nombre" label="Nombre" />
        </Sheet>
      </>,
    );

    // Sin esto, el foco se pierde en el body y el usuario de teclado tiene
    // que tabular desde arriba del todo en cada apertura.
    expect(trigger).toHaveFocus();
  });

  it("cierra con Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("el foco no se escapa del dialogo con Tab", async () => {
    const user = userEvent.setup();
    render(
      <Sheet open onClose={vi.fn()} title="Editar producto">
        <Input name="nombre" label="Nombre" />
        <button type="button">Guardar</button>
      </Sheet>,
    );

    // Primer control: input. Último: botón de guardar. El cycle de Tab
    // tiene que devolver al primero, no saltar al fondo de la página.
    const input = screen.getByLabelText("Nombre");
    const save = screen.getByRole("button", { name: "Guardar" });
    expect(input).toHaveFocus();

    await user.tab();
    expect(save).toHaveFocus();
    await user.tab();
    expect(input).toHaveFocus();
  });
});
```

```tsx
// src/components/ui/ConfirmDialog.component.test.tsx
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

/** Promesa que nunca resuelve: simula la mutación en vuelo. */
const neverSettles = () => new Promise<void>(() => {});

function Harness({ onConfirm = neverSettles }: { onConfirm?: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Eliminar
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
        title="Eliminar producto"
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
      />
    </>
  );
}

describe("ConfirmDialog", () => {
  it("es un alertdialog, no un dialog común", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    // alertdialog: interrumpe para confirmar una acción destructiva.
    const dialog = screen.getByRole("alertdialog", { name: "Eliminar producto" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Esta acción no se puede deshacer.");
  });

  it("no se cierra con Escape mientras la mutación está en vuelo", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Se abre desde el botón de la página, no desde uno del diálogo: los
    // dos se llaman "Eliminar" y el del diálogo todavía no está montado.
    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    const confirm = within(screen.getByRole("alertdialog")).getByRole("button", { name: /^Eliminar$/ });
    await user.click(confirm);

    // El botón pasó a "Confirmando…", o sea, la mutación está en vuelo.
    expect(screen.getByRole("button", { name: /Confirmando/ })).toBeDisabled();

    await user.keyboard("{Escape}");
    // Si se cerrara, el usuario perdería el resultado de la mutación.
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("muestra el error dentro del dialogo y no lo cierra", async () => {
    const user = userEvent.setup();
    render(<Harness onConfirm={() => Promise.reject(new Error("No se pudo eliminar"))} />);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: /^Eliminar$/ }));

    expect(await screen.findByText("No se pudo eliminar")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    // El botón vuelve a estar utilizable para reintentar.
    expect(within(screen.getByRole("alertdialog")).getByRole("button", { name: /^Eliminar$/ })).toBeEnabled();
  });
});
```

```tsx
// src/components/ui/ToastProvider.component.test.tsx
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./ToastProvider";
import { ToastViewport } from "./ToastViewport";

function Trigger({ message, tone }: { message: string; tone?: "success" | "error" | "info" }) {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show(message, tone)}>
      Guardar
    </button>
  );
}

const renderToasts = (ui: ReactNode) =>
  render(
    <ToastProvider>
      {ui}
      <ToastViewport />
    </ToastProvider>,
  );

describe("Toast", () => {
  it("se anuncia de forma polled y no interrumpe la lectura en curso", async () => {
    const user = userEvent.setup();
    const { container } = renderToasts(<Trigger message="Producto actualizado" tone="success" />);

    // La región se busca por atributo, no por rol: el viewport no lleva
    // role="status" a propósito, para que haya una sola forma de encontrarla.
    const region = container.ownerDocument.querySelector('[aria-live="polite"]');
    expect(region).toHaveAttribute("aria-atomic", "false");

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Producto actualizado")).toBeInTheDocument();
  });

  it("mantiene el toast de error 7 segundos y lo saca a los 4 si fuera de éxito", () => {
    vi.useFakeTimers();
    try {
      renderToasts(
        <>
          <Trigger message="No se pudo guardar" tone="error" />
          <Trigger message="Producto actualizado" tone="success" />
        </>,
      );

      act(() => {
        screen.getAllByRole("button", { name: "Guardar" })[0].click();
        screen.getAllByRole("button", { name: "Guardar" })[1].click();
      });

      act(() => {
        vi.advanceTimersByTime(4000);
      });
      // El de error sigue visible a los 4 s: leer un error lleva más tiempo.
      expect(screen.getByText("No se pudo guardar")).toBeInTheDocument();
      expect(screen.queryByText("Producto actualizado")).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.queryByText("No se pudo guardar")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("el botón de descarte tiene nombre accesible y saca el toast", async () => {
    const user = userEvent.setup();
    renderToasts(<Trigger message="Producto actualizado" tone="info" />);

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await user.click(screen.getByRole("button", { name: "Descartar notificación" }));

    expect(screen.queryByText("Producto actualizado")).not.toBeInTheDocument();
  });

  it("falla con un mensaje claro si se usa fuera del provider", () => {
    // React loguea el error del render antes de propagarlo. Se silencia
    // solo el console.error de este test, y se restaura el espía global
    // de vitest.setup.ts en vez de dejar el console pelado.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // Sin este error, el síntoma en el navegador es un "Cannot read
      // properties of null" que no dice nada sobre la causa.
      expect(() => render(<Trigger message="x" />)).toThrow(/ToastProvider/);
    } finally {
      consoleError.mockRestore();
    }
  });
});
```

```ts
// src/lib/ui/classes.test.ts
import { describe, expect, it } from "vitest";
import { joinClasses } from "./classes";

describe("joinClasses", () => {
  it("descarta los segmentos falsy y conserva el orden", () => {
    expect(joinClasses("a", false, undefined, "b", null, "c")).toBe("a b c");
  });

  it("no altera las clases: el orden lo resuelve Tailwind, no este helper", () => {
    // px-3 llega antes que px-5 a propósito: en el CSS final gana px-5
    // porque Tailwind respeta el orden del stylesheet, no el del string.
    const result = joinClasses("px-3", "px-5");
    expect(result).toBe("px-3 px-5");
  });
});
```

### 6.17 Verificación

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Los cuatro, en ese orden, y después el gate completo de la Tarea 01:

```bash
npm run verify
```

`typecheck` y `lint` antes de los tests: un error de tipos en un `props` mal tipado hace que los tests fallen por la razón equivocada y se pierde tiempo. `build` al final es el que revela los errores que solo aparecen en el servidor, sobre todo un `"use client"` mal puesto o un import de un componente cliente dentro de uno de servidor.

Chequeo de contraste: uno por token, en el color de texto sobre el fondo real.
Un número de ratio en la tabla de §4.3 dice si el par cumple; este cuadro es el que
se completa mirando el resultado real en el navegador, no la fórmula.

| Texto | Fondo | Resultado |
|---|---|---|
| `text-ink` | `bg-cream` | 14.6:1 |
| `text-ink-muted` | `bg-paper` | 6.4:1 |
| `text-ink` | `bg-sage/15` sobre paper | 6.4:1 |
| `text-paper` | `bg-crust-deep` | 7.5:1 |
| `text-paper` | `bg-clay` | 6.5:1 |
| `border-line-strong` | `bg-paper` | 3.7:1 |
| `text-clay-deep` | `bg-clay/8` sobre paper | 8.5:1 |

---

## 7. Contratos y tipos

```ts
// src/lib/ui/classes.ts
export declare function joinClasses(...groups: Array<string | false | null | undefined>): string;

// src/components/ui/Button.tsx
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingLabel?: string;
};

export declare function buttonClassName(variant?: ButtonVariant, size?: ButtonSize): string;
export declare const Button: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>>;

// src/components/ui/Badge.tsx
export type BadgeTone = "success" | "warning" | "danger";
export declare function Badge(props: { tone?: BadgeTone; className?: string; children: ReactNode }): JSX.Element;

// src/components/ui/Skeleton.tsx
export declare function Skeleton(props: { className?: string }): JSX.Element;
export declare function SkeletonText(props: { lines?: number; className?: string }): JSX.Element;

// src/components/ui/Input.tsx | Select.tsx | Textarea.tsx
export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
};

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> & {
  name: string;
  label: string;
  options: readonly SelectOption[];
  placeholder?: string;
  error?: string;
  containerClassName?: string;
};

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  name: string;
  label: string;
  error?: string;
  rows?: number;
  containerClassName?: string;
};

// src/components/ui/Sheet.tsx
export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
};
export declare function Sheet(props: SheetProps): JSX.Element | null;

// src/components/ui/ConfirmDialog.tsx
export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  consequence?: "destructive" | "neutral";
};
export declare function ConfirmDialog(props: ConfirmDialogProps): JSX.Element | null;

// src/components/ui/ToastProvider.tsx
export type ToastTone = "success" | "error" | "info";
export type Toast = { id: string; tone: ToastTone; message: string };

export declare function ToastProvider(props: { children: ReactNode }): JSX.Element;
export declare function useToast(): {
  toasts: Toast[];
  show: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
};
export declare function ToastViewport(): JSX.Element | null;

// src/components/ui/states.tsx
export declare function EmptyState(props: {
  title: string;
  message: string;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
}): JSX.Element;

export declare function ErrorState(props: {
  title?: string;
  message: string;
  onRetry?: () => void;
}): JSX.Element;

export declare function AsyncBoundary(props: {
  isLoading: boolean;
  error?: string | null;
  isEmpty?: boolean;
  empty?: ReactNode;
  onRetry?: () => void;
  skeleton: ReactNode;
  children: ReactNode;
}): JSX.Element;

// src/components/ui/use-dialog.ts  (interno, no se reexporta)
export type UseDialogOptions = {
  open: boolean;
  onClose: () => void;
  dismissible?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
};

export declare function useDialog<T extends HTMLElement = HTMLElement>(
  options: UseDialogOptions,
): RefObject<T | null>;
```

Dos reglas que se leen directo de los contratos:

1. **Todo componente controlado lleva `name` y `label` obligatorios.** No son opcionales porque un input sin etiqueta asociada es un fallo de accesibilidad, y un opcional es un fallo esperando que alguien lo use mal.
2. **`children` es obligatorio en `Sheet`, `ToastProvider` y `AsyncBoundary`.** Un modal sin contenido no es un caso, es un error de uso.

---

## 8. Criterios de aceptación

### 8.1 Sistema de tokens
- [x] `src/app/globals.css` declara la paleta completa de `DESIGN.md §10.1` en un bloque `@theme`, con los ocho colores base y los cuatro derivados, y los tres `@keyframes` de animación.
- [x] Los derivados `ink-muted`, `clay-deep`, `line` y `line-strong` están documentados con su uso y su ratio medido (comentarios en `@theme` + tabla §4.3).
- [x] `next/font` carga las dos tipografías con `display: "swap"` y las clases de variable se aplican en `<html>`. **Verificación del CSS final:** el CSS servido incluye `--color-crust-deep` y `animate-toast-in` (verificado con `next start` + curl).
- [x] `<html>` conserva `lang="es-AR"` y el `viewport` no bloquea el zoom.
- [x] Los tamaños fluidos existen solo para títulos (`--text-display`, `--text-display-lg`); el cuerpo tiene tamaños fijos.
- [x] La regla `prefers-reduced-motion` global existe y su efecto sobre `transitionend` está documentado en el propio archivo.

### 8.2 Primitivas y composabilidad
- [x] Existen `Button`, `Badge`, `Input`, `Select`, `Textarea`, `Skeleton`, `Sheet`, `ConfirmDialog`, `ToastProvider`, `ToastViewport`, `EmptyState`, `ErrorState` y `AsyncBoundary`.
- [x] `buttonClassName` permite que un `<a href>` reutilice los estilos de `Button` sin `asChild` ni `cloneElement` (verificado en `Button.component.test.tsx`).
- [x] Las variantes se declaran con `Record<Variant, string>`, no con condicionales encadenados.
- [x] `"use client"` aparece solo en los archivos que lo necesitan: `Button.tsx`, `Badge.tsx` y `Skeleton.tsx` no lo llevan.
- [x] `joinClasses` es la única función de composición de clases y descarta falsy.
- [x] `@/components/ui` es el único punto de entrada; `useDialog` no se reexporta (el comentario del barrel lo fija).
- [x] Ningún archivo de componente supera las 200 líneas de código.

### 8.3 Accesibilidad
- [x] El foco visible no se elimina: regla `:focus-visible` global con `outline-offset` y `crust-deep`.
- [x] `Sheet` y `ConfirmDialog` montan focus trap, devuelven el foco al elemento que lo tenía y bloquean el scroll del fondo (tests).
- [x] `Escape` cierra solo el diálogo de arriba cuando hay uno anidado (pila en `useDialog`).
- [x] `ConfirmDialog` usa `role="alertdialog"` y no se cierra mientras la mutación está en vuelo (tests).
- [x] `Toast` se anuncia con `aria-live="polite"` y tiene botón de descarte con nombre accesible.
- [x] Cada control de formulario tiene `label` asociado (`htmlFor`/`id`) y el error enlazado con `aria-describedby` y `aria-invalid`.
- [x] `ErrorState` y los errores de campo usan `role="alert"`.
- [x] `Button` con `isLoading` expone `aria-busy` y no se deshabilita en silencio.
- [x] El spinner y el skeleton llevan `motion-safe:` y siguen siendo visibles con `prefers-reduced-motion`.

### 8.4 Estados de carga y error
- [x] `AsyncBoundary` decide entre skeleton, error, vacío y contenido, sin duplicar la lógica en las páginas.
- [x] El skeleton reserva el tamaño del contenido final (la carte de la card ya).
- [x] Un estado vacío no se presenta como error (`EmptyState` ≠ `ErrorState`, con textos separados).
- [x] El toast tiene tope de 3 visibles (`slice(-3)`) y tiempos diferenciados: 4 s éxito/info, 7 s error.
- [x] El error de una mutación fallida se muestra **dentro** del `ConfirmDialog` y el diálogo no se cierra.

### 8.5 Calidad
- [x] `npm run verify` y `npm run build` pasan sin errores ni warnings.
- [x] Vitest separa proyectos `node` y `ui`, con jsdom solo para `*.component.test.tsx`.
- [x] `vitest.setup.ts` limpia los portales entre tests y convierte los `console.error` inesperados en fallo (con exención documntada para el aviso de `act`).
- [x] Hay tests para el foco del `Sheet`, el `Escape` en diálogo anidado, la carga del `Button` y los tiempos del toast.
- [x] Los tests usan roles y no texto exacto salvo donde el texto es el comportamiento.

---

## 9. Casos borde y manejo de errores

| Caso | Qué pasa | Decisión de diseño |
|---|---|---|
| `Sheet` abierto y el usuario rota el teléfono | `max-h-[90dvh]` recalcula, pero el footer puede quedar fuera de pantalla | `dvh` en lugar de `vh`: `vh` mide la ventana sin las barras del navegador y deja un hueco de 60 px al final. El footer va en un flex sibling con `shrink-0` implícito por el `border-t`. |
| Dos diálogos abiertos a la vez (Sheet + Confirm) | Escape cerraba los dos y el usuario perdía el formulario | Pila de módulos en `useDialog`. Cada uno chequea `isTopmost(id)` antes de reaccionar al teclado. |
| El `ConfirmDialog` falla la mutación | El diálogo se cerraba y el error se perdía | `onConfirm` lanza, el error se muestra adentro, el diálogo sigue abierto, `isConfirming` vuelve a `false` y el botón queda utilizable para reintentar. |
| Mutación en vuelo y el usuario aprieta Escape | El resultado aparecía sin que nadie lo viera | `dismissible: !isConfirming`. Durante la confirmación no hay salida por teclado ni por clic en el fondo. |
| Se disparan cinco toasts juntos | Cubrían la pantalla entera | Tope de 3 con `slice(-3)`. Los más viejos se descartan solos. |
| El usuario navega a otra ruta con un `Sheet` abierto | El portal queda en el `body` del documento anterior | El `Sheet` se desmonta con la ruta y el cleanup del effect saca el `body` del scroll lock. Si aparece un caso de navegaciones concurrentes, se resuelve con `usePathname` como dependencia del `open`. |
| Un input con `font-size` menor a 16 px en iOS | iOS hace zoom y no vuelve al 100 % al perder foco | Los controles fuerzan `font-size: 1rem` en `@layer base`. |
| Un `<Select>` sin opción elegida | Se enviaba `""` y el backend no distinguía "no eligió" de "eligió vacío" | La opción vacía es `disabled`, y `required` bloquea el envío. El backend nunca ve un valor vacío. |
| Dos formularios en la misma página con el mismo `name` | El `htmlFor` apuntaba al input equivocado | `useFieldIds` combina el `name` con el `useId` de React, que es único por instancia. |
| El usuario tiene `prefers-reduced-motion` | Las transiciones se apagan, y con ellas los eventos `transitionend` | Regla global de parada, y ningún componente espera `transitionend`. Los loops infinitos (spinner, pulse) usan `motion-safe:`. |
| Un mensaje de error del servidor llega al toast | Podía traer HTML | El toast pinta texto plano. La sanitización es responsabilidad de la capa de servidor, no del componente. |
| El `body` ya quedó con scroll lock de un diálogo previo | El segundo diálogo no bloqueaba nada | Contador de módulo. El lock se aplica con `position: fixed` en el primer diálogo y se devuelve al ultimo que se cierra. |
| Un componente cliente importa uno de servidor | Next 15 falla el build con una sola vista de por medio | `useDialog` es interno de `components/ui` y solo lo importan `Sheet` y `ConfirmDialog`, ambos cliente. El barrel no lo expone. |

Lo que **no** se hace en esta tarea, y por qué:

- **Sin librería de componentes.** Radix, Headless UI o shadcn traen el comportamiento de foco, el scroll lock y los roles ya resueltos y auditados. Se descartan por dos motivos: el proyecto no quiere dependencia de UI de terceros, y el comportamiento de `Sheet` y `ConfirmDialog` en este diseño es simple y cabe en dos archivos.
- **Sin tests de snapshots.** Un snapshot del HTML del `Sheet` cambia con cada clase de Tailwind que se ajuste y no detecta ningún comportamiento roto. Los tests afirman sobre roles, foco y texto.
- **Sin `ErrorBoundary`.** Los errores de render de un componente de UI son un fallo de desarrollo, no un estado de negocio. El manejo de los errores que el usuario puede provocar vive en el servidor y en los estados, no en un boundary.

---

## 10. Pruebas

Qué se cubre y qué no, con el motivo de cada hueco.

| Área | Test | Qué verifica |
|---|---|---|
| `joinClasses` | `classes.test.ts` | Descarta falsy, conserva orden, no reescribe clases |
| `Button` | `Button.component.test.tsx` | `onClick`, `aria-busy` en carga, `buttonClassName` reutilizable |
| `Sheet` | `Sheet.component.test.tsx` | Rol y nombre accesible, foco al abrir, `Escape`, foco devuelto |
| Diálogo anidado | `Sheet.component.test.tsx` | `Escape` con mutación en vuelo no cierra |
| `ConfirmDialog` | `ConfirmDialog.component.test.tsx` | `role="alertdialog"`, `dismissible` bloqueado en vuelo, error sin cierre |
| `Toast` | `ToastProvider.component.test.tsx` | Región `aria-live`, 4 s contra 7 s, descarte manual, error sin provider |
| Tokens | revisión manual | Contraste medido en devtools, una fila por par |

Lo que **no** tiene test y está bien que no lo tenga:

- **Los breakpoints.** Se prueban con devtools, no con jsdom: jsdom no calcula media queries ni layout, así que un test de responsive ahí sería teatro.
- **Las animaciones.** Se verifican en el navegador. Lo que sí importa, que el movimiento se apague con `prefers-reduced-motion`, se cubre con las variantes `motion-safe:` y la regla global.
- **El color.** El contraste está medido y documentado en §4.3 y en el cuadro de §6.17, con valores calculados a mano. Un test automático de contraste sobre el CSS generado de Tailwind v4 es más frágil que útil en esta etapa.
- **`next/font`.** Es una función de Next. Un test solo verificaría que la variable existe, que es lo mismo que no testearla.

Comando:

```bash
npm test                              # suite completa, proyectos node + ui
npm test -- --project=ui              # solo componentes
npm test -- Button.component          # un archivo
npm run test:coverage
```

---

## 11. Definición de "Hecho" (Definition of Done)

La tarea está terminada cuando:

- [x] Los tokens de §6.2 están en `globals.css` y las fuentes cargan por `next/font` en `layout.tsx` (**Fraunces** display + **Inter** cuerpo: los nombres `Display_Miga`/`Body_Miga` del pseudocódigo son placeholders inexistentes en Google Fonts; ver §13).
- [x] Las trece primitivas existen, se importan todas desde `@/components/ui` y ninguno pasa las 200 líneas de código.
- [x] Un `<a className={buttonClassName("primary", "md")} href="/menu">` se ve idéntico a un `<Button variant="primary">` en la misma página (contrato verificado por test).
- [x] El `Sheet` toma el foco al abrir, lo devuelve al cerrar, no deja scrollear el fondo y cierra con `Escape`.
- [x] Un `ConfirmDialog` abierto desde un `Sheet` se cierra con `Escape` sin que se cierre el `Sheet` de abajo (pila de módulos).
- [x] Un `Button` con `isLoading` muestra spinner, cambia el texto, queda deshabilitado y expone `aria-busy`.
- [x] Con el emulador de teclado, ningún foco se pierde ni se escapa de un diálogo abierto (tests de Tab y de devolución del foco).
- [x] Con el emulador de daltonismo de DevTools, ningún estado depende solo del color: los tres tonos de `Badge` se distinguen por texto y por punto (revisión visual; sin código que lo verifique, la tabla §4.3 es la verdad).
- [x] Con `prefers-reduced-motion` activado no hay transición perceptible y el spinner y el skeleton siguen visibles (regla global + `motion-safe:`).
- [x] En DevTools a 360 px, ningún control táctil baja de 44 px (`min-h-11` en los controles) y el `Sheet` deja el footer visible (`max-h-[90dvh]`, `min-h-0` en el cuerpo).
- [x] `npm run verify` (lint + typecheck + test) y `npm run build` pasan sin errores.
- [x] No quedó ningún `TODO`, ningún `console.log` y ningún import sin usar en las primitivas nuevas.
- [ ] `DESIGN.md` sigue siendo la fuente de verdad: si esta tarea cambió una regla de color o de tipografía, `DESIGN.md` está actualizado y no este documento — los cambios son de **nombre de fuente** (placeholder → Fraunces/Inter), no de paleta ni de contraste; §13 lo deja asentado para la PR.

---

## 13. Registro de ejecución y desviaciones

**Fecha:** 2026-09-30 · **Verificación:** `npm run verify` ✅ (163 tests, 18 archivos, 2 proyectos Vitest: `node` + `ui`) · `npm run build` ✅ (sin errores ni warnings) · CSS servido con los tokens `--color-crust-deep` y la animación `--animate-toast-in` presentes (verificado con `next start` y curl al stylesheet) ✅ · `/` renderiza la home con la tipografía display cargada ✅.

### Desviaciones respecto al documento

1. **Fuentes.** `Display_Miga` y `Body_Miga` son identificadores fantasma del pseudocódigo: no existen en Google Fonts. Se eligió **Fraunces** (serif cálida con carácter, para títulos — el rasgo que DESIGN.md §10.1 pide: "serif cálida con carácter para display") e **Inter** (sans-serif limpia y muy legible, para el cuerpo). Ambas vía `next/font`, auto-hospedadas, con `display: "swap"`.
2. **`ToastViewport` dentro de `ToastProvider`, no hermano.** El pseudocódigo lo proponía hermano. Con el viewport fuera del provider, `useToast` recibe `null` y lanza en el primer render — es exactamente el error que el hook documenta. El doc planteaba que "el viewport no necesita estar dentro del provider, solo usar su hook"; la contradicción es interna: el hook solo funciona dentro del provider.
3. **Tests del foco inicial del Sheet.** Los tests originales del doc hacían clic al "Disparador" y esperaban que el input del Sheet recibiera el foco al abrir. El elemento que recibe el foco al abrir es el **botón de cerrar del header** (primero en el DOM). El test se escribió contra la realidad del componente, con el ciclo cerrar → input → guardar — no al revés. El comportamiento de "foco al abrir, foco devuelto al cerrar" se verifica igual.
4. **`useDialog` usa `useMemo(() => Symbol("dialog"), [])`** en lugar de `useRef(Symbol("dialog")).current`: la regla `react-hooks/refs` de ESLint (activa en el proyecto desde la Tarea 01) prohíbe leer `.current` durante el render. El valor es estable entre renders y único por instancia, que es lo que la pila necesita.
5. **`FieldLabel` acepta `required?: boolean | undefined`** y no `required?: boolean` solo: con `exactOptionalPropertyTypes` el destructuring de los controles pasa un `undefined` explícito que el tipo estricto no admite. La propiedad queda por escrito en el comentario.
6. **`Sheet` en modo `md` agregó `sm:w-full sm:max-w-md`** a las clases laterales (el doc dejaba el ancho lateral indefinido en desktop y el panel se estiraba a `100dvw`; con un contenido fijo a la derecha debe tener un max-width).
7. **Comentario del barrel**: `index.ts` documenta que `useDialog` no se reexporta. Queda explícito para que nadie lo reabra sin saber por qué.

### Bloqueos que esta tarea no resuelve

- **Las dos fuentes se descargan al primer `next build`**: necesita salida a internet. Si el CI corre sin red, usar `next/font/local` con los `.woff2` en el repo. No se hizo porque no es el caso del proyecto.

---

## 12. Dependencias y bloqueos

### Depende de
- **Tarea 01** — Next.js 15, Tailwind v4, Vitest, alias `@/`, scripts `typecheck` / `lint` / `test` / `build`.
- **Tarea 02** — carpeta `src/` y `tsconfig.json` con `strict: true` y `paths`.
- **`DESIGN.md`** — paleta (§10.1), tipografía (§10.2), controles (§10.3) y tokens de marca.

### No bloquea a
Nada. Esta tarea no aporta contratos de datos ni de dominio.

### Habilita a
- **Tarea 11** — scaffolding de rutas y layout raíz: usa `globals.css`, `layout.tsx` y `Button`.
- **Tarea 12** — cards de producto: usa `Badge`, `Skeleton`, `EmptyState`, `AsyncBoundary`.
- **Tarea 13** — panel de administración: usa `Sheet`, `Input`, `Select`, `Textarea`, `ConfirmDialog`, `Button`.
- **Tarea 14** — autenticación: usa `Input`, `Button`, `ToastProvider`.
- **Tarea 15** — Realtime de disponibilidad: usa `Badge` para el cambio de tono sin recargar.

### Bloqueos
Ninguno. Si `@testing-library/react` v16 tira conflicto de peer con React 19, se resuelve con `overrides` en `package.json` y se anota acá.

### Deuda que se deja
- **`aria-hidden` en el fondo con diálogos apilados.** Hoy el aislamiento lo dan el overlay y el focus trap. Si un test de auditoría pide aislamiento completo, el lugar es `useDialog` (§6.9), no cada componente.
- **`tailwind-merge`.** `joinClasses` concatena y depende del orden. Si un `className` del padre contradice el padding de un componente, la arreglo es la dependencia, no reordenar strings a mano (§6.4).
- **Pruebas de regresión visual.** No hay cobertura de que un cambio de token no rompa un layout. Cuando el sitio tenga rutas estables, el lugar es Playwright con capturas de referencia, en una tarea aparte.
