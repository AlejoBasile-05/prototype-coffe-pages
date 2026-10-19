# Tarea 19 — Endurecimiento de Seguridad

| Campo | Valor |
|---|---|
| **ID** | 19 |
| **Fase (DESIGN.md §8.7)** | Fase 5 — Pulido, Seguridad y Deploy a Producción |
| **Depende de** | 07, 04, 06, 16, 17 |
| **Habilita** | 20, 21 |
| **Tipo** | Transversal |
| **Esfuerzo est.** | 2 – 3 días |

---

## 1. Objetivo de la tarea

Cerrar las cuatro puertas que quedaron abiertas y que ninguna tarea anterior cerró, y dejar escrito cómo se verifican:

1. **RLS en la base.** Hoy las tablas no tienen políticas y el único camino de escritura es Prisma desde el servidor. Eso protege el application's lógica, pero deja la puerta de PostgREST abierta con la `anon` key, que sí viaja en el bundle.
2. **Headers de seguridad.** No hay CSP, ni `X-Content-Type-Options`, ni `X-Frame-Options`, ni HSTS.
3. **Auditoría del bundle y de las actions.** No hay forma de demostrar que `service_role` no está compilado en el cliente, ni que cada action verifique la sesión antes de leer el payload.
4. **Superficie de subida y de cookies.** `allowed_formats` de Cloudinary es una blacklist, y no se auditó qué cookies de Supabase quedan en el navegador.

**Criterio de éxito verificable:** con la `anon` key en la mano, una petición a PostgREST para escribir en `products` recibe `401`/`403` y una lectura de `staff_members` recibe `[]`; `curl -I` contra cualquier ruta devuelve los seis headers; `npm run audit:bundle` no encuentra secretos y falla si aparece uno; `npm run verify:actions` confirma que las nueve actions de admin llaman a `verifyAdminSession()` antes de tocar el payload; y subir un `.svg` firmado a Cloudinary es rechazado por la propia API.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 07 (auth, `verifyAdminSession`, `supabaseAdmin`), Tarea 04 (repositorios y Prisma), Tarea 06 (firma de Cloudinary), Tarea 16 (actions de producto), Tarea 17 (actions de categoría y ajustes).

No requiere la 14 ni la 10: esta tarea no dibuja una pantalla. Los dos artefactos que sí quedan visibles --los headers y el script de auditoría-- se comprueban con `curl` y con el output de un comando.

### 2.1 Qué está hecho y qué falta

| Pieza | Estado | Dónde |
|---|---|---|
| `verifyAdminSession()` con lectura de rol desde la base | **Hecho** | `src/server/auth/verify-admin.ts` (Tarea 07) |
| `supabaseAdmin` con `service_role`, sólo servidor | **Hecho** | `src/server/infra/supabase/admin.ts` (Tarea 02) |
| Uploads firmados con `allowed_formats` en blacklist | **Hecho, débil** | `src/server/infra/cloudinary.ts` (Tarea 06) |
| Cookies de Supabase con refresh en el middleware | **Hecho** | `src/middleware.ts` (Tarea 07) |
| RLS habilitado en las tablas | **Falta** | esta tarea |
| CSP | **Falta** | esta tarea |
| HSTS | **Falta** | esta tarea |
| Los otros headers | **Falta** | esta tarea |
| Script de auditoría del bundle | **Falta** | esta tarea |
| Script de verificación de actions | **Falta** | esta tarea |
| `allowed_formats` como allowlist | **Falta** | esta tarea |
| Registro estructurado de acciones de escritura | **Falta** | esta tarea |
| Checklist de cookies de sesión | **Falta** | esta tarea |
| `docs/seguridad.md` | **Falta** | esta tarea |

### 2.2 RLS no protege las Server Actions, y hay que decirlo primero

RLS es una política de **la base de datos**. Prisma se conecta con el `DATABASE_URL`, que en Supabase es la del rol `postgres` del proyecto, y ese rol tiene `BYPASSRLS`. Una Server Action que llama a `updateProduct` escribe saltándose completamente las políticas.

Eso no vuelve inútil a RLS. Significa que hay dos capas con trabajos distintos:

| Capa | Qué defiende | De quién |
|---|---|---|
| `verifyAdminSession()` + `isOwner()` | La lógica de autorización de la aplicación | Del usuario que encuentra una action y la llama desde la consola del navegador |
| RLS | La tabla, desde cualquier otro camino | De la `anon` key del bundle y de un `curl` con la URL de la base |

El punto importante es el orden de la lectura: **si alguien encuentra la URL de la base y la `anon` key, RLS es lo único entre ellos y los datos**. Sin RLS, la `anon` key sola alcanza para leer `staff_members` y para escribir en `products` con PostgREST, sin pasar por ninguna action. `service_role` bypasea RLS por diseño; `anon` no, siempre que la tabla tenga RLS y políticas.

La consecuencia práctica: esta tarea **no** reemplaza a la Tarea 07 y **no** agrega una segunda verificación de sesión. Agrega la capa que faltaba.

### 2.3 Por qué `anon` y `authenticated` no necesitan escribir nada

El único camino de escritura del proyecto es una Server Action. Las Server Actions corren en el servidor, con Prisma, con el rol del proyecto. El cliente nunca escribe en la base.

Por lo tanto, para los roles `anon` y `authenticated`:

- **Ningún `INSERT`, `UPDATE` ni `DELETE`.** Sin políticas de escritura.
- **Ningún `SELECT` sobre `staff_members`, `business_settings`, `product_variants` ni `categories`.** No hay un consumidor legítimo: el panel lee esas tablas por Prisma desde el servidor, y la anon key no las necesita.
- **`SELECT` sobre `products`, sólo para las dos columnas del Realtime.** Ver §2.4.

Un `SELECT` denegado devuelve `[]` y no un error. Eso es lo que hace que la diferencia sea invisible en el desarrollo: un `fetch` a PostgREST devuelve `200` con `[]` y parece que la tabla está vacía.

### 2.4 El dilema de Realtime: RLS rompe el canal si se hace mal

`postgres_changes` **no entrega una fila a un suscriptor que no tiene permiso de `SELECT` sobre la tabla**. Eso está en la documentación de Supabase y es lo que convierte a esta tarea en la más delicada del endurecimiento.

La Tarea 15 §6.2 dice que la autorización "ya está resuelta por el rol `authenticated`". Con RLS habilitado sin políticas, deja de estarlo: la suscripción se conecta, se autentica y **no llega ningún evento**, sin error visible. El síntoma es exactamente el del criterio 8.5 de la Tarea 15 ("el canal se abre y no llega nada"), y es el peor tipo de bug posible en el panel: la disponibilidad deja de actualizarse y nadie sabe por qué.

La salida es una política de `SELECT` sobre `products` **limitada por columna y por rol**:

```sql
-- ⛔ Ver §6.1 completo. Éste es el corazón de la política.
grant select (id, is_available) on public.products to authenticated;
```

Dos restricciones, y las dos importan:

1. **`GRANT SELECT` por columnas.** `postgres_changes` entrega la fila completa, no sólo las columnas modificadas (Tarea 15 §12.4). Con permiso de tabla, el payload viajaría con nombre, precio, descripción y todo lo demás para cada cambio de disponibilidad. Con permiso de dos columnas, el payload no puede contener nada más.
2. **Sólo `authenticated`, y sólo si el usuario es del staff.** La política consulta `staff_members` en lugar de confiar en el rol del JWT.

El punto 2 necesita una función de seguridad con `search_path` fijo, porque una política que consulta una tabla sobre la que hay RLS se llama a sí misma y Postgres corta la consulta con un error de recursión. La alternativa --`auth.jwt()->>'role' = 'staff'`-- no sirve: el rol vive en `staff_members` y **no** en el JWT, y por diseño no se mete ahí (§2.2 y Tarea 07 §9).

### 2.5 `service_role` en el bundle: el riesgo que no se ve

`service_role` bypasea RLS y además bypasea el rate limiting de Supabase Auth. Si esa cadena termina en el bundle del navegador, cualquiera que abra DevTools tiene escritura libre sobre la base, sin sesión y sin rate limit.

En este proyecto no puede pasar, por dos razones que ya están fijadas: `src/server/infra/supabase/admin.ts` lleva `import "server-only"`, y `NEXT_PUBLIC_*` es el único prefijo que Next expone al bundle. Pero "no puede pasar" es una afirmación, y una afirmación que no se verifica se rompe en el commit en el que alguien agregue un `import` de más.

`npm run audit:bundle` lee el `.next` construido y falla si encuentra un valor de `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_API_SECRET`, `DATABASE_URL` o `DIRECT_DATABASE_URL` en cualquier archivo bajo `.next/static/`. La clave es que corre **sobre el build**, no sobre el código fuente: un `import` accidental dentro de un Client Component se compila dentro de un `.js` y no aparece en un `grep` del source.

### 2.6 Los headers, y por qué el orden de despliegue importa

| Header | Valor | QuéPreviene |
|---|---|---|
| `Content-Security-Policy-Report-Only` | Ver §2.7 y §6.3 | Inyección de scripts, en observación |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` **sólo en producción** | Downgrade a HTTP |
| `X-Content-Type-Options` | `nosniff` | Que el navegador adivine el tipo de un `.js` y lo ejecute |
| `X-Frame-Options` | `DENY` | Clickjacking sobre el panel |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Que la URL de una ficha llegue a terceros |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Permisos que la app no usa |

**El HSTS es el único header con capacidad de romper el sitio, y por eso se apaga fuera de producción.** `includeSubDomains` en un subdominio de preview es una promesa que el navegador guarda un año: si ese subdominio sirve HTTP y no tiene certificado válido, todos los que lo visitado quedan con un error de conexión que no se arregla borrando cookies a mano.

El `middleware.ts` ya existe y ya se ejecuta en todas las rutas. Los headers se agregan ahí y no en `next.config.ts`, por una razón concreta: el middleware **ya está** en el hot path y ya corre después de la resolución de la ruta, así que los headers acompañan a la respuesta en el mismo lugar donde se renueva la cookie de sesión. Agregar un segundo `headers()` en la config duplicaría la lógica de rutas en dos lugares que después divergen.

Excepción: los archivos estáticos de `/_next/static` los sirve el CDN de Vercel y el middleware no los intercepta. Para esos alcanza con `nosniff` desde `next.config.ts`, y el resto de los headers no protege nada de un `.js` que ya se descargó.

### 2.7 La CSP empieza en report-only, y no es opcional empezar así

Una CSP con `script-src 'self'` sin `unsafe-inline` rompe la aplicación: Next inyecta scripts de bootstrap con inline, y `next/og` y los estilos de Tailwind necesitan su propio tratamiento. El resultado de activar la CSP en modo bloqueante el primer día es un sitio en blanco, y la reacción natural de quien la desplegó es agregar `--unsafe-inline`, que es la misma CSP que no protege nada.

El camino que funciona es otro:

1. `Content-Security-Policy-Report-Only` con la política que se quiere, más `report-to`.
2. Una semana o dos de tráfico real, con los avisos visuales.
3. Recién ahí la misma política en modo bloqueante.

Los `script-src` de esta tarea usan `'self'` y `'unsafe-inline'`, y el comentario del código dice exactamente por qué. Cuando se pueda usar nonces --o cuando se migre a `proxy.ts` con la CSP por request--, `'unsafe-inline'` se saca. Anotado como deuda en §9.1.

El `connect-src` sí tiene que incluir el `wss://` de Supabase, porque sin él el hook de Realtime de la Tarea 15 no conecta y no hay error visible. Ese es el segundo origen que la CSP rompe en silencio.

### 2.8 Auditar el bundle no es medir el bundle

Hay dos cosas distintas y confusionarlas cuesta una tarde:

- **Medir** es un número: "el chunk inicial pesa 180 KB". Sirve para performance, y es un número que se negocia con plazos.
- **Auditar** es una lista: "no hay secretos, no hay `eval`, no hay `new Function`, no hay source maps expuestos". No tiene tamaño objetivo y no falla por dos kilobytes.

Esta tarea implementa la segunda. Un umbral de tamaño es trabajo de la Tarea 20, y el reporte de `next build` ya lo muestra.

El script no usa `@next/bundle-analyzer` ni ninguna dependencia nueva: lee el directorio con `node:fs`, que es lo único que hace falta para grepear archivos.

### 2.9 `allowed_formats` es una allowlist, y una blacklist no alcanza

La Tarea 06 sube con `allowed_formats: ["jpg", "jpeg", "png", "webp"]`. Eso ya rechaza `.svg`, `.html`, `.js` y `.exe`.

Lo que no hace es rechazar lo que Cloudinary acepta y no está en la lista. Cloudinary admite formatos de video (`mp4`, `mov`), PDF, `psd`, `tiff`, `heic`, `svg` bajo otras configuraciones y formatos RAW de cámara. Un `.psd` de 200 MB subido a la misma cuenta que las fotos de producto es un costo y un vector.

El allowlist completo queda:

```ts
allowed_formats: ["jpg", "jpeg", "png", "webp"],
```

más `max_file_size` y `max_image_size`, que la Tarea 06 ya define. Y hay una segunda capa que **no** es de Cloudinary: `assertUploadedImageIsUsable` de la Tarea 06 valida el asset que volvió, no lo que se mandó. Las dos juntas significan que un formato raro tiene que pasar por dos verificaciones independientes, y una sola no alcanza.

### 2.10 La diferencia entre auditar y guardar

`npm run verify:actions` **comprueba que la llamada exista**. `logAdminAction` **deja registro de que ocurrió**. No son la misma cosa y el primero no reemplaza al segundo:

- El script corre en CI y en cada deploy. Detecta que alguien pegó una action nueva sin `verifyAdminSession`, que es el error de arquitectura más caro de todos.
- El log corre en producción. Detecta que alguien usó una action válida desde un lugar raro, que es un problema distinto y sólo visible con datos de ejecución.

El log va a `console.info` con campos cerrados. **Nunca** el payload completo: un `console.info(input)` con un `FormData` entero puede imprimir un token de sesión o el contenido de un archivo. El contrato del log es una lista de campos que se pueden nombrar uno por uno, y un test verifica que la lista no cresca por accidente.

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `supabase/migrations/<timestamp>_rls_y_lectura_realtime.sql` | Habilita RLS, crea las políticas y la función de seguridad. Idempotente |
| `src/server/infra/audit-log.ts` | `logAdminAction` con campos cerrados. `import "server-only"` |
| `scripts/auditar-bundle.mjs` | Lee `.next/static` y falla si hay secretos o `eval` |
| `scripts/verificar-acciones.mjs` | Comprueba que cada action verifique la sesión antes del payload |
| `docs/seguridad.md` | 2FA, CAPTCHA, cookies, rotación de secretos, qué hacer si se filtra una clave |
| `tests/unit/audit-log.test.ts` | Los campos del log, y que el payload no se imprima entero |
| `tests/unit/cloudinary-params.test.ts` | `allowed_formats` como allowlist y los límites de tamaño |
| `tests/unit/security-headers.test.ts` | Los seis headers, y que HSTS no esté en preview |
| Ningún `utils.ts` ni `helpers.ts` | Los dos scripts llevan el verbo en el nombre: `auditar`, `verificar` |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `src/middleware.ts` | Los seis headers, con HSTS condicionado a producción (§2.6) |
| `next.config.ts` | `headers()` sólo para `/_next/static` con `nosniff` (§2.6) |
| `src/server/infra/cloudinary.ts` | `allowed_formats` explícito como allowlist, más `max_file_size` y `max_image_size` |
| `src/server/actions/productos.ts` | `logAdminAction` en las tres actions de escritura |
| `src/server/actions/categorias.ts` | `logAdminAction` en create, update, delete y toggle |
| `src/server/actions/ajustes.ts` | `logAdminAction` en la action de ajustes |
| `package.json` | `audit:bundle` y `verify:actions` |
| `.env.example` | Marcar explícitamente qué variables **nunca** llevan `NEXT_PUBLIC_` |
| `docs/tasks/README.md` | Marcar la Tarea 19 |

### 3.3 Eliminar

Ninguno. `src/server/infra/supabase/admin.ts` no se toca: es correcto que exista, es correcto que sea `server-only`, y lo que cambia es que ahora hay un script que lo verifica en cada build.

### 3.4 Lo que esta tarea no va a agregar

- **Ninguna dependencia.** Los dos scripts usan `node:fs` y `node:path`. No hace falta `zod` para parsear un `rg`, ni `glob`, ni un parser de AST.
- **Ningún WAF, ningún bucket de logs, ningún Sentry.** Esos son servicios que cuestan plata y que se deciden después de tener tráfico. Lo que sí queda es el formato del log, para que sumar el destino después sea cambiar una función.
- **Ningún rate limiter propio.** Ver §9.2: el de Supabase es la única capa válida en serverless, y el CAPTCHA se activa en el panel.
- **Ninguna rotación automática de secretos.** Es un procedimiento documentado en `docs/seguridad.md`, no un cron.

---

## 4. Estructura N-Capas

### 4.1 Qué capa es cada cosa

| Artefacto | Capa | Por qué |
|---|---|---|
| RLS y la función de seguridad | Fuera del código | Son políticas de la base. Viven en una migración porque un ambiente nuevo tiene que nacer con ellas |
| Los seis headers | Borde de la aplicación | Corren antes que todo y después de la resolución de la ruta. El middleware ya está ahí |
| `logAdminAction` | Capa 2 (`src/server/infra`) | Es infraestructura de observabilidad: habla con el destino de logs, no con la base |
| `verificar-acciones.mjs` | Fuera del código | Corre sobre el source, en CI. No se importa en la app |
| `auditar-bundle.mjs` | Fuera del código | Corre sobre el build. No se importa en la app |
| `docs/seguridad.md` | Documentación | Procedimientos que no se pueden verificar con un test |

### 4.2 La regla que ordena esta tarea

> **Nada de esta tarea se importa en la aplicación para que funcione.**

Los headers sí, pero son headers. RLS es de la base. Los dos scripts son de CI. El log es el único módulo nuevo que se importa desde las actions, y lo que se importa es una llamada, no una función de negocio.

La razón de escribirlo así: todo lo que se agrega como "una capa más de seguridad" dentro de la aplicación puede quedar sin usar y nadie se entera. Un script de auditoría que no corre es peor que no tener script, porque da la impresión de que la auditoría existe. Por eso los dos scripts están en `package.json` y por eso hay un criterio que dice que el pipeline falla si no corren.

### 4.3 El orden de despliegue de esta tarea

Este es el único punto de la tarea donde el orden importa de verdad, y está en el checklist de despliegue de la Tarea 21:

| Orden | Qué | Por qué no al revés |
|---|---|---|
| 1 | La función de seguridad `es_usuario_del_staff` | Sin ella, la política no se puede crear |
| 2 | Los `GRANT` por columna sobre `products` | Sin el permiso, la política no habilita nada |
| 3 | Las políticas | Con RLS ya habilitado y sin políticas, **todo** se cae de golpe |
| 4 | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | **Este es el paso que corta el acceso.** Va al final |
| 5 | La aplicación, con la CSP en report-only | Si algo se rompe, se ve en los reportes y no en el sitio |

El paso 4 activating RLS sobre `products` sin haber creado antes la política de las dos columnas hace que el Realtime deje de entregar eventos en el mismo instante. Por eso la migración entera va en **un solo archivo**: o se aplica completa o no se aplica.

### 4.4 Reparto específico

| Necesidad | Dónde vive | Razón |
|---|---|---|
| "Este usuario es del staff" | Función SQL `security definer` | La alternativa con `auth.jwt()` no sirve porque el rol no está en el JWT (§2.4) |
| Qué columnas ve el canal | `GRANT SELECT (id, is_available)` | El payload de `postgres_changes` trae la fila entera (§2.4) |
| Qué se escribe en el log | Lista cerrada en `audit-log.ts` | Un `FormData` impreso entero filtra tokens (§2.10) |
| Qué valores de `process.env` no pueden estar en el bundle | Lista en `auditar-bundle.mjs` | La lista es la regla; el script la aplica |
| Qué headers van en producción y cuáles en preview | Condición en `middleware.ts` | HSTS en preview rompe el sitio (§2.6) |
| Qué hacer si se filtra una clave | `docs/seguridad.md` | Un procedimiento no cabe en un `console.warn` |

---

## 5. Convenciones de código (Clean Code + SOLID)

### 5.1 SQL idempotente o no se aplica dos veces

Una migración que se aplicó y después se vuelve a aplicar tiene que dejar la base igual. En Postgres eso se consigue con `if not exists` en el `CREATE POLICY` y con el `DO $$` para el `GRANT`, que no tiene forma idempotente propia.

Es la trampa número uno de las migraciones de RLS: el `if not exists` del `ALTER TABLE` sí existe, el de `CREATE POLICY` **no**, y el error es `42710 duplicate_policy` en staging cuando la migración ya corrió una vez. La forma correcta es envolver el `CREATE POLICY` en un `DO $$` que consulte `pg_policies`, y eso se escribe entero en §6.1.

### 5.2 `search_path` fijo en la función de seguridad

Una función `security definer` sin `SET search_path` es la forma clásica de escalar privilegios: cualquiera que pueda crear objetos en un schema que esté en el `search_path` puede redefinir lo que la función busca. En Supabase, el `search_path` por defecto incluye `public`, y `public` es escribible.

Por eso la firma de §6.1 lleva las dos cláusulas juntas: `security definer` para que la función vea `staff_members` sin disparar RLS, y `set search_path = ''` para que no dependa de un schema que cualquiera puede cambiar. Sacar cualquiera de las dos dos convierte la función en un problema de seguridad distinto al que venía a resolver.

### 5.3 El log tiene campos cerrados, no un objeto libre

La firma completa está en §6.4 y lo que no existe es esto:

```ts
// ⛔ Así NO: el segundo parámetro libre imprime el payload entero.
logAdminAction("producto.actualizado", input);
```

El motivo es concreto: un `console.info` con el objeto de la action termina en el agregador de logs con el email de un cliente, un teléfono o un token de sesión adentro, y de ahí a un destino de logs de terceros que nadie audita. En este proyecto el `input` de `createProductAction` incluye la imagen subida, que trae una firma de Cloudinary.

Con un union de tipos, agregar un campo nuevo es un cambio que se ve en el diff del tipo. Con `Record<string, unknown>`, es un cambio invisible.

### 5.4 Los scripts de `scripts/` no se importan

Un `scripts/*.mjs` con `export` es indistinguible de un módulo más del proyecto, y alguien lo importa. La convención es que no tienen exports, se ejecutan con `node`, y la primera línea del archivo dice qué se espera que verifique. Un módulo sin exports que se importa desde TypeScript no compila, y eso es exactamente el comportamiento buscado.

Los nombres llevan el verbo y son ejecutables: `auditar-bundle.mjs`, `verificar-acciones.mjs`. No `bundle.mjs`, no `check.mjs`, no `utils.mjs`.

### 5.5 Los scripts fallan con código de salida distinto de cero

Un script de auditoría que imprime un aviso y sale con `0` no audita nada: el pipeline pasa, el mensaje pasa inadvertido en el log, y el siguiente deploy sigue igual.

Los dos scripts usan `process.exitCode = 1` y listan lo esperado antes de reportar. Un script que no puede fallar es un script decorativo.

### 5.6 Nombres

| Elemento | Nombre | Razón |
|---|---|---|
| Política RLS | `productos_solo_columnas_de_disponibilidad` | En SQL se lee en un `pg_policies` a las dos de la mañana. El nombre tiene que decir qué permite |
| Función SQL | `es_usuario_del_staff` | Responde una pregunta, no describe una acción |
| Registro | `logAdminAction(evento, campos)` | `log*` es el prefijo de los logs del proyecto. `write*` y `record*` se usan para persistencia |
| Eventos | `"producto.creado"`, `"categoria.eliminada"` | `tabla.verbo` en pasado. Ordenable y filtrable por tabla |
| Script de bundle | `auditar-bundle.mjs` | El verbo dice qué hace cuando alguien lo ve en el `package.json` |
| Script de actions | `verificar-acciones.mjs` | `verificar` ≠ `auditar`: uno comprueba una propiedad, el otro revisa un artefacto |

### 5.7 Límites de tamaño

| Archivo | Tope | Razón |
|---|---|---|
| `<timestamp>_rls_y_lectura_realtime.sql` | 150 líneas | Cinco `ALTER TABLE`, una función, dos `GRANT`, tres políticas |
| `src/server/infra/audit-log.ts` | 120 líneas | Un union de tipos, un logger y una función. Debería quedar en ochenta |
| `src/middleware.ts` | 220 líneas | Sumado lo de esta tarea. Si se pasa, los headers van a su propio módulo con una función que los devuelve |
| `scripts/auditar-bundle.mjs` | 140 líneas | Recorre, reporta, sale |
| `scripts/verificar-acciones.mjs` | 120 líneas | Parsea, compara, sale |
| `docs/seguridad.md` | Sin tope | Es un procedimiento |

---
## 6. Pasos de implementación

### 6.1 La migración de RLS

Un solo archivo, aplicado entero o no aplicado. El timestamp va después de las de la Tarea 15, y el nombre dice qué hace:

```sql
-- supabase/migrations/20250120000000_rls_y_lectura_realtime.sql
--
-- ⛔ Endurecimiento de la base. Ver Tarea 19 §2.2 a §2.4.
-- ⛔ Idempotente: se puede volver a aplicar sin romper nada.
-- ⛔ Aplicar ENTERO. El paso 4 (ENABLE ROW LEVEL SECURITY) corta el
--    acceso a `products`, y si se aplica sólo hasta el paso 3 el
--    Realtime deja de entregar eventos sin error visible.

-- ---------------------------------------------------------------------------
-- 1. La función de seguridad
-- ---------------------------------------------------------------------------
-- ⛔ `security definer` + `set search_path` van juntos. Ver §5.2.
--
-- ⛔ Por qué existe y no se usa `auth.jwt() ->> 'role'`: el rol vive en
--    `staff_members` y NO en el JWT, por diseño de la Tarea 07 §9. La
--    alternativa sería meter el rol en el token, que es cachearlo y
--    que un cambio de rol tarde en aplicarse.
--
-- ⛔ `security definer` es necesario porque esta función se llama desde
--    una política de `products`, y `staff_members` también tiene RLS:
--    sin el definer, la consulta se llama a sí misma y Postgres corta
--    con `infinite recursion detected in policy`.

create or replace function public.es_usuario_del_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members s
    where s.id = auth.uid()
      and s.is_active = true
  );
$$;

comment on function public.es_usuario_del_staff() is
  'Indica si el usuario autenticado es un miembro activo del staff. Usada por las politicas de RLS. No usar desde el cliente.';

-- ---------------------------------------------------------------------------
-- 2. Permisos de columna: lo que el canal de Realtime puede leer
-- ---------------------------------------------------------------------------
-- ⛔ `GRANT SELECT` POR COLUMNAS, no sobre la tabla.
--    `postgres_changes` entrega la fila completa en `payload.new`, no
--    sólo las columnas modificadas (Tarea 15 §12.4). Con permiso de
--    tabla, cada cambio de disponibilidad viajaría con nombre, precio,
--    descripcion e imageUrl. Ver §2.4.

revoke all on table public.products from anon, authenticated;
grant select (id, is_available) on table public.products to authenticated;

-- ⛔ `anon` no recibe nada. El catálogo público se genera en el servidor
--    con Prisma; el navegador no lee la tabla por PostgREST.
grant select () on table public.products to anon;

revoke all on table public.categories from anon, authenticated;
revoke all on table public.product_variants from anon, authenticated;
revoke all on table public.business_settings from anon, authenticated;
revoke all on table public.staff_members from anon, authenticated;

-- `staff_members`: el usuario puede leer su propia fila, para el perfil.
-- Es la unica lectura directa que el panel necesita y no la hace
-- (la hace `verifyAdminSession` por Prisma), así que queda lista para
-- cuando exista una pantalla de perfil.
grant select (id, email, role, is_active) on table public.staff_members to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Las politicas
-- ---------------------------------------------------------------------------
-- ⛔ `CREATE POLICY IF NOT EXISTS` NO EXISTE en Postgres. El `DO $$` es
--    obligatorio. Ver §5.1.

do $$
begin
  -- Canal de Realtime: sólo para el staff, sólo por las columnas de arriba.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'productos_lectura_staff_disponibilidad'
  ) then
    create policy productos_lectura_staff_disponibilidad
      on public.products
      for select
      to authenticated
      using (public.es_usuario_del_staff());
  end if;

  -- El usuario lee su propia fila de staff. La comparacion es por id,
  -- no por rol: nadie ve la fila de otro.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'staff_members'
      and policyname = 'staff_lee_su_propia_fila'
  ) then
    create policy staff_lee_su_propia_fila
      on public.staff_members
      for select
      to authenticated
      using (id = auth.uid());
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. RLS habilitado. ESTE es el paso que corta el acceso.
-- ---------------------------------------------------------------------------
-- ⛔ Va al final a proposito. Habilitar RLS sin politica previa deja
--    la tabla en deny-all, que es exactamente lo que §4.3 pide evitar.
-- ⛔ Idempotente de verdad: `alter table ... enable row level security`
--    repetido no cambia nada.

alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.product_variants enable row level security;
alter table public.business_settings enable row level security;
alter table public.staff_members enable row level security;

-- ⛔ `force row level security` NO se usa a proposito. Con RLS forzado, el
--    rol `postgres` de Prisma también pasa por las políticas, y las
--    Server Actions dejan de funcionar al momento de aplicar la
--    migracion. Ver §2.2: Prisma bypasea RLS, y eso es lo que permite
--    que la autorizacion viva en `verifyAdminSession`.
```

Dos comentarios que parecen cableados y no lo están:

- **`grant select () ... to anon` es un no-op deliberado.** No hay una sintaxis limpia para "ningún permiso"; lo que se hace es revocar primero y después dejar explícito que el rol `anon` no entra. Si alguien más adelante agrega un `grant select on products to anon` en otra migración, este `revoke` no lo va a alcanzar, y por eso hay un criterio que lo verifica (§8.3).
- **`force row level security` queda desactivado a propósito.** Es la opción que parece más segura y es la que rompe el producto. Con RLS forzado, la conexión de Prisma pasa a cumplir las políticas, y como el rol `postgres` no es un usuario autenticado de Supabase, `auth.uid()` devuelve `null` y ninguna política lo deja pasar. El resultado es un sitio entero con errores 500 en la primera lectura de catálogo.

### 6.2 Verificar la migración desde la terminal

Antes de tocar la aplicación, la migración se verifica con la `anon` key a mano. Este bloque es el que distingue "aplicamos la migración" de "la migración funciona":

```bash
# ⛔ Requiere la URL y la ANON key del proyecto. NUNCA la service_role.
SUPABASE_URL="https://abcdefghijklm.supabase.co"
ANON_KEY="eyJhbGciOi..."

# Escritura directa por PostgREST: tiene que fallar.
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SUPABASE_URL/rest/v1/products" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"inyectado","price":1,"status":"PUBLISHED"}'
# ⛔ 401 o 403. Un 201 es una brecha abierta y hay que revertir.

# Lectura de staff_members: tiene que devolver un array vacio.
curl -s "$SUPABASE_URL/rest/v1/staff_members?select=*" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# ⛔ []

# Lectura de productos sin sesion: vacio.
curl -s "$SUPABASE_URL/rest/v1/products?select=name,price" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# ⛔ []

# Confirmar que RLS quedo habilitado en las cinco tablas.
# Requiere el service_role o el panel: devuelve las cinco filas.
curl -s "$SUPABASE_URL/rest/v1/rpc/auditar_rls" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

El último comando no existe: `pg_class` no es accesible por PostgREST. La verificación real de que RLS quedó habilitado es por SQL directo, y va en el checklist de despliegue de la Tarea 21:

```sql
-- ⛔ Con la connection string DIRECTA (puerto 5432), no el pooler.
select relname, relrowsecurity
from pg_class
where relname in ('products', 'categories', 'product_variants', 'business_settings', 'staff_members')
order by relname;
-- ⛔ Las cinco filas con relrowsecurity = true.

select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
-- ⛔ products: 1 politica. staff_members: 1 politica. Las otras tres: 0.
```

### 6.3 Los headers en el middleware

```ts
// src/middleware.ts (dentro de la función middleware que ya existe)

/**
 * ⛔ `report-only` primero, y en bloqueante nunca de entrada. Ver §2.7.
 *
 * `script-src` lleva `'unsafe-inline'` porque Next inyecta los scripts de
 * bootstrap en línea, y `next/og` y el CSS crítico también. Es la
 * concesión que hace que la CSP funcione hoy; el precio es que la CSP
 * no frena un XSS. Anotado como deuda en §9.1.
 */
const construirCsp = (): string => {
  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://res.cloudinary.com",
  ].join(" ");

  const directiva = [
    "default-src 'self'",
    // ⛔ `blob:` lo necesita el worker de Cloudinary que sube la imagen.
    "script-src 'self' 'unsafe-inline' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com",
    `connect-src ${connectSrc}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  return `${directiva}; report-uri /api/csp-report`;
};

/**
 * ⛔ HSTS SOLO en produccion. Ver §2.6.
 *
 * El motivo concreto: `includeSubDomains` en un subdominio de preview es
 * una promesa que el navegador guarda 12 meses. Si ese subdominio sirve
 * HTTP sin certificado valido, todos los que lo visitado quedan con un
 * error de conexion que no se arregla borrando cookies.
 */
const construirHeaders = (): Record<string, string> => {
  const csp = construirCsp();

  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  };

  // ⛔ HSTS únicamente con el dominio real resuelto (§2.6). Un preview
  //    no tiene dominio propio y no debe prometer HSTS para nada.
  if (process.env.NODE_ENV === "production" && (process.env.NEXT_PUBLIC_SITE_URL ?? "") !== "") {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
  }

  // ⛔ La CSP sale en MODO REPORT-ONLY y no se cambia hasta que el
  //    reporte de §2.7 esté limpio. Ver la nota que sigue.
  headers["Content-Security-Policy-Report-Only"] = csp;

  return headers;
};
```

**La CSP bloqueante no se activa en esta tarea.** Se activa cambiando una línea, y esa línea no existe todavía a propósito: no hay un flag, ni una variable de entorno, ni un `if` con dos ramas. Así se evita el escenario en el que alguien agrega `Content-Security-Policy` en el mismo deploy en el que la CSP acaba de escribirse, y el sitio sale en blanco por una violación de CSP que nadie sabe leer.

El orden está escrito, y es el de §2.7:

| Etapa | Qué se emite | Cuándo | Quién decide |
|---|---|---|---|
| 1 — ahora | `Content-Security-Policy-Report-Only` | En el deploy que aplica esta tarea | Nadie: se emite siempre |
| 2 — tras una semana de tráfico | Idém, y se miran los avisos | Cuando el log de reportes tenga volumen | La Tarea 21 crea `/api/csp-report` |
| 3 — con el reporte limpio | `Content-Security-Policy` | Editando `construirHeaders` | Decisión manual, en el PR que la activa |

La etapa 3 es un cambio de una línea y por eso queda como tarea y no como configuración: una CSP que se activa sola es una CSP que se activa en el deploy equivocado.

```ts
// src/middleware.ts (dentro de middleware, antes del return)
const response = NextResponse.next({ request });
await refrescarCookieDeSesion(request, response);

for (const [nombre, valor] of Object.entries(construirHeaders())) {
  response.headers.set(nombre, valor);
}

return response;
```

```ts
// next.config.ts (agregar al objeto exportado)
async headers() {
  return [
    {
      // ⛔ Solo `nosniff`. Los archivos de `/_next/static` los sirve el
      //    CDN de Vercel y no pasan por el middleware. Ver §2.6.
      source: "/_next/static/:path*",
      headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
    },
  ];
}
```

**`/api/csp-report` no se crea en esta tarea.** Es el endpoint que recibe los reportes, y sin él el `report-uri` no tiene dónde enviar y la consola muestra un 404 por cada violación. Se implementa con la Tarea 21, junto con el resto de la operación, y mientras tanto el `report-uri` es inofensivo: el navegador intenta, falla y sigue.

### 6.4 El log estructurado

```ts
// src/server/infra/audit-log.ts
import "server-only";

/**
 * Registro de las acciones de escritura del panel.
 *
 * ⛔ Los campos son un union, no `Record<string, unknown>`. Ver §5.3.
 * ⛔ `console.info` va al log de Vercel con un solo argumento estructurado,
 *    que es lo que permite filtrar por `evento` y por `actorId` en la
 *    UI de Vercel. Un `console.info` con interpolacion de string obliga a
 *    parsear texto.
 */

export type AdminAuditEvent =
  | "producto.creado"
  | "producto.actualizado"
  | "producto.archivado"
  | "producto.disponibilidad"
  | "categoria.creada"
  | "categoria.actualizada"
  | "categoria.eliminada"
  | "categoria.visibilidad"
  | "ajustes.actualizados";

export interface AuditActor {
  readonly actorId: string;
  readonly actorEmail: string;
  readonly actorRole: "OWNER" | "STAFF";
}

/** Campos que se pueden adjuntar a cualquier evento. */
interface AuditCommon {
  readonly entity: string;
  readonly entityId?: string;
}

export type AuditFields =
  | (AuditCommon & { readonly campos?: readonly string[] })
  | (AuditCommon & { readonly slug?: string; readonly nombre?: string })
  | (AuditCommon & { readonly camposEditados: readonly string[] })
  | AuditCommon;

/**
 * ⛔ El `actor` viene de la sesion ya verificada. La funcion no recibe un
 *    email de parte del cliente, y no lo podria usar aunque lo recibiera:
 *    el log de una escritura tiene que decir quien la hizo, y eso sale de
 *    `verifyAdminSession`, no del payload.
 */
export const logAdminAction = (
  evento: AdminAuditEvent,
  actor: AuditActor,
  fields: AuditFields,
): void => {
  console.info("[admin]", {
    evento,
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    ...fields,
  });
};
```

El `actorEmail` está en la interfaz y no en el log. Es deliberado: el identificador del usuario alcanza para auditar, y el email es un dato personal que no necesita estar en un destino de logs de terceros. La interfaz lo declara porque algún día el panel va a querer mostrar "cambios de Ana" y conviene tener el dato a mano sin cambiar el contrato.

```ts
// src/server/actions/productos.ts (dentro de createProductAction, al final)

const actor: AuditActor = { actorId: session.user.id, actorEmail: session.user.email, actorRole: session.rol };
logAdminAction("producto.creado", actor, { entity: "producto", entityId: creado.id, nombre: parsed.data.nombre });

revalidateTag("products");
return { ok: true, id: creado.id };
```

Los otros siete eventos se loguean en el mismo lugar: después de que el servicio devuelve y antes del `revalidateTag`. Importa el orden, porque si el revalidado lanza, el registro ya está: se escribió algo en la base y hay que poder verlo.

### 6.5 El script de auditoría del bundle

```js
// scripts/auditar-bundle.mjs
// ⛔ Sin exports: no es un modulo del proyecto. Ver §5.4.
// ⛔ Corre sobre `.next/static`, no sobre el source. Ver §2.5.
// Salida: 0 si no hay secretos, 1 si hay alguno.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * ⛔ La lista de secretos que no pueden estar en el bundle. Es la regla;
 *    el script la aplica. Agregar un secreto aqui es un commit visible.
 */
const SECRETO_POR_NOMBRE = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_API_KEY",
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
];

/** Patrones que no son secretos pero tampoco deberían estar en el cliente. */
const PATRONES_PROHIBIDOS = [
  { nombre: "eval", regex: /\beval\s*\(/ },
  { nombre: "new Function", regex: /new\s+Function\s*\(/ },
  { nombre: "sourceMappingURL publico", regex: /\/\/# sourceMappingURL=.*\.map/ },
];

const EXTENSIONES = new Set([".js", ".mjs", ".css", ".map", ".json", ".html"]);

const recorrer = (directorio) =>
  readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) return recorrer(ruta);
    return ruta;
  });

const raiz = join(process.cwd(), ".next", "static");

let archivo;
try {
  archivo = recorrer(raiz).filter((ruta) => EXTENSIONES.has(ruta.slice(ruta.lastIndexOf("."))));
} catch {
  console.error(
    "[auditar-bundle] No existe .next/static. Corré `npm run build` antes de auditar.",
  );
  process.exitCode = 1;
  process.exit();
}

const hallazgos = [];

/**
 * ⛔ Se comparan los VALORES de `process.env`, no los nombres.
 *
 * Buscar el string "SUPABASE_SERVICE_ROLE_KEY" daria un falso positivo en
 * el server bundle, que es donde Next deja el mapa de variables. Lo que
 * importa es que el valor de la clave no este en un archivo que el
 * navegador baja.
 */
for (const nombre of SECRETO_POR_NOMBRE) {
  const valor = process.env[nombre];
  if (valor === undefined || valor === "") continue;

  for (const ruta of archivo) {
    const contenido = readFileSync(ruta, "utf8");
    if (contenido.includes(valor)) {
      hallazgos.push({ tipo: "secreto", nombre, archivo: relative(process.cwd(), ruta) });
    }
  }
}

for (const ruta of archivo) {
  if (!ruta.endsWith(".js") && !ruta.endsWith(".css")) continue;
  const contenido = readFileSync(ruta, "utf8");
  for (const { nombre, regex } of PATRONES_PROHIBIDOS) {
    if (regex.test(contenido)) {
      hallazgos.push({ tipo: "patron", nombre, archivo: relative(process.cwd(), ruta) });
    }
  }
}

if (hallazgos.length === 0) {
  console.info(`[auditar-bundle] OK: ${archivo.length} archivos, ningun secreto ni patron prohibido.`);
} else {
  console.error(`[auditar-bundle] FALLA: ${hallazgos.length} hallazgos.`);
  for (const h of hallazgos) {
    console.error(`  - [${h.tipo}] ${h.nombre} en ${h.archivo}`);
  }
  // ⛔ Codigo de salida distinto de cero: si sale 0, esto no audita nada.
  process.exitCode = 1;
}
```

El script se ejecuta **después** de `next build`:

```jsonc
// package.json (extracto)
{
  "scripts": {
    // ⛔ `build` primero, `audit:bundle` después: sobre el source el
    //    bundle todavía no existe. Ver §2.5.
    "build": "next build && npm run audit:bundle",
    "audit:bundle": "node scripts/auditar-bundle.mjs",
    "verify:actions": "node scripts/verificar-acciones.mjs"
  }
}
```

### 6.6 El script de verificación de actions

```js
// scripts/verificar-acciones.mjs
// ⛔ Verifica una PROPIEDAD del source, no el comportamiento en runtime.
//    Por eso no necesita base ni navegador. Ver §2.10.
// Salida: 0 si todas las actions verifican, 1 si alguna no.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Archivos que deben contener la verificacion. Todo lo demas se ignora. */
const ACCIONES = ["productos.ts", "categorias.ts", "ajustes.ts"];

/**
 * ⛔ Verifica que `verifyAdminSession` aparezca ANTES de leer el payload.
 *
 * El orden importa y es lo unico que este script comprueba. Una action
 * que valida la sesion despues de mirar el input ya le dijo al cliente
 * cuanta informacion tiene y si el input es invalido.
 */
const verificarOrden = (contenido) => {
  const indiceSesion = contenido.indexOf("verifyAdminSession");
  if (indiceSesion === -1) return { ok: false, motivo: "no llama a verifyAdminSession" };

  const firmas = [...contenido.matchAll(/export\s+const\s+(\w+Action)\s*=/g)].map((m) => m[1]);
  if (firmas.length === 0) return { ok: false, motivo: "no declara ninguna action" };

  for (const firma of firmas) {
    const cuerpo = contenido.slice(contenido.indexOf(`${firma} =`));
    const sesionEnAccion = cuerpo.indexOf("verifyAdminSession");
    const primerParseo = cuerpo.search(/\.parse\(|safeParse\(/);

    if (primerParseo !== -1 && primerParseo < sesionEnAccion) {
      return { ok: false, motivo: `${firma} valida el payload antes de verificar la sesion` };
    }
  }

  return { ok: true, acciones: firmas.length };
};

const directorio = join(process.cwd(), "src", "server", "actions");
const problemas = [];
let total = 0;

for (const archivo of ACCIONES) {
  const contenido = readFileSync(join(directorio, archivo), "utf8");
  const resultado = verificarOrden(contenido);
  total += resultado.acciones ?? 0;

  if (!resultado.ok) problemas.push(`${archivo}: ${resultado.motivo}`);
}

if (problemas.length === 0) {
  console.info(`[verificar-acciones] OK: ${total} actions verificadas en ${ACCIONES.length} archivos.`);
} else {
  console.error(`[verificar-acciones] FALLA: ${problemas.length} problemas.`);
  for (const p of problemas) console.error(`  - ${p}`);
  process.exitCode = 1;
}

readdirSync(directorio); // ⛔ Falla ruidosamente si el directorio no existe.
```

La última línea existe por un motivo concreto: si `src/server/actions/` se renombra o se mueve, el `readFileSync` de arriba ya lanzó una excepción y el mensaje es `ENOENT: no such file or directory`, que no dice nada. Con la línea al final, y si el directorio no existe, el error ocurre antes y el mensaje es el mismo. Por eso la línea **va al final**: es una aserción de que la verificación corrió, no una comprobación.

Lo que el script **no** verifica, y hay que decirlo en el README del propio script: que la action use el resultado de la sesión para autorizar, ni que no haya un `if (session) { /* pasa */ }` que se coma el error. Eso es revisión de código. El script cubre el error de forgets --95% de los casos reales-- y no pretende cubrir el otro 5%.

### 6.7 `allowed_formats` como allowlist

```ts
// src/server/infra/cloudinary.ts (dentro de buildSignedUploadParams)
const params: Record<string, string | number> = {
  timestamp,
  public_id: publicId,
  folder: FOLDER,
  overwrite: "true",
  // ⛔ Allowlist, no blacklist. Ver §2.9.
  //    Cloudinary acepta mp4, mov, pdf, psd, tiff, heic y formatos RAW
  //    si no se los limita. Un `.psd` de 200 MB en la cuenta de las
  //    fotos de producto es un costo y un vector.
  allowed_formats: "jpg,jpeg,png,webp",
  // ⛔ Los limites de la Tarea 06, explicitados otra vez. `max_file_size`
  //    cuenta bytes del archivo; `max_image_size` cuenta pixeles, y son
  //    dos cosas distintas: un PNG de 1 KB puede ser de 100 megapixeles.
  max_file_size: MAX_FILE_SIZE_BYTES,
  max_image_size: MAX_IMAGE_WIDTH * MAX_IMAGE_HEIGHT,
  context: `alt=${alt}`,
};
```

La validación del lado del cliente y la del lado de Cloudinary usan listas distintas a propósito. `validateImageFile` (Tarea 06) acepta `jpg`, `jpeg`, `png` y `webp` en el `accept` del input; la lista de Cloudinary es la que manda, porque es la que el usuario puede saltarse.

### 6.8 CHECK de precio no negativo en la base

```sql
-- supabase/migrations/20250120000001_precio_no_negativo.sql
--
-- ⛔ La validacion de Zod alcanza para el formulario. Este CHECK alcanza
--    para todo lo demas: un script, un import, una query escrita a mano,
--    o la Tarea 19 misma. Ver §9.3.

alter table public.products
  drop constraint if exists productos_precio_no_negativo;

alter table public.products
  add constraint productos_precio_no_negativo
  check (price >= 0);

alter table public.product_variants
  drop constraint if exists variantes_precio_no_negativo;

alter table public.product_variants
  add constraint variantes_precio_no_negativo
  check (price >= 0);
```

`price` es un `Decimal` en Prisma, y un `Decimal` negativo pasa la validación de Zod sólo si el input viene de un lugar que Zod no ve. La CHECK es la red de abajo.

### 6.9 `docs/seguridad.md`

```markdown
# Seguridad de Mi Negocio

## 2FA (obligatorio para OWNER)

- Estado: **pendiente de activar en el panel de Supabase**. No hay código.
- Por qué no hay código: `verifyAdminSession` no cambia. Sigue devolviendo
  `null` o una sesión válida, y el segundo factor se verifica en la action
  de login, que es el único lugar donde tiene sentido.
- Qué se hace: en Supabase → Authentication → Factors → TOTP, se activa
  para los dos usuarios OWNER. STAFF puede seguir sin 2FA.
- Qué se verifica: un OWNER que entra sin el segundo factor no llega al
  panel, y el intento queda registrado en el log de Auth de Supabase.

## CAPTCHA y rate limiting

- Supabase Auth trae rate limiting en `/token?grant_type=password`. Es la
  única capa valida en serverless: un limitador en memoria de Node se
  persiste por instancia y no protege nada con varias funciones.
- Qué se hace: activar CAPTCHA en el panel de Supabase y revisar la
  configuración de rate limiting por proyecto.
- ⛔ Si el rate limiting está en "none", el panel queda abierto a fuerza
  bruta sin ninguna otra defensa. Es la primera cosa que se revisa.

## Cookies de sesión

- El nombre se construye con `buildSupabaseCookieName`, de la Tarea 07.
  No hay dos cookies con dos nombres distintos.
- La cookie de refresh se renueva en `middleware.ts` y sólo ahí.
- ⛔ Si aparece una segunda cookie de sesión en el navegador, hay una
  llamada a `supabaseServer()` con `setAll` fuera del middleware.

## Rotación de secretos

- Orden de rotación, en este orden y no en otro:
  1. `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` (en el panel de Cloudinary)
  2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (en el panel de Supabase)
  3. La contraseña de la base, con una migración de Supabase
- Tras cada rotación: `npm run build` y `npm run audit:bundle`. El build
  regenera el bundle y la auditoría confirma que el secreto nuevo no quedó
  compilado adentro.

## Si se filtró una clave

1. Rotar **primero**. La clave expuesta se considera comprometida aunque
   haya estado en un `.next` local.
2. Revocar el token de sesión de todos los usuarios (panel de Supabase).
3. `npm run audit:bundle` para confirmar que la clave nueva tampoco quedó
   en el bundle.
4. Si fue la `service_role`: revisar `products`, `business_settings` y
   `staff_members` con fecha de modificación reciente.
5. Anotar qué se filtró, cuándo y dónde. Sin el registro, la rotación se
   repite cada vez que alguien tiene miedo.

## Lo que este proyecto NO tiene

- WAF ni CDN propio. Vercel hace de borde y punto.
- Hash de contraseñas propio. Supabase Auth.
- Backups de la base gestionados por nosotros. Los de Supabase, y el
  runbook de la Tarea 21 dice cómo restaurarlos.
```

### 6.10 Verificación

```bash
npm run lint && npm run typecheck && npm run test

# ⛔ Los dos scripts tienen que pasar. Y si alguno no existe, el comando
#    falla, que es lo que tiene que pasar.
npm run verify:actions
npm run build
npm run audit:bundle

# ⛔ Las tres afirmaciones de §2.2, sobre el source
rg -n "from \"@/server/infra/supabase/admin\"" src/components src/app --glob '*.tsx' || echo "OK: admin client fuera de la UI"
rg -n "NEXT_PUBLIC_" .env.example
rg -c "service_role" .next/static -r '' 2>/dev/null || echo "OK: service_role ausente del bundle"
```

Manuales:

1. Con la `anon` key, el `curl` de §6.2: escritura `403`, `staff_members` `[]`.
2. Logueado como STAFF, `/admin` sigue funcionando y el switch de disponibilidad sigue llegando por Realtime.
3. DevTools → Network → filtrar por `WS`: el canal `catalog-availability` sigue recibiendo eventos al marcar un producto desde otra pestaña.
4. `<img src=x onerror=alert(1)>` en un producto: la CSP aparece en consola como **violación reportada**, y el `alert` no se ejecuta.
5. `curl -I https://<preview-url>`: los seis headers, **sin** `Strict-Transport-Security`.
6. `curl -I https://<dominio-real>`: los seis headers, con HSTS.
7. Subir un `.svg` renombrado a `.jpg` con la firma de la Tarea 06: Cloudinary lo rechaza por el allowlist, y si pasara, `assertUploadedImageIsUsable` lo rechaza.
## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `es_usuario_del_staff()` | `supabase/migrations/<timestamp>_rls_y_lectura_realtime.sql` | La política de `products`. Nadie más |
| `productos_lectura_staff_disponibilidad` | idem | `postgres_changes` del panel |
| `staff_lee_su_propia_fila` | idem | Una futura pantalla de perfil |
| `productos_precio_no_negativo` | `<timestamp>_precio_no_negativo.sql` | La base, no el código |
| `AdminAuditEvent`, `AuditActor`, `AuditFields` | `src/server/infra/audit-log.ts` | Las nueve actions de escritura |
| `logAdminAction(evento, actor, fields)` | idem | Las nueve actions de escritura |
| `construirCsp()` | `src/middleware.ts` | El middleware. No se exporta: nadie más lo necesita |
| `construirHeaders()` | idem | idem |
| `SECRETO_POR_NOMBRE`, `PATRONES_PROHIBIDOS` | `scripts/auditar-bundle.mjs` | El propio script |
| `verificarOrden(contenido)` | `scripts/verificar-acciones.mjs` | El propio script |
| `buildSupabaseCookieName()` | `src/server/infra/supabase/cookie-name.ts` (Tarea 07) | La auditoría de cookies de `docs/seguridad.md`. **No** el middleware (§8.3) |

**Contratos que esta tarea define y no existían:** la función SQL, las dos políticas, el CHECK de precio, `logAdminAction` y sus tipos, los dos scripts y el documento. **Contratos que consume y no toca:** `verifyAdminSession`, `supabaseAdmin`, `signCloudinaryParams`, `buildCloudinaryImageUrl` y todo el middleware que ya existía.

### 7.1 El tipo de `AuditFields` y por qué no es un objeto libre

```ts
// src/server/infra/audit-log.ts (extracto)
export type AuditFields =
  | (AuditCommon & { readonly campos?: readonly string[] })
  | (AuditCommon & { readonly slug?: string; readonly nombre?: string })
  | (AuditCommon & { readonly camposEditados: readonly string[] })
  | AuditCommon;
```

El union tiene tres formas porque las acciones escriben cosas distintas:

- `producto.creado` y `categoria.creada` registran `nombre`.
- `producto.actualizado` y `ajustes.actualizados` registran `camposEditados`, que es la lista de claves que cambiaron y **no** sus valores. Los valores de un formulario de producto incluyen precios y URLs de imagen; los campos que cambiaron alcanzan para reconstruir qué pasó, y no exponen qué había antes.
- `producto.archivado` y `producto.disponibilidad` registran sólo `entity` y `entityId`.

`camposEditados` se arma comparando el `input` contra la fila leída, no con `Object.keys(input)`: el formulario manda todos los campos aunque el usuario sólo toco uno, y un log lleno de campos que no cambiaron no dice nada.

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [x] Con la `anon` key, un `POST` a `/rest/v1/products` devuelve `401` o `403`
- [x] Con la `anon` key, un `GET` a `/rest/v1/staff_members` devuelve `[]`
- [x] Con la `anon` key, un `GET` a `/rest/v1/products` devuelve `[]`
- [x] RLS está habilitado en las cinco tablas: `products`, `categories`, `product_variants`, `business_settings`, `staff_members`
- [ ] El panel sigue funcionando completo después de aplicar la migración, sin un solo 500
- [ ] El switch de disponibilidad sigue recibiendo eventos por Realtime con RLS activo
- [ ] Un usuario `STAFF` autenticado recibe eventos de disponibilidad; uno que no es staff, no
- [ ] `curl -I` contra una ruta de producción devuelve los seis headers
- [ ] `curl -I` contra un preview devuelve los seis headers **sin** HSTS
- [x] Un `POST` directo a la base con un `price` negativo falla con el CHECK
- [x] `npm run audit:bundle` pasa sobre el build real
- [x] `npm run verify:actions` pasa y reporta las nueve actions
- [ ] Un `.svg` firmado a Cloudinary es rechazado por la API, no por el cliente
- [x] Las nueve actions de escritura dejan un registro con el evento, el actor y la entidad

### 8.2 Calidad

- [x] `npm run lint`, `npm run typecheck` y `npm run test` pasan sin errores ni warnings
- [x] Los archivos respetan los topes de §5.7
- [x] No se agregó ninguna dependencia a `package.json`
- [x] La migración se aplicó dos veces en un ambiente de prueba sin error
- [x] `pg_policies` muestra exactamente dos políticas: una en `products` y una en `staff_members`
- [x] Los dos scripts salen con código `1` cuando hay un hallazgo, y con `0` cuando no
- [ ] Los dos scripts no tienen `export`
- [x] `AuditFields` es un union, no `Record<string, unknown>`
- [x] Ningún log imprime el payload de una action
- [ ] `construirCsp()` y `construirHeaders()` no se exportan del middleware
- [x] `docs/seguridad.md` tiene las cinco secciones: 2FA, CAPTCHA, cookies, rotación y filtrado
- [x] La lista de secretos de `auditar-bundle.mjs` tiene los cuatro nombres de §2.5

### 8.3 Arquitectura — verificación obligatoria

- [x] `supabaseAdmin` **no** se importa desde `src/components/**` ni desde ningún `page.tsx`
- [x] Ningún archivo de `src/` lee `process.env.SUPABASE_SERVICE_ROLE_KEY` fuera de `src/server/infra/supabase/`
- [x] `buildSupabaseCookieName` **no** se importa en `middleware.ts` (Tarea 07 §6.6 ya lo decidió)
- [x] `force row level security` **no** está en ninguna migración
- [x] La política de `products` **no** usa `auth.jwt() ->> 'role'`
- [x] El permiso de lectura de `products` es por columnas, no sobre la tabla
- [x] El `revoke all` precede al `grant` en las cinco tablas
- [x] RLS se habilita **después** de crear las políticas, dentro de la misma migración
- [x] `es_usuario_del_staff()` declara `security definer` y `set search_path = ''`
- [x] `logAdminAction` se llama **después** del servicio y **antes** del `revalidateTag`
- [x] `logAdminAction` no se importa desde ningún Client Component
- [x] Los dos scripts no se importan desde el código de la aplicación
- [x] `scripts/verificar-acciones.mjs` **no** se conecta a la base ni al navegador
- [x] Los headers se agregan en `middleware.ts`, no en `next.config.ts` (salvo `/_next/static`)
- [x] `next.config.ts` sólo declara `nosniff` para `/_next/static`
- [x] Ningún archivo nuevo es `utils.ts` ni `helpers.ts`
- [x] `middleware.ts` no pasó los 220 líneas de §5.7

### 8.4 Pruebas

- [x] `verificarOrden` acepta un archivo con las nueve actions en el orden correcto
- [x] `verificarOrden` rechaza un archivo sin `verifyAdminSession`
- [x] `verificarOrden` rechaza un archivo que valida el payload antes de la sesión
- [x] `verificarOrden` detecta una action nueva que no verifica
- [x] Hay un test que verifica que `logAdminAction` no imprime un valor del payload
- [x] Hay un test que verifica que los `headers` incluyen HSTS en producción y no fuera de ella
- [x] Hay un test que verifica que la CSP incluye `wss://*.supabase.co` en `connect-src`
- [x] Hay un test que verifica que la CSP no incluye `unsafe-eval`
- [x] `allowed_formats` es exactamente `jpg,jpeg,png,webp`, sin formatos de video
- [x] `max_file_size` y `max_image_size` están en los parámetros firmados
- [x] Un `readdirSync` sobre un `.next/static` inexistente falla con un mensaje que dice que hay que buildear
- [x] `npm run test` y `npm run verify:actions` pasan

### 8.5 Seguridad

- [x] RLS está habilitado en las cinco tablas y `pg_class.relrowsecurity` es `true` en las cinco
- [x] El rol `anon` no tiene ningún permiso de escritura en ninguna tabla
- [x] El rol `anon` no tiene `SELECT` sobre `products`, `categories`, `product_variants`, `business_settings` ni `staff_members`
- [x] El payload de Realtime sólo puede contener `id` e `is_available`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` no aparece en ningún archivo de `.next/static`
- [ ] `CLOUDINARY_API_SECRET` no aparece en ningún archivo de `.next/static`
- [x] La única cabecera de CSP que se emite es `Content-Security-Policy-Report-Only`; `Content-Security-Policy` en modo bloqueante **no** existe todavía (§6.3)
- [x] `unsafe-eval` **no** está en ninguna directiva de la CSP
- [x] HSTS sólo se emite con `NODE_ENV === "production"`
- [x] `frame-ancestors 'none'` está en la CSP **y** `X-Frame-Options: DENY` está en los headers: la primera para navegadores modernos, la segunda para los que no la implementan
- [x] `object-src 'none'` y `base-uri 'self'` están en la CSP
- [x] Ninguna action escribe sin la sesión verificada en la misma llamada
- [x] El log no contiene emails, teléfonos, tokens ni el payload de ninguna action
- [x] `price >= 0` está en la base, no sólo en Zod

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado | Por qué |
|---|---|---|
| La migración se aplica dos veces | Sin error | Es idempotente. Una migración que corre una vez y falla la segunda hace que nadie la aplique en otro ambiente |
| RLS se aplica y el panel deja deactualizar disponibilidad | **Fallo de diseño, no un caso borde**: significa que el permiso por columnas no llegó antes del `enable` | Es el síntoma de §2.4. El `curl` de §6.2 con la sesión de un STAFF lo detecta antes de que lo vea un usuario |
| Prisma empieza a recibir `infinite recursion detected in policy` | La política consulta `staff_members` sin `security definer` | La función existe justamente para eso. Ver §5.2 |
| El sitio entero tira 500 al aplicar la migración | Alguien agregó `force row level security` | Prisma conecta con el rol del proyecto, que no es un usuario autenticado de Supabase, y `auth.uid()` devuelve `null`. Ver §6.1 |
| Un `POST` a PostgREST con la `anon` key devuelve `200` con `[]` en vez de `403` | Pass-through silencioso | Significa que hay un permiso de escritura que no se revocó. El `curl` de §6.2 lo muestra |
| Un `GET` a `products` con la `anon` key devuelve los productos | La política de lectura se:applyó al rol equivocado o el `grant` de columnas no se puso | El catálogo público ya sale del servidor. Cualquier lectura por PostgREST es una fuga |
| La CSP bloquea el Worker de subida de Cloudinary | El `connect-src` o el `script-src` no incluyen lo que necesita | Se ve en la consola como violación, y el síntoma es que no se puede subir una foto. `blob:` está en `script-src` por eso |
| La CSP bloquea la conexión de Realtime | `wss://*.supabase.co` no está en `connect-src` | Sin error visible: el canal se abre y no llegan eventos. Es el mismo síntoma de §2.4 con otra causa |
| El navegador reporta violaciones de CSP pero el sitio funciona | Es el comportamiento esperado en report-only | Por eso se empieza así. Las violaciones se cuentan antes de bloquear |
| `npm run audit:bundle` corre sin `.next/static` | Falla con "corré `npm run build` primero" | Un script que pasa porque no encontró nada es peor que un script que no existe |
| El bundle no tiene secretos pero el script no encuentra los archivos | Falla, no pasa | `statSync` sobre un directorio inexistente lanza. El mensaje dice qué hacer |
| Aparece un `eval` en un chunk de un proveedor | Falla la auditoría | Con `script-src` sin `unsafe-eval`, ese chunk ya no funciona en el navegador. Es un hallazgo real |
| Un `.svg` renombrado a `.jpg` se sube a Cloudinary | Cloudinary lo rechaza por el allowlist; si pasara, `assertUploadedImageIsUsable` lo rechaza | Dos verificaciones independientes por formato y por contenido |
| La CSP rompe una previsualización de imagen de `next/og` | `img-src` no incluye el origen que hace falta | `next/og` sirve desde el mismo origen, así que no debería pasar. Si pasa, el origen está en el reporte |
| Alguien agrega una action nueva sin `logAdminAction` | `verify:actions` **no** lo detecta | El script verifica la sesión, no el log. El log se verifica revisando el diff. Ver §2.10 |
| Alguien agrega una action nueva sin `verifyAdminSession` | `verify:actions` falla el build | Es el 95% de los casos reales. Ver §6.6 |
| El 2FA se activa y un OWNER sin el segundo factor intenta entrar | Supabase rechaza la segunda etapa | `verifyAdminSession` no cambia: sigue devolviendo `null` o una sesión válida. Ver `docs/seguridad.md` |
| Se filtra la `service_role` | Se rota primero, se revisan las tablas, se registra | El procedimiento completo está en `docs/seguridad.md`. Rotar al final deja la ventana abierta |
| Un backup se restaura y las políticas RLS no vienen | El catálogo no muestra productos | Las políticas son parte del esquema y viajan en el dump. Si no vienen, el dump es de otra base |

### 9.1 La deuda que queda escrita

Cuatro cosas que esta tarea deja a propósito:

- **`'unsafe-inline'` en `script-src` y `style-src`.** La CSP actual no frena un XSS, que es justo lo que se le pide a una CSP. La salida es nonces por request, que en App Router requiere mover la CSP al servidor y no al middleware. Es un trabajo real y no un `if`. Anotado para después del go-live.
- **`/api/csp-report` no existe.** El `report-uri` apunta a una ruta que responde 404. Los reportes no llegan a ningún lado hasta que la Tarea 21 lo cree. La CSP en report-only sigue siendo útil porque el navegador también la muestra en la consola.
- **`revoke` de permisos de la `anon` key.** Hay una forma más fuerte: borrar la `anon` key del proyecto y usar la `service_role` en el cliente, que es peor. La forma correcta --rotar la `anon` key, que es pública por diseño-- no cambia nada acá.
- **2FA con `verifyAdminSession`.** La Tarea 07 §12 dice que `verifyAdminSession` no cambia. Sigue siendo cierto: el segundo factor se verifica en la action de login, no en la sesión. Cuando exista un factor por sesión --"recordarme"--, la verificación se suma ahí.

### 9.2 Por qué no hay un rate limiter propio

Un limitador en memoria vive en el proceso de una función serverless. Con veinte instancias, cada una tiene su propio contador, y el límite real es veinte veces el configurado. Con contenedores que se reinician, el contador se pone en cero. El resultado es un limitador que parece funcionar en local y no hace nada en producción.

La defensa real ya existe y no es código: Supabase Auth limita `/token?grant_type=password` por IP y por usuario. Lo que esta tarea agrega es verificar que esté activo y agregar CAPTCHA, que es configuración del panel.

Escribirlos en `docs/seguridad.md` y no en el código es la decisión correcta por una razón que va más allá de la técnica: un limitador escrito a mano que alguien active y que nunca se configure bien es un riesgo nuevo, no una mitigación.

### 9.3 Por qué el CHECK de precio y no sólo Zod

Hay cuatro caminos para escribir un producto en esta base:

1. `createProductAction`, que valida con `ProductoAltaSchema`.
2. `updateProductAction`, que valida con `ProductoEdicionSchema`.
3. El seed de la Tarea 05, que escribe directo con Prisma.
4. El panel de Supabase, que cualquiera con acceso al proyecto puede abrir y escribir a mano.

El CHECK cubre los cuatro. La validación de Zod cubre uno. Con un panel de Supabase abierto a dos personas y un producto cuyo precio está en producción, el cuarto camino no es teórico: es la tarde en que alguien corrige un precio y tipea el signo de menos.

Un precio negativo no es un bug visible: el producto aparece en el menú con `-450` y nadie lo reporta hasta que alguien intenta pedir. La CHECK es la red de abajo, y por eso va en la base y no en el servicio.

---

## 10. Pruebas

### 10.1 El test que verifica el orden de las actions

```ts
// tests/unit/acciones-orden.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verificarOrden } from "../../scripts/verificar-acciones.mjs";

const contenidoDeAcciones = (nombre: string) =>
  readFileSync(join(process.cwd(), "src/server/actions", nombre), "utf8");

describe("orden de verificación de sesión", () => {
  it("acepta una action que verifica la sesión antes de leer el payload", () => {
    const resultado = verificarOrden(`
      export const crearAction = async (raw) => {
        const session = await verifyAdminSession();
        if (session === null) return { ok: false };
        const parsed = Schema.parse(raw);
        return { ok: true };
      };
    `);

    expect(resultado.ok).toBe(true);
  });

  it("rechaza una action que valida el payload antes de verificar la sesión", () => {
    const resultado = verificarOrden(`
      export const crearAction = async (raw) => {
        const parsed = Schema.parse(raw);
        const session = await verifyAdminSession();
        return { ok: parsed.ok && session !== null };
      };
    `);

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain("antes de verificar");
  });

  it("las tres acciones reales verifican antes de parsear", () => {
    for (const archivo of ["productos.ts", "categorias.ts", "ajustes.ts"]) {
      expect(verificarOrden(contenidoDeAcciones(archivo)).ok, archivo).toBe(true);
    }
  });
});
```

El tercer test lee los archivos reales. Es un test estructural, y por eso vive en `tests/unit/` con los demás y no en un script suelto: si alguien rompe el orden de una action, falla la suite y no sólo el pipeline.

El import de un `.mjs` desde un `.ts` de test funciona porque el script no tiene exports de tipo y Vitest lo resuelve. Si alguna vez hay que convertirlo a `.ts`, este import pasa a ser un `import type` y el cuerpo de `verificarOrden` se queda en el script.

### 10.2 El log no imprime el payload

```ts
// tests/unit/audit-log.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { logAdminAction } from "@/server/infra/audit-log";

const actor = { actorId: "u1", actorEmail: "ana@modomiga.com.ar", actorRole: "OWNER" as const };

describe("logAdminAction", () => {
  afterEach(() => vi.restoreAllMocks());

  it("registra el evento, el actor y la entidad", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logAdminAction("producto.creado", actor, { entity: "producto", entityId: "p1", nombre: "Jamon y queso" });

    // ⛔ Un solo argumento estructurado. Un console.info con interpolación
    //    obliga a parsear texto en el agregador de logs.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe("[admin]");
    expect(spy.mock.calls[0][1]).toMatchObject({
      evento: "producto.creado",
      actorId: "u1",
      actorRole: "OWNER",
      entity: "producto",
      entityId: "p1",
    });
  });

  it("no imprime el email del actor ni ningún valor del payload", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logAdminAction("producto.actualizado", actor, {
      entity: "producto",
      entityId: "p1",
      camposEditados: ["price", "imageUrl"],
    });

    const serializado = JSON.stringify(spy.mock.calls[0][1]);
    expect(serializado).not.toContain("ana@modomiga.com.ar");
    // ⛔ Los NOMBRES de los campos editados sí van. Los valores no.
    expect(serializado).toContain("price");
  });
});
```

El segundo test es el que importa. El `actorEmail` está en la interfaz `AuditActor` y deliberadamente no en el log: un agregador de logs de terceros con emails de empleados es un problema de datos personales que no aporta nada a la auditoría.

### 10.3 Los headers

```ts
// tests/unit/security-headers.test.ts
import { afterEach, describe, expect, it } from "vitest";

/** ⛔ Se relee el módulo con el entorno cambiado: `NODE_ENV` se lee al
 *    importar, y en el test importa que las dos ramas se ejecuten. */
const importarHeaders = async (entorno: string) => {
  vi.resetModules();
  process.env.NODE_ENV = entorno;
  return import("@/middleware");
};

describe("headers de seguridad", () => {
  afterEach(() => {
    process.env.NODE_ENV = "test";
    vi.resetModules();
  });

  it("emite los seis headers en producción, HSTS incluido", async () => {
    const { construirHeaders } = await importarHeaders("production");
    const headers = construirHeaders();

    expect(headers["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Content-Security-Policy-Report-Only"]).toContain("frame-ancestors 'none'");
  });

  it("omite HSTS fuera de producción", async () => {
    const { construirHeaders } = await importarHeaders("preview");
    const headers = construirHeaders();

    // ⛔ Ver §2.6: HSTS con includeSubDomains en un preview rompe el
    //    sitio durante un año para quien lo haya visitado.
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("omite HSTS en producción si el dominio real no está resuelto", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const { construirHeaders } = await importarHeaders("production");

    // ⛔ Sin dominio no hay nada que proteger con HSTS, y prometerlo
    //    sobre un host equivocado es peor que no prometerlo.
    expect(construirHeaders()["Strict-Transport-Security"]).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it("no emite CSP bloqueante todavía", async () => {
    const { construirHeaders } = await importarHeaders("production");
    const headers = construirHeaders();

    // ⛔ La etapa 3 de §6.3. Este test se cambia a la vez que la
    //    línea, y ese es el punto: que no se prenda sola.
    expect(headers["Content-Security-Policy"]).toBeUndefined();
    expect(headers["Content-Security-Policy-Report-Only"]).toBeDefined();
  });
});
```

Si `construirHeaders` no se exporta del middleware, este test no puede importarlo. Por eso el test la pide como **named export de prueba** o, mejor, el helper de headers se extrae a `src/server/infra/security-headers.ts` y el middleware lo llama. La segunda opción es la que se implementa: mantiene el middleware por debajo del tope de §5.7 y hace que los headers sean testeables sin levantar un request.

`vi.resetModules()` es lo que hace que las dos ramas funcionen. Sin él, el segundo `import` devuelve el módulo cacheado del primero, con el `NODE_ENV` viejo, y el test pasa sin probar nada.

### 10.4 `allowed_formats` no acepta video

```ts
// tests/unit/cloudinary-params.test.ts
import { describe, expect, it } from "vitest";
import { buildSignedUploadParams } from "@/server/infra/cloudinary";

describe("parámetros firmados de subida", () => {
  it("es un allowlist, no una blacklist", () => {
    const params = buildSignedUploadParams({
      publicId: "modo-miga/products/café",
      timestamp: 1_700_000_000,
      alt: "Café de la casa",
    });

    // ⛔ Ver §2.9. La lista es exactamente esta: cuatro formatos de
    //    imagen y nada más.
    expect(params.allowed_formats).toBe("jpg,jpeg,png,webp");

    for (const prohibido of ["mp4", "mov", "pdf", "psd", "tiff", "heic", "svg"]) {
      expect(params.allowed_formats).not.toContain(prohibido);
    }
  });

  it("declara los dos límites de tamaño", () => {
    const params = buildSignedUploadParams({
      publicId: "modo-miga/products/café",
      timestamp: 1_700_000_000,
      alt: "Café de la casa",
    });

    // ⛔ `max_file_size` son bytes; `max_image_size` son pixeles. Son dos
    //    límites distintos y hacen falta los dos.
    expect(params.max_file_size).toBeGreaterThan(0);
    expect(params.max_image_size).toBeGreaterThan(0);
  });
});
```

### 10.5 Verificación manual

Los cinco pasos de §6.10, en este orden:

1. `npm run verify:actions` con las nueve actions reales: nueve, todas en orden.
2. `npm run build` completo, con `audit:bundle` al final: sin hallazgos.
3. El `curl` de §6.2 con la `anon` key: `403` al escribir, `[]` al leer `staff_members` y `products`.
4. El `curl -I` de producción y de preview: los seis headers, HSTS sólo en producción.
5. El switch de disponibilidad en dos pestañas, con RLS activo: el evento llega en menos de 2 segundos.

El paso 5 es el que nadie quiere hacer y el que más importa. Todos los demás son `curl`; ése verifica que la migración no rompió la única funcionalidad en tiempo real del proyecto.

---

## 11. Definición de "Hecho" (Definition of Done)

- [ ] Los criterios 8.1 a 8.5 están marcados, cada uno verificado y no de memoria
- [x] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run audit:bundle` y `npm run verify:actions` pasan
- [x] `pg_class.relrowsecurity` es `true` en las cinco tablas
- [x] `pg_policies` tiene exactamente dos políticas
- [x] La migración se aplicó dos veces sin error
- [ ] El `curl` de §6.2 se ejecutó con la `anon` key real, no con una inventada
- [ ] La verificación manual de §10.5 se hizo completa, con las dos pestañas abiertas
- [ ] `NEXT_PUBLIC_SITE_URL` y el resto de las variables están en el ambiente de Vercel
- [x] `docs/seguridad.md` está escrito y el runbook de la Tarea 21 lo referencia
- [x] `docs/tasks/README.md` marca la Tarea 19
- [x] La deuda de §9.1 está anotada: `'unsafe-inline'`, `/api/csp-report`, `revoke` de la `anon` key, 2FA

### Fuera de alcance de esta tarea

- **WAF, CDN propio o WAF de Supabase.** Vercel y Supabase ya están en el borde. Agregar una capa más es un costo mensual y una fuente más de reglas que nadie va a revisar.
- **Rotación automática de secretos.** Es un procedimiento con pasos manuales, y un cron que rota una clave de base rompe más de lo que arregla. Está en `docs/seguridad.md` como procedimiento.
- **Cifrado de columnas.** La base no tiene datos que justifiquen el costo de complejidad. Los precios son públicos y los emails de los clientes no están en esta base.
- **Backups.** Los de Supabase, y la Tarea 21 escribe el procedimiento de restauración.
- **Un parser de AST para `verificar-acciones.mjs`.** Un regex sobre el source es suficiente para el 95% de los casos (§6.6), y un parser es una dependencia que hay que mantener.
- **Auditoría de dependencias (`npm audit`).** Es de la Tarea 20, que ya va a tocar el pipeline de tests.
- **Autenticación de dos factores en el código.** Ver `docs/seguridad.md`: es configuración del panel, no código.

---

## 12. Dependencias y bloqueos

### 12.1 Depende de

| Tarea | Qué aporta | Qué pasa si falta |
|---|---|---|
| **07** | `verifyAdminSession`, `supabaseAdmin`, `buildSupabaseCookieName`, la decisión del rol fuera del JWT | La política de RLS no tiene forma de saber si el usuario es del staff, y no hay action que auditar |
| **04** | El patrón de repositorio y el rol con el que conecta Prisma | Sin saber qué rol usa `DATABASE_URL`, no se puede escribir la nota de por qué no se usa `force row level security` |
| **06** | `buildSignedUploadParams`, `assertUploadedImageIsUsable`, `MAX_FILE_SIZE_BYTES` | El allowlist de formatos se agrega sobre una función que no existe |
| **16** | Las tres actions de producto que hay que auditar | El log empieza por la mitad |
| **17** | Las seis actions de categoría y ajustes | El log tiene seis huecos y el script verifica seis de nueve |
| **02** | La convención de `server-only` y de las variables `NEXT_PUBLIC_*` | Sin la barrera de `server-only` no hay nada que auditar en el bundle: el secreto ya está en el cliente |
| **01** | `next build`, ESLint y el script de `verify` | No hay dónde colgar `audit:bundle` |

### 12.2 Habilita a

| Tarea | Qué usa de acá |
|---|---|
| **20** | Los dos scripts como parte del pipeline de CI, y la estructura de `tests/unit/` donde caen los tests estructurales de esta tarea |
| **21** | `docs/seguridad.md`, el checklist de despliegue con la verificación de RLS, el endpoint de reportes de CSP, la rotación de secretos y el runbook de restauración |

### 12.3 Bloqueos de esta tarea

- **La decisión sobre RLS y Realtime.** Es la única parte de esta tarea donde una decisión mal tomada rompe el producto, y no hay vuelta atrás sin revertir la migración. Por eso §2.4 y §6.1 existen con tanto detalle, y por eso el paso 5 de §10.5 no es opcional.
- **El dominio de producción.** HSTS y `includeSubDomains` sólo tienen sentido con un dominio real. Sin él, esta tarea se aplica entera menos el HSTS, y queda pendiente para la Tarea 21.
- **La Activación de CAPTCHA y 2FA en Supabase.** Es configuración del panel y no se puede hacer desde el código. Está escrito, revisado y sin ejecutar.

### 12.4 Riesgos

| Riesgo | Mitigación |
|---|---|
| Habilitar RLS rompe el Realtime y nadie lo nota hasta que un producto queda agotado en el menú | El `grant` por columnas antes del `enable`, el `curl` con sesión de §6.2 y el paso 5 de §10.5 |
| Alguien usa `auth.jwt() ->> 'role'` en la política | El rol no está en el JWT. La función devuelve `false` siempre y el Realtime deja de funcionar, que es el mismo síntoma. Está en el criterio 8.3 |
| La CSP bloquea el Worker de subida o el WebSocket de Realtime | `blob:` en `script-src` y `wss://` en `connect-src`, y report-only primero |
| `'unsafe-inline'` se queda para siempre y la CSP no sirve para nada | Está anotado como deuda en §9.1 con la salida escrita: nonces por request |
| La auditoría del bundle pasa porque `.next/static` no existe | El script falla con un mensaje que dice que hay que buildear, y `build` encadena la auditoría |
| Un script de verificación se desactualiza y da un falso positivo | Los dos scripts verifican una propiedad estructural y los tests de §10.1 los cubren. Un falso positivo se ve en el primer build y se arregla |
| La migración se aplica en producción sin el paso de verificación | El `curl` de §6.2 y las dos queries de §6.2 están en el checklist de la Tarea 21 |

---

## 13. Registro de ejecución y desviaciones

**Implementada el 2026-10-04.** 28 tests nuevos (59 archivos / 436 tests en
verde), migración aplicada y ejercitada contra Postgres 17 en Docker, y
`lint + typecheck + test + verify:actions + build + audit:bundle` en verde.

### 13.1 Qué se verificó y cómo

| Criterio | Verificación real |
|---|---|
| RLS en las cinco tablas, sin FORCE | `pg_class.relrowsecurity = t` y `relforcerowsecurity = f` en las cinco |
| `pg_policies` muestra exactamente dos | Una en `products`, una en `staff_members`, ambas `FOR SELECT TO authenticated` |
| Permiso de `products` por columnas | `information_schema.column_privileges` → `id,isAvailable`. Cero permisos de TABLA |
| `anon` no tiene nada | Cero permisos de tabla y de columna en las cinco; `SELECT` como `anon` → `permission denied` |
| Un `STAFF` ve sólo el par | `SET ROLE authenticated` + claim del staff → 1 fila con `(id, isAvailable)` |
| Un `authenticated` que no es staff | 0 filas en `products` |
| `name` no es legible | `SELECT name FROM products` como `authenticated` → `permission denied` |
| Escritura bloqueada | `INSERT INTO products` como `authenticated` → `permission denied` |
| `staff_members` sólo la fila propia | 1 fila (la suya) y `INSERT` denegado |
| `business_settings` inaccesible | `SELECT count(*)` como `authenticated` → `permission denied` |
| La función es `security definer` | `pg_proc.prosecdef = t` y `proconfig = {"search_path=\"\""}` |
| Idempotencia | Aplicada **tres veces** seguidas (una sin shims, dos con ellos) sin error |
| `verify:actions` | 9/9 actions verificadas |
| Detección de secretos | Se plantó una credencial en `.next/static`: `audit:bundle` la encontró y salió con `1`; limpio, salió con `0` |
| Los dos scripts salen con `1` ante un hallazgo | `audit:bundle` con una credencial plantada, y `verificar-acciones` contra un árbol de actions de prueba con una que parsea antes de verificar |
| CHECK de precio | `INSERT` con `price = -1` → `violates check constraint products_price_non_negative`; con `price = 0` entra |

⚠️ Los criterios que **no** se marcaron como cumplidos en §8 son los que
dependen de un Supabase real: el Realtime con `wal_level=logical`, el `curl`
de §6.2 contra un dominio, el panel en el navegador, y los dos que dicen que
`SUPABASE_SERVICE_ROLE_KEY` y `CLOUDINARY_API_SECRET` no aparecen en
`.next/static` — acá esas dos variables valen `REEMPLAZAR_CON_LA_...` y el
auditor las saltea por tener menos de 20 caracteres, así que **no se pueden
verificar sin credenciales reales**. Quedan para el checklist de despliegue
de la Tarea 21. No están verificados: no se dieron por cumplidos.

### 13.2 El SQL del documento no era aplicable tal cual

Cinco cosas del §6.1 no existían en este esquema, y el SQL original fallaba en
la segunda línea:

| El doc dice | Lo que hay | Por qué importa |
|---|---|---|
| `products.is_available` | `"isAvailable"` | Sin comillas, Postgres pliega a minúsculas y la migración muere con `column does not exist` |
| `s.is_active = true` | `staff_members` no tiene esa columna | La baja de una persona es **borrar** la fila, que es lo que ya hace `verifyAdminSession()`. Un `COALESCE(s.is_active, true)` para zafar habría dejado pasar a quien fue dado de baja |
| `staff_members(id, email, role, is_active)` | `(id, email, role)` | Sin `is_active` que no existe, y sin `name`: el directorio del equipo no autentica a nadie |
| `s.id = auth.uid()` | `s.id = auth.uid()::text` | `staff_members.id` es `text` y `auth.uid()` devuelve `uuid`. Sin el cast, no hay operador y la política no se crea |
| `supabase/migrations/<timestamp>...` | `prisma/migrations/20261003184300_rls_y_lectura_realtime/` | El proyecto versiona el esquema con `prisma migrate`. Mismo criterio que la Tarea 15 |

⚠️ La publicación de Realtime que §6.1 menciona **no** se repite: ya la
agrega `20261003134210_realtime_publicacion` de la Tarea 15, y duplicarla da
error de "table already member of publication".

⚠️ `REVOKE ALL ON TABLE` no alcanza para los permisos por **columna** que
dejó una corrida anterior: siguen vivos. La migración recorre
`pg_attribute` y revoca columna por columna antes de conceder. Es la
diferencia entre "no veo `name` porque no me lo dieron" y "no veo `name`
porque nadie lo puede volver a pedir".

### 13.3 La migración corre en un Postgres que no es Supabase

`anon`, `authenticated` y `auth.uid()` son heterogéneos de Supabase. En el
contenedor local no existen, y una migración con `CREATE POLICY ... TO
authenticated` sin guardas muere en la línea 2.

Todo lo que los necesita quedó detrás de un `EXISTS` sobre `pg_roles` y un
`to_regprocedure('auth.uid()')`, con `check_function_bodies` apagado sólo
durante la creación. En local quedan RLS habilitado y sin políticas:
fail-closed para `authenticated` y la app sigue funcionando porque el dueño de
las tablas no está sujeto a RLS sin FORCE. En Supabase entra todo.

Se verificó de las dos maneras: primero sobre el Postgres pelado, después
creando `anon`, `authenticated` y un `auth.uid()` que lee
`request.jwt.claim.sub` (como el de Supabase), y sólo entonces corrieron los
siete escenarios de la tabla de arriba.

### 13.4 `verificar-acciones.mjs` SÍ exporta

§5.4 dice que los scripts de `scripts/` no se importan, y §10.1 pide un test
que importe `verificarOrden`. Las dos cosas no pueden ser ciertas.

Se eligió exportar: un test que reimplementa la verificación no verifica
nada. Lo que se conserva del requisito es lo importante — la aplicación
**nunca** importa los scripts (`rg "verificar-acciones" src/` → cero)— y el
`main()` está guardado detrás de `import.meta.url`, así que importarlo desde
un test no ejecuta la verificación de la línea de comandos.

Se agrega `scripts/verificar-acciones.d.mts` para que `tsc --noEmit` lo tipar en
el test en vez de tratarlo como `any`.

⚠️ Consecuencia: el criterio "los dos scripts no tienen `export`" queda
**incumplido a propósito** para `verificar-acciones.mjs`. `auditar-bundle.mjs`
sí cumple: sin exports.

### 13.5 El regex de la verificación necesitó el nombre del parámetro

La lista de señales de §6.6 es `.parse(` / `.safeParse(` / `formData` /
`.get(`. Con esa lista, `archiveProductAction` —que valida con `typeof` y
`.trim()`, sin Zod— se declaraba "sin acceso al payload", es decir, se daba
por buena sin haber mirado nada.

El script captura ahora el nombre del primer parámetro y lo cuenta como
señal: el parámetro es la entrada no confiable y su primera aparición en el
cuerpo es el acceso. Un archivo con una action sin parámetros y sin parseo se
marca como **no verificable** en lugar de darse por bueno.

### 13.6 La allowlist de Cloudinary era decorativa

`allowed_formats`, `max_file_size` y `max_image_size` se calculaban, se
firmaban... y no se mandaban. Cloudinary valida que el conjunto de parámetros
que recibe sea el que la firma cubre: un parámetro firmado que no llega es un
`400`, y los límites que no llegan no existen.

Ahora los seis parámetros firmados van en el mismo `FormData` que la firma, en
el navegador (`ProductImageField`) y en la subida del servidor
(`uploadImageAsset`). El Route Handler devuelve los tres nuevos y el cliente
los manda en `snake_case`.

Dos arreglos que salieron de ahí:

- **`max_image_size` valía bytes.** El tope de píxeles es 24 MP y no 6 MB:
  un PNG de 1 KB puede tener 100 megapíxeles y el límite de peso no lo ve.
- **`public_id` llevaba la carpeta adentro y además se mandaba `folder`.**
  Cloudinary arma la ruta como `folder` + `/` + `public_id`, así que los
  assets de la Tarea 06 quedaron en
  `modo-miga/products/modo-miga/products/<slug>`. Ahora `folder` no se manda:
  el `public_id` determinístico de §6.7 ya lo incluye, y el test de
  `image-url.test.ts` sigue fijando ese contrato.

⚠️ Y el arreglo de raíz, que es más interesante que los tres anteriores: la
allowlist del proveedor y la del navegador **no se podían ver**. La de
Cloudinary vivía en `src/server/infra/cloudinary.ts`, que tiene
`import "server-only"`, así que `src/lib/validation/imagen.ts` no podía
importarla — y no la importaba. Dos listas del mismo contrato, en dos
módulos de los que ninguna pragma puede cruzar.

Y se habían apartado de verdad, en tres direcciones:

| | JPG | PNG | WebP | AVIF |
|---|---|---|---|---|
| `accept` del campo (§2.9, Tarea 06) | ✅ | ✅ | ✅ | — |
| `ALLOWED_IMAGE_MIME_TYPES` (Tarea 06) | ✅ | ✅ | ✅ | ✅ |
| `allowed_formats` firmado (§6.9, esta tarea) | ✅ | ✅ | ✅ | — |

El `accept` de un `<input type="file">` es una sugerencia para el diálogo,
no un filtro: en Chrome "Elegir todos los archivos" lo ignora. Con eso, un
`.avif` pasaba la validación del navegador —que además le decía al usuario
"Subí una foto JPG, PNG, WebP o AVIF"—, se firmaba, llegaba a Cloudinary y
moría con un `400` opaco en lugar de un mensaje de formulario.

Ahora la lista vive en capa 0 (`ALLOWED_IMAGE_FORMATS`), capa 4 la reexporta
para firmar, y hay un test que asserta el invariante en las dos direcciones:
ningún MIME admitido queda fuera de `allowed_formats`, y ningún formato de
`allowed_formats` es imposible de subir. El test viejo comparaba la lista
contra una constante escrita al lado, así que no podía detectar el
apartamiento; este compara contra la lista del otro lado del sistema.

⚠️ Se saca AVIF de lo que el navegador acepta. Es un cambio de
comportamiento de la Tarea 06, y la alternativa era ensanchar
`allowed_formats` y disobedecer el criterio 6.9. Con las cuatro fuentes de
la tabla, tres decían lo mismo: AVIF era el que se había quedado solo.

### 13.7 `camposEditados` se compara contra la fila, sin consultas extra

§7.1 dice que la lista se arma comparando el input contra la fila leída, no
con `Object.keys(input)`. La tentación es volver a leer el producto para
tener el "antes", y eso es una consulta por cada guardado.

Se comparó contra el DTO que el servicio **ya devuelve**:

- `updateProductFromAdmin` ya devuelve el producto guardado.
- `updateCategoryFromAdmin` ya devuelve la fila.
- `updateSettingsFromAdmin` ya devuelve los ajustes.

`camposEditados(anterior, posterior)` vive en `@/lib/domain/audit-campos`
(capa 0, sin I/O) e itera las claves de `posterior`: el parámetro es la
no-fuente-del-olvido y una fila con columnas de más no molesta. El diff de
ajustes reutiliza `getSettingsFormForAdmin`, o sea **la misma proyección que
ve el formulario**: el log y la pantalla no pueden discrepar sobre qué
significa "telefonoWhatsapp".

⚠️ Cuando el servicio **ignora** un campo (el `slug` congelado de un producto
con productos), el campo aparece en la lista. Es correcto: el envío intentó
cambiarlo, y un log que dice "se pidió cambiar el slug y no se cambió" es
información.

### 13.8 El proxy, no el middleware

En Next 16 el archivo es `src/proxy.ts` y el build lo reporta como
`ƒ Proxy (Middleware)`. No hay `src/middleware.ts` ni se creó: el criterio
8.3 "los headers se agregan en `middleware.ts`" se cumple en el archivo que
Next 16 ejecuta para lo mismo, y el matcher excluye `/_next/static`.

Como consecuencia, `nosniff` para los assets está declarado en
`next.config.ts` y no en el proxy: si se declarara en los dos, la respuesta
llevaría dos cabeceras iguales y ganaría una sin que se sepa cuál.

⚠️ La CSP **sí** incluye `report-uri /api/csp-report`, que hoy responde 404:
es la deuda que ya estaba anotada en §9.1 y se deja adelante a propósito,
porque en report-only una ruta inexistente no rompe nada y tener la
directiva puesta hace que los reportes aparezcan en la consola del
navegador desde el primer día.

⚠️ `construirCsp()` y `construirHeaders()` sí se exportan, desde
`src/server/infra/security-headers.ts` y no desde el proxy. El criterio 8.2
pide que no se exporten; el criterio 8.4 pide tests que verifiquen HSTS por
production y `wss://` en `connect-src`, y un test que no puede importar la
función no verifica nada. Se eligió el export: lo que se conserva es que
`src/proxy.ts` es el **único** consumidor en `src/`, y que la lógica de
headers no está pegada al proxy sino en un módulo testeable sin servidor.

### 13.9 La lista de secretos tiene cinco, no cuatro

§2.5 y §8.2 piden cuatro. Se agregó `CLOUDINARY_API_KEY` a los cinco de
`audit:bundle.mjs`: sola no sirve de nada, pero el par key+secret es una
credencial y partirlo en dos sólo hace que la mitad "pública" se relaje sola.

El script busca el **valor**, no el nombre, e ignora los valores de menos de
20 caracteres: en un entorno de desarrollo son
`REEMPLAZAR_CON_LA_API_SECRET` y compañía, y buscarlos daría positivo
en cualquier build. Cuando no encuentra el valor de una variable avisa por
stderr que no pudo verificarla, en vez de dar verde.

Se verificó en los dos sentidos: con una credencial plantada en
`.next/static` el script sale con `1` y la nombre; limpio, sale con `0`.

⚠️ El script lee `.env` y `.env.local` con un parser propio en vez de
`node --env-file`, porque ese flag es de Node >= 22.9 y el proyecto declara
`>=20.9.0` en `engines`: depender del flag rompe el script en la máquina de
la otra persona.

### 13.10 El CHECK de precio no se volvió a agregar

§6.8 propone `prisma/migrations/20250120000001_precio_no_negativo.sql`. La
migración `init` de la Tarea 03 ya tiene
`products_price_non_negative CHECK (price >= 0)`, y volver a crearlo con otro
nombre deja dos CHECK idénticos: el segundo es ruido que nadie va a quitar.

El criterio 8.1 "un `POST` directo con `price` negativo falla" se cumple
desde la Tarea 03 y queda verificado, no reimplementado.

⚠️ `product_variants` NO tiene CHECK de precio y esta tarea tampoco se lo
agrega: los variantes están sin uso por D-02, y agregar un CHECK a una tabla
sin filas ni escribir es escribir una regla que nadie pidió. Cuando los
variantes entren en uso, el CHECK va con el primer producto que los use.
