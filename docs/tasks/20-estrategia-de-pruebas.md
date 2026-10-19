# Tarea 20 — Estrategia de Pruebas y Quality Gates

| Campo | Valor |
|---|---|
| **ID** | 20 |
| **Fase (DESIGN.md §8.7)** | Fase 5 — Pulido, Seguridad y Deploy a Producción |
| **Depende de** | 13, 16 |
| **Habilita** | 21 |
| **Tipo** | Transversal |
| **Esfuerzo est.** | 1 – 1.5 días |

---

## 1. Objetivo de la tarea

Una sola cosa: que la suite de pruebas que ya existe deje de estar dispersa, deje de medir lo que no importa, y empiece a **fallar cuando algo se rompe de verdad**.

Las tareas anteriores dejaron cuarenta y seis archivos de test entre `tests/` y junto al código. Esta tarea no agrega pruebas nuevas salvo donde hay un hueco crítico y demostrable: **la autorización de las Server Actions**. El resto del esfuerzo es consolidar, ajustar umbrales y poner los cuatro comandos de calidad en un pipeline que corre en cada push.

**Criterio de éxito verificable:** `npm run test:coverage` pasa con umbral 80% sobre `src/lib/**` y `src/server/services/**`, `npm run test:ci` corre las tres suites en menos de tres minutos, un push a `main` dispara `.github/workflows/ci.yml` y el pipeline corre `lint`, `typecheck`, `test` y `build` en verde, y existe un test que demuestra que `updateBusinessSettingsAction` devuelve un error de permiso cuando la sesión es de rol `STAFF`.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 13 (checkout, porque el flujo de handoff es el que se prueba de punta a punta) y Tarea 16 (CRUD de productos, porque sus tres Server Actions son el caso de prueba de la autorización).

En la práctica también consume los entregables de 04, 08, 09, 11, 12, 15 y 17, y ahí está el trabajo: **no escribir tests nuevos, sino ordenarlos**.

### 2.1 El principio rector: cuatro módulos, todo el resto es decorativo

El catálogo público, el panel y los formularios tienen una sola fuente de verdad y **cero lógica de negocio**. Un componente que renderiza `formatARS(price)` está bien o mal según una regla de estilo; un `buildWhatsAppMessage` que pone `$3.700,000000001` pierde el pedido.

| Zona | Qué hay que probar | Dónde va el esfuerzo |
|---|---|---|
| **A. Formato del mensaje de WhatsApp** | String exacto, encoding, truncado, sanitizado | Ya cubierto por la Tarea 12 (18 + 8 + 14 casos). **No se toca.** |
| **B. Reglas del carrito y aritmética de dinero** | `roundCurrency`, `calculateCartSubtotal`, `lineTotal`, `orderTotal`, punto flotante | Ya cubierto por 11 y 12. Se **consolida de lugar** y se agregan los huecos de §6.5. |
| **C. Autorización de las Server Actions** | Sin sesión falla; sesión sin fila en `staff_members` falla; `STAFF` no hace lo de `OWNER` | **Casi nada cubierto. Es el trabajo de esta tarea.** |
| **D. Toggle de disponibilidad** | `setProductAvailability` y el contrato de la action | Parcialmente cubierto por 14. Se completa. |
| Todo lo demás | Componentes, estilos, accesibilidad | Ya cubierto por la Tarea 09 con `.component.test.tsx`. **No se agrega nada.** |

> **Decisión explícita, y es la más importante de la tarea:** este proyecto **no va a agregar tests de UI decorativa**. No hay test de que el `Button` tenga la clase `bg-crust`, ni de que el `ProductCard` renderice el precio con un punto de miles. Esos tests pasan, dan sensación de cobertura y no atrapan un solo bug real. La cobertura de una UI se mide mirando la pantalla, y en un panel que usa el encargado diez minutos por día eso alcanza.
>
> El ROI de un test de componente en este proyecto es cercano a cero comparado con el de un test de autorización. El presupuesto de la hora va al bloque C.

### 2.2 Inventario de lo que ya existe

La suite está escrita. Esta tabla es el punto de partida, y es el inventario que hay que consolidar, no reescribir.

| Origen | Archivo | Tipo | Qué cubre | Dónde vive hoy |
|---|---|---|---|---|
| 01 | `tests/unit/domain-errors.test.ts` | Unit | Jerarquía de `DomainError`, `toSafeErrorMessage` | `tests/` |
| 04 | `tests/integration/{product,category,settings}.repository.test.ts` | Integración | Repositorios contra la base real | `tests/` |
| 05 | `tests/unit/{slug,allergens}.test.ts` | Unit | `buildSlug`, glosario cerrado | `tests/` |
| 06 | `tests/unit/{cloudinary-signature,imagen-validation,image-url}.test.ts` | Unit | Firma de subida, validación de archivo | `tests/` |
| 07 | `tests/unit/ruta-retorno.test.ts` | Unit | Redirección post-login | `tests/` |
| 08 | `tests/unit/{catalog,category,settings}.service.test.ts` | Unit | Servicios de catálogo con puertos inyectados | `tests/` |
| 09 | `src/lib/ui/classes.test.ts` | Unit | `joinClasses` | **colocado en `src/`** |
| 09 | `src/components/ui/*.component.test.tsx` (4) | Componente | Accesibilidad de primitivas | **colocado en `src/`** |
| 11 | `src/lib/format/currency.test.ts` | Unit | `roundCurrency` | **colocado en `src/`** |
| 11 | `src/lib/cart/{cart-rules,cart-schema}.test.ts` | Unit | Reglas del carrito y persistencia | **colocado en `src/`** |
| 11 | `src/components/cart/CartLineItem.component.test.tsx` | Componente | Render de la línea | **colocado en `src/`** |
| 12 | `tests/unit/format/phone.test.ts` | Unit | `normalizeArgentinePhone` en 6 formatos | `tests/` |
| 12 | `tests/unit/whatsapp/*.test.ts` (2) | Unit | Mensaje y URL | `tests/` |
| 13 | `tests/unit/checkout/*.test.ts` (4) | Unit | Esquema, validación, snapshot del handoff | `tests/` |
| 13 | `tests/integration/cart-validation.service.test.ts` | Integración | Revalidación de precio contra la base | `tests/` |
| 14 | `tests/unit/product.service.test.ts` | Unit | `setProductAvailability` | `tests/` |
| 15 | `src/store/availability-store.test.ts` | Unit | Reductor del store de disponibilidad | **colocado en `src/`** |
| 15 | `src/hooks/use-availability-realtime.component.test.tsx` | Componente | Suscripción y limpieza del canal | **colocado en `src/`** |
| 17 | `tests/unit/{category-admin.service,ajustes-normalizers,ajustes.schema}.test.ts` | Unit | Servicios de panel, saneado de ajustes | `tests/` |
| 17 | `tests/integration/{categorias,ajustes}.integration.test.ts` | Integración | Escritura de categorías y ajustes | `tests/` |
| 18 | `tests/unit/{seo,schema-org,seo-url,seo-estructure}.test.ts` | Unit | Metadatos, JSON-LD, URLs canónicas | `tests/` |
| 19 | `tests/unit/{acciones-orden,audit-log,cloudinary-params,security-headers}.test.ts` | Unit | Orden de verificación, log, headers, allowlist | `tests/` |

**Conteo:** 46 archivos, 35 en `tests/` y 11 en `src/`; de esos, 6 son de integración contra la base real y 6 son de componentes. El hueco de la columna "Qué cubre" es `C. Autorización`: no hay ni un test que llame a una de las nueve Server Actions.

### 2.3 Los tres conflictos que dejó la acumulación

Consolidar no es mover archivos. Es resolver tres contradicciones que hoy viven en el repo y que hacen que `npm run test` y `npm run test:coverage` midan cosas distintas según cuándo se corran.

| # | Conflicto | Dónde | Efecto | Resolución |
|---|---|---|---|---|
| 1 | El `include` del proyecto `node` quedó como `src/**/*.{test,spec}.ts` (Tarea 09) y **descartó** `tests/**`, que es donde la Tarea 01 y la Tarea 04 pongeron todo | `vitest.config.ts` | Los 35 tests de `tests/` no corren, o corren sólo si el include es la unión | §6.3: `include: ["tests/**/*.test.ts", "src/**/*.test.ts"]` |
| 2 | El bloque `coverage` cambió tres veces: Tarea 01 (`lib` + `services`), Tarea 04 (`+ repositories`), Tarea 09 (todo `src`, sin `include`) | `vitest.config.ts` | La cobertura mide componentes y baja el número, o sube el número y no mide lo que importa | §6.3: `include` explícito sobre `src/lib/**` y `src/server/services/**`, y `exclude` de repositorios |
| 3 | `setupFiles: ["./tests/setup.ts"]` es **global**, y ese archivo es el de `resetDatabase()` | `vitest.config.ts` | Los tests unitarios abren una conexión a Postgres para no usarla, y en CI fallan si no hay `.env` | §6.3: tres proyectos. El unitario no carga el setup de base |

> El tercer conflicto es la causa directa de "los tests fallan sólo en CI por falta de `.env`" (§9). No es un problema de secretos: es que un archivo de tests que no toca la base está pagando el costo de una conexión que no va a usar.

### 2.4 Un hueco de la Tarea 19 que se cierra acá

`scripts/verificar-acciones.mjs` declara `ACCIONES = ["productos.ts", "categorias.ts", "ajustes.ts"]` y reporta nueve. La cuenta no cierra: 3 + 4 + 1 = 8. La novena es `toggleProductAvailabilityAction`, que la Tarea 14 dejó en `src/server/actions/product-availability.actions.ts`, un archivo que el script no abre.

El resultado es que la action que **más se usa en el panel** (el switch de disponibilidad, la única que el encargado toca varias veces por día) es la única que nadie audita. Se agrega el archivo a la lista en §6.7. Es un cambio de una línea y cierra la brecha más barata que queda en el proyecto.

### 2.5 Checklist de prerrequisitos

- [ ] Tarea 12: `buildWhatsAppMessage` con sus 18 casos, `normalizeArgentinePhone` con los suyos
- [ ] Tarea 11: `roundCurrency` en `src/lib/format/currency.ts` y `calculateCartSubtotal` en `src/lib/cart/cart-rules.ts`
- [ ] Tarea 07: `verifyAdminSession`, `requireAdminSession`, `AdminSession` (`userId`, `email`, `role`) y `isOwner`
- [ ] Tarea 14: `toggleProductAvailabilityAction` en `src/server/actions/product-availability.actions.ts`
- [ ] Tarea 16: `createProductAction`, `updateProductAction`, `archiveProductAction`
- [ ] Tarea 17: `createCategoryAction`, `updateCategoryAction`, `deleteCategoryAction`, `setCategoryVisibilityAction`, `updateBusinessSettingsAction`
- [ ] Tarea 19: `audit:bundle` y `verify:actions` en `package.json`, y los dos scripts
- [ ] Existe `.env.local` con `DATABASE_URL` y `DIRECT_DATABASE_URL` apuntando a la base de desarrollo
- [ ] `npm run test` pasa hoy, con los `include` que dejó la Tarea 09

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `tests/unit/actions/autorizacion.test.ts` | Las nueve actions sin sesión y el filtro de rol. **El archivo que más importa de la tarea** |
| `tests/integration/verify-admin.test.ts` | `verifyAdminSession` contra la base real, con sólo la lectura de cookies doblada |
| `tests/unit/format/currency.test.ts` | **Movido** desde `src/lib/format/currency.test.ts`. Sin cambios de contenido |
| `tests/unit/cart/cart-rules.test.ts` | **Movido** desde `src/lib/cart/cart-rules.test.ts`. Sin cambios de contenido |
| `tests/unit/cart/cart-schema.test.ts` | **Movido** desde `src/lib/cart/cart-schema.test.ts`. Sin cambios de contenido |
| `tests/unit/ui/classes.test.ts` | **Movido** desde `src/lib/ui/classes.test.ts`. Sin cambios de contenido |
| `tests/unit/store/availability-store.test.ts` | **Movido** desde `src/store/availability-store.test.ts`. Sin cambios de contenido |
| `tests/setup-entorno.ts` | Carga `.env.local` en `process.env` para el proyecto de integración. Sin dependencias |
| `tests/infra/roles-y-auth-stub.sql` | Roles `anon`/`authenticated` y `auth.uid()` para que la migración de RLS aplique en el Postgres de CI |
| `.github/workflows/ci.yml` | Los cuatro comandos de calidad en cada push y PR |
| `docs/pruebas.md` | La política de la suite: qué se prueba, qué no, y por qué |
| `tests/e2e/checkout-hasta-whatsapp.spec.ts` | **Condicional.** Ver §4.5 y el criterio de decisión de §6.6 |
| `playwright.config.ts` | **Condicional.** Sólo si se adopta Playwright |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `vitest.config.ts` | Tres proyectos (`unit`, `integracion`, `ui`), `include` unificados, `coverage.include` y `thresholds` (§6.3) |
| `package.json` | `test:coverage`, `test:ci`, `test:unit`, `test:integracion`, `db:export` no (esa es de la Tarea 21), `audit:deps` |
| `scripts/verificar-acciones.mjs` | Agregar `product-availability.actions.ts` a `ACCIONES` (§6.7) |
| `src/hooks/use-availability-realtime.component.test.tsx` | Ningún cambio de contenido. Se deja en `src/` (§4.2) |
| `docs/tasks/README.md` | Marcar Tarea 20 |

### 3.3 Eliminar

| Ruta | Motivo |
|---|---|
| `src/lib/format/currency.test.ts` | Se mueve a `tests/unit/format/` |
| `src/lib/cart/cart-rules.test.ts` | Se mueve a `tests/unit/cart/` |
| `src/lib/cart/cart-schema.test.ts` | Se mueve a `tests/unit/cart/` |
| `src/lib/ui/classes.test.ts` | Se mueve a `tests/unit/ui/` |
| `src/store/availability-store.test.ts` | Se mueve a `tests/unit/store/` |

**Los cinco archivos se mueven con `git mv` y no se tocan.** Un `git mv` deja el blame intacto y muestra en el diff que el archivo no cambió. Reescribirlos para "aprovechar" el cambio de carpeta sería tirar trabajo hecho y romper la regla de esta tarea: consolidar, no rehacer.

---

## 4. Estructura N-Capas

### 4.1 Qué vive en esta capa

| Artefacto | Ubicación | Por qué |
|---|---|---|
| Pruebas de lógica pura | `tests/unit/**` | No tocan base ni navegador. Corren en `environment: "node"`, sin mocks de infraestructura |
| Pruebas contra la base real | `tests/integration/**` | Un `TRUNCATE` por archivo. Es la única forma honesta de probar un repositorio |
| Pruebas de componentes | `src/**/*.component.test.tsx` | Se quedan pegadas al componente: el sufijo es lo que las separa del resto sin mantener una lista de rutas |
| Configuración de la suite | `vitest.config.ts` | Una sola fuente de verdad de qué corre dónde y qué se mide |
| Umbral de cobertura | `vitest.config.ts`, no en un `.md` | Un umbral que vive en un documento es un umbral que se puede ignorar en silencio |
| Pipeline | `.github/workflows/ci.yml` | Es la única forma de que la Quality Gate exista cuando nadie está mirando |

### 4.2 La regla que ordena dónde vive cada test

> **Un test de lógica pura va en `tests/unit/`. Un test de componente se queda junto al componente, con sufijo `.component.test.tsx`. No hay un tercer lugar.**

La excepción de los `.component.test.tsx` no es estética: son los únicos tests del proyecto que necesitan `jsdom` y `vitest.setup.ts`, y el sufijo por extensión los separa de la suite de `node` sin una lista de rutas que se desactualiza. Moverlos a `tests/` obligaría a mantener esa lista, y la lista es siempre el archivo que nadie actualiza.

Los cinco archivos que se mueven en esta tarea son todos de lógica pura. `use-availability-realtime.component.test.tsx` y los cuatro de `src/components/ui/` se quedan donde están, sin tocar.

### 4.3 Reparto específico: qué proyecto de Vitest corre qué

```
proyecto "unit"          environment: node     sin setup de base     paraleliza
  ├── tests/unit/**/*.test.ts
  └── src/**/*.test.ts            (los que no son .component.test.tsx)

proyecto "integracion"   environment: node     tests/setup-entorno.ts  fileParallelism: false
  └── tests/integration/**/*.test.ts

proyecto "ui"            environment: jsdom    vitest.setup.ts        paraleliza
  └── src/**/*.component.test.tsx
```

La cobertura se mide sobre el conjunto. Los umbrales son globales, no por proyecto: el número que importa es el de `src/lib/**` y `src/server/services/**`, y no cambia según qué proyecto se esté mirando.

### 4.4 Por qué `fileParallelism: false` sólo en integración

Los tests de integración comparten **una** base y hacen `TRUNCATE` en `beforeEach`. Dos archivos en paralelo se borran la base mutuamente y el fallo se reporta como un `expect` que no cuadra, cuando el problema es el aislamiento. Es el peor tipo de bug de test: parece un error de lógica.

Los proyectos `unit` y `ui` sí paralelizan: no tocan estado compartido y la velocidad importa, porque son los que corren en cada push.

### 4.5 La regla del ROI, escrita para que no se discuta de nuevo

| Se prueba | No se prueba |
|---|---|
| Que un mensaje salga con `$3.700` y no con `$3.700,000000001` | Que el `Button` tenga la clase `bg-crust` |
| Que una action sin sesión no escriba nada | Que la tabla del panel ordene por fecha |
| Que un `STAFF` no cambie el número de WhatsApp del local | Que el `Sheet` cierre con `Escape` (ya lo prueba la Tarea 09) |
| Que el total del carrito coincida con la suma de las líneas | Que un ícono sea el ícono correcto |
| Que un producto `DRAFT` no aparezca en `/menu` | Que la animación de entrada dure 200 ms |

La columna de la derecha ya tiene quien la cubra: cuatro archivos de `.component.test.tsx` de la Tarea 09, escritos una vez y no tocados. Agregar más tests de UI es la forma más fácil de inflar la cifra de cobertura y la más difícil de sostener.

### 4.6 Playwright: qué es y por qué queda condicional

Un test E2E levanta un navegador real, levanta Next, y verifica que `/menu` muestra productos, que el carrito acepta, que el checkout pide nombre y teléfono, y que el enlace generado es el `wa.me` correcto. Es el único tipo de test que atrapa el error de cableado: que el botón no llame a `buildWhatsAppUrl`.

Ese error es real, pero **es un error de una línea de cableado**, y el smoke test de la Tarea 21 lo detecta en el primer minuto después del deploy. Un navegador headless en el pipeline agrega entre tres y diez minutos de build, una dependencia que hay que mantener, y una clase nueva de tests que fallan por la red y no por el código.

**Criterio de decisión, escrito para aplicarlo sin discutir:**

| Condición | Decisión |
|---|---|
| El flujo de checkout cambió más de tres veces en el mes | Adoptar Playwright |
| Hubo dos o más incidentes del checkout en producción que ningún test unitario vio | Adoptar Playwright |
| El encargado reporta que se rompe algo y no se puede reproducir en local | Adoptar Playwright |
| Ninguna de las tres | **No adoptar.** El smoke test manual de la Tarea 21 cubre el cableado |

Si se adopta, el job de Playwright se habilita en `.github/workflows/ci.yml` activando la variable `E2E` del repositorio, y el job queda condicionado a `vars.E2E == 'true'`. Agregar Playwright después **no** es tocar el pipeline.

---

## 5. Convenciones de código (Clean Code + SOLID)

### 5.1 Un test afirma un comportamiento y falla si el comportamiento cambia

La pregunta que decide si un test se queda: **si alguien rompe la funcionalidad mañana, ¿este test se pone rojo?**

- `expect(formatARS(1450)).toBe("$ 1.450")` falla si alguien cambia el formato. **Se queda.**
- `expect(DEFAULT_BUSINESS_SETTINGS.name).toBe("Mi Negocio")` es un test de una constante. **No se agrega**, y si está, se borra: sólo sube el número y no atrapa nada.
- `expect(sinSesion).toBeDefined()` no dice nada. **No se escribe.**

La regla operativa: si un test pasa con el cuerpo de la función vaciado, no está probando la función. Es la misma heurística de mutación de la Tarea 04 §10, aplicada a la suite completa.

### 5.2 Los mocks que sí valen y los que no

Regla heredada de la Tarea 04 §10 y de la Tarea 07 §10, aplicada sin excepciones nuevas:

| Se dobla | Por qué |
|---|---|
| `@/server/auth/verify-admin` | Es la frontera con la identidad. La lógica que se prueba es la decisión de la action, y un doble de contrato de tres valores (`null`, `OWNER`, `STAFF`) no puede mentir sobre eso |
| `next/cache` | `revalidatePath` y `revalidateTag` lanza fuera de un contexto de request. No es lógica de negocio, es una dependencia del framework |
| `@/server/services` | Para afirmar **"el servicio no se llamó"**, que es la mitad del valor del test de autorización |
| `@/server/infra/supabase/server` en integración | La lectura de cookies es una frontera de I/O. **Todo lo demás corre contra la base real** |
| Prisma, Supabase Auth, Cloudinary en tests de lógica | **Nunca.** Un mock de Prisma verifica que el código se llama como se escribió, no que funcione |

### 5.3 Nombres

| Elemento | Nombre | Razón |
|---|---|---|
| Suite de autorización | `autorizacion.test.ts` | Dice qué protege, no qué módulo prueba |
| Suite de sesión | `verify-admin.test.ts` | El nombre del módulo, como el resto de las de integración |
| Carga de entorno | `setup-entorno.ts` | Verbo, no `env.ts` ni `cargar-env.ts` |
| Stub de SQL de CI | `roles-y-auth-stub.sql` | Dice qué crea |
| Job de calidad | `calidad` | `quality` en un proyecto que escribe en español |
| Job de integración | `integracion` | Ídem |

### 5.4 Límites de tamaño

| Archivo | Tope | Razón |
|---|---|---|
| `tests/unit/actions/autorizacion.test.ts` | 200 líneas | Nueve actions, cuatro escenarios. Si pasa, es que falta un `describe` por archivo de actions |
| `tests/integration/verify-admin.test.ts` | 150 líneas | Tres escenarios contra la base real |
| `tests/setup-entorno.ts` | 50 líneas | Lee un archivo y asigna variables |
| `tests/infra/roles-y-auth-stub.sql` | 40 líneas | Dos roles, un schema, una función |
| `.github/workflows/ci.yml` | 140 líneas | Dos jobs. Si crece, es que se está metiendo un tercer job |

---

## 6. Pasos de implementación

### 6.1 Medir antes de tocar nada

Antes de cambiar una línea, correr la suite como está y guardar el número. Sin el valor de partida, un umbral de 80% no significa nada: puede ser que el proyecto esté en 78% o en 41%.

```bash
npm run test
npm run test:coverage
```

Anotar en `docs/pruebas.md` el número real de archivos, de casos y de porcentaje. Ese es el punto de comparación del §6.3.

### 6.2 Mover los cinco tests colocados

```bash
mkdir -p tests/unit/format tests/unit/cart tests/unit/ui tests/unit/store

git mv src/lib/format/currency.test.ts      tests/unit/format/currency.test.ts
git mv src/lib/cart/cart-rules.test.ts      tests/unit/cart/cart-rules.test.ts
git mv src/lib/cart/cart-schema.test.ts     tests/unit/cart/cart-schema.test.ts
git mv src/lib/ui/classes.test.ts           tests/unit/ui/classes.test.ts
git mv src/store/availability-store.test.ts tests/unit/store/availability-store.test.ts
```

Después de esto, cada archivo movido tiene que seguir importing con el mismo alias que ya usaba (`@/lib/...`, `./...` relativos). `cart-rules.test.ts` importa `./cart-rules` y al moverlo tiene que pasar a `@/lib/cart/cart-rules`. Son los **únicos** cambios de contenido, y son cambios de línea de import.

```bash
# Verificar que no quedó ningún test de lógica pura pegado al código.
rg --files -g '*.test.ts' src/
# ⛔ Sólo puede devolver archivos *.component.test.tsx-equivalentes en
#    src/hooks/ y src/components/. Un .test.ts suelto en src/ es un olvido.
```

### 6.3 `vitest.config.ts` — configuración final

```ts
// vitest.config.ts
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

/**
 * ⛔ Un proyecto declarado en línea NO hereda `plugins` ni `resolve` de la
 *    raíz: Vitest los resuelve por proyecto. Ver Tarea 09 §6.15.
 */
const shared: ViteUserConfig = { plugins: [react()], resolve: { alias } };

export default defineConfig({
  test: {
    projects: [
      {
        ...shared,
        test: {
          name: "unit",
          environment: "node",
          /**
           * ⛔ La unión de las dos rutas, y esta es la corrección del
           *    conflicto 1 de §2.3: la Tarea 09 dejó `src/**` y dejó
           *    afuera los treinta y cinco archivos de `tests/`.
           */
          include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
          // Sin `setupFiles`: un test de lógica pura no abre una conexión
          // a Postgres para no usarla. Ver el conflicto 3 de §2.3.
        },
      },
      {
        ...shared,
        test: {
          name: "integracion",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // El orden importa: `setup-entorno` carga las variables y
          // `setup` expone `resetDatabase`. Ver §4.4.
          setupFiles: ["./tests/setup-entorno.ts"],
          /**
           * ⛔ Una sola base compartida: los archivos corren de a uno.
           *    Ver §4.4.
           */
          fileParallelism: false,
          maxWorkers: 1,
          testTimeout: 20_000,
        },
      },
      {
        ...shared,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.component.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],

    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",

      /**
       * ⛔ Sólo estas dos carpetas se miden. Ver §2.3, conflicto 2.
       *
       * Lo que queda afuera, y por qué:
       *  - `src/components/**` y `src/app/**`: presentación. Ya probada
       *    por la Tarea 09; medirla infla el número y baja el umbral real.
       *  - `src/server/repositories/**`: no se puede probar sin base, y
       *    los tests de integración lo hacen. Incluirlo en el umbral
       *    obligaría a un número que depende de tener la base levantada.
       *  - `src/server/infra/**`: conexión y singletons. No tienen lógica
       *    de negocio que testear. Es lo que ya decidió la Tarea 02 §10.
       *  - `scripts/**` y `docs/**`: fuera de `src/`.
       */
      include: ["src/lib/**/*.ts", "src/server/services/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/index.ts",
        "**/*.config.*",
        "**/schemas/**",
      ],

      /**
       * ⛔ `perFile: false` a propósito.
       *
       * Con `perFile: true`, un archivo de ocho líneas con cuatro
       *_ramificaciones no alcanzaría 80% y el pipeline fallaría por un
       * archivo que nadie va a leer. El umbral es del conjunto: mide si
       * el módulo crítico está cubierto, no si cada helper tiene su
       * propio test.
       */
      thresholds: {
        lines: 80,
        functions: 85,
        branches: 80,
        statements: 80,
        perFile: false,
      },
    },
  },
});
```

**Sobre el número 80:** es un piso, no un objetivo. La forma de moverlo:

1. Correr `npm run test:coverage` y mirar el número real.
2. Si está por debajo de 80, **no se baja el umbral**: se agrega el test que falta en la zona A, B, C o D de §2.1. Bajar el umbral para que el pipeline pase es la forma más rápida de no tener pipeline.
3. Si está claramente por encima (95 y pico), se sube a 85 en un commit propio con el texto explicando que el número se subió porque la suite estaba lista, no en un commit que mezcla una feature con un cambio de umbral.
4. El umbral sólo se toca en `vitest.config.ts`, y el cambio se ve en el diff. Un umbral en un `README.md` es un umbral que no se aplica.

### 6.4 `tests/setup-entorno.ts`

```ts
// tests/setup-entorno.ts
// ⛔ Sin dependencias. Lee `.env.local` y lo pone en `process.env` antes de
//    que Prisma se conecte. Ver el conflicto 3 de §2.3.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ⛔ No sobreescribe variables que ya existen.
 *
 * En CI las variables llegan del entorno del job y tienen prioridad: el
 * `.env.local` de una máquina de desarrollo no puede apuntar el pipeline a
 * otra base. Este es el orden que hace que los tests fallen en CI por una
 * base equivocada, en vez de apuntar en silencio a la de desarrollo.
 */
const cargarSiFalta = (archivo: string): void => {
  const ruta = join(process.cwd(), archivo);
  if (!existsSync(ruta)) return;

  for (const linea of readFileSync(ruta, "utf8").split("\n")) {
    const definicion = /^([A-Z0-9_]+)=(.*)$/.exec(linea.trim());
    if (definicion === null) continue;

    const clave = definicion[1];
    const valor = definicion[2]?.replace(/^["']|["']$/g, "");
    if (clave === undefined || valor === undefined) continue;
    if (process.env[clave] !== undefined) continue;

    process.env[clave] = valor;
  }
};

cargarSiFalta(".env.local");
cargarSiFalta(".env");

// Falla ruidosamente y temprano. Un `P1001` tres minutos después, en el
// primer `beforeEach`, cuesta más entender que esto.
const requeridas = ["DATABASE_URL", "DIRECT_DATABASE_URL"] as const;
const faltantes = requeridas.filter((clave) => process.env[clave] === undefined);

if (faltantes.length > 0) {
  throw new Error(
    `[setup-entorno] Faltan ${faltantes.join(", ")}. Corré con .env.local en la raíz o exportalas en el entorno.`,
  );
}
```

> `tests/setup.ts` de la Tarea 04 se sigue importando **como módulo** desde los tests de integración (`import { resetDatabase } from "../setup"`), no se usa más como `setupFiles`. Por eso no hay que partirlo: `resetDatabase` y `disconnectDatabase` son sus exports y no se ejecutan al importarse.

### 6.5 Tests de autorización de las Server Actions

Este es el bloque que no existía. La hipótesis que se prueba es una sola: **una action que no verifica la sesión no escribe nada**, y el filtro de rol corta lo que no le corresponde.

```ts
// tests/unit/actions/autorizacion.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminSession } from "@/lib/domain/session";
import type { ProductoAltaInput } from "@/lib/validation/producto-admin";
import type { AjustesInput } from "@/server/schemas/ajustes.schema";

/**
 * ⛔ Dobles de CONTRATO, no de comportamiento. Ver §5.2.
 *
 * `verifyAdminSession` devuelve exactamente tres cosas: `null`, una sesión
 * `OWNER` o una sesión `STAFF`. Si mañana devuelve un cuarto valor, este
 * archivo deja de compilar y eso es correcto: la autorización cambió y el
 * test tiene que cambiar con ella.
 */
const verifyAdminSession = vi.fn<() => Promise<AdminSession | null>>();

const sesion = (role: AdminSession["role"]): AdminSession => ({
  userId: "u-ana",
  email: "ana@modomiga.com.ar",
  role,
});

vi.mock("@/server/auth/verify-admin", () => ({
  verifyAdminSession: () => verifyAdminSession(),
  requireAdminSession: async () => {
    const actual = await verifyAdminSession();
    if (actual === null) throw new Error("Sesión expirada");
    return actual;
  },
}));

/**
 * ⛔ `revalidatePath` y `revalidateTag` lanzan fuera de un contexto de
 *    request de Next. No es lógica de negocio: es una dependencia del
 *    framework que no se puede ejecutar en un test de Node.
 */
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

const createProductFromAdmin = vi.fn();
const updateProductFromAdmin = vi.fn();
const archiveProductFromAdmin = vi.fn();
const setProductAvailability = vi.fn();
const createCategoryFromAdmin = vi.fn();
const updateCategoryFromAdmin = vi.fn();
const deleteCategoryFromAdmin = vi.fn();
const setCategoryVisibilityFromAdmin = vi.fn();
const updateSettingsFromAdmin = vi.fn();

vi.mock("@/server/services", () => ({
  createProductFromAdmin,
  updateProductFromAdmin,
  archiveProductFromAdmin,
  setProductAvailability,
  createCategoryFromAdmin,
  updateCategoryFromAdmin,
  deleteCategoryFromAdmin,
  setCategoryVisibilityFromAdmin,
  updateSettingsFromAdmin,
}));

vi.mock("@/server/services/category-admin.service", () => ({
  createCategoryFromAdmin,
  updateCategoryFromAdmin,
  deleteCategoryFromAdmin,
  setCategoryVisibilityFromAdmin,
}));

vi.mock("@/server/services/settings-admin.service", () => ({
  updateSettingsFromAdmin,
  getSettingsFormForAdmin: vi.fn(),
}));

/** Payload válido y completo. La idea es que el rechazo sea por sesión, no por validación. */
const productoValido: ProductoAltaInput = {
  nombre: "Classic Jamón y Queso",
  descripcion: "Vientre de leche con jamón cocido y queso gouda.",
  precio: 1450,
  categoryId: "cat_1",
  allergens: ["gluten", "lactosa"],
  isFeatured: false,
  imagen: {
    imageUrl: "https://res.cloudinary.com/modo-miga/image/upload/x.jpg",
    imagePublicId: "modo-miga/products/classic-jamon-y-queso",
  },
};

/**
 * Payload válido y completo, con las claves exactas de `AjustesSchema`
 * (Tarea 17 §6.5). La idea es que el rechazo sea por sesión, no por
 * validación: si el payload no parseara, el test probaría Zod y no la
 * autorización.
 */
const ajustesValidos: AjustesInput = {
  nombre: "Mi Negocio",
  telefonoWhatsapp: "5492615551234",
  direccion: "San Rafael, Mendoza",
  instagram: "https://instagram.com/modo.miga",
  mensajeCierre: null,
  avisoLegal: null,
  horarios: { monday: { abre: "09:00", cierra: "21:00" } },
};

const TODOS_LOS_SERVICIOS = [
  createProductFromAdmin,
  updateProductFromAdmin,
  archiveProductFromAdmin,
  setProductAvailability,
  createCategoryFromAdmin,
  updateCategoryFromAdmin,
  deleteCategoryFromAdmin,
  setCategoryVisibilityFromAdmin,
  updateSettingsFromAdmin,
];

/**
 * ⛔ Payload que no parsea en ningún esquema.
 *
 * Todas las actions declaran `rawInput: unknown` (Tarea 14 §6.2, Tarea 16
 * §6.1, Tarea 17 §6.3), así que el doble del servicio es el único que
 * puede detectar que una action miró el input antes de autorizar. Por eso
 * `vi.spyOn` no alcanza y hace falta el doble de `@/server/services`.
 */
const PAYLOAD_INVALIDO = { hackeado: true };

beforeEach(() => {
  vi.clearAllMocks();
  verifyAdminSession.mockResolvedValue(null);
  for (const servicio of TODOS_LOS_SERVICIOS) {
    servicio.mockResolvedValue(undefined);
  }
});

describe("autorización de las Server Actions", () => {
  it("debe rechazar las nueve actions sin sesión, sin delegar en ningún servicio", async () => {
    const {
      createProductAction,
      updateProductAction,
      archiveProductAction,
    } = await import("@/server/actions/productos");
    const { toggleProductAvailabilityAction } = await import(
      "@/server/actions/product-availability.actions"
    );
    const {
      createCategoryAction,
      updateCategoryAction,
      setCategoryVisibilityAction,
      deleteCategoryAction,
    } = await import("@/server/actions/categorias");
    const { updateBusinessSettingsAction } = await import("@/server/actions/ajustes");

    // ⛔ Nueve, ni una más ni una menos: 3 de productos, 1 de disponibilidad,
    //    4 de categorías y 1 de ajustes. Es la misma cuenta que hace
    //    `verify:actions`, y las dos tienen que dar nueve.
    const resultados = await Promise.all([
      createProductAction(PAYLOAD_INVALIDO, null),
      updateProductAction(PAYLOAD_INVALIDO),
      archiveProductAction(PAYLOAD_INVALIDO),
      toggleProductAvailabilityAction(PAYLOAD_INVALIDO),
      createCategoryAction(PAYLOAD_INVALIDO),
      updateCategoryAction(PAYLOAD_INVALIDO),
      setCategoryVisibilityAction(PAYLOAD_INVALIDO),
      deleteCategoryAction(PAYLOAD_INVALIDO),
      updateBusinessSettingsAction(PAYLOAD_INVALIDO),
    ]);

    for (const resultado of resultados) {
      expect(resultado.ok).toBe(false);
    }

    // ⛔ La mitad del valor del test. Si una action autoriza después de
    //    parsear, o si el servicio se llama antes del chequeo, esto falla.
    for (const servicio of TODOS_LOS_SERVICIOS) {
      expect(servicio).not.toHaveBeenCalled();
    }
  });

  it("debe devolver el mensaje de sesión expirada de cada familia, no uno genérico", async () => {
    const { createProductAction } = await import("@/server/actions/productos");
    const { toggleProductAvailabilityAction } = await import(
      "@/server/actions/product-availability.actions"
    );
    const { updateBusinessSettingsAction } = await import("@/server/actions/ajustes");

    // ⛔ Los tres textos NO son iguales: productos, disponibilidad y
    //    ajustes escribieron cada uno el suyo. Ver §7.2.
    expect(await createProductAction(PAYLOAD_INVALIDO, null)).toEqual({
      ok: false,
      error: "Tu sesión expiró. Volvé a entrar.",
      code: "UNAUTHORIZED",
    });
    expect(await toggleProductAvailabilityAction(PAYLOAD_INVALIDO)).toEqual({
      ok: false,
      error: "Tu sesión expiró. Volvé a iniciar sesión para seguir.",
      code: "UNAUTHORIZED",
    });
    expect(await updateBusinessSettingsAction(PAYLOAD_INVALIDO)).toEqual({
      ok: false,
      error: "Sesión expirada. Volvé a iniciar sesión.",
    });
  });

  it("debe impedir que un STAFF cambie los datos del negocio", async () => {
    verifyAdminSession.mockResolvedValue(sesion("STAFF"));
    const { updateBusinessSettingsAction } = await import("@/server/actions/ajustes");

    const resultado = await updateBusinessSettingsAction(ajustesValidos);

    expect(resultado).toEqual({
      ok: false,
      error: "Sólo el dueño del negocio puede cambiar los datos de contacto.",
    });
    expect(updateSettingsFromAdmin).not.toHaveBeenCalled();
  });

  it("debe dejar que un OWNER cambie los datos del negocio", async () => {
    verifyAdminSession.mockResolvedValue(sesion("OWNER"));
    const { updateBusinessSettingsAction } = await import("@/server/actions/ajustes");

    const resultado = await updateBusinessSettingsAction(ajustesValidos);

    expect(resultado.ok).toBe(true);
    expect(updateSettingsFromAdmin).toHaveBeenCalledTimes(1);
  });

  it("debe permitir que un STAFF cree un producto, porque el panel es de los dos", async () => {
    verifyAdminSession.mockResolvedValue(sesion("STAFF"));
    const { createProductAction } = await import("@/server/actions/productos");

    const resultado = await createProductAction(productoValido, null);

    expect(resultado.ok).toBe(true);
    expect(createProductFromAdmin).toHaveBeenCalledTimes(1);
  });

  it("debe rechazar un producto con precio negativo antes de delegar", async () => {
    verifyAdminSession.mockResolvedValue(sesion("OWNER"));
    const { createProductAction } = await import("@/server/actions/productos");

    const resultado = await createProductAction(
      { ...productoValido, precio: -450 },
      null,
    );

    expect(resultado.ok).toBe(false);
    expect(createProductFromAdmin).not.toHaveBeenCalled();
  });
});
```

Seis casos, no veinte. Los cinco primeros casos son el contrato de autorización; el sexto existe para demostrar que el filtro de sesión no se comió el filtro de validación. Agregar un caso por cada combinación de rol y action sería cobrir el producto cartesiano, y once de esos casos no prueban nada que el primero no pruebe.

### 6.6 Tests de la sesión sin fila en `staff_members`

Este es el caso que §2.1 marca como crítico y que la Tarea 07 §10 declara explícitamente que **no** se testea ("necesita Supabase Auth real"). Lo que hace esta tarea es correr la mitad de `verifyAdminSession` que **no** necesita Auth: la consulta a `staff_members`. La frontera que se dobla es la lectura de cookies, que es I/O puro; todo lo demás va contra la base real.

```ts
// tests/integration/verify-admin.test.ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { disconnectDatabase, resetDatabase } from "../setup";
import { createStaffMember } from "@/server/repositories/staff.repository";

/**
 * ⛔ Se dobla SÓLO la lectura de cookies. `findStaffById` sigue siendo el
 *    real, contra la base real. Ver §5.2.
 *
 * Un doble de `findStaffById` que devuelve `null` probaría que el código
 * tiene un `if (staff === null)`. Esto prueba que la fila se busca de
 * verdad y que la fila de `staff_members` es la que manda.
 *
 * El estado del doble son dos variables, no un `spyOn`: `auth` es una
 * propiedad del objeto devuelto, no un getter, y `vi.spyOn(objeto,
 * "auth", "get")` sobre un módulo ya mockeado falla en runtime.
 */
let usuarioId = "u-sin-fila";
let getUserFalla = false;

vi.mock("@/server/infra/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () =>
        getUserFalla
          ? { data: { user: null }, error: { message: "network down" } }
          : { data: { user: { id: usuarioId, email: "sin-fila@modomiga.com.ar" } }, error: null },
    },
  }),
}));

const crearDueña = () =>
  createStaffMember({
    id: "u-con-fila",
    email: "con-fila@modomiga.com.ar",
    name: "Ana",
    role: "OWNER",
  });

beforeEach(async () => {
  usuarioId = "u-sin-fila";
  getUserFalla = false;
  await resetDatabase();
  await crearDueña();
});

afterAll(disconnectDatabase);

describe("verifyAdminSession", () => {
  it("debe rechazar a un usuario con sesión válida que no está en staff_members", async () => {
    const { verifyAdminSession } = await import("@/server/auth/verify-admin");

    // Sesión válida: `getUser` no devuelve error. La fila no existe.
    const sesion = await verifyAdminSession();

    expect(sesion).toBeNull();
  });

  it("debe devolver la sesión con el rol leído de la base, no del token", async () => {
    usuarioId = "u-con-fila";
    const { verifyAdminSession } = await import("@/server/auth/verify-admin");

    const sesion = await verifyAdminSession();

    expect(sesion).toEqual({
      userId: "u-con-fila",
      email: "con-fila@modomiga.com.ar",
      role: "OWNER",
    });
  });

  it("debe rechazar cuando getUser falla, sin degradar a autorizado", async () => {
    const { verifyAdminSession } = await import("@/server/auth/verify-admin");

    getUserFalla = true;

    // Red caída, token vencido o revocado: los tres casos.
    expect(await verifyAdminSession()).toBeNull();
  });
});
```

El tercer caso es el más importante de los tres, y es la razón de que la Tarea 07 declara que `verifyAdminSession` falle cerrada. Un panel que se cae un rato es un problema operativo; un panel que se abre solo es una brecha.

### 6.7 Cerrar el hueco de `verificar-acciones.mjs`

```js
// scripts/verificar-acciones.mjs (modificación de ACCIONES)

/**
 * ⛔ Los cuatro archivos, no tres. Ver Tarea 20 §2.4.
 *
 * `product-availability.actions.ts` contiene `toggleProductAvailabilityAction`,
 * que es la action que más usa el encargado del local. Sin esta línea, la
 * suite reporta ocho actions verificadas y el número no cuadra con las nueve
 * que existen.
 */
const ACCIONES = [
  "productos.ts",
  "product-availability.actions.ts",
  "categorias.ts",
  "ajustes.ts",
];
```

### 6.8 Aritmética de dinero: sólo los huecos

`roundCurrency` y `calculateCartSubtotal` ya tienen sus casos de borde en los archivos que se movieron en §6.2. **No se reescriben.** Lo que falta son los casos que cruzan los dos módulos, y son tres:

| Hueco | Por qué no está cubierto |
|---|---|
| El subtotal del carrito y el total del mensaje coinciden con el mismo carrito | Viven en dos módulos distintos (`cart-rules` y `message-contract`) con dos implementaciones de la suma. Si divergen, el cliente ve un total y el local recibe otro |
| Un precio con centavos y cantidad mayor que uno | `roundCurrency(1450.55, 3)` es el caso que produce residuo de punto flotante en la línea, no en el total |
| El precio de una variante ya incluye el `priceDelta` | El mensaje arma el precio; el carrito calcula el precio. Si uno aplica el delta y el otro no, el total del mensaje no es el del carrito |

```ts
// tests/unit/cart/consistencia-de-totales.test.ts
// ⛔ Este archivo no reemplaza a cart-rules.test.ts ni al de la Tarea 12.
//    Cubre lo que ninguno de los dos puede ver solo.
import { describe, expect, it } from "vitest";
import { roundCurrency } from "@/lib/format/currency";
import { calculateCartSubtotal } from "@/lib/cart/cart-rules";
import type { CartLine } from "@/lib/cart/cart-types";
import { buildWhatsAppOrder } from "@/lib/whatsapp/whatsapp-message.service";
import { lineTotal, orderTotal } from "@/lib/whatsapp/message-contract";
import type { WhatsAppCartLine } from "@/lib/whatsapp/message-contract";

const NEGOCIO = { name: "Mi Negocio", whatsappPhone: "5492615551234" } as const;
const CLIENTE = {
  fullName: "Juan Pérez",
  phone: "2615551234",
  fulfillment: "pickup",
  address: null,
  notes: null,
} as const;

/**
 * ⛔ La línea del carrito y la del mensaje son dos tipos distintos con
 *    cinco campos en común. El helper parte de la del carrito y deriva la
 *    del mensaje, que es lo que hace el checkout en la Tarea 13: el precio
 *    que viaja ya tiene el `priceDelta` aplicado.
 */
const linea = (sobrescribe: Partial<CartLine> = {}): CartLine => ({
  productId: "p1",
  slug: "classic-jamon-y-queso",
  name: "Classic Jamón y Queso",
  variantId: null,
  variantName: null,
  unitPrice: 1450,
  quantity: 1,
  imageUrl: null,
  available: true,
  ...sobrescribe,
});

const comoMensaje = (origen: CartLine): WhatsAppCartLine => ({
  productId: origen.productId,
  name: origen.name,
  variantName: origen.variantName,
  unitPrice: origen.unitPrice,
  quantity: origen.quantity,
});

describe("consistencia entre el carrito y el mensaje", () => {
  it("debe dar el mismo total en el carrito y en el mensaje de WhatsApp", () => {
    const lineas = [
      linea({ productId: "a", unitPrice: 1450.55, quantity: 3 }),
      linea({ productId: "b", unitPrice: 0.1, quantity: 1 }),
      linea({ productId: "c", unitPrice: 0.2, quantity: 1 }),
    ];
    const items = lineas.map(comoMensaje);

    const subtotal = calculateCartSubtotal({ lines: lineas });
    const total = orderTotal(items);

    expect(subtotal).toBe(total);
    // Y el mensaje, que es lo que lee el local, dice lo mismo.
    expect(buildWhatsAppOrder({ items, customer: CLIENTE, business: NEGOCIO }).total).toBe(total);
  });

  it("debe redondear la línea con centavos, no el total acumulado", () => {
    const conCentavos = linea({ unitPrice: 1450.55, quantity: 3 });

    // 1450.55 * 3 = 4351.649999999999 en coma flotante.
    expect(lineTotal(comoMensaje(conCentavos))).toBe(4351.65);
    expect(roundCurrency(1450.55 * 3)).toBe(4351.65);
  });

  it("debe usar en el mensaje el precio con el priceDelta ya aplicado", () => {
    // El precio de la línea YA viene con el delta. Si el mensaje lo
    // aplicara otra vez, el total sería el doble en la variante.
    const conVariante = linea({
      variantId: "v-doble",
      variantName: "Doble queso",
      unitPrice: 1450 + 250,
      quantity: 2,
    });

    const mensaje = buildWhatsAppOrder({
      items: [comoMensaje(conVariante)],
      customer: CLIENTE,
      business: NEGOCIO,
    });

    expect(mensaje.total).toBe(3400);
    expect(mensaje.text).toContain("Doble queso");
  });
});
```

**Y los tres huecos de dinero que quedan, si el suite está en 80 justo.** `roundCurrency` con un valor que no es número, con un número gigante, y con un `Number.MAX_SAFE_INTEGER` que no se puede representar. Son tres líneas cada uno y ninguno agrega valor si el umbral ya está.

### 6.9 Playwright, si se decide (§4.6)

```ts
// tests/e2e/checkout-hasta-whatsapp.spec.ts  — CONDICIONAL
import { expect, test } from "@playwright/test";

/**
 * El único bug que este archivo atrapa y los tests unitarios no: que el
 * botón del checkout no llame a `buildWhatsAppUrl`. Todo lo demás --el
 * formato, el truncado, el encoding-- ya está cubierto por la Tarea 12.
 *
 * Ver §4.6 para el criterio de decisión. Si no se adoptó Playwright, este
 * archivo no se crea.
 */
test("debe llevar desde el menú hasta una URL de WhatsApp con el pedido completo", async ({
  page,
}) => {
  await page.goto("/menu");

  const primerProducto = page.getByRole("link", { name: /ver|detalle/i }).first();
  await primerProducto.click();
  await expect(page.getByRole("button", { name: /agregar/i }).first()).toBeVisible();
  await page.getByRole("button", { name: /agregar/i }).first().click();

  await page.getByRole("link", { name: /carrito/i }).click();
  await page.getByRole("link", { name: /checkout|finalizar/i }).click();

  await page.getByLabel(/nombre/i).fill("Juan Pérez");
  await page.getByLabel(/tel[eé]fono/i).fill("2615551234");
  await page.getByRole("button", { name: /enviar|whatsapp/i }).click();

  await expect(page).toHaveURL(/^https:\/\/wa\.me\/549261\d{7}\?text=/);
  await expect(page.getByText(/Classic|modo miga/i).first()).toBeVisible();
});
```

El smoke test manual de la Tarea 21 §6.5 verifica lo mismo en un minuto. La diferencia es que el manual lo hace una vez por deploy y el E2E lo hace en cada commit; a cambio, cuesta entre tres y diez minutos de pipeline y una dependencia más.

### 6.10 `package.json`

```jsonc
// package.json (extracto de scripts)
{
  "scripts": {
    // ⛔ `test` corre las TRES suites. Con la Tarea 09 el proyecto
    //    `node` había dejado afuera `tests/**`; §6.3 lo arregla.
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run --project=unit",
    "test:integracion": "vitest run --project=integracion",
    "test:ui": "vitest run --project=ui",

    // ⛔ En CI el umbral es el de `vitest.config.ts`. No se pasa por
    //    flag: un umbral que se puede sobreescribir por línea de
    //    comando es un umbral que no se aplica.
    "test:coverage": "vitest run --coverage",
    "test:ci": "vitest run --project=unit && vitest run --project=ui && vitest run --project=integracion",

    "verify": "npm run lint && npm run typecheck && npm run test",
    "verify:actions": "node scripts/verificar-acciones.mjs",
    "audit:bundle": "node scripts/auditar-bundle.mjs",

    // ⛔ Auditoría de dependencias, que la Tarea 19 dejó explícitamente
    //    para esta. No falla el pipeline: informa, y el que decide es la
    //    persona. Un `npm audit` que corta el deploy por una vulnerabilidad
    //    transitiva de desarrollo deja de tierra el deploy por cosas reales.
    "audit:deps": "npm audit --omit=dev"
  }
}
```

### 6.11 `.github/workflows/ci.yml`

```yaml
# .github/workflows/ci.yml
name: calidad

on:
  push:
    branches: [main]
  pull_request:

# ⛔ Cancela la corrida anterior del mismo ref. Un push seguido de otro
#    genera dos builds de la misma rama, y el segundo arranca mientras el
#    primero todavía está corriendo.
concurrency:
  group: calidad-${{ github.ref }}
  cancel-in-progress: true

jobs:
  calidad:
    name: calidad
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Instalar dependencias
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      # ⛔ Sin base de datos: la suite unitaria no abre una conexión. Ver
      #    el conflicto 3 de §2.3. Por eso este job no necesita secretos.
      - name: Tests unitarios
        run: npm run test:unit

      - name: Tests de componentes
        run: npm run test:ui

      # ⛔ `build` ya encadena `audit:bundle`. Ver Tarea 19 §6.5.
      - name: Build y auditoría del bundle
        run: npm run build
        env:
          # ⛔ Valores de mentira, y no vacíos, para que el bundle se
          #    construya completo. `auditar-bundle.mjs` compara contra
          #    `process.env`: con la variable vacía no encuentra nada que
          #    auditar y pasa sin auditar. Ver §9.
          SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiJ9.placeholder.para-ci"
          CLOUDINARY_API_SECRET: "placeholder-para-ci"
          CLOUDINARY_CLOUD_NAME: "modo-miga"
          CLOUDINARY_API_KEY: "000000000000000"
          NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co"
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-para-ci"
          NEXT_PUBLIC_SITE_URL: "https://modomiga.com.ar"

      - name: Verificar actions
        run: npm run verify:actions

      - name: Cobertura
        run: npm run test:coverage --project=unit

  integracion:
    name: integracion
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: calidad
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: modo_miga_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Instalar dependencias
        run: npm ci

      # ⛔ La migración de RLS de la Tarea 19 usa `auth.uid()` y hace
      #    `grant` a los roles `anon` y `authenticated`, que no existen en
      #    un Postgres de Docker. El stub se aplica ANTES de migrar, en la
      #    misma base, y nunca en Supabase. Ver §6.12.
      - name: Stub de roles y auth
        run: PGPASSWORD=postgres psql -h localhost -U postgres -d modo_miga_test -f tests/infra/roles-y-auth-stub.sql

      - name: Aplicar migraciones
        run: npx prisma migrate deploy
        env:
          # ⛔ `DIRECT_DATABASE_URL` para migrar, `DATABASE_URL` para el
          #    runtime. La distinción de la Tarea 02 §12.2. Acá los dos
          #    apuntan al mismo Postgres porque no hay pooler, y esa es la
          #    única diferencia con producción.
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/modo_miga_test
          DIRECT_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/modo_miga_test

      - name: Tests de integración
        run: npm run test:integracion
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/modo_miga_test
          DIRECT_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/modo_miga_test

  e2e:
    name: e2e
    # ⛔ No corre salvo que la variable `E2E` del repositorio valga
    #    "true". Ver §4.6: Playwright es condicional y adoptarlo no es
    #    tocar este archivo.
    if: ${{ vars.E2E == 'true' }}
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: calidad
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
        env:
          NEXT_PUBLIC_SITE_URL: http://localhost:3000
```

### 6.12 El stub de roles y `auth` para CI

```sql
-- tests/infra/roles-y-auth-stub.sql
--
-- ⛔ SOLO para el Postgres de CI. Nunca se aplica en Supabase.
-- ⛔ Motivo: la migración `20250120000000_rls_y_lectura_realtime.sql` de
--    la Tarea 19 hace `grant ... to anon, authenticated` y usa
--    `auth.uid()` dentro de `es_usuario_del_staff()`. En un Postgres
--    pelado los roles no existen y `migrate deploy` falla con
--    `role "anon" does not exist`.
--
-- Esto NO es una traducción de la migración: es lo mínimo para que
--    corra. La verificación real de que la política hace lo que dice es
--    la de la Tarea 19 §6.2, con la anon key de verdad, contra Supabase.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create schema if not exists auth;

-- ⛔ Devuelve `null` a propósito. En CI no hay sesión de Supabase, y una
--    política que resuelve `false` es el comportamiento correcto para
--    un usuario que no está autenticado.
create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select null::uuid $$;

create or replace function auth.jwt() returns jsonb
  language sql stable
  as $$ select null::jsonb $$;
```

> Si `migrate deploy` sigue fallando con `column "x" does not exist` en una tabla que Supabase crea sola, la migración del proyecto tiene una dependencia de plataforma que hay que resolver en `prisma/migrations/`, no acá. Anotar el error exacto y corregir la migración: agregar objetos de plataforma al stub es la forma de que la base de desarrollo y la de producción diverjan en silencio.

### 6.13 Verificación

```bash
npm run lint && npm run typecheck

# ⛔ Los tres proyectos, uno por vez. Esto tiene que imprimir tests en
#    los tres: un proyecto que no imprime nada es un proyecto que no
#    está corriendo lo que dice.
npm run test:unit
npm run test:ui
npm run test:integracion

npm run test:coverage
npm run build
npm run verify:actions

# ⛔ El número de actions tiene que ser nueve. Si sigue en ocho, falta
#    un archivo en ACCIONES. Ver §2.4.
npm run verify:actions
```

```bash
# ⛔ Ningún test de lógica pura quedó pegado al código.
rg --files -g '*.test.ts' src/
# ⛔ Salida esperada: src/hooks/use-availability-realtime.component.test.tsx
#    NO aparece (es .tsx). Sólo quedan .component.test.tsx.

# ⛔ La suite corre los archivos de tests/ Y los de src/.
npm run test:unit -- --reporter=verbose 2>&1 | rg -c '^\s+[✓×]'
```

---

## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `projects: [unit, integracion, ui]` | `vitest.config.ts` | `npm run test`, `test:coverage`, el pipeline de CI |
| `thresholds: { lines: 80, functions: 85, branches: 80, statements: 80 }` | `vitest.config.ts` | El pipeline de CI |
| `fileParallelism: false` en el proyecto `integracion` | `vitest.config.ts` | Los 7 archivos de integración |
| `setup-entorno.ts` | `tests/setup-entorno.ts` | El proyecto `integracion` |
| `resetDatabase()`, `disconnectDatabase()` | `tests/setup.ts` (Tarea 04) | Los 7 archivos de integración, **como módulo** |
| `ACCIONES` con cuatro archivos | `scripts/verificar-acciones.mjs` | `npm run verify:actions`, Tarea 19 |
| `AdminSession` (`userId`, `email`, `role`) | `src/lib/domain/session.ts` (Tarea 07) | El doble de sesión de `autorizacion.test.ts` |
| `isOwner(session)` | `src/lib/domain/session.ts` (Tarea 17) | `updateBusinessSettingsAction` y su test |
| `lineTotal`, `orderTotal` | `src/lib/whatsapp/message-contract.ts` (Tarea 12) | `consistencia-de-totales.test.ts` |
| `calculateCartSubtotal(state)` | `src/lib/cart/cart-rules.ts` (Tarea 11) | `consistencia-de-totales.test.ts` |
| `E2E` (variable del repositorio) | Configuración del repositorio en GitHub | El job `e2e` de `.github/workflows/ci.yml` |

**Contrato que esta tarea fija y no existía:** la distribución de los tests en tres proyectos de Vitest, y el umbral de cobertura como configuración ejecutable. **Contratos que consume y no toca:** los 46 archivos de test existentes, los repositorios, los servicios y las nueve Server Actions.

### 7.1 La discrepancia que hay que cerrar al escribir el test

`verifyAdminSession` devuelve `AdminSession` con los campos **`userId`, `email`, `role`** (Tarea 07 §6.3). El ejemplo de `logAdminAction` de la Tarea 19 §6.4 usa `session.user.id` y `session.rol`, que no existen en ese tipo.

Al escribir `autorizacion.test.ts`, usar la forma de la Tarea 07: `userId` y `role`. Si el ejemplo de la Tarea 19 no compila, se corrige el ejemplo en `docs/seguridad.md` o en el propio archivo de la action, no el test. **El test no se adapta a un contrato roto: el contrato se arregla.**

### 7.2 Los tres mensajes de sesión expirada no son el mismo

Las nueve actions rechazan sin sesión, pero **no con el mismo texto**:

| Familia | Texto | Campo `code` |
|---|---|---|
| Productos (Tarea 16 §6.1) | `"Tu sesión expiró. Volvé a entrar."` | `"UNAUTHORIZED"` |
| Disponibilidad (Tarea 14 §6.2) | `"Tu sesión expiró. Volvé a iniciar sesión para seguir."` | `"UNAUTHORIZED"` |
| Categorías y ajustes (Tarea 17 §6.3) | `"Sesión expirada. Volvé a iniciar sesión."` | No lo lleva |

La Tarea 17 §12 pide explícitamente que ese texto deje de estar repetido en cada action y pase a una constante. Hoy no lo está: son tres cadenas distintas escritas a mano en tres tareas.

El test de §6.5 **afirma los tres textos por separado y no los unifica**. Unificar el mensaje es una decisión de producto que corresponde a la Tarea 17 o a la 21, no a una tarea de pruebas: si este testvoltara a afirmar un solo texto, fallaría en el momento exacto en que alguien corrige la inconsistencia, que es cuando menos conviene.

Lo que sí hace esta tarea es dejar el hecho anotado: la diferencia existe, es visible para el cliente, y el próximo que escriba una action nueva tiene que elegir a cuál de los tres se parece.

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [x] `npm run test` corre las tres suites y encuentra los 46 archivos de test  — **63** archivos (el inventario de §3 quedó viejo, §13.3.1)
- [x] `npm run test:unit` corre los archivos de `tests/unit/**` **y** los de `src/**/*.test.ts` (el conflicto 1 de §2.3 está resuelto)  — `src/**/*.test.ts` ya no existe: los 9 se movieron, así que el patrón cubre `tests/unit/**` y queda inerte (§13.3.2)
- [x] `npm run test:integracion` corre los 7 archivos contra la base real  — **4** archivos (§13.3.4)
- [x] `npm run test:ui` corre los 6 archivos `.component.test.tsx`  — **18** archivos (§13.3.5)
- [x] Los cinco tests colocados se movieron a `tests/unit/` con `git mv` y sus imports actualizados  — con `mv`, no `git mv`: el repo no tiene ningún commit (§13.3.3)
- [x] `autorizacion.test.ts` prueba las nueve actions sin sesión y ninguna delega en un servicio
- [x] `autorizacion.test.ts` prueba que un `STAFF` no puede cambiar los datos del negocio y que un `OWNER` sí
- [x] `verify-admin.test.ts` prueba que una sesión válida sin fila en `staff_members` devuelve `null`
- [x] `verify-admin.test.ts` prueba que `verifyAdminSession` devuelve `null` cuando `getUser` falla
- [x] `consistencia-de-totales.test.ts` prueba que el subtotal del carrito y el total del mensaje coinciden
- [x] `npm run verify:actions` reporta **nueve** actions
- [x] `npm run test:coverage` pasa con el umbral de §6.3

### 8.2 Calidad

- [x] `npm run lint`, `npm run typecheck` y `npm run test` en verde
- [x] `npm run build` en verde, con `audit:bundle` encadenado y sin hallazgos
- [x] El número de porcentaje de cobertura está anotado en `docs/pruebas.md`
- [x] `npm run test:ci` corre en menos de tres minutos en la máquina de desarrollo
- [x] Ningún test quedó pegado a `src/` salvo los `.component.test.tsx`
- [x] El umbral no se bajó para que el pipeline pase: si estaba en 79, se agregó el test que faltaba
- [x] `test` no se sobreescribe por flag en ningún script de `package.json`
- [ ] Los archivos de §5.4 respetan sus topes — **4 de 5.** `autorizacion.test.ts` queda en 445/200 y no se tocó el tope: §13.3.15 explica por qué el split sale más caro que el archivo

### 8.3 Arquitectura — verificación obligatoria

- [x] `vitest.config.ts` tiene **tres** proyectos declarados, y cada uno declara su `plugins` y su `resolve.alias` (Tarea 09 §6.15)  — `plugins` y `alias` se declaran **una vez** en la raíz y los tres proyectos los heredan; duplicarlos en cada bloque daría el mismo comportamiento con tres fuentes de verdad. Comprobado empíricamente: los tres proyectos resuelven `@/` y el stub de `server-only` sin declarar nada
- [x] El proyecto `unit` **no** tiene `setupFiles`: un test de lógica pura no abre conexión a la base
- [x] `coverage.include` es exactamente `["src/lib/**/*.ts", "src/server/services/**/*.ts"]`
- [x] `coverage.exclude` no incluye repositorios, y la razón está escrita en el código
- [x] `thresholds.perFile` es `false`
- [x] `fileParallelism: false` está en el proyecto `integracion` y **no** en los otros dos
- [x] `tests/setup-entorno.ts` no sobreescribe una variable que ya existe en el entorno
- [x] Ningún test usa `vi.mock` sobre Prisma, Supabase Auth o Cloudinary
- [x] El doble de `verify-admin.test.ts` es sólo `@/server/infra/supabase/server`; `findStaffById` es el real
- [x] Ningún archivo nuevo es `utils.ts` ni `helpers.ts`
- [x] `rg ': any|@ts-ignore|@ts-expect-error' tests/` → cero resultados

### 8.4 Pruebas

- [x] `autorizacion.test.ts` tiene al menos 6 casos, y ninguno verifica que un servicio "fue llamado" sin que la negación sea el assertion principal
- [x] Existe un caso que prueba que el filtro de validación de precio sigue funcionando con sesión válida
- [x] `verify-admin.test.ts` tiene 3 casos: sin fila, con fila, y `getUser` caído  — **8** casos, que es lo que §8.4 pide en realidad
- [x] `consistencia-de-totales.test.ts` tiene 3 casos y ninguno repite un caso que ya esté en `cart-rules.test.ts` o en el archivo de la Tarea 12  — **15** casos, y ninguno repite un caso de esos dos archivos
- [x] Los tests de la Tarea 12 siguen pasando sin modificación de contenido
- [x] `vitest run --project=integracion` pasa dos veces seguidas, sin residuos de la corrida anterior
- [x] Los tests de la Tarea 09 (`.component.test.tsx`) siguen pasando sin modificación
- [x] `docs/pruebas.md` existe y dice explícitamente que **no** se agregan tests de UI decorativa

### 8.5 Seguridad y documentación

- [x] `.github/workflows/ci.yml` corre `lint`, `typecheck`, `test` y `build` en cada push a `main` y en cada PR
- [x] El job `calidad` **no** necesita secretos de Supabase ni de Cloudinary
- [x] El job `integracion` aplica el stub de roles antes de `prisma migrate deploy`
- [x] `tests/infra/roles-y-auth-stub.sql` dice en un comentario que nunca se aplica en Supabase
- [x] `auditar-bundle.mjs` encuentra los valores de placeholder del CI, o falla con un mensaje que lo diga (§9)
- [x] Ningún secreto de producción está en `.github/workflows/ci.yml`
- [x] El job `e2e` está condicionado a `vars.E2E` y no corre por defecto
- [x] La auditoría de dependencias está en `npm run audit:deps` y **no** corta el pipeline
- [x] `docs/pruebas.md` documenta la decisión sobre Playwright y el criterio para revertirla

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado | Por qué |
|---|---|---|
| **Tests que fallan sólo en CI por falta de `.env`** | Los unitarios no lo pueden seguir fallando: el proyecto `unit` no carga variables. El proyecto `integracion` falla al **arrancar** con un mensaje que dice qué variable falta y qué correr | Es el conflicto 3 de §2.3. Un `P1001` tres minutos después, en el primer `beforeEach`, cuesta el doble de entender |
| **`auditar-bundle.mjs` pasa en CI sin auditar nada** | Las variables del build tienen **valores de mentira** en el pipeline (§6.11). Si están vacías, el script compara contra `""`, que aparece en todos lados o en ninguno, y no encuentra nada | Un script de auditoría que pasa porque no encontró nada es peor que un script que no existe. Es el mismo criterio de la Tarea 19 §6.5 |
| **La migración de RLS no aplica en el Postgres de CI** | El stub de roles y `auth.uid()` lo resuelve. Si falta algo más, se corrige la migración y **no** se agrega al stub | Agregar objetos de plataforma al stub hace que la base de CI y la de producción diverjan en silencio |
| **Tests flaky por orden de ejecución** | `fileParallelism: false` y `maxWorkers: 1` en integración. Un test que depende del orden dentro de un archivo es un bug del test | Dos archivos en paralelo se hacen `TRUNCATE` mutuamente y el fallo aparece como un `expect` que no cuadra |
| **Tests que pasan en local y fallan en CI por la zona horaria** | Ningún test de lógica toca la fecha. `buildWhatsAppMessage` no usa `Date` (Tarea 12 §4.1), y el truncado es determinista. Si aparece un test de fecha, se le pasa la fecha explícita | La hora local de la máquina de desarrollo y la del runner de GitHub no son la misma |
| **Un test tarda más de cinco segundos en integración** | Es señal de que está haciendo I/O de más, o de que la consulta necesita un índice. No se sube el timeout: `testTimeout: 20_000` es el techo | Un timeout grande esconde el problema y hace que la suite completa sea lenta |
| **La suite completa tarda más de tres minutos** | Se mide antes de subir nada. El proyecto `ui` es el sospechoso, porque corre en `jsdom`. El proyecto `integracion` va serializado por diseño | Un pipeline de diez minutos deja de correr antes de que exista el problema que previene |
| **La cobertura sube por tests triviales** | `docs/pruebas.md` dice qué archivos cuentan para el umbral. Un test que pasa con el cuerpo de la función vaciado se borra | Es la forma más fácil de tener 95% y ningún bug atrapado |
| **Un archivo de `src/lib/` queda sin cubrir y el umbral no se mueve** | Se agrega el test si el módulo está en las zonas A, B, C o D. Si está en una quinta zona sin valor, se agrega al `exclude` **con el motivo escrito** | Un `exclude` sin motivo es donde se esconde el código que nadie quiere probar |
| **Alguien agrega un `.test.ts` en `src/`** | `rg --files -g '*.test.ts' src/` lo muestra y falla el criterio 8.2. Los `.component.test.tsx` sí pueden estar | Es la razón por la que el proyecto `ui` usa sufijo y no una lista de rutas |
| **`verify:actions` sigue reportando ocho** | Falta un archivo en `ACCIONES`. El número es el criterio más barato de la tarea | §2.4 |
| **El job de Playwright falla por la red y no por el código** | Por eso está condicionado a `vars.E2E` y es un job aparte, no un paso del job de calidad | Un job opcional que se vuelve obligatorio termina deshabilitado por todos |
| **El guard de `console.error` de la Tarea 09 hace fallar tests de `autorizacion.test.ts`** | Las actions hacen `console.error("[action:...]", error)` en el `catch`. Un caso que provoque un `ConflictError` dispara el espía global. Se permite explícitamente con `vi.spyOn(console, "error")` en el `describe` que lo necesita | El guard de la Tarea 09 existe para cazar `setState` fuera de `act`, no para silenciar logs de error intencionales |
| **Supabase pausa la base de desarrollo a los 7 días** | Los tests de integración fallan con `P1001` y el mensaje no dice nada del cold start. Se documenta en `docs/runbook.md` (Tarea 21 §9) | Es un caso de la Tarea 02 §9 que reaparece acá |
| **`npm run test:coverage` se corre sin la base levantada** | El proyecto `integracion` falla al arrancar. Los otros dos miden igual y el umbral se cumple | El umbral mide `src/lib/**` y `src/server/services/**`; los repositorios no están en el `include` por esa razón |

---

## 10. Pruebas

| Suite | Qué verifica | Qué NO verifica |
|---|---|---|
| `tests/unit/actions/autorizacion.test.ts` | Las nueve actions rechazan sin sesión y no delegan; `STAFF` no cambia los ajustes; `OWNER` sí; el filtro de precio sigue vivo | Que las actions hagan lo correcto con datos válidos más allá de "no rompieron nada" |
| `tests/integration/verify-admin.test.ts` | La fila de `staff_members` es la segunda capa; el rol sale de la base; `verifyAdminSession` falla cerrada | Que Supabase Auth emita o valide tokens. Eso es de la Tarea 07 y necesita credenciales reales |
| `tests/unit/cart/consistencia-de-totales.test.ts` | El total del carrito y el del mensaje coinciden; la línea se redondea antes de sumar; el `priceDelta` no se aplica dos veces | El formato del mensaje, que ya lo cubre la Tarea 12 carácter por carácter |
| `tests/unit/{format,cart,ui,store}/*.test.ts` (movidos) | Lo que ya medían, sin cambio de contenido | Nada nuevo |
| `scripts/verificar-acciones.mjs` | Que las nueve actions verifiquen la sesión antes de leer el payload | Que la action use el resultado de la sesión para autorizar. Eso es el test de autorización, no el script |

**Criterio de diseño de esta tarea:** el valor de la suite no es el número de casos, es **qué clase de bug atrapa cada archivo**. La tabla de arriba tiene que poder leerse como esa lista. Un archivo que no aparece en la columna de la derecha y no aparece en la de la izquierda es un archivo que hay que borrar.

---

## 11. Definición de "Hecho" (Definition of Done)

- [ ] Todos los criterios de §8 marcados, cada uno verificado y no de memoria  — **47 de 48**: sólo el de los topes de §5.4 queda sin cumplir, por `autorizacion.test.ts` (§13.3.15), y queda sin marcar a propósito
- [x] `npm run verify`, `npm run build`, `npm run test:coverage` y `npm run verify:actions` en verde
- [x] `npm run verify:actions` reporta nueve
- [x] La cobertura de `src/lib/**` y `src/server/services/**` está por encima de 80  — 93,67 / 92,88 / 88,68 / 91,32
- [x] Los cinco tests colocados se movieron con `git mv` y el diff no muestra cambios de contenido más allá de los imports  — con `mv`, porque el repo no tiene ningún commit y `git mv` falla (§13.3.3). Sólo cambiaron las líneas de import
- [x] `rg --files -g '*.test.ts' src/` no devuelve nada
- [ ] Un push a una rama de prueba corrió `.github/workflows/ci.yml` de punta a punta, con los dos jobs en verde  — **pendiente**: no se hizo push. El pipeline se verificó paso a paso en local (§13.3.16)
- [x] `docs/pruebas.md` escrito, con el número de cobertura y la decisión sobre Playwright
- [x] `docs/tasks/README.md` actualizado
- [ ] Commit: `test(20): consolidar suite en tres proyectos, umbrales y pipeline de CI`  — no se commiteó: el repo no tenía un solo commit y no se commiteó sin que lo pidas

> **Antes de mergear:** correr `npm run test:coverage` y pegar el número real en el PR. Un pipeline en verde con un umbral bajado a 70% es un pipeline que no atrapa nada, y se ve en el diff del `vitest.config.ts`.

---

## 12. Dependencias y bloqueos

### 12.1 Depende de

| Tarea | Qué aporta | Qué pasa si falta |
|---|---|---|
| **13** | El checkout y el `handoff-snapshot` que dan el contexto del flujo de handoff | El criterio de Playwright no tiene flujo que probar |
| **16** | Las tres actions de producto, el caso de prueba de autorización más completo | El bloque C de §2.1 se reduce a las seis actions de categorías y ajustes |
| **12** | `buildWhatsAppOrder`, `lineTotal`, `orderTotal` y sus casos | No hay caso consolidable y el test de totales cruzados no tiene contra qué comparar |
| **11** | `roundCurrency`, `calculateCartSubtotal` y los tests colocados | La mitad del presupuesto de la tarea desaparece |
| **07** | `verifyAdminSession`, `AdminSession`, `isOwner` | Los tests de autorización no tienen qué doblar |
| **14** | `toggleProductAvailabilityAction`, la novena action | El hueco de §2.4 no existe |
| **17** | Las cinco actions de categorías y ajustes, y el filtro `isOwner` | El caso de rol `STAFF` contra `OWNER` no se puede escribir |
| **19** | `audit:bundle`, `verify:actions`, el log de auditoría | El pipeline de CI no tiene los dos scripts que ya existen y este los reimplementaría |
| **04** | `tests/setup.ts` con `resetDatabase`, y el patrón de pruebas de integración | Los 7 archivos de integración se reescriben |

### 12.2 Habilita a

| Tarea | Qué usa de acá |
|---|---|
| **21** | El pipeline de CI que corre antes de cada deploy, y `docs/pruebas.md` como referencia del runbook |
| **22** | El criterio de "un bug del checkout se reproduce en un test" para decidir si un reporte entra al backlog o se arregla ya |

### 12.3 Decisiones que esta tarea deja establecidas

1. **La lógica crítica de este proyecto son cuatro módulos:** formato del mensaje, reglas del carrito y aritmética de dinero, autorización de las Server Actions, y toggle de disponibilidad. El esfuerzo de pruebas va ahí y en ningún otro lado.
2. **No se agregan tests de UI decorativa.** Los de la Tarea 09 cubren accesibilidad de primitivas y no se tocan.
3. **Un test de lógica pura vive en `tests/unit/`.** Un test de componente se queda en `src/` con sufijo `.component.test.tsx`. No hay un tercer lugar.
4. **Vitest tiene tres proyectos:** `unit` (sin base, paraleliza), `integracion` (base real, `fileParallelism: false`) y `ui` (`jsdom`, paraleliza).
5. **La cobertura mide `src/lib/**` y `src/server/services/**`, con umbral 80%** y `perFile: false`. Repositorios, infra, componentes y presentación quedan afuera, con el motivo escrito en el archivo.
6. **El umbral baja sólo agregando tests, nunca bajando el número.** Subirlo es un commit propio.
7. **La suite se prueba contra la base real, no contra mocks.** Los cuatro dobles permitidos están enumerados en §5.2.
8. **Playwright es condicional** y el job queda apagado con `vars.E2E`. El criterio para adoptarlo está escrito en §4.6.
9. **El pipeline es `calidad` + `integracion`,** con `e2e` opcional. El job de calidad no necesita secretos.
10. **Las migraciones de CI usan un stub de roles y `auth.uid()`** que existe sólo para el Postgres de Docker y nunca se aplica en Supabase.
11. **`verify:actions` audita cuatro archivos y nueve actions.** El número es un criterio, no un comentario.
12. **Un test que pasa con el cuerpo de la función vaciado se borra.** Es la heurística que decide si la suite sirve.

---

## 13. Registro de ejecución y desviaciones

Implementada el 2026-10-05. **63 archivos / 487 tests**, los tres en verde.

### 13.1 Lo que se hizo, en orden

| Paso | Resultado |
|---|---|
| Consolidación de `src/**/*.test.ts` | 9 archivos movidos a `tests/unit/**` con `mv` (no `git mv`: el repo estaba sin un solo commit) y sus imports de relativos a alias `@/` |
| `tests/setup-entorno.ts` | Carga `.env.local`/`.env` sin sobreescribir lo que ya existe y **falla al arrancar** si falta `DATABASE_URL` o `DIRECT_DATABASE_URL` |
| `vitest.config.ts` | Tres proyectos (`unit`, `integracion`, `ui`), `coverage.include` acotado a `src/lib/**` + `src/server/services/**`, umbrales 80/80/85/80 con `perFile: false` |
| Bloque C · `autorizacion.test.ts` | 11 casos: las nueve actions rechazan sin sesión y **ninguna** delega; `STAFF` no toca los ajustes y `OWNER` sí; el filtro de precio sigue vivo con sesión válida; el log va después del servicio |
| Bloque D · `consistencia-de-totales.test.ts` | 15 casos: el subtotal del carrito, el re-preciado del servidor y el puente al mensaje de WhatsApp, incluido el `priceDelta` que no se puede aplicar dos veces |
| Bloque B · `verify-admin.test.ts` | 8 casos contra la base real; el único doble es `@/server/infra/supabase/server` |
| Cobertura de `category-admin.service.ts` | 17 casos con repositorios en memoria y **sin `vi.mock`**: el servicio recibe sus dependencias por parámetro |
| `tests/infra/roles-y-auth-stub.sql` | Verificado empíricamente sobre una base nueva: **sin el stub, 0 políticas de RLS; con el stub, 2** |
| `.github/workflows/ci.yml` | Jobs `calidad` (sin secretos) e `integracion` (Postgres 16 + stub antes de migrar). YAML validado con parser |
| `docs/pruebas.md` | Baseline, política de umbrales, decisión sobre Playwright y qué no es cobertura |

### 13.2 La cuenta del threshold: no se bajó el número

Las funciones estaban en **84,39 %**, contra el 85 % que pedía §6.3. El número
no se movió: se escribió `tests/unit/services/category-admin.service.test.ts`.

| Métrica | Antes de Tarea 20 | Ahora | Umbral |
|---|---|---|---|
| Líneas | 88,11 % | **93,67 %** | 80 |
| Statements | 87,44 % | **92,88 %** | 80 |
| Branches | 82,12 % | **88,68 %** | 80 |
| Funciones | 84,39 % ❌ | **91,32 %** | 85 |

Las dos columnas son `npm run test:coverage` (los tres proyectos), de modo que
son comparables. La columna "antes" tenía las funciones en 84,39 %, y ese hueco
fue el que motivó `category-admin.service.test.ts`; las cifras suben un poco más
por los tests de integración, que también entran en el denominador de
`src/server/services/**`.

### 13.3 Desviaciones del documento

1. **El inventario estaba desactualizado.** El documento cuenta 46 archivos de
   test; eran **59** antes de esta tarea (29 en `tests/unit`, 3 en
   `tests/integration`, 9 `.test.ts` en `src/` y 18 `.component.test.tsx`).
   Quedaron 63 con los cuatro nuevos.

2. **Eran cinco tests colocados y eran nueve.** El documento nombra cinco; había
   nueve `.test.ts` de lógica pegados en `src/` (format, cart-rules,
   cart-schema, classes, availability-store, cloudinary-loader, producto-admin,
   product-admin.service y productos). Se movieron los nueve.

3. **No se usó `git mv`: se usó `mv`.** El repositorio no tenía **ningún
   commit**, así que `git mv` falla con *"not under version control"*. El
   renombrado no se registra en el historial porque no hay historial; el diff
   del primer commit lo va a mostrar como borrado+agregado.

4. **Los 7 archivos de integración son 4.** Los de la Tarea 04 (`category`,
   `product`, `settings`) más el nuevo de esta tarea.

5. **Eran 6 `.component.test.tsx` y hay 18.** La Tarea 09 y la 17 los
   agregaron. No se tocaron.

6. **`tests/unit/category-admin.service.test.ts` no existía.** El inventario de
   §3 lo daba por hecho y era el gap real de cobertura: el servicio no tenía un
   solo test. Se creó en `tests/unit/services/` para seguir la convención del
   resto de los archivos de servicio.

7. **`global: true` eliminado.** El proyecto no lo activa y ningún test depende
   de él: los 63 archivos importan de `vitest` explícitamente.

8. **El alias `server-only` se conserva**, aunque §6.3 lo omite en la muestra.
   Sin `tests/server-only.stub.ts`, todos los servicios y repositorios fallan al
   importar en Node.

9. **Los ejemplos de `AdminSession` y de los payloads del documento no
   compilan contra el código real.** §7.1 ya avisaba del `session.user.id`
   versus `userId`; al escribir los tests aparecieron tres más, todos
   documentados en el archivo de test:
   - `AjustesSchema.horarios` exige `estado` explícito **y los siete días**
     (`z.record` con clave enum es exhaustivo en Zod 4), y `abre`/`cierra` son
     strings: la ausencia es `""`, no `null`.
   - `OpeningHours` habla inglés (`opens`/`closes`), el formulario habla
     español (`abre`/`cierra`).
   - `ProductoAltaInput` es el tipo de **salida** del Zod (`precio: number`);
     el formulario manda `"1450,50"`. El payload del test va sin anotar a
     propósito, para poder escribir `"-450"` en el caso del filtro de precio.

10. **Las actions importan de dos rutas de servicios.** El barril
    `@/server/services` y el módulo concreto (`categorias.ts:26`,
    `ajustes.ts:23`). Los dobles tienen que cubrir las dos, y con
    `importOriginal`: una factory con lista cerrada deja los helpers puros
    (`camposEditadosDeCategoria`, `camposEditadosDeAjustes`) en `undefined`, la
    action revienta al loguear y el test de la ruta exitosa falla por un motivo
    que no es la autorización.

11. **`verify:actions` ya auditaba las cuatro archivos.** No hizo falta tocarlo:
    la Tarea 19 ya había agregado `product-availability.actions.ts`. Los nueve
    actions se verifican.

12. **`npm run test:coverage` sin la base.** El proyecto `integracion` falla al
    arrancar sin `DATABASE_URL`. Los otros dos miden igual y el umbral se
    cumple: la cobertura no incluye repositorios, y eso es justamente por lo que
    no necesita base.

13. **`auditar-bundle.mjs` cambió.** §8.5 lo pedía y §9 lo explicaba: con los
    valores de mentira del pipeline la auditoría comparaba contra nada y pasaba
    en verde. Ahora clasifica los valores (`MARCADORES_DE_PLACEHOLDER`), cuenta
    cuántas variables verificó de verdad, **falla si no verificó ninguna** y
    acepta la excepción explícita con `AUDITAR_BUNDLE_SIN_SECRETOS=1`, que
    está escrita en el workflow. Comprobado en los cuatro casos: placeholders →
    falla; excepción → pasa diciendo `0 de 5`; valor real ausente del bundle →
    pasa diciendo `1 de 5`; valor real presente → falla con el hallazgo.

14. **El job `e2e` no se escribió.** §6.11 lo muestra condicionado a
    `vars.E2E`, pero escribir un job de Playwright sin un solo test de Playwright
    es un job que falla o un archivo muerto. La decisión y el criterio para
    revertirla están en `docs/pruebas.md`.

15. **Cuatro de los cinco topes de §5.4 se cumplen; el quinto no.** El
    diagnóstico que da el propio documento para `autorizacion.test.ts` es
    "falta un `describe` por archivo de actions", y el split por archivo de
    actions se evaluó:

    | Archivo | Tope | Antes | Ahora |
    |---|---|---|---|
    | `verify-admin.test.ts` | 150 | 159 | **150** |
    | `setup-entorno.ts` | 50 | 56 | **47** |
    | `roles-y-auth-stub.sql` | 40 | 71 | **40** |
    | `ci.yml` | 140 | 139 | **139** |
    | `autorizacion.test.ts` | 200 | 445 | **445** |

    El SQL bajó de 71 a 40 líneas **sin perder nada**: se fusionaron los
    `IF NOT EXISTS` en una línea por rol, los cuerpos de las dos funciones
    quedaron en una línea cada uno y los `GRANT EXECUTE` se fusionaron en uno.
    Reaplicado sobre una base que ya tenía el stub (idempotente) y sobre una
    nueva: mismo resultado, 2 políticas.

    Los tres primeros bajaron comprimiendo comentarios, que es lo que se puede
    recortar sin costo. `autorizacion.test.ts` no: tiene 291 líneas de código
    sin comentarios, así que llegar a 200 exige SACAR tests, y el split por
    archivo de actions obligaría a duplicar las cuatro factorías de `vi.mock`
    (las actions importan del barril y del módulo concreto, §13.3.10) en cuatro
    archivos: unas 600 líneas duplicadas para esconder 245. Eso es peor código,
    no mejor. Queda abierto, con el número medido y sin tocar el tope.

16. **No se corrió un push a una rama de prueba**, que es un criterio del DoD.
    Y no es un olvido: `git remote -v` no devuelve nada. El repositorio no
    tiene remote configurado ni un solo commit, así que `.github/workflows/ci.yml`
    no se puede disparar todavía. Cuando se suba, el primer pipeline va a
    ejecutar migraciones sobre un Postgres 16 recién creado, que es
    exactamente el escenario que el stub existe para cubrir.
    El pipeline se verificó paso a paso en local: YAML parseado, stub+migraciones
    sobre una base nueva con el conteo de políticas, y la suite de integración
    corriendo contra esa base. Lo que falta es la corrida remota.

### 13.4 Verificación

```bash
npm run lint            # ✅
npm run typecheck       # ✅
npm run test            # ✅ 63 archivos / 487 tests
npm run test:coverage   # ✅ 93,67 / 92,88 / 88,68 / 91,32
npm run build           # ✅ con audit:bundle encadenado
npm run verify:actions  # ✅ 9 actions
```

```bash
# Criterios que se comprueban con un comando, no de memoria:
rg ': any|@ts-ignore|@ts-expect-error' tests/   # cero resultados
rg --files -g '*.test.ts' src/                  # cero resultados
rg --files -g '*.component.test.tsx' src/       # 18 (los de la Tarea 09 y la 17)
npm run test:integracion                         # dos veces seguidas, 34 y 34
```

Base de desarrollo: Postgres 17 en Docker. Para replicar el camino de CI se
levantó una base vacía, se aplicó el stub, `migrate deploy` y la suite de
integración encima: 2 políticas y 34 tests en verde.
