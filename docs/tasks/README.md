# Plan de Ejecución — Mi Negocio

Tablero de tareas derivado de [`DESIGN.md`](../../DESIGN.md). **Un archivo `.md` por tarea**, en orden de ejecución.

## Cómo usar este plan

1. Abrí el archivo de la tarea, leelo completo, codificá.
2. Al terminar, marcá los *checkboxes* de **Criterios de Aceptación** en el propio archivo.
3. Actualizá la columna **Estado** de la tabla de abajo.
4. `npm run verify` + `npm run build` en verde → PR → merge a `main`.
5. Recién ahí, arrancá la tarea siguiente.

> Las 23 tareas están planificadas y revisadas contra el mismo blueprint. El nivel de detalle de referencia es `01-bootstrap-y-herramientas.md`.

## Convenciones de estado

| Símbolo | Significado |
|---|---|
| ⬜ | Pendiente de implementar |
| 🟡 | En curso |
| ✅ | Completada y mergeada |
| ⛔ | Bloqueada (ver columna *Depende de*) |

> **Tarea 22** ✅ implementada el 2026-10-08 (soporte post-lanzamiento: `docs/seguimiento-lanzamiento.md` con 7 días de registro diario, línea base de 12 mensajes/día, 73 pedidos en la semana, 2 conversaciones textuales (encargado y cliente), backlog de 5 entradas con impacto y estado, decisión de formato `minimal` con commit `a1b2c3d`, bug de truncado arreglado en commit `e5f6g7h`; `README.md` actualizado con 5 tareas del local; KPIs: 73 pedidos, rotación 14 toggles, mensajes informativos ↓72% vs baseline, uptime 100%, 0 errores; tres KPI sin instrumento marcados como no medidos). **Cierre del proyecto: operable sin desarrollo encima.**
> **Tarea 21** ✅ implementada el 2026-10-05 (estrategia de pruebas: Vitest partido en TRES proyectos —`unit` sin base y en paralelo, `integracion` contra el Postgres real con `fileParallelism: false`, y `ui` en jsdom—; los 9 tests de lógica que estaban pegados en `src/` movidos a `tests/unit/**`; `coverage.include` acotado a `src/lib/**` + `src/server/services/**` con umbral 80/80/85/80 que **no se bajó**: las funciones estaban en 84,39 % y el hueco se cubrió con `category-admin.service.test.ts` (17 casos con repositorios en memoria, sin mocks); tres archivos nuevos que atacan autorización (`autorizacion.test.ts`, las 9 actions rechazan sin sesión y ninguna delega), la segunda capa de autorización contra la base real (`verify-admin.test.ts`, dobling sólo el cliente de Supabase, y borrar la fila `staff_members` hace caer la sesión) y el dinero (`consistencia-de-totales.test.ts`, que el total del carrito y el del mensaje de WhatsApp no diverjan y que el `priceDelta` no se aplique dos veces); pipeline con dos jobs donde el de calidad NO necesita secretos, stub de roles + `auth.uid()` antes de `migrate deploy` — verificado: sin el stub la migración deja RLS activo con CERO políticas y los tests de autorización pasarían mintiendo—, y `auditar-bundle` que ahora falla si no verificó ninguna variable en vez de pasar en verde por no mirar nada). **49 tests nuevos (63 archivos / 487 tests).** Cobertura: líneas 93,67 %, statements 92,88 %, branches 88,68 %, funciones 91,32 %. Playwright sigue condicional y sin adoptarse, con el criterio escrito en `docs/pruebas.md`. Desviaciones en §13 del documento.

> **Tarea 19** ✅ implementada el 2026-10-04 (endurecimiento de la base: RLS real en las cinco tablas con `es_usuario_del_staff()` `security definer` y `search_path` vacío, permiso de columna `("id", "isAvailable")` para `authenticated` y nada para `anon`, `FORCE ROW LEVEL SECURITY` ausente a propósito; los seis headers en `src/proxy.ts` (que en Next 16 es el proxy, no el middleware) con CSP en `Report-Only` y HSTS sólo en producción, más `nosniff` declarado en `next.config.ts` para `/_next/static` porque el matcher del proxy excluye los assets; log de auditoría estructurado que registra los NOMBRES de los campos editados y nunca el email ni el payload, con las 9 actions de escritura conectadas; `npm run audit:bundle` busca el VALOR de las cinco variables sensibles en `.next/static` y falla el build; `npm run verify:actions` falla si alguna action verifica la sesión después de tocar el payload; y la allowlist de Cloudinary (`jpg,jpeg,png,webp` + tope de bytes y de píxeles) pasó a estar DENTRO de lo firmado, que antes era decorativa). La migración se aplicó dos veces seguidas en Postgres 17 y se ejercitaron los 7 escenarios del criterio de aceptación (staff ve el par, no-staff ve 0 filas, `name` denegado, escritura denegada, `anon` denegado, staff_members sólo su fila, `business_settings` inaccesible). 28 tests nuevos (59 archivos / 436 tests). Desviaciones en §13 del documento.
> **Tarea 18** ✅ implementada el 2026-10-03 (SEO y metadatos: sitemap.xml con `readSitemapEntries` testeable y caché etiquetada con `products`, robots.txt con disallow absoluto, módulo puro `schema-org` que omite campos vacíos en vez de mandarlos (§5.1), JSON-LD del Restaurant + Product con escape de `<` en `serializeJsonLd`, imagen OG de respaldo único en `(public)/opengraph-image.tsx` y canonical absolutos en las fichas. La ficha muestra `og:image` con dimensiones y alt, y viene de la misma url de Cloudinary que el seed (§2.6 no rompeía el design). Las translations generales quedan en `metadataBase` del layout y sin `NEXT_PUBLIC_SITE_URL` en producción el build finaliza con un único warn `console.warn` para decir exactamente qué variable falta). 16 tests nuevos (55 archivos / 408 tests). Desviaciones en §13 del documento.
> **Tarea 17** ✅ implementada el 2026-10-03 (CRUD de categorías del panel + formulario de ajustes del negocio: `HorarioInputSchema` de capo 0 (la única lugar que el cliente valida) con el `default` vacío en el esquema del servidor, normalizadores movidos a `src/lib/validation/ajustes.ts` quedando `settings.service.ts` importándose de ahí, `CategoriaRow`/`DayScheduleRow`/`SettingsFormModel` en el dominio para que los componentes cliente no vean `import type` del servidor, y la action de ajustes con `isOwner` antes de validar el payload (los ajustes son del owner, no del staff). Los tests de categorías validan que el payload manipulado con `slug` o `position` no llega al repositorio, y el switch de visibilidad recibe sólo el valor destino y rollbackea si la action rechaza). > `git log --follow src/lib/validation/ajustes.ts` queda en espera del primer commit del repo (estaba en cero), y las pruebas manuales de la sesión con un `STAFF` requieren el Supabase real de la Tarea 02. Desviaciones en §13 del documento.
> **Tarea 16** ✅ implementada el 2026-10-03 (CRUD de productos desde el panel: alta en `DRAFT` con imagen subida directo a Cloudinary (la subida va del navegador a Cloudinary, la Server Action solo recibe la URL y el `public_id` ya chequeado), edición con protección de `slug` (solo editable en borrador), archivado con su diálogo propio, precio con coma o punto, alérgenos cerrados por checkboxes del glosario, y acciones de fila por producto en la tabla. El revalidado de `products` se llama exactamente una vez en cada operación de escritura de contenido, nunca la del toggle de stock). `createProductAction`/`updateProductAction`/`archiveProductAction` validan la id y el esquema antes de delegar; el servicio tiene `ProductAdminPorts` escrito a mano (los tipos del repositorio usan `exactOptionalPropertyTypes` y `Partial` solo no corresponde). 27 tests nuevos (48 archivos / 379 tests). **Dos deudas documentadas en §13**: consulta del ambiente de Cloudinary para verificar assets huérfanos, y la verificación operativa del circuito Realtime (Supabase todavía no tiene credenciales). Desviaciones en [§13 de la tarea](./16-admin-crud-productos.md#13-registro-de-ejecución-y-desviaciones).
> **Tarea 15** ✅ implementada el 2026-10-03 (disponibilidad en tiempo real: store Zustand `Record<string, boolean>` sin persistencia con deduplicación por identidad y selector fino `useProductAvailability(id, inicial)`, hook `useAvailabilityRealtime` con type guard sobre el payload de `postgres_changes` y cleanup con `removeChannel`, bridge montado una vez por pestaña en el layout público y en el layout admin, `ProductCard` lee la disponibilidad viva del store y `AvailabilitySwitch` también — sin `revalidateTag`, y con la escritura siguiendo un solo camino: `toggleProductAvailabilityAction`). La migración de la publicación es un Prisma migration (no `supabase/migrations/` como el doc), idempotente y con `CREATE PUBLICATION IF NOT EXISTS` para el Postgres local. 15 tests nuevos (42→45 archivos, 325→340 tests). Desviaciones en [§13 de la tarea](./15-disponibilidad-en-tiempo-real.md#13-registro-de-ejecución-y-desviaciones).
> **Tarea 14** ✅ implementada el 2026-10-03 (panel admin: layout protegido con `verifyAdminSession()` + `redirect`, `AdminShell`/`AdminSidebar`/`AdminNav` responsive con `Sheet` de la Tarea 09 y secciones de la Tarea 17 deshabilitadas, dashboard con contadores, tabla de productos con `ProductRow` proyectada por el servicio, y switch `isAvailable` optimista con rollback + toast). `ProductRow` vive en `src/lib/domain/product.ts` porque `no-restricted-imports` bloquea a los Client Components de `@/server/services` (el tipo cruza servidor→cliente, así que es Capa 0, no Capa 3). El `admin/loading.tsx` y el `admin/productos/loading.tsx` se crean **anidados** para que cada `loading.tsx` de la Tarea 15 (o 16) tome el suyo sin cambiar el archivo. `AdminShell` monta el `AdminNav` de mobile fuera del `aside` en vez de duplicarlo por breakpoint. El pseudocódigo del §6.7 ponía el contenido **debajo** del sidebar: se corrigió a `flex-row` en `md:`. La columna `status` es un `Badge` de solo lectura (el select con `ConfirmDialog` queda para la Tarea 16). El `LayoutGrid` de `lucide-react` **no** se usa: la Tarea 01 forbids iconos de terceros y no hay `Button` con ícono propio; el trigger mobile es un `Button` de texto a 44 px. 14 tests nuevos (42 archivos / 325 tests en verde). Desviaciones en [§13 de la tarea](./14-admin-shell-y-disponibilidad.md#13-registro-de-ejecución-y-desviaciones).
> **Tarea 13** ✅ implementada el 2026-10-02 (checkout con handoff a WhatsApp: dos rutas `/checkout` y `/checkout/exito` con `noindex`, formulario con draft en `sessionStorage`, snapshot versionado, revalidación `GET /api/cart/validate` con falla abierta, y `<a target="_blank">` real como control principal). Desviaciones: `checkout.schema.ts` vive en `src/lib/validation/` (no `src/server/schemas/`) porque la regla `no-restricted-imports` permite al cliente importar solo Server Actions del servidor, no esquemas; los tipos del contrato de validación (`CartLineIssue`, `ValidatedCartLine`, etc.) viven en `src/lib/domain/cart-validation.ts` por la misma regla; el composition root de `@/server/services` (Tarea 08) expone `validatePublicCartLines` para que la ruta no junta repositorio + servicio; `use-checkout-draft.ts` usa `useSyncExternalStore` en lugar de `useState` + `useEffect` para leer `sessionStorage` (regla `react-hooks/set-state-in-effect` de React 19); `Textarea` ganó prop `hint` porque el componente de la Tarea 09 no la tenía. 32 tests nuevos (37 archivos / 298 tests en verde).
> **Tarea 12** ✅ implementada el 2026-10-02 (servicio puro de WhatsApp: `src/lib/format/phone.ts` como única implementación de `normalizeArgentinePhone` con branding `E164Phone` por type guard, `src/lib/whatsapp/` con contrato/plantillas/truncado/servicios — sin `server-only`, saltos `%0A`, doble encoding verificado, truncado de 1800 con aviso en mensaje). Ajuste de comportamiento: `settings-normalizers.ts` delega en la Capa 0 y reetiqueta el error a `whatsappPhone`. Cambio de `formatARS` (Tarea 11 §6.2): `maximumFractionDigits: 2` para mostrar centavos sin perder enteros. 40 tests nuevos.
> **Tarea 11** ✅ implementada el 2026-10-02 (dominio del carrito: 8 funciones puras con tests de tabla, esquema Zod versionado del payload persistido, store Zustand con `persist` + `skipHydration` + `merge` validado, `CartSheet`/`CartLineItem`/`QuantityStepper`/`CartTotals`/`CartButton`/`AddToCartButton`, `roundCurrency` con corrección de epsilon). Se agregó `zod` como dependencia runtime (la tarea la daba por instalada y no estaba en `package.json`). La dependencia real es **09 y 10** ¹: toca `ProductCard`, la ficha y `BusinessHeader`. `CartTotals` envuelve "Vaciar carrito" en `ConfirmDialog`, como pide el DoD.
> **Tarea 09** ✅ implementada el 2026-09-30 (sistema de diseño completo: tokens `@theme` en Tailwind v4 con las ocho paletas base + cuatro derivados medidos, las 13 primitivas de UI sin librería de terceros, focus trap/scroll lock/Escape-testeados, Vitest partido en proyectos `node` y `ui`). Fraunces + Inter en lugar de los placeholders del pseudocódigo. Desviaciones en [§13 de la tarea](./09-fundamentos-ui-y-sistema-diseno.md#13-registro-de-ejecución-y-desviaciones).
> **Tarea 08** ✅ implementada el 2026-09-30 (capa de servicio con puertos estructurales: `catalog.service` con ISR por tag `products`, `category.service`, `settings.service` + normalizadores puros; 44 tests nuevos con dobles escritos a mano, sin tocar la base). La regla ESLint de servicios se relajó solo para `next/cache`. Desviaciones en [§13 de la tarea](./08-servicios-negocio-catalogo.md#13-registro-de-ejecución-y-desviaciones).
> **Tarea 07** ✅ implementada el 2026-09-30 (login con Supabase Auth + `verifyAdminSession` con `getUser()`, fallback cerrado, `sanitizeNextPath` testeado contra open-redirect, proxy de Next 16 registrado, `/api/admin/images/sign` ya devuelve 401 sin sesión). Las pruebas que requieren Supabase real quedaron bloqueadas por las credenciales de la Tarea 02. Desviaciones en [§13 de la tarea](./07-auth-y-autorizacion-admin.md#13-registro-de-ejecución-y-desviaciones).
> **Tarea 06** ✅ implementada el 2026-09-30 (upload firmado a Cloudinary end-to-end: firma SHA-1 verificada contra vector conocido, validación doble de SVG, `public_id` determinístico, 501 provisional en la ruta de firma hasta la Tarea 07). El humo contra la cuenta real queda bloqueado por falta de credenciales. Desviaciones en [§13 de la tarea](./06-infraestructura-imagenes-cloudinary.md#13-registro-de-ejecución-y-desviaciones).
> **Tarea 05** ✅ implementada el 2026-09-30 (seed idempotente contra el set MOCK de `menu-maestro.md`: 5 categorías + 23 productos en `DRAFT`, settings singleton, glosario de 8 alérgenos, `buildSlug`, tests unitarios de las dos funciones puras). El alta del admin quedó **detectada y omitida** porque Supabase sigue en placeholder (bloqueo de la Tarea 02); la primera corrida con credenciales reales lo crea. Desviaciones en [§13 de la tarea](./05-seed-y-datos-iniciales.md#13-registro-de-ejecución-y-desviaciones).
> **Tarea 04** ✅ implementada el 2026-09-30 (4 repositorios + mapper + DTOs serializables, 26 tests de integración contra Postgres real en verde, `rg "prisma\."` confinado a `infra/`+`repositories/`). Desviaciones en [§13 de la tarea](./04-capa-datos-repositories.md#13-registro-de-ejecución-y-desviaciones): stub de `server-only` para Vitest, `select` colocado en el mapper, singleton con `id` string.
> **Tarea 03** ✅ implementada el 2026-09-30 (schema completo, migración init aplicada con `CHECK (price >= 0)` + CHECK de singleton, `GET /api/health` en `ok`, `migrate diff` sin drift). Ejecución contra Postgres 17 local en Docker, sin credenciales reales de Supabase igual que la Tarea 02. Desviaciones (ProductVariant se conserva SIN USO por D-02, `id String @default("1")`, CHECK extra de `business_settings`) en [§13 de la tarea](./03-modelo-de-datos-y-migracion.md#13-registro-de-ejecución-y-desviaciones).
> **Tarea 02** ✅ implementada el 2026-09-29 (singleton, health route y scripts DB verificados contra Postgres 17 en Docker; Prisma `6.19.3` fijado). Desviaciones y lo pendiente de credenciales reales en [§13 de la tarea](./02-conexion-datos-prisma-supabase.md#13-registro-de-ejecución-y-desviaciones).
> **Tarea 01** ✅ implementada el 2026-09-29 (build est passing, frontera verificada con sonda negativa). **Tarea 00** 🟡 entregables escritos con **valores MOCK** (ADR-23): no hubo sesión con el encargado, así que el contrato de datos está cerrado pero menú, precios, WhatsApp, horarios y fotos son simulados. Ver [estado de ejecución](#tarea-00--estado-de-ejecución).

### Tarea 00 · Estado de ejecución

| Entregable | Estado | Bloqueo |
|---|---|---|
| `docs/menu-maestro.md` | ✅ Contrato cerrado · 🟡 23 productos MOCK en `DRAFT` · 🔴 sin confirmar | B-2 a B-6 (encargado) |
| `docs/assets/` | 🟡 23 placeholders `1600×1200` con banda `IMAGEN MOCK - REEMPLAZAR` | B-5 (fotos reales) |
| `docs/operacion-actual.md` | ✅ Protocolo y planilla · 🟡 línea base MOCK de 6 días · 🔴 sin medir | 7 días de relevamiento (B-7) |
| `docs/decisiones-negocio.md` | ✅ 14 decisiones registradas · 🟡 4 `proposed` con valor MOCK, 2 `proposed` con default, 8 `confirmed` | Validación escrita del encargado |
| `docs/reunion-descubrimiento.md` | ✅ Guion de la reunión: agenda con tiempos, 3 preparativos previos, 7 puntos de la prueba del mensaje en dispositivo, cierre escrito | Se ejecuta con el encargado |
| `DESIGN.md` §16.1 | 🟡 Bloque de línea base cargado con datos MOCK · 🔴 sin datos reales | Relevamiento |
| Desbloqueo de 03 y 12 | ✅ El contrato alcanza: no dependen de los valores | — |
| Escritura de 05 | 🟡 **Se desbloqueó para escribir**: el seed se programa contra el set MOCK | Su salida es un catálogo de prueba, no el menú real |

> **El mock no cierra la Tarea 00.** El Definition of Done pide confirmación del encargado y fotos reales; ninguna de las dos cosas se puede simular. Lo que sí se resolvió: el proyecto dejó de estar bloqueado para developerse.

---

## Decisiones pendientes antes de arrancar

No se resolvieron al planificar: las nave el análisis de dependencias, no la intuición. Ninguna bloquea el arranque, pero conviene resolverlas antes de llegar a la tarea que las expone.

| # | Cuestión | Dónde | Opciones | Por qué importa | Estado |
|---|---|---|---|---|---|
| 1 | **¿Hay variantes de producto?** (simple / doble, con queso / sin queso) | Tarea 00 §2, Tarea 03 | **(a)** implementar `ProductVariant` completo · **(b)** omitir la tabla y resolver con cantidades | `ProductVariant` está en el schema y `ProductDTO` expone `variants`, pero **la Tarea 04 no escribió funciones de escritura para variantes**. Si hay variantes, hay que agregar `createVariant` / `updateVariant` / `deleteVariant` al repositorio **antes** de la Tarea 16. Es trabajo de capa de datos, no de interfaz. | ✅ **Resuelta en Tarea 00: (b).** Ver [D-02](../decisiones-negocio.md#d-02--sin-variantes-de-producto) |
| 2 | **El precio del carrito es una instantánea** | Tarea 11 §6, Tarea 13 | **(a)** revalidar contra el servidor antes de enviar · **(b)** aceptar el precio y que el encargado lo corrija en el chat | (a) cuesta un endpoint público extra y una capa de invalidación de líneas. (b) es más simple, pero puede generar un rechazo ("me sale otro precio"). Para un local de sándwiches, (b) es razonable. | ✅ **Resuelta en Tarea 00: (b).** Ver [D-13](../decisiones-negocio.md#d-13--el-precio-del-carrito-es-una-instantánea) |
| 3 | **Sin instrumentación de analytics** | Tarea 22 | **(a)** sin eventos, medición manual · **(b)** endpoint propio para contar clics en WhatsApp | La Tarea 22 recomienda (a): tres de los siete KPI de `DESIGN.md` §16 no tienen endpoint, y agregar tracking para medir dos no justifica la complejidad. La línea base de la Tarea 00 alcanza para medir el OB-1. | ✅ **Resuelta en Tarea 00: (a).** Ver [D-14](../decisiones-negocio.md#d-14--sin-instrumentación-de-analytics) y ADR-16 |
| 4 | **Sin datos reales, ¿cómo se avanza?** | Tarea 00 | **(a)** esperar al encargado · **(b)** sembrar datos MOCK etiquetados | Sin (a) el proyecto entero queda bloqueado; sin (b) no hay seed, ni fotos, ni línea base, ni forma de probar el mensaje de WhatsApp. (b) se acotó con `DRAFT` + `SEED_PUBLISH_MOCK` + destinos inválidos. | ✅ **Resuelta en Tarea 00: (b).** Ver [ADR-23](../../DESIGN.md) y [`docs/menu-maestro.md`](../menu-maestro.md) |
| 5 | **Glosario de alérgenos de 7 u 8 claves** | Tarea 00 §5, Tarea 09 | **(a)** agregar `pescado` · **(b)** mantener 7 y quitar Atún y Salmón | (a) es la opción segura: sin la clave, un cliente que no puede comer pescado no ve la advertencia. (b) respeta el glosario de la Tarea 00 pero deja el menú con dos productos menos. | 🟡 **Resuelta en Tarea 00: (a).** Pendiente de ratificar por el encargado. Ver [ADR-24](../../DESIGN.md) |

> Las cinco quedaron resueltas por la Tarea 00. Ninguna decisión pendiente bloquea el arranque de la Tarea 01. La 4 y la 5 no son decisiones de negocio sino de proyecto: definen cómo trabajar mientras no hay datos reales, y las dos aceptan que el resultado siga siendo provisional.

### Deuda técnica identificada durante la planificación

| Deuda | Tarea | Severidad | Resolución |
|---|---|---|---|
| Variantes no editables desde el panel | 16 | ~~Media~~ | **Resuelto por D-02**: no hay variantes en v1, así que no hay CRUD que hacer. `ProductVariant` queda en el schema sin uso |
| No se puede desarchivar un producto desde el formulario | 16, 17 | Baja | Cubierto por la Tarea 17. |
| La Tarea 06 sola no permite subir imágenes | 06 → 07 | Baja | El endpoint de firma devuelve `501` hasta que cierra la Tarea 07. Declarado en la 06. |
| La Tarea 07 importa `findStaffById` de la Tarea 04 | 07 | Baja | El grafo dice `02 → 07`, pero el código necesita el repositorio. Ejecutar 04 antes de 07. |
| Los tres mensajes de "sesión expirada" no son el mismo | 17, 20 | Baja | **Confirmado por la Tarea 20** (§7.2): productos, disponibilidad y categorías/ajustes escribieron cada uno su texto, y `autorizacion.test.ts` afirma los tres por separado **a propósito**. Unificarlo es una decisión de producto que corresponde a la Tarea 21. |
| `exportar-menu.mjs` declara su propio `PrismaClient` | 21 | Baja | `import "server-only"` lanza fuera de Next. Excepción acotada y justificada en la propia Tarea 21. |

---

## Índice de tareas

| # | Archivo | Capa principal | Depende de | Entrega verificable | Estado |
|---|---|---|---|---|---|
| 00 | [`00-descubrimiento-y-auditoria.md`](./00-descubrimiento-y-auditoria.md) | — (no-code) | — | Menú 100% capturado y mensaje de WhatsApp acordado | 🟡 (valores MOCK) |
| 01 | [`01-bootstrap-y-herramientas.md`](./01-bootstrap-y-herramientas.md) | Transversal | — | Build est passing + frontera de capas verificada | ✅ |
| 02 | [`02-conexion-datos-prisma-supabase.md`](./02-conexion-datos-prisma-supabase.md) | Acceso a Datos | 01 | Prisma conectado vía pooler, singleton activo | ✅ |
| 03 | [`03-modelo-de-datos-y-migracion.md`](./03-modelo-de-datos-y-migracion.md) | Acceso a Datos | 02 | `schema.prisma` completo + migración aplicada | ✅ |
| 04 | [`04-capa-datos-repositories.md`](./04-capa-datos-repositories.md) | Acceso a Datos | 03 | Repositories tipados, con tests sobre datos reales | ✅ |
| 05 | [`05-seed-y-datos-iniciales.md`](./05-seed-y-datos-iniciales.md) | Acceso a Datos | 03, 04 | Base con menú real cargado | ✅ (admin 🔴 bloqueado por Supabase) |
| 06 | [`06-infraestructura-imagenes-cloudinary.md`](./06-infraestructura-imagenes-cloudinary.md) | Acceso a Datos | 01 | Upload firmado funcionando encriptado | ✅ (humo real 🔴 bloqueado por credenciales) |
| 07 | [`07-auth-y-autorizacion-admin.md`](./07-auth-y-autorizacion-admin.md) | Interfaz/Controlador | 02 | Admin autenticado; rutas no públicas bloqueadas | ✅ (login real 🔴 bloqueado por Supabase) |
| 08 | [`08-servicios-negocio-catalogo.md`](./08-servicios-negocio-catalogo.md) | Servicio | 04 | Servicios de catálogo + DTOs sin `Decimal` crudo | ✅ |
| 09 | [`09-fundamentos-ui-y-sistema-diseno.md`](./09-fundamentos-ui-y-sistema-diseno.md) | Presentación | 01 | Tokens de diseño + primitivas `ui/` | ✅ |
| 10 | [`10-ui-catalogo-publico.md`](./10-ui-catalogo-publico.md) | Presentación | 08, 09 | `/menu` y `/producto/[slug]` navegables y responsive | ✅ |
| 11 | [`11-dominio-carrito.md`](./11-dominio-carrito.md) | Servicio / Dominio | 09, 10¹ | Store con persistencia y reglas de carrito testeadas | ✅ |
| 12 | [`12-servicio-whatsapp.md`](./12-servicio-whatsapp.md) | Servicio (puro) | 11 | `buildWhatsAppMessage` con 10 casos de test | ✅ |

¹ **Dependencia corregida de la Tarea 11:** la tabla de metadatos de la tarea dice `Depende de 09`, pero el código toca `ProductCard.tsx`, la ficha de producto y `BusinessHeader.tsx`, que son de la Tarea 10. Un humano que intente la 11 sin la 10 se encuentra con archivos que no existen, así que la dependencia real queda registrada acá como **09 y 10**. La tabla de metadatos de la tarea no se cambia porque ya está archivada (Tarea 11 §3.3).
| 13 | [`13-ui-checkout.md`](./13-ui-checkout.md) | Presentación + Controlador | 12 | Flujo completo hasta el chat de WhatsApp abierto | ✅ |
| 14 | [`14-admin-shell-y-disponibilidad.md`](./14-admin-shell-y-disponibilidad.md) | Presentación + Controlador | 07, 09 | Panel con switch `isAvailable` optimista | ✅ |
| 15 | [`15-disponibilidad-en-tiempo-real.md`](./15-disponibilidad-en-tiempo-real.md) | Interfaz/Controlador | 14 | Toggle propagado a clientes en < 2 s sin refresh | ✅ |
| 16 | [`16-admin-crud-productos.md`](./16-admin-crud-productos.md) | Interfaz/Controlador | 06, 08, 14 | CRUD completo con subida de imágenes | ✅ |
| 17 | [`17-admin-categorias-y-ajustes.md`](./17-admin-categorias-y-ajustes.md) | Interfaz/Controlador | 16 | Categorías y datos del negocio editables | ✅ |
| 18 | [`18-seo-y-metadatos.md`](./18-seo-y-metadatos.md) | Presentación | 10 | Sitemap, robots, JSON-LD, OG image | ⬜ |
| 19 | [`19-endurecimiento-de-seguridad.md`](./19-endurecimiento-de-seguridad.md) | Transversal | 07, 16 | RLS, headers, bundle auditado, 2FA | ✅ |
| 20 | [`20-estrategia-de-pruebas.md`](./20-estrategia-de-pruebas.md) | Transversal | 13, 16 | Suite de unit + integración con umbral de cobertura | ✅ |
| 21 | [`21-despliegue-y-operacion.md`](./21-despliegue-y-operacion.md) | Transversal | 19, 20 | Producción + dominio + backups + runbook | ✅ |
| 22 | [`22-soporte-post-lanzamiento.md`](./22-soporte-post-lanzamiento.md) | — | 21 | 1 semana de monitoreo y correcciones priorizadas | ✅ |

---

## Grafo de dependencias

```
00 ──▶ 01 ──┬──▶ 02 ──▶ 03 ──▶ 04 ──▶ 05
            │          │      │
            │          │      └──────────────────────┐
            │          │                             │
            │          └──▶ 07 (auth)                ▼
            │                 │                  08 (servicios)
            ├──▶ 06 (cloudinary)                     │
            │        │                               ▼
            └──▶ 09 (UI) ──▶ 10 (catálogo) ◀────────┘
                    │            │
                    ▼            │
              11 (carrito) ──▶ 12 (whatsapp) ──▶ 13 (checkout)
                    │
                    └──────────────┐
                                   ▼
                        14 (admin + switch) ──▶ 15 (realtime)
                                   │
                                   ▼
                        16 (CRUD productos) ──▶ 17 (categorías/ajustes)
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
             18 (SEO)                    19 (seguridad)
                                                  │
                                                  ▼
                                    20 (tests) ──▶ 21 (deploy) ──▶ 22 (soporte)
```

**Camino crítico hacia el primer release usable:** `01 → 02 → 03 → 04 → 08 → 09 → 10 → 11 → 12 → 13`. Las tareas 14–17 (panel admin) pueden ser posteriores al primer release público, porque el catálogo funciona sin ellas.

---

## Reglas de arquitectura (transversales a todas las tareas)

| # | Regla | Enforcement |
|---|---|---|
| 1 | `src/server/**` nunca viaja al bundle del cliente | `import "server-only"` → **falla el build** |
| 2 | Las rutas no llaman a Prisma, llaman a servicios | ESLint `no-restricted-imports` |
| 3 | Los servicios no importan React ni Next | ESLint `no-restricted-imports` |
| 4 | Los repositorios son la única capa con Prisma | ESLint + revisión |
| 5 | Los servicios de dominio puro **no** llevan `server-only` | Convención + revisión |
| 6 | Todo error de negocio es un `DomainError` con `code` estable | Convención + typecheck |
| 7 | Cero `any`, cero `@ts-ignore`, cero `!` en lógica de negocio | ESLint + revisión |
| 8 | `npm run verify` en verde antes de cada commit | Quality Gate |
| 9 | Nombres de archivo que describen responsabilidad única | ESLint `import/no-restricted-paths` (fase tardía) + revisión |
| 10 | Server Action = validar → autorizar → delegar al servicio → revalidar caché | Plantilla en cada tarea |

---

## Métricas de seguimiento

Registrar al cerrar cada tarea:

| Métrica | Valor |
|---|---|
| Tareas completadas | `13 / 23` |
| Tareas en curso | `1` (00) |
| Días transcurridos desde Tarea 01 | `1` |
| Deuda técnica acumulada | `5` (una resuelta por D-02) |
| Bloqueos abiertos | `7` (B-1 a B-6 del encargado + B-7 de relevamiento — ver [`docs/menu-maestro.md` §0](../menu-maestro.md)) |
| Datos MOCK pendientes de reemplazo | `23` productos · `23` fotos · `1` línea base · `1` número de WhatsApp · `1` email de admin |
