# Tarea 21 — Despliegue y Operación

| Campo | Valor |
|---|---|
| **ID** | 21 |
| **Fase (DESIGN.md §8.7)** | Fase 5 — Pulido, Seguridad y Deploy a Producción |
| **Depende de** | 19, 20 |
| **Habilita** | 22 |
| **Tipo** | Transversal |
| **Esfuerzo est.** | 1 – 1.5 días |

---

## 1. Objetivo de la tarea

Una sola cosa: que el sitio esté en un dominio real, con la base conectada por el pooler, las migraciones aplicadas a mano, el smoke test pasado, los backups verificados y un runbook que una sola persona pueda seguir a las dos de la mañana sin adivinar.

**Criterio de éxito verificable:** `https://<dominio>` responde 200 en `/` y en `/menu`; `GET /api/health` devuelve `{"status": "ok", "database": "reachable"}` con `DATABASE_URL` apuntando al pooler del puerto 6543; `curl -I` contra el dominio devuelve los seis headers de la Tarea 19 con HSTS incluido; el panel abre y un producto cambia `isAvailable` en dos pestañas en menos de dos segundos; existe `docs/runbook.md` con los tres escenarios de `DESIGN.md` §15.3; y **una restauración de backup se probó de verdad sobre la base de desarrollo**, no sólo se confirmó que la casilla del panel está tildada.

---

## 2. Contexto y dependencias

**Requiere:** Tarea 19 (los seis headers, `docs/seguridad.md`, RLS aplicado, los dos scripts) y Tarea 20 (el pipeline que tiene que estar en verde antes de tocar producción).

En la práctica también usa lo que dejaron 02 (las dos URLs, `GET /api/health`), 15 (Realtime, que es lo único que hay que verificar a mano porque ningún `curl` lo ve) y 06 (Cloudinary, que es el segundo punto de falla después de la base).

### 2.1 La distinción de las dos URLs es lo más importante de la tarea

No es un detalle de configuración. Es la diferencia entre un sitio que funciona y uno que se cae a los diez minutos de tráfico.

| Variable | Qué es | Dónde se usa | Puerto |
|---|---|---|---|
| `DATABASE_URL` | **Session pooler** en modo Transaction | Runtime de la app: cada Server Component, cada action, cada repositorio | `6543` |
| `DIRECT_DATABASE_URL` | **Conexión directa** | `prisma migrate deploy` y `npx prisma` a secas. **Nunca en runtime** | `5432` |

`prisma/schema.prisma` ya las separa con `url` y `directUrl` (Tarea 02 §6.3). Lo que esta tarea tiene que garantizar es que **cada variable esté en el scope de Vercel que le corresponde** y que nadie las intercambie.

El síntoma del intercambio es específico y no se parece a ningún otro: `too many connections` unos minutos después de recibir tráfico. En local funciona perfecto, porque hay una sola conexión. En serverless cada invocación es un módulo nuevo que abre su propio pool, y quince conexiones del plan Free se agotan en el primer minuto de tráfico real.

> ⛔ **`DIRECT_DATABASE_URL` en el scope de producción es un incidente esperando.** No falla al deploy: falla en producción, con clientes esperando. La verificación de §6.5 incluye leer las dos variables del dashboard de Vercel y confirmar los puertos, antes de promote, no después.

### 2.2 Por qué las migraciones no corren en el build

`DESIGN.md` §15.2 lo advierte y la razón es concreta: **cualquier preview se despliega contra la misma base de desarrollo**. Si el build de Vercel ejecutara `prisma migrate deploy`, diez previews abiertos a la vez aplicarían la misma migración en paralelo, dos de ellos se toman el lock de migración, y el preview falla con un error que no tiene nada que ver con el código que se estaba revisando.

| Lo que hace el build | Lo que hace la migración | Por qué están separados |
|---|---|---|
| `npm ci` | — | Instalar |
| `prisma generate` (viene del `postinstall` de la Tarea 02) | — | Generar el cliente. No toca la base |
| `next build` | — | Compilar |
| — | `npx prisma migrate deploy`, **a mano** | Mutar el esquema |

**El build no muta el esquema. Jamás.** `prisma migrate dev` tampoco, y menos en producción: pide reset cuando detecta drift, y un reset borra datos.

### 2.3 Los tres ambientes

`DESIGN.md` §15.1 los define y esta tarea los implementa:

| Ambiente | Rama | Base de datos | Quién entra |
|---|---|---|---|
| **Local** | — | Supabase branch de desarrollo | Desarrollo diario |
| **Preview** | Cualquiera que no sea `main` | **La misma base de desarrollo** | Revisión visual antes de mergear |
| **Producción** | `main` | Base de producción | Público |

> ⛔ **El preview comparte la base con desarrollo, y eso es una decisión, no una comodidad.** Un reviewer que abra un preview y pruebe el panel está escribiendo en la base de desarrollo. Está bien: es exactamente para eso que existe. Lo que no está bien es que un preview **migre**. Y por eso §6.4 aplica las migraciones a mano, contra un ambiente explícito, y nunca desde un build.

### 2.4 Qué hay que verificar a mano y por qué ningún `curl` lo alcanza

| Verificación | Por qué la tiene que hacer una persona |
|---|---|
| El switch de disponibilidad en dos pestañas | Es la única funcionalidad del proyecto que depende de un canal de Realtime. Un `curl` no abre un WebSocket |
| El login del panel y el logout | `verifyAdminSession` depende de cookies que un `curl` sin cookie jar no reproduce |
| El enlace de WhatsApp generado | El bug de cableado de §4.6 de la Tarea 20. Se ve, no se automatiza |
| La carga de una imagen en el panel | Cloudinary devuelve un 200 con un asset que después no existe si la firma estaba mal. Hay que mirarla |

El pipeline de la Tarea 20 corre `lint`, `typecheck`, `test` y `build` en cada push. **Si está en rojo, no hay deploy.** Ese gate es la mitad del trabajo de esta tarea; la otra mitad es todo lo que el pipeline no puede ver.

---

## 3. Archivos a crear / modificar

### 3.1 Crear

| Ruta | Propósito |
|---|---|
| `docs/runbook.md` | Qué hacer si Cloudinary cae, si Supabase no responde, si se pierde el acceso al panel |
| `docs/despliegue.md` | El checklist de deploy, en orden, con los comandos copiables |
| `src/app/api/csp-report/route.ts` | Recibe los reportes de violación de CSP. Etapa 2 de la Tarea 19 §6.4 |
| `scripts/exportar-menu.mjs` | Exporta el menú a JSON y CSV. La red de seguridad de `DESIGN.md` §15.3 |
| `.github/workflows/migrar-produccion.yml` | `workflow_dispatch` manual que corre `migrate deploy` con el secreto correcto y deja registro de quién lo aplicó |

### 3.2 Modificar

| Ruta | Cambio |
|---|---|
| `package.json` | `menu:exportar`, y `db:estado` que ya existía como `db:status` y queda con el nombre en español |
| `.env.example` | Separar por ambiente y marcar cuáles son de producción |
| `docs/tasks/README.md` | Marcar Tarea 21 |

### 3.3 Eliminar

Ninguno.

### 3.4 La decisión sobre el workflow de migración

La alternativa a `.github/workflows/migrar-produccion.yml` es correr `npx prisma migrate deploy` desde la máquina de desarrollo, que es lo que sugiere `DESIGN.md` §15.2. Las dos son válidas y esta tarea elige la segunda por dos razones concretas:

1. `DIRECT_DATABASE_URL` de producción no tiene por qué estar en la laptop de quien despliega. Si la tiene, tarde o temprano se la pasa a un branch equivocado.
2. El workflow deja un registro de qué migración se aplicó, cuándo y por quién. Un `migrate deploy` en una terminal no deja ninguno.

**Y el workflow es manual a propósito:** no tiene trigger de `push` ni de `schedule`. Se dispara a mano desde la pestaña Actions, contra un entorno protegido que pide confirmación. Un workflow que aplica migraciones solo en cada merge a `main` es un `migrate dev` con mejor marketing.

---

## 4. Estructura N-Capas

Las tareas anteriores trataron esta sección como el lugar de cada archivo en la arquitectura de la app. Acá el reparto es otro: es **dónde vive cada artefacto de operación**.

| Artefacto | Ubicación | Por qué |
|---|---|---|
| Configuración del build y la región | `vercel.json` | Es la única que Vercel lee sin que nadie la lea antes |
| Migración de producción | `.github/workflows/migrar-produccion.yml`, `workflow_dispatch` | Un paso manual con registro, no un hook |
| Procedimiento de deploy | `docs/despliegue.md` | Lo que se sigue **antes** de desplegar |
| Procedimiento de incidentes | `docs/runbook.md` | Lo que se sigue **después** de que algo se rompió |
| Recepción de reportes de CSP | `src/app/api/csp-report/route.ts` | Es una ruta HTTP, va en la app |
| Export del menú | `scripts/exportar-menu.mjs` | Es un script de Node, no un test ni una app |
| Secrets | Dashboard de Vercel y de Supabase | **Nunca en el repo.** Ver §5.3 |

### 4.1 La regla que ordena el deploy

> **Primero el pipeline, después el build, después la migración, después el smoke test, después el dominio.**

El orden no es una preferencia. El build sin pipeline en verde produce un deploy que alguien va a tener que revertir; la migración sin smoke test produce una base con el esquema nuevo y un sitio que no lo usa; el dominio sin smoke test produce un sitio público con un error en `/menu` que se ve desde cualquier celular.

### 4.2 Qué hace el pipeline y qué hace la persona

| Paso | Automático | Quién lo hace | Por qué no es automático |
|---|---|---|---|
| `lint`, `typecheck`, `test` | Sí | GitHub Actions | No depende de criterio |
| `next build` en Vercel | Sí | Vercel | Idem |
| `migrate deploy` | No | Persona, a mano | Ver §2.2 |
| Smoke test de `/` y `/menu` | No | Persona, con `curl` | Un 200 no dice que el menú se vea |
| Smoke test del panel y Realtime | No | Persona, en el navegador | Ver §2.4 |
| Verificación de RLS con la `anon` key | No | Persona, con `curl` | Necesita la key real, y esa key es un secreto |
| Restauración de un backup | No | Persona, una vez | Un backup que nunca se restauró es una hipótesis |

---

## 5. Convenciones de código (Clean Code + SOLID)

### 5.1 Un runbook son comandos copiables, no párrafos

| Se escribe así | Se escribe así no |
|---|---|
| ``npx prisma migrate status`` | «Hay que verificar el estado de las migraciones» |
| ``curl -sS https://<dominio>/api/health`` | «Verificar que la base responde» |
| «Si el `curl` devuelve `503`, el paso siguiente es §3» | «Si algo falla, investigar» |

La persona que lee `docs/runbook.md` a las dos de la mañana no tiene tiempo de traducir prosa en comandos. **Cada paso tiene el comando literal, qué se espera ver, y qué hacer si no es lo esperado.**

### 5.2 Un archivo, una responsabilidad, también en `scripts/`

`exportar-menu.mjs` exporta el menú. No consulta la salud de la base, no manda un webhook y no limpia nada. La regla de nombres de la Tarea 19 §2.10 se aplica igual: `exportar-menu.mjs`, no `menu.mjs` ni `script.mjs` ni `utils.mjs`.

**Y tiene una excepción explícita a la regla de "un solo `PrismaClient`" de la Tarea 02 §7.** No por conveniencia: `src/server/infra/prisma.ts` arranca con `import "server-only"`, y ese import **lanza** fuera de Next. Un script de Node plano no puede usar el cliente de la app, así que construye el suyo y lo cierra. La excepción está acotada a este archivo y está escrita como criterio en §8.3: si algún día aparece un segundo `new PrismaClient()` fuera de él, es un bug, no una decisión.

### 5.3 Ningún secreto entra al repositorio, en ningún paso de esta tarea

| Se escribe | Dónde | Por qué no en el repo |
|---|---|---|
| `DIRECT_DATABASE_URL` de producción | Secretos de Vercel, scope **Production** | La migración de §6.4 la necesita en un solo paso |
| `SUPABASE_SERVICE_ROLE_KEY` de producción | Secretos de Vercel, scope **Production** | Es la que puede escribir en cualquier tabla |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Secretos de Vercel, **Production y Preview** | Es pública por diseño, pero distinto en cada ambiente |
| `CLOUDINARY_API_SECRET` | Secretos de Vercel, scope **Production** | Da control total de la cuenta de Cloudinary |
| La `anon` key para el `curl` de RLS | La terminal de quien verifica | Es la que prueba que el RLS cierra |

`.env.example` lleva los nombres y la forma, con valores de ejemplo. `npm run audit:bundle` de la Tarea 19 es el que falla si algo de esto terminó en `.next/static`.

### 5.4 El nombre del archivo dice qué hacer cuando algo se rompe

| Archivo | Qué contiene | Cuándo se abre |
|---|---|---|
| `docs/despliegue.md` | El deploy, en orden, con sus verificaciones | Antes de cada deploy |
| `docs/runbook.md` | Los tres escenarios de `DESIGN.md` §15.3 | Cuando algo ya se rompió |
| `docs/seguridad.md` (Tarea 19) | 2FA, cookies, rotación de secretos, clave filtrada | Cuando hay una sesión o una clave en juego |

Tres archivos, tres momentos distintos. Un solo documento con las tres cosas es un documento que nadie encuentra a las dos de la mañana.

---

## 6. Pasos de implementación

### 6.1 El proyecto en Vercel

```bash
# ⛔ Con la CLI, sólo si se quiere ver el proyecto desde la terminal.
#    La alternativa es importar el repo desde el dashboard, que es lo
#    que hace la mayoría. Los dos chemins llevan al mismo lugar.
npm i -g vercel
vercel login
vercel link
vercel env ls
```

El build command queda en `next build && npm run audit:bundle` (ya está así desde la Tarea 19 §6.5). Lo que hay que confirmar es que **no** tenga `prisma migrate` en ningún lado: ni en el build command, ni en un `vercel.json` heredado, ni en un `postinstall` editado a mano.

```bash
# ⛔ La comprobación de que el build no muta el esquema. Si esto imprime
#    algo, hay un paso de migración escondido en el build.
rg -n "migrate (dev|deploy|reset)" package.json vercel.json .github/workflows/
# Salida esperada: sólo .github/workflows/migrar-produccion.yml
```

### 6.2 Las variables, una por una, y en el scope que corresponde

| Variable | Preview | Production | De dónde sale |
|---|---|---|---|
| `DATABASE_URL` | Desarrollo, pooler 6543 | **Producción, pooler 6543** | Supabase → Project Settings → Database → Session pooler |
| `DIRECT_DATABASE_URL` | Desarrollo, directa 5432 | **Producción, directa 5432** | Supabase → Project Settings → Database → URI |
| `NEXT_PUBLIC_SUPABASE_URL` | Desarrollo | Producción | Dashboard de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Desarrollo | Producción | Dashboard de Supabase → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Desarrollo | Producción | Dashboard de Supabase → API |
| `CLOUDINARY_CLOUD_NAME` | `modo-miga` | `modo-miga` | Panel de Cloudinary |
| `CLOUDINARY_API_KEY` | Desarrollo | Producción | Panel de Cloudinary |
| `CLOUDINARY_API_SECRET` | Desarrollo | Producción | Panel de Cloudinary |
| `NEXT_PUBLIC_SITE_URL` | La URL del preview | `https://<dominio>` | Del dominio que se registra en §6.6 |

> ⛔ **`NEXT_PUBLIC_SITE_URL` en producción tiene que ser el dominio real, con `https`, y no el dominio de Vercel.** De eso depende que la Tarea 19 emita HSTS: su condición es `NODE_ENV === "production" && NEXT_PUBLIC_SITE_URL !== ""`. Con la URL de Vercel el valor no estaría vacío y el HSTS se emitiría sobre un dominio que después se cambia, y el navegador guarda esa promesa doce meses.

```bash
# ⛔ La verificación que hace falta antes de promote, no después.
#    Hace falta sin prefijo: `prisma://` es la que se lee en el log.
vercel env pull .env.produccion --environment=production
rg -o 'pooler\.supabase\.com:6543|:5432' .env.produccion | sort | uniq -c
rm .env.produccion
```

Salida esperada: una línea con `:6543` para `DATABASE_URL` y otra con `:5432` para `DIRECT_DATABASE_URL`. Si aparecen al revés, el deploy se detiene acá.

### 6.3 `vercel.json`

```jsonc
// vercel.json
{
  // ⛔ Sin `buildCommand` con migraciones. Ver §2.2. Este archivo no
  //    aparece hasta esta tarea, y aparece con una sola decisión.
  "framework": "nextjs",

  /**
   * ⛔ Región pegada a la de la base.
   *
   * La URL del pooler de la Tarea 02 es `aws-0-sa-east-1`, que es São
   * Paulo. Una función serverless en `iad1` (Virginia) hace un viaje de ida
   * y vuelta por el Atlántico en cada consulta: en una página que hace
   * cinco, el usuario nota el retraso antes que nadie. Es el cold start de
   * 1 a 3 s de la Tarea 02 §9 medido desde el lugar correcto.
   */
  "regions": ["gru1"],

  /**
   * ⛔ `maxDuration` en 10, no en 300.
   *
   * El plan Hobby corta a los 10 segundos por función. Poner 300 no da
   * más tiempo: da la ilusión de tenerlo, y el corte llega igual. Un
   * endpoint de salud que tarda diez segundos ya está roto, y conviene
   * que lo diga rápido.
   */
  "functions": {
    "src/app/api/health/route.ts": { "maxDuration": 10 },
    "src/app/api/csp-report/route.ts": { "maxDuration": 10 }
  }
}
```

### 6.4 Las migraciones, a mano y con registro

El orden completo, y es el mismo que va en `docs/despliegue.md`:

```bash
# 1. Ver el estado ANTES de aplicar nada. Esto es el que evita el
#    surprise de una migración que ya estaba y el build la repite.
npx prisma migrate status

# 2. Aplicar. `DIRECT_DATABASE_URL` apuntando a la base de producción y
#    NADA más: este comando nunca usa el pooler, y por eso no debe
#    encontrar `DATABASE_URL` en el entorno.
DIRECT_DATABASE_URL="$DIRECT_DATABASE_URL_PROD" npx prisma migrate deploy

# 3. Confirmar que quedaron aplicadas y que la base responde.
npx prisma migrate status
```

Desde el dashboard de GitHub, la alternativa:

```bash
# ⛔ Manual. Se dispara desde la pestaña Actions, con confirmación del
#    entorno protegido. No hay trigger de push.
gh workflow run migrar-produccion.yml -f ambiente=produccion

# Y después, el log dice qué migración se aplicó.
gh run list --workflow migrar-produccion.yml --limit 1
```

```yaml
# .github/workflows/migrar-produccion.yml
# ⛔ `workflow_dispatch` y nada más. Si alguien le agrega `push: main`,
#    esta tarea deja de cumplir su propósito. Ver §3.4.
name: migrar-produccion

on:
  workflow_dispatch:
    inputs:
      ambiente:
        description: Base a migrar
        required: true
        type: choice
        options: [produccion, desarrollo]

jobs:
  migrar:
    name: prisma migrate deploy
    runs-on: ubuntu-latest
    # ⛔ Entorno protegido: pide confirmación antes de correr, y es donde
    #    vive el secreto. El aviso de "esperando aprobación" es el que
    #    hace que alguien mire qué se está por aplicar.
    environment: produccion
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Aplicar migraciones
        run: npx prisma migrate deploy
        env:
          # ⛔ Sólo la directa. Si este paso correra con el pooler,
          #    `Could not connect`: la transacción de DDL necesita
          #    una sesión real y el pooler no la garantiza.
          DIRECT_DATABASE_URL: ${{ secrets.DIRECT_DATABASE_URL_PROD }}

      - name: Estado final
        run: npx prisma migrate status
        env:
          DIRECT_DATABASE_URL: ${{ secrets.DIRECT_DATABASE_URL_PROD }}
```

> ⛔ `prisma migrate deploy` **no** usa `DATABASE_URL`, y esa es la razón por la que el paso anterior no lo define. Prisma lee `directUrl` para el CLI. Si el proyecto alguna vez se configuró al revés, este paso falla con un error de conexión y el mensaje dice `directUrl`, que es exactamente la ayuda que hace falta.

### 6.5 El smoke test post-deploy

Cinco minutos, y son los mismos después de **cada** deploy. No hay atajo para el primero.

```bash
# 1. El sitio responde y no está en mantenimiento.
curl -sS -o /dev/null -w '%{http_code}\n' https://<dominio>/

# 2. La base responde. Este es el que tarda 1 a 3 s la primera vez por
#    el cold start; a partir de ahí, milisegundos.
curl -sS https://<dominio>/api/health
# ⛔ Esperado: {"status":"ok","database":"reachable","latencyMs":42}
#    Si devuelve 503, el deploy no sirve: parar acá y §9.2.

# 3. El catálogo se arma. Un 200 de /menu no alcanza: el HTML tiene que
#    contener el nombre de un producto real, o la página está sirviendo
#    el esqueleto con un error adentro.
curl -sS https://<dominio>/menu | rg -o 'Classic Jamón y Queso'
# ⛔ Esperado: una coincidencia. Cero es un error de datos, no de HTTP.

# 4. Los seis headers, con HSTS. Es la verificación de la Tarea 19 §10.5
#    repetida contra el dominio real.
curl -sSI https://<dominio>/ | rg -i 'strict-transport|x-frame|x-content|referrer|permissions|content-security'

# 5. La de RLS, con la `anon` key real y no una inventada.
curl -sS "https://<project-ref>.supabase.co/rest/v1/staff_members?select=id" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
# ⛔ Esperado: []. Un objeto con datos es una fuga.
```

Después, en el navegador, los cuatro que ningún `curl` alcanza (§2.4):

| # | Qué | Cómo se sabe que salió bien |
|---|---|---|
| 1 | `/menu` carga con productos e imágenes | Las imágenes se ven. Una 404 de Cloudinary con un `alt` roto delata la firma |
| 2 | Carrito y checkout | El carrito acepta, el checkout valida, y el enlace abre `wa.me` con el pedido completo |
| 3 | Login del panel y logout | Entra, `/admin` carga, y al hacer logout `/admin` redirige |
| 4 | Toggle en dos pestañas | Se marca en una y **desaparece en la otra en menos de 2 s** |

### 6.6 El dominio y el SSL

1. En Vercel: Settings → Domains → Add, con el dominio del local.
2. En el registrador: apunta el `A` al proyecto de Vercel. Vercel muestra el valor exacto, que cambia por proyecto.
3. Vercel emite el certificado automáticamente cuando el DNS propaga. Tarda de minutos a una hora.
4. Volver a poner `NEXT_PUBLIC_SITE_URL` con el dominio real y hacer un redeploy. Sin esto, los canonical, los OG y el HSTS siguen apuntando al dominio de Vercel.
5. Repetir §6.5 completo. El paso 4 cambia el comportamiento de los headers.

```bash
# ⛔ La comprobación de que el certificado es válido y no un warning.
curl -sSI https://<dominio>/ | rg -i 'strict-transport'
# ⛔ Esperado: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### 6.7 Backups, y la restauración probada

`DESIGN.md` §15.3 pide dos cosas distintas, y la segunda es la que importa:

| Qué | Cómo | Quién |
|---|---|---|
| **Backups automáticos de Supabase** | Plan → Database → Backups, con retención ≥ 7 días | Ya vem. Se confirma que el plan lo tenga |
| **Export del menú a JSON y CSV** | `npm run menu:exportar` | Se corre una vez antes de cada deploy que cambie el menú |

```js
// scripts/exportar-menu.mjs
// ⛔ Sin dependencias. Prisma ya está y `@prisma/client` viene del
//    `postinstall`. Ver §5.2: este script exporta y nada más.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * ⛔ Ésta es la única excepción a la regla de "un solo PrismaClient" (Tarea 02 §7),
 *    y hay una razón técnica, no de conveniencia: `src/server/infra/prisma.ts`
 *    arranca con `import "server-only"`, que **lanza** al importarse fuera
 *    de Next. Un script de Node plano no puede usar el cliente de la app.
 *
 *    El script construye el suyo y cierra la conexión al final. No
 *    reexporta nada: si algo de `src/` lo importara, el build lo corta
 *    con la regla de capas de la Tarea 01.
 */
const prisma = new PrismaClient();

/**
 * ⛔ Sólo productos PUBLICADOS y no archivados.
 *
 * El export es la red de seguridad del contenido, no un dump de la base.
 * Si aparece un DRAFT es información que el local todavía no publicó, y
 * un archivo con datos que nadie autorizó no es una red de seguridad: es
 * una fuga con buena prensa.
 */
const productos = await prisma.product.findMany({
  where: { status: "PUBLISHED" },
  orderBy: [{ categoryId: "asc" }, { name: "asc" }],
  include: { category: { select: { name: true } } },
});

const marca = new Date().toISOString().slice(0, 10);
const destino = join("exports", `menu-${marca}.json`);

await writeFile(destino, `${JSON.stringify(productos, null, 2)}\n`, "utf8");

/**
 * ⛔ El CSV es para que el local lo abra en una planilla, así que las
 *    columnas van en español y los centavos van como número, no como
 *    `$ 1.450,00`: una planilla en es-AR no parsea ese formato.
 */
const columnas = ["categoria", "nombre", "precio", "disponible"];
const celda = (valor) => `"${String(valor ?? "").replaceAll('"', '""')}"`;
const filas = productos.map((p) =>
  [
    p.category?.name,
    p.name,
    p.price.toString(),
    p.isAvailable ? "sí" : "no",
  ]
    .map(celda)
    .join(","),
);

await writeFile(
  join("exports", `menu-${marca}.csv`),
  `${columnas.join(",")}\n${filas.join("\n")}\n`,
  "utf8",
);

console.info(`[exportar-menu] ${productos.length} productos en exports/menu-${marca}.{json,csv}`);

await prisma.$disconnect();
```

**La restauración se prueba una vez, sobre la base de desarrollo.** Un backup que nunca se restauró es una hipótesis, y el día que lo necesites es el peor para descubrir que el dump no tiene los roles correctos:

```bash
# ⛔ En la base de DESARROLLO. Nunca en producción, ni para probar.
#    Se descarga el backup de la última semana, se sube a una base
#    descartable y se verifica contra `docs/runbook.md` §3.
```

Lo que se anota del ensayo, en `docs/runbook.md` §3: cuánto tardó, qué comando lo revierte, y si el `prisma/_prisma_migrations` que vino adentro del dump coincidió con el que tenía la base destino.

### 6.8 Monitoreo y alertas

Cinco, y todas las que pide `DESIGN.md` §15.3:

| Qué | Herramienta | Configuración | Costo |
|---|---|---|---|
| Caída de `/menu` | Uptime check externo, 5 min | Un `GET` a `https://<dominio>/api/health` y otro a `/menu` | Los servicios gratuitos dan 1 chequeo cada 5 min |
| Errores de Server Action | Vercel Analytics | Ya activo con los deploys | Incluido |
| `error.tsx`global y de sección | Vercel Analytics | Ya activo: React reporta los error boundaries | Incluido |
| Pool de conexiones cercano al límite | Dashboard de Supabase → Database | Revisión semanal durante el primer mes | Incluido |
| Reportes de CSP | `src/app/api/csp-report/route.ts` | Etapa 2 de la Tarea 19 §6.4 | Incluido |

> El uptime check externo **no** puede ser un `curl` corriendo en la misma red que el sitio. Un monitor que cae junto con lo que monitorea no monitorea: es una formalidad. Por eso "externo" está en la fila.

### 6.9 `/api/csp-report`

La Tarea 19 §6.4 define tres etapas y deja la segunda para esta tarea: la CSP se emite en `Content-Security-Policy-Report-Only`, y este endpoint es donde aterriza lo que el navegador reporta.

```ts
// src/app/api/csp-report/route.ts
/**
 * ⛔ Recibe los reportes de la CSP en modo `Report-Only`. Ver Tarea 19
 *    §6.4, etapa 2. La etapa 3 —activar la CSP bloqueante— es una
 *    decisión manual en el PR que la cambia, y no se toma acá.
 *
 * ⛔ Nunca responde 4xx por un cuerpo inválido. Un navegador que recibe
 *    un error en este endpoint deja de reportar, y el reporte que falta
 *    es el que no se lee. Se responde 204 siempre.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CREADOS: Reporte[] = [];

interface Reporte {
  readonly recibidoEn: string;
  readonly documento: string;
  readonly directiva: string;
  readonly bloqueado: string;
}

/**
 * El body de un reporte de CSP es `application/csp-report`, un objeto con
 * `csp-report`. Varios navegadores lo mandan en el campo `body`. Se leen
 * los dos y se guarda lo que haya.
 */
const leerReportes = (cuerpo: unknown): Reporte[] => {
  if (typeof cuerpo !== "object" || cuerpo === null) return [];

  const envoltorio = cuerpo as { "csp-report"?: unknown; body?: unknown };
  const crudo = envoltorio["csp-report"] ?? envoltorio.body;
  if (typeof crudo !== "object" || crudo === null) return [];

  const reporte = crudo as {
    "document-uri"?: string;
    "violated-directive"?: string;
    "blocked-uri"?: string;
  };

  return [
    {
      recibidoEn: new Date().toISOString(),
      documento: reporte["document-uri"] ?? "desconocido",
      directiva: reporte["violated-directive"] ?? "desconocida",
      bloqueado: reporte["blocked-uri"] ?? "desconocido",
    },
  ];
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    CREADOS.push(...leerReportes(await request.json()));
  } catch {
    // ⛔ Un body que no es JSON se registra como lo que es, y se
    //    responde igual. Ver la nota del encabezado.
    console.error("[csp-report] Body ilegible");
  }

  return new NextResponse(null, { status: 204 });
}

/**
 * ⛔ Los reportes quedan **en memoria, y a propósito**.
 *
 * Una función serverless es un módulo nuevo en cada invocación: este
 * arreglo se vacía solo y no sirve para nada. Lo que sirve es el log.
 * Guardarlos en la base sería escribir desde un endpoint público sin
 * sesión, que es exactamente lo que el modelo de la Tarea 19 no permite: la `anon`
 *    key lee, no escribe.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ total: CREADOS.length });
}
```

> ⛔ **El `GET` de este endpoint no se agrega al smoke test.** No dice si hay violaciones, porque en producción el arreglo está siempre vacío. Si alguna vez dice un número mayor que cero, es porque alguien está mirando una función caliente, y ese alguien ya sabe que tiene que mirar el log.

### 6.10 `docs/runbook.md`

Estructura fija, en el mismo orden siempre:

```markdown
# Runbook — Mi Negocio

## 0. A quién llamar y dónde mirar primero
## 1. Si el sitio no carga
## 2. Si el panel no abre o da error
## 3. Si la base no responde
## 4. Si Cloudinary no carga
## 5. Si se perdió el acceso al panel
## 6. Si hay que volver atrás (rollback)
## 7. Contactos y accesos
```

Cada sección tiene la misma forma:

```markdown
## 3. Si la base no responde

**Síntoma:** `GET /api/health` devuelve `{"status":"error","database":"unreachable"}`,
o las páginas con datos dan 500.

**Antes de tocar nada:**
```bash
curl -sS https://<dominio>/api/health
```

**Causa 1 — La base de desarrollo está pausada (Supabase la pausa a los 7 días de inactividad).**
Es la causa más frecuente y no es una falla: se reactiva desde el dashboard
en un minuto y después sigue.
```bash
# En el dashboard de Supabase → el proyecto aparece con estado "Paused".
# Botón "Restore". Esperar a que vuelva a "Active".
```

**Causa 2 — Se agotó el pool de conexiones.**
El síntoma es distinto: el health check responde `ok` y después, con
tráfico, aparecen `too many connections`.
```bash
# En Vercel → el proyecto → Settings → Environment Variables
# Verificar que DATABASE_URL termina en :6543 y NO en :5432.
# Si termina en :5432, está usando la conexión directa: corregir y redeploy.
```

**Qué NO hacer:** `prisma migrate reset` en producción. Borra los datos
y la Tarea 02 §9 dice por qué no se usa jamás fuera de desarrollo.
```

### 6.11 `docs/despliegue.md`

Es el camino de §6.1 a §6.6 en una sola lista, con casillas. La diferencia con este documento es que éste se **cumple** y aquel se **consulta**.

```markdown
# Despliegue — Mi Negocio

## Antes (10 min)
- [ ] `gh run list` muestra el pipeline de la Tarea 20 en verde
- [ ] `npm run verify` en verde en local
- [ ] Menú revisado: no hay productos en `DRAFT` que deberían estar publicados

## Deploy
- [ ] Merge a `main` (o promote del preview si hay staging)
- [ ] Build de Vercel en verde
- [ ] `npx prisma migrate status` — aplicado

## Después (5 min)
- [ ] `curl /api/health` → `ok`
- [ ] `curl /menu` contiene un nombre de producto
- [ ] `curl -I` → los seis headers, con HSTS
- [ ] Toggle de disponibilidad en dos pestañas
- [ ] Login del panel
- [ ] Enlace de WhatsApp desde el checkout

## Si algo de "Después" falló
Ir a `docs/runbook.md`. No improvisar en producción.
```

### 6.12 La capacitación al encargado

Quince minutos, con la pantalla grabada, como pide `DESIGN.md` §8.7. Cuatro cosas y ninguna más:

| Qué | Cuánto |
|---|---|
| Entrar al panel y ubicar el menú | 3 min |
| Agregar o editar un producto, con su foto | 5 min |
| Marcar un producto como no disponible | 2 min |
| Cambiar el teléfono de WhatsApp del local | 2 min |

Se deja grabado y en un lugar donde el local lo encuentre. **La pregunta que se hace al final y que decide si la capacitación sirvió:** «¿podés entrar solo, agregar un producto con foto y marcarlo como agotado, sin llamarme?» Si la respuesta es un "sí" con seguridad, la sesión está terminada.

---

## 7. Contratos y tipos

| Contrato | Ubicación | Consumido por |
|---|---|---|
| `DATABASE_URL` (pooler 6543) / `DIRECT_DATABASE_URL` (directa 5432) | Secretos de Vercel, por ambiente | Prisma CLI y runtime |
| `GET /api/health` | `src/app/api/health/route.ts` (Tarea 02 §6.8) | El smoke test de §6.5 y el uptime check externo |
| `POST /api/csp-report` | `src/app/api/csp-report/route.ts` | La directiva `report-uri` de la Tarea 19 §6.4 |
| `regions: ["gru1"]` | `vercel.json` | La latencia entre la función y el pooler de São Paulo |
| `migrate deploy` con `DIRECT_DATABASE_URL` solamente | `.github/workflows/migrar-produccion.yml` | El CLI de Prisma, que lee `directUrl` |
| Los seis headers con HSTS sólo en producción | `src/middleware.ts` (Tarea 19 §6.4) | La verificación de §6.5, paso 4 |

**Contrato que esta tarea fija y no existía:** la lista exacta de verificaciones que un deploy tiene que pasar antes de considerarse hecho, en el orden de §4.1. **Contratos que consume y no toca:** la configuración de `schema.prisma`, los headers, el endpoint de salud, y el pipeline de la Tarea 20.

### 7.1 Lo que este documento no puede verificar solo

Tres cosas de §6.8 necesitan una cuenta y una tarjeta que esta tarea no puede dar por hechas, y por eso quedan como criterios de §8 y no como pasos de §6:

| Qué | Por qué |
|---|---|
| El uptime check externo | Hay que elegir un servicio y crear la cuenta. El sitio queda sin monitoreo hasta que alguien lo haga |
| La alerta de pool cercano al límite | El umbral se configura en el dashboard de Supabase según el plan contratado, y el plan lo define al proyectar |
| La grabación de la capacitación | Depende de que el encargado esté disponible quince minutos |

Un criterio de aceptación que dice «configurar el monitoreo externo» sin decir cuál es un criterio que se marca en verde sin que exista nada. Por eso en §8 cada uno nombra el servicio.

---

## 8. Criterios de aceptación

### 8.1 Funcionalidad

- [ ] `https://<dominio>` responde 200 y `/menu` contiene al menos un nombre de producto real
- [ ] `GET /api/health` devuelve `{"status": "ok", "database": "reachable"}` con `latencyMs`
- [ ] Las cinco verificaciones de `curl` de §6.5 se ejecutaron contra el dominio real, con la `anon` key real
- [ ] Los cuatro chequeos de navegador de §6.5 se hicieron: menú con imágenes, carrito y checkout, login, toggle en dos pestañas
- [ ] El certificado SSL está emitido y `curl -I` devuelve HSTS con `includeSubDomains`
- [ ] `NEXT_PUBLIC_SITE_URL` de producción es el dominio real con `https`, no el dominio de Vercel
- [ ] `npx prisma migrate status` dice que no hay migraciones pendientes en producción
- [ ] `npm run menu:exportar` produjo `exports/menu-<fecha>.json` y `.csv` con los productos publicados

### 8.2 Calidad

- [ ] El pipeline de la Tarea 20 corrió en verde en el push que se promovió
- [ ] `npm run verify` y `npm run build` en verde en local antes del merge
- [ ] `npm run audit:bundle` pasó después del build, sin hallazgos
- [ ] `npm run verify:actions` reporta nueve actions
- [ ] `docs/despliegue.md` se siguió de punta a punta en el deploy, con las casillas marcadas
- [ ] `docs/runbook.md` tiene las siete secciones de §6.10 y cada una con comandos copiables
- [ ] `scripts/exportar-menu.mjs` no tiene dependencias y corre sin variables de Vercel

### 8.3 Arquitectura — verificación obligatoria

- [ ] `vercel.json` **no** contiene `migrate` en ningún campo
- [ ] `rg -n "migrate (dev|deploy|reset)" package.json vercel.json .github/workflows/` devuelve **sólo** el workflow de migración
- [ ] El build de Vercel no corre migraciones: en el log del build no aparece `prisma migrate`
- [ ] `migrar-produccion.yml` dispara **sólo** con `workflow_dispatch` y no tiene `push` ni `schedule`
- [ ] El job de migración define `DIRECT_DATABASE_URL` y **no** define `DATABASE_URL`
- [ ] El job de migración corre contra un entorno protegido de GitHub
- [ ] `vercel.json` fija la región y no la deja en el default
- [ ] `scripts/exportar-menu.mjs` es el único archivo fuera de `src/` que instancia un `PrismaClient`, y lo hace por el motivo de `server-only` escrito en el archivo
- [ ] `rg -n "new PrismaClient\(\)" src/ scripts/` devuelve sólo la línea de `src/server/infra/prisma.ts` y la del script de exportación
- [ ] `/api/csp-report` responde `204` también con un body inválido
- [ ] Ninguna variable de producción está en `.env.example` con valor real

### 8.4 Pruebas

- [ ] El smoke test de §6.5 está completo en `docs/despliegue.md` y se ejecutó dos veces: una en el primer deploy y otra en el siguiente
- [ ] `vercel env pull` + el `rg` de §6.2 confirmó que `DATABASE_URL` termina en `:6543` y `DIRECT_DATABASE_URL` en `:5432`
- [ ] El `curl` de RLS devolvió `[]` con la `anon` key de producción
- [ ] El toggle de disponibilidad se propagó entre dos pestañas en menos de 2 segundos, con las dos sesiones en el panel
- [ ] **Una restauración de backup se probó sobre la base de desarrollo** y el resultado quedó anotado en `docs/runbook.md` §3
- [ ] La grabación de la capacitación al encargado existe y tiene los cuatro puntos de §6.12

### 8.5 Seguridad y documentación

- [ ] Backups automáticos de Supabase habilitados con retención ≥ 7 días, confirmado en el panel
- [ ] El 2FA está activado para los dos `OWNER` (Tarea 19 §6.9)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` no aparece en `.next/static` después del build de producción
- [ ] El rate limiting de Supabase Auth no está en `none` (Tarea 19 §6.9)
- [ ] Un uptime check externo está activo contra `/api/health` y contra `/menu`, con alertas a un destino real
- [ ] Alguien miró los reportes de `/api/csp-report` y pudo distinguir un problema real de un ruido
- [ ] La etapa 3 de la CSP —activarla en modo bloqueante— **no** se activó: sigue en `Report-Only` con una decisión explícita de esperar la semana de tráfico
- [ ] `docs/tasks/README.md` marca la Tarea 21

---

## 9. Casos borde y manejo de errores

| Caso | Comportamiento esperado | Por qué |
|---|---|---|
| **`too many connections` en producción, con `DATABASE_URL` en `:5432`** | `DATABASE_URL` de producción apunta al pooler 6543; se redeploya y el síntoma desaparece en un minuto | Es el fallo más caro de esta tarea y el más silencioso: en local nunca pasa. §2.1 |
| **El build de Vercel falla con `P1001`** | Falta `DIRECT_DATABASE_URL` en el scope del build, o `prisma generate` no corrió. `postinstall` está en `package.json` y la variable existe en el scope correcto | El `postinstall` corre en `npm ci`, y sin la URL el cliente se genera igual: el error recién aparece en runtime |
| **Dos previews despliegan a la vez y una migración entra en conflicto** | No puede pasar: el build no migra. Las migraciones son un paso manual de §6.4 | §2.2. El síntoma es `P3009` en un PR que no toca la base |
| **`migrate deploy` pide reset de la base** | Nunca se resetea en producción. `migrate status` primero, para ver si hay drift, y el drift se arregla con `migrate resolve` después de mirarlo | `migrate dev` resetea solo cuando detecta drift, y `deploy` no. Si aparece el pedido, se está corriendo el comando equivocado |
| **HSTS emitido en un preview** | `NEXT_PUBLIC_SITE_URL` vacío en el scope Preview, o el dominio de Vercel sin HSTS | Un preview no tiene dominio propio: `includeSubDomains` es una promesa que el navegador guarda doce meses |
| **La base de desarrollo está pausada por inactividad de 7 días** | `P1001` sin mensaje útil. Se reactiva en el dashboard y el smoke test del preview vuelve a pasar | Es la causa más frecuente de «los tests fallan de golpe» y no es una falla. Tarea 02 §9 |
| **Cloudinary devuelve error al subir una imagen** | El panel muestra el mensaje de la Tarea 06 y el producto no se guarda. El catálogo público sigue sirviendo con las imágenes viejas | Es el único punto de falla externo que el cliente ve. `docs/runbook.md` §4 dice qué revisar: credenciales, quota, allowlist de formatos |
| **Se perdió el acceso al panel** | El log de Auth de Supabase muestra los intentos, y el caso está en `docs/runbook.md` §5: recuperar por correo, promover a `OWNER` con `supabaseAdmin`, o entrar por SQL con `DIRECT_DATABASE_URL` | Es el escenario que más probabilidad tiene de ser real: la contraseña del dueño es una contraseña que no está en ningún gestor |
| **El deploy rompió producción y hay que volver atrás** | Vercel → Deployments → el anterior → Promote to Production. **Sin** tocar la base: si la migración no se aplicó, volver el código alcanza | Si la migración ya está aplicada, volver el código deja el esquema adelante. Ver la fila siguiente |
| **La migración ya está aplicada y hay que volver atrás** | No se hace rollback de esquema automáticamente. Se crea una migración nueva que revierte, se aplica, y recién después se promueve el deploy anterior | Prisma no tiene `migrate down`. Un `git revert` de una migración deja la base y el código en estados que nadie puede leer |
| **Un reporte de CSP llega con un body que no es JSON** | El endpoint responde `204` igual y lo registra en el log | Un navegador que recibe un error en este endpoint deja de reportar, y el reporte que falta es el que no se lee |
| **El sitio recibe tráfico y el pool se agota igual** | Se sube el plan de Supabase o se cachea `/menu`. `DESIGN.md` §15.3 lo pide como alerta semanal del primer mes | El pooler resuelve el serverless, no un catálogo público con muchas visitas simultáneas al mismo producto |
| **`prisma generate` no corrió y el build pasa igual** | `postinstall` en `package.json` lo corre siempre. Si se editó a mano, el error aparece en el primer `prisma.product` y no antes | Por eso el `postinstall` existe: para que no dependa de que alguien se acuerde |

---

## 10. Pruebas

| Verificación | Qué prueba | Automático |
|---|---|---|
| `npm run verify` + `npm run build` | Que el código que se despliega pasó la Tarea 20 | Sí, el pipeline |
| `npm run verify:actions` | Que las nueve actions siguen autorizando antes del payload | Sí, el pipeline |
| `npm run audit:bundle` | Que ningún secreto de producción quedó en `.next/static` | Sí, dentro del build |
| `curl /api/health` | Que la base responde por el pooler, no por la directa | No |
| `curl /menu` + `rg` de un nombre de producto | Que el HTML trae datos, no un esqueleto de error | No |
| `curl -I` con `rg` de los seis headers | Que HSTS está y que ningún header se perdió | No |
| `curl` de RLS con la `anon` key | Que `staff_members` devuelve `[]` desde fuera | No |
| Toggle en dos pestañas | Que Realtime sigue funcionando después del deploy | No |
| Restauración de un backup | Que el dump se puede aplicar y devuelve datos | No, una vez |
| `npm run menu:exportar` | Que el contenido público se puede recuperar fuera de la base | No, antes de cada deploy de contenido |

**El criterio que decide si esta tarea está bien hecha:** el smoke test de §6.5 es un documento que otra persona puede seguir sin preguntar nada, y el runbook sirve a las dos de la mañana. Todo lo demás que se haya hecho y no se pueda repetir desde el documento no cuenta.

---

## 11. Definición de "Hecho" (Definition of Done)

- [ ] Todos los criterios de §8 marcados, cada uno verificado y no de memoria
- [ ] `https://<dominio>` en producción, con el menú mostrando productos reales y sus fotos
- [ ] Las cinco verificaciones de `curl` y las cuatro de navegador ejecutadas y registradas en `docs/despliegue.md`
- [ ] `vercel env pull` confirmó `:6543` en `DATABASE_URL` y `:5432` en `DIRECT_DATABASE_URL`
- [ ] Las migraciones de producción aplicadas con `prisma migrate deploy` y registradas en el log del workflow
- [ ] `npx prisma migrate status` sin pendientes
- [ ] Backups automáticos confirmados con retención ≥ 7 días
- [ ] **Un backup restaurado de verdad** sobre la base de desarrollo, con el resultado anotado en `docs/runbook.md` §3
- [ ] Uptime check externo activo contra `/api/health` y `/menu`
- [ ] `docs/runbook.md` con las siete secciones, cada una con comandos copiables
- [ ] `docs/despliegue.md` con las casillas del primer deploy marcadas
- [ ] `docs/seguridad.md` de la Tarea 19 existe y el runbook lo referencia
- [ ] Capacitación de quince minutos hecha, con la grabación guardada
- [ ] `docs/tasks/README.md` actualizado
- [ ] Commit: `chore(21): despliegue a produccion, migraciones manuales, runbook y backups`

> **Antes de promote:** `curl -sSI https://<dominio>/ | rg -i strict-transport` tiene que imprimir la línea con `includeSubDomains`. Si no imprime nada, `NEXT_PUBLIC_SITE_URL` está vacío o mal y el sitio está sirviendo por el dominio de Vercel sin HSTS. Es el último error posible de encontrar y el más difícil de explicar después.

---

## 12. Dependencias y bloqueos

### 12.1 Depende de

| Tarea | Qué aporta | Qué pasa si falta |
|---|---|---|
| **19** | Los seis headers, RLS aplicado, `docs/seguridad.md`, `audit:bundle` y `verify:actions`, y el CSP en modo `Report-Only` | No hay qué auditar en producción ni qué referencia tiene el runbook. El smoke test del paso 4 no verifica nada |
| **20** | El pipeline que tiene que estar en verde antes de promover, y `docs/pruebas.md` | Se despliega sin gate, que es la forma de que el primer deploy rompa algo que un test hubiera visto |
| **02** | `schema.prisma` con `url` y `directUrl`, `GET /api/health`, los nombres de las variables y elSingleton de Prisma | Sin `/api/health` el smoke test es un `curl` a la home, que no dice si la base responde |
| **15** | Realtime y el canal de disponibilidad | El único chequeo que no se puede automatizar es el que se pierde |
| **06** | Upload firmado y el allowlist de formatos | La imagen que se sube en el smoke test puede no ser la que se ve después |
| **08** | `supabaseAdmin` | Es la vía de recuperación de `docs/runbook.md` §5 |

### 12.2 Habilita a

| Tarea | Qué usa de acá |
|---|---|
| **22** | El smoke test como criterio para decidir si un reporte es un bug o un uso nuevo, el runbook como fuente de la línea base de incidentes, y los KPI de uptime y errores de Server Action de `DESIGN.md` §16 con dónde mirar |

### 12.3 Bloqueos de esta tarea

| Bloqueo | Por qué | Cómo se resuelve |
|---|---|---|
| Dominio registrado | Sin dominio no hay HSTS, ni canonical, ni OG con la URL real | Se compra antes de empezar. Es lo único que no depende de nadie de este proyecto |
| `anon` key de producción para el `curl` de RLS | La verificación de §6.5 la necesita y es un secreto | La saca quien tenga acceso al dashboard de Supabase. Se usa en la terminal, no se guarda |
| Uptime check externo con cuenta creada | Sin cuenta no hay alerta de caída | Crear la cuenta en el mismo día del deploy. Mientras no exista, el sitio no tiene monitoreo |
| Ventana de mantenimiento con el local | El smoke test toca el panel y el dominio cambia la sesión del encargado | 15 minutos, acordados. El mismo día del primer deploy |

### 12.4 Decisiones que esta tarea deja establecidas

1. **El build no muta el esquema.** `prisma generate` sí, `migrate deploy` no, y el paso de migración es manual y con registro.
2. **`DATABASE_URL` es el pooler 6543 y `DIRECT_DATABASE_URL` es la directa 5432**, en todos los ambientes, y se verifica leyendo las variables antes de promover.
3. **`prisma migrate dev` y `migrate reset` no se usan jamás fuera de desarrollo.** Un reset en producción es la pérdida de datos con un comando de una palabra.
4. **El preview comparte la base de desarrollo y por eso no puede migrar.** Es la razón por la que el paso de migración está desconectado del build.
5. **Un deploy no está terminado hasta que pasó el smoke test.** Cinco `curl` y cuatro chequeos de navegador, en ese orden, después de cada deploy.
6. **Un backup que nunca se restauró no es un backup.** La restauración se prueba una vez, sobre desarrollo, y el resultado se anota.
7. **La CSP sigue en `Report-Only` al terminar esta tarea.** La etapa 3 es una decisión manual en el PR que la activa, después de una semana de tráfico real.
8. **Tres documentos de operación, tres momentos distintos:** `docs/despliegue.md` antes, `docs/runbook.md` después, `docs/seguridad.md` cuando hay una sesión o una clave en juego.
9. **El contenido se puede recuperar sin la base:** `npm run menu:exportar` deja JSON y CSV, y se corre antes de cada deploy que toque el menú.
10. **El smoke test es un documento, no un recuerdo.** Lo que no está escrito en `docs/despliegue.md` no se hizo.
