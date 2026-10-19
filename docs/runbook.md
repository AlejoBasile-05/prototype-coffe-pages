# Runbook — Mi Negocio

## 0. A quién llamar y dónde mirar primero

**Contactos críticos:**
- **Encargado del local** (WhatsApp): `+54 9 261 XXX XXXX` — Decisiones de negocio, validación de datos
- **Desarrollador** (GitHub/Telegram): Revisar logs, CI/CD, migraciones
- **Supabase Dashboard**: `https://supabase.com/dashboard/project/PROJECT_REF` — Estado de la base, logs de Auth, pooler
- **Vercel Dashboard**: `https://vercel.com/...` — Deploys, logs de funciones, variables de entorno
- **Cloudinary Dashboard**: `https://cloudinary.com/console` — Uploads, cuota, assets

**Primeros 3 comandos de diagnóstico:**
```bash
# 1. ¿El sitio responde?
curl -sS -o /dev/null -w '%{http_code}\n' https://<dominio>/

# 2. ¿La base responde por el pooler?
curl -sS https://<dominio>/api/health

# 3. ¿Los headers de seguridad están?
curl -sSI https://<dominio>/ | rg -i 'strict-transport|x-frame|x-content|referrer|permissions|content-security'
```

---

## 1. Si el sitio no carga

**Síntoma:** `curl https://<dominio>/` devuelve 5xx, timeout, o DNS no resuelve.

**Antes de tocar nada:**
```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://<dominio>/
curl -sSI https://<dominio>/ | head -20
```

**Causa 1 — Deploy fallido en Vercel.**
```bash
# En Vercel Dashboard → Deployments → último deploy → ver logs
# Buscar: "Error:", "Failed to compile", "P1001", "ENOTFOUND"
# Si hay error de build: corregir código y re-pushear a main
```

**Causa 2 — DNS no propagado o mal configurado.**
```bash
# Verificar registro A en el registrador
dig +short <dominio> @1.1.1.1
# Debe coincidir con la IP que muestra Vercel en Settings → Domains
```

**Causa 3 — Middleware/Proxy rompe la request (Tarea 19).**
```bash
# Revisar logs de Vercel → Functions → middleware (o proxy en Next 16)
# Error típico: redirect loop, header duplicado, CSP bloqueando
# Fix: corregir src/proxy.ts y redeploy
```

**Qué NO hacer:**
- Cambiar variables de entorno en Vercel sin saber qué tocas
- Forzar redeploy sin leer el log de error

---

## 2. Si el panel no abre o da error

**Síntoma:** `/admin` redirige a login, da 401/403, o muestra página en blanco.

**Antes de tocar nada:**
```bash
# Verificar que la sesión existe
curl -sS -H "Cookie: <cookie_del_navegador>" https://<dominio>/admin
# O en DevTools: Application → Cookies → buscar sesión de Supabase
```

**Causa 1 — Sesión expirada o cookie no enviada.**
- El usuario debe volver a loguearse en `/login`
- Verificar que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` estén bien en Vercel (Production + Preview)

**Causa 2 — Usuario no está en `staff_members` (Tarea 19 RLS).**
```bash
# En Supabase Dashboard → Table Editor → staff_members
# Verificar que exista fila con id = user.id del usuario
# Rol debe ser OWNER o STAFF
```

**Causa 3 — `verifyAdminSession` falla (Supabase Auth caído).**
```bash
# Verificar en Supabase Dashboard → Auth → Logs
# Si hay 5xx: esperar a que Supabase se recupere (status.supabase.com)
```

**Qué NO hacer:**
- Borrar filas de `staff_members` sin tener otro OWNER
- Modificar RLS sin probar con `anon` key (ver §3)

---

## 3. Si la base no responde

**Síntoma:** `GET /api/health` devuelve `{"status":"error","database":"unreachable"}`, o las páginas con datos dan 500.

**Antes de tocar nada:**
```bash
curl -sS https://<dominio>/api/health
```

**Causa 1 — La base de desarrollo está pausada (Supabase la pausa a los 7 días de inactividad).**
```bash
# En el dashboard de Supabase → el proyecto aparece con estado "Paused"
# Botón "Restore". Esperar a que vuelva a "Active".
```

**Causa 2 — Se agotó el pool de conexiones.**
```bash
# El síntoma es distinto: el health check responde ok y después,
# con tráfico, aparecen "too many connections"
# En Vercel → el proyecto → Settings → Environment Variables
# Verificar que DATABASE_URL termina en :6543 y NO en :5432
# Si termina en :5432, está usando la conexión directa: corregir y redeploy
```

**Qué NO hacer:** `prisma migrate reset` en producción. Borra los datos y la Tarea 02 §9 dice por qué no se usa jamás fuera de desarrollo.

---

## 4. Si Cloudinary no carga

**Síntoma:** Imágenes rotas en `/menu` o panel, 404 en `res.cloudinary.com`, error al subir en panel.

**Antes de tocar nada:**
```bash
# Probar una imagen conocida
curl -sSI "https://res.cloudinary.com/modo-miga/image/upload/..." | head -5
# Verificar cuota en Cloudinary Dashboard → Usage
```

**Causa 1 — Credenciales incorrectas o rotadas.**
```bash
# En Vercel → Settings → Environment Variables
# Verificar CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
# Deben coincidir con Cloudinary Dashboard → Settings → API Keys
```

**Causa 2 — Cuota excedida (plan Free: 25 GB/mes, 25k transformaciones).**
```bash
# Cloudinary Dashboard → Usage → ver barra de progreso
# Si está lleno: upgrade plan o limpiar assets no usados
```

**Causa 3 — Allowlist de formatos/firmas (Tarea 06 §6.3).**
```bash
# El panel muestra el mensaje de la Tarea 06 y el producto no se guarda
# Revisar: la firma expira en 10 min, el formato debe ser jpg/jpeg/png/webp
# Verificar que el allowlist en el servidor coincida con lo que firma el cliente
```

**Qué NO hacer:**
- Subir imágenes sin firma (la ruta de firma devuelve 401 sin sesión)
- Cambiar `CLOUDINARY_API_SECRET` sin actualizar Vercel y redeploy

---

## 5. Si se perdió el acceso al panel

**Síntoma:** Nadie puede loguearse como OWNER/STAFF, o el único admin perdió credenciales.

**Causa 1 — Contraseña olvidada / enlace mágico no llega.**
```bash
# 1. En Supabase Dashboard → Authentication → Users
#    Buscar el email → "Send password reset email" o "Magic link"
# 2. Si el email no existe: crear usuario en Auth → "Add user"
#    Luego insertar en staff_members con rol OWNER (ver abajo)
```

**Causa 2 — No hay ningún OWNER en `staff_members`.**
```bash
# Requiere DIRECT_DATABASE_URL de producción (secreto en Vercel/GitHub)
# Conectar a la base:
psql "$DIRECT_DATABASE_URL_PROD"

# Ver estado actual:
SELECT * FROM staff_members;

# Promover a OWNER (reemplazar UUID real):
INSERT INTO staff_members (id, email, name, role)
VALUES ('uuid-del-usuario-auth', 'email@dominio.com', 'Nombre', 'OWNER')
ON CONFLICT (id) DO UPDATE SET role = 'OWNER';
```

**Causa 3 — Supabase Auth deshabilitado / proyecto pausado.**
```bash
# Ver §3 Causa 1: reactivar proyecto en Supabase Dashboard
```

**Qué NO hacer:**
- Compartir `SUPABASE_SERVICE_ROLE_KEY` por chat/email
- Crear usuarios en Auth sin fila correspondiente en `staff_members`

---

## 6. Si hay que volver atrás (rollback)

**Síntoma:** Deploy rompió producción (páginas 500, headers faltantes, datos incorrectos).

**Escenario A — La migración NO se aplicó (solo código malo).**
```bash
# Vercel → Deployments → el anterior (verde) → "Promote to Production"
# Esto revierte el código SIN tocar la base
# Verificar smoke test §6.5 post-deploy
```

**Escenario B — La migración YA se aplicó (esquema nuevo + código viejo = roto).**
```bash
# NO se hace rollback de esquema automáticamente (Prisma no tiene migrate down)
# 1. Crear migración nueva que revierte los cambios:
#    npx prisma migrate diff --from-schema-datasource --to-schema-datamodel prisma/schema.prisma --script > revert.sql
#    Revisar revert.sql MANUALMENTE antes de aplicar
# 2. Aplicar en producción (workflow migrar-produccion.yml):
#    gh workflow run migrar-produccion.yml -f ambiente=produccion
#    (usar DIRECT_DATABASE_URL_PROD en el secret)
# 3. Recién después: Vercel → Deployments → el anterior → Promote to Production
```

**Qué NO hacer:**
- `git revert` de una migración: deja la base y el código en estados que nadie puede leer
- `prisma migrate reset` en producción: borra todos los datos

---

## 7. Contactos y accesos

| Qué | Dónde | Quién tiene acceso |
|-----|-------|-------------------|
| **Dominio / DNS** | Registrador (ej. Nic.ar, GoDaddy) | Encargado / Desarrollador |
| **Vercel Project** | `vercel.com/equipo/proyecto` | Desarrollador (Owner) |
| **Supabase Project** | `supabase.com/dashboard/project/PROJECT_REF` | Desarrollador (Owner) |
| **Cloudinary** | `cloudinary.com/console` | Desarrollador |
| **GitHub Repo** | `github.com/...` | Desarrollador |
| **Secrets Vercel (Prod)** | Vercel → Settings → Env Variables (scope Production) | Solo Developedor |
| **Secrets GitHub (Migración)** | GitHub → Settings → Secrets → Actions → `DIRECT_DATABASE_URL_PROD` | Solo Desarrollador |
| **`anon` key para RLS test** | Supabase → Settings → API → `anon public` | Quién haga smoke test |

**Variables críticas que NUNCA van al repo:**
- `DATABASE_URL` (pooler 6543)
- `DIRECT_DATABASE_URL` (directa 5432)
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDINARY_API_SECRET`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (distinta por ambiente)

**Para smoke test RLS (requiere `anon` key real):**
```bash
export ANON_KEY="<copiar_de_supabase_dashboard>"
curl -sS "https://<project-ref>.supabase.co/rest/v1/staff_members?select=id" \
  -H "apikey: $ANON_KEY"
# Debe devolver: []
```