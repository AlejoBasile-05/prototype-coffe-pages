# Seguridad — Mi Negocio

Qué está implementado hoy, qué NO, y por qué. Es el documento que se lee
antes de tocar autenticación, cookies, secretos o subidas.

> **Tarea 19.** Lo de acá está implementado y verificado. Lo que aparece
> marcado como **NO** no es un olvido: es una decisión de alcance, con la
> razón escrita al lado.

---

## 1. Modelo de acceso

| Capa | Qué hace | Dónde |
|---|---|---|
| UI | Deshabilita botones y oculta secciones | `AdminNav`, formularios del panel |
| **Action** | `verifyAdminSession()` antes de leer el payload | las 9 actions de escritura |
| **RLS** | Fila y columna que la sesión puede ver | `prisma/migrations/20261003184300_rls_y_lectura_realtime` |

La UI no es un control de acceso: el POST es un `fetch` que cualquiera puede
reescribir. La action es el control real, y `npm run verify:actions` falla el
build si alguna verifica la sesión después de tocar el payload.

RLS es la capa de abajo, y es **fail-closed**: para un `authenticated` sin
fila en `staff_members`, `products` devuelve cero filas.

### Qué puede leer un `authenticated`

| Tabla | Permiso |
|---|---|
| `products` | `SELECT ("id", "isAvailable")` y nada más |
| `staff_members` | `SELECT ("id", "email", "role")`, y sólo su propia fila |
| `orders`, `order_items` | `SELECT` sólo si es staff (`es_usuario_del_staff()`), para el tablero y Realtime (Tarea 23) |
| `categories`, `product_variants`, `business_settings` | nada |
| `anon` | nada en ninguna |

### Recuperación de contraseña (Tarea 24)

Flujo self-service: `/login` → mail de Supabase → `/auth/confirm`
(intercambia el token por sesión de recovery, soporta OTP y PKCE) →
`/nueva-contrasena` → `updatePasswordAction`. Mensajes anti-enumeración,
redirecciones solo a constantes del servidor, whitelist de errores en el
querystring. Requiere Site URL y Redirect URLs configuradas en el
dashboard de Supabase (ver `docs/tasks/24-recuperacion-contrasena.md`).

### La única escritura pública (Tarea 23)

`registerOrderAction` no pide sesión (la dispara el cliente del checkout).
Está defendida por: honeypot con respuesta-cebo, rate limit por IP
(5/10 min), validación Zod con el mismo schema del formulario y
**cotización server-side** — el precio lo calcula el servidor contra la
base, nunca se toma del payload. Si el registro falla, el handoff de
WhatsApp no se bloquea: el chat sigue siendo el canal sagrado.

⚠️ `anon` no tiene ni una fila porque el catálogo público lo sirve Next con
el service role. Si mañana alguien expone la anon key para "leer más rápido",
encuentra la puerta cerrada por permiso y no por costumbre.

⚠️ `FORCE ROW LEVEL SECURITY` **no** está, y no es olvido: con RLS forzado
el `service_role` de Supabase deja de hacer bypass y la aplicación entera
empieza a devolver 500.

---

## 2. Secretos

La frontera real es el prefijo `NEXT_PUBLIC_`: lo que lo lleva queda
incrustado en `.next/static` y lo lee cualquiera con las DevTools abiertas.

⛔ Nunca llevan ese prefijo: `DATABASE_URL`, `DIRECT_DATABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_API_KEY`.

```bash
npm run audit:bundle   # busca el VALOR de esas cinco en .next/static
```

Es parte de `npm run build`. Busca el valor y no el nombre, porque
`SERVICE_ROLE` aparece escrito en el código con cualquier constante y
`DATABASE_URL` en la documentación de Prisma: lo que no puede aparecer es la
clave pegada por error.

---

## 3. Cookies

| Cookie | HttpOnly | Secure | SameSite |
|---|---|---|---|
| Sesión de Supabase (`sb-*-auth-token`) | sí | en producción | `lax` |

- El refresh de sesión vive en `src/proxy.ts` y corre en `/admin/**` y
  `/login`. Fuera de esas rutas no hay nada que refrescar.
- El proxy **no** ve `/_next/static`: por eso ese `nosniff` se declara en
  `next.config.ts` y no en el proxy. Duplicar un header en los dos lugares
  produce dos cabeceras iguales y una que gana sin que se sepa cuál.

---

## 4. Uploads (Cloudinary)

El navegador sube **directo** a Cloudinary con una firma del servidor: los
megabytes no pasan por una función serverless.

- `POST /api/admin/images/sign` → 401 sin sesión (`verifyAdminSession()`).
- El `public_id` lo deriva el servidor del slug: el cliente no elige a qué
  carpeta se sube.
- La firma cubre `public_id`, `timestamp`, `overwrite`, `allowed_formats`,
  `max_file_size` y `max_image_size`. Los seis van en el mismo `FormData`:
  un parámetro firmado que no llega es un `400` de Cloudinary.
- Allowlist: `jpg,jpeg,png,webp`. ⛔ SVG nunca, ni siquiera firmado: es
  código que el navegador ejecuta.
- El tope de píxeles (24 MP) es **distinto** del de bytes (6 MB): un PNG
  de 1 KB puede tener 100 megapíxeles.

---

## 5. Lo que NO está (y por qué)

| Falta | Por qué | Dónde |
|---|---|---|
| **2FA del OWNER** | El panel tiene una sola persona con permiso de escritura de negocio. Es la deuda más grande de esta lista. | Tarea 21 |
| **CAPTCHA + rate limit en `/login`** | El login es por enlace mágico, sin password que bruteforcear; el vector real es pedir muchos enlaces. | Tarea 21 |
| **`/api/csp-report`** | La CSP va en `Report-Only` y necesita un destino donde acumularse antes de activar el bloqueo. La directiva `report-uri` ya está puesta y hoy responde 404; los reportes se ven igual en la consola del navegador. | Tarea 21 |
| **Limpieza de assets huérfanos** | Una subida que se valida mal deja el asset en Cloudinary. El `destroy` del catch cubre el caso conocido; la conciliación, no. | Tarea 21 |
| **CSP bloqueante** | Bloquear sin reportes reales rompe la app en el primer `script-src` mal calculado. | Tarea 21 |
| **Rotación de claves y procedimiento de filtración** | Requiere un proyecto Supabase real; con credenciales mock no hay nada que rotar. | Tarea 21 |

---

## 6. Si se filtró una clave

1. **Rotarla primero.** Una clave filtrada es inválida desde el momento en
   que sale del panel, no desde que uno se da cuenta.
2. `SUPABASE_SERVICE_ROLE_KEY` → Supabase → Settings → API → *Rotate*.
   RLS bypasea todo: hasta rotarla, cualquiera con esa clave lee la base
   entera, borradores incluidos.
3. `CLOUDINARY_API_SECRET` → Cloudinary → Settings → API Keys. Rotar
   invalida las firmas viejas: las subidas en curso fallan y se reintentan.
4. `DATABASE_URL` / `DIRECT_DATABASE_URL` → Supabase → Database → rotar la
   contraseña. Actualizar los dos archivos, porque migraciones y runtime usan
   conexiones distintas.
5. Revisar `npm run audit:bundle` y el despliegue: si la clave estuvo en el
   bundle, **cachés y CDNs también la tienen**.

Un log de esta app (`console.info` en `audit-log.ts`) es interno y va a la
plataforma del despliegue: nunca a un destino de terceros sin revisar.

---

## 7. Cómo se verifica

```bash
npm run verify              # lint + typecheck + test
npm run verify:actions      # las 9 actions verifican antes del payload
npm run build               # build + audit:bundle
```

La migración de RLS se puede aplicar dos veces seguidas sin efecto: es
idempotente de verdad, no "creo que sí".