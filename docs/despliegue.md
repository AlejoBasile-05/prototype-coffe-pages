# Despliegue — Mi Negocio

> **Regla de oro:** Primero el pipeline, después el build, después la migración, después el smoke test, después el dominio.
> El orden no es una preferencia. El build sin pipeline en verde produce un deploy que alguien va a tener que revertir; la migración sin smoke test produce una base con el esquema nuevo y un sitio que no lo usa; el dominio sin smoke test produce un sitio público con un error en `/menu` que se ve desde cualquier celular.

---

## Antes (10 min)

- [ ] `gh run list` muestra el pipeline de la Tarea 20 en verde
- [ ] `npm run verify` en verde en local
- [ ] Menú revisado: no hay productos en `DRAFT` que deberían estar publicados

---

## Deploy

- [ ] Merge a `main` (o promote del preview si hay staging)
- [ ] Build de Vercel en verde
- [ ] `npx prisma migrate status` — aplicado

---

## Después (5 min)

- [ ] `curl /api/health` → `{"status":"ok","database":"reachable","latencyMs":<num>}`
- [ ] `curl /menu` contiene un nombre de producto real (ej. `Classic Jamón y Queso`)
- [ ] `curl -I` → los seis headers, con HSTS (`strict-transport-security: max-age=31536000; includeSubDomains; preload`)
- [ ] Toggle de disponibilidad en dos pestañas (se propaga en < 2 s)
- [ ] Login del panel (`/admin` carga, logout redirige)
- [ ] Enlace de WhatsApp desde el checkout (abre `wa.me` con pedido completo)

---

## Verificación de variables críticas (antes de promote)

```bash
# ⛔ Hacer ANTES de promote, no después
vercel env pull .env.produccion --environment=production
rg -o 'pooler\.supabase\.com:6543|:5432' .env.produccion | sort | uniq -c
rm .env.produccion
```

**Salida esperada:**
```
      1 :5432
      1 :6543
```
- Una línea con `:6543` para `DATABASE_URL` (pooler)
- Una línea con `:5432` para `DIRECT_DATABASE_URL` (directa)
- **Si aparecen al revés, el deploy se detiene acá.**

---

## Migración de producción (manual, con registro)

```bash
# Opción 1: Desde la máquina de desarrollo (requiere DIRECT_DATABASE_URL_PROD en local)
DIRECT_DATABASE_URL="$DIRECT_DATABASE_URL_PROD" npx prisma migrate deploy
npx prisma migrate status

# Opción 2: Desde GitHub Actions (recomendado: deja registro de quién/qué/cuándo)
gh workflow run migrar-produccion.yml -f ambiente=produccion
gh run list --workflow migrar-produccion.yml --limit 1
```

**El workflow `migrar-produccion.yml`:**
- Solo `workflow_dispatch` (manual)
- Corre contra entorno protegido `produccion` (pide confirmación)
- Usa `DIRECT_DATABASE_URL_PROD` **solamente** (nunca `DATABASE_URL`)
- Registra qué migración se aplicó, cuándo y por quién

---

## Post-deploy: Smoke test completo

```bash
# 1. Sitio responde
curl -sS -o /dev/null -w '%{http_code}\n' https://<dominio>/
# ⛔ Esperado: 200

# 2. Base responde por pooler (cold start 1-3s la primera vez)
curl -sS https://<dominio>/api/health
# ⛔ Esperado: {"status":"ok","database":"reachable","latencyMs":42}
# ⛔ Si 503: deploy no sirve → parar acá y ver runbook §9.2

# 3. Catálogo se arma (HTML trae datos, no esqueleto)
curl -sS https://<dominio>/menu | rg -o 'Classic Jamón y Queso'
# ⛔ Esperado: una coincidencia. Cero = error de datos, no de HTTP.

# 4. Seis headers con HSTS (Tarea 19 §10.5)
curl -sSI https://<dominio>/ | rg -i 'strict-transport|x-frame|x-content|referrer|permissions|content-security'
# ⛔ Esperado: 6 líneas, HSTS con includeSubDomains; preload

# 5. RLS cierra con anon key real
curl -sS "https://<project-ref>.supabase.co/rest/v1/staff_members?select=id" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
# ⛔ Esperado: []. Un objeto con datos = fuga.
```

**En el navegador (lo que ningún curl alcanza):**

| # | Qué | Cómo se sabe que salió bien |
|---|-----|----------------------------|
| 1 | `/menu` carga con productos e imágenes | Las imágenes se ven. Una 404 de Cloudinary con `alt` roto delata la firma |
| 2 | Carrito y checkout | El carrito acepta, el checkout valida, el enlace abre `wa.me` con pedido completo |
| 3 | Login del panel y logout | Entra, `/admin` carga, al hacer logout `/admin` redirige |
| 4 | Toggle en dos pestañas | Se marca en una y **desaparece en la otra en < 2 s** |

---

## Dominio y SSL

1. En Vercel: Settings → Domains → Add, con el dominio del local
2. En el registrador: apunta el `A` al proyecto de Vercel (Vercel muestra el valor exacto)
3. Vercel emite el certificado automáticamente cuando el DNS propaga (minutos a una hora)
4. **Volver a poner `NEXT_PUBLIC_SITE_URL` con el dominio real y hacer un redeploy.**
   - Sin esto, canonical, OG y HSTS siguen apuntando al dominio de Vercel
5. Repetir smoke test completo. El paso 4 cambia el comportamiento de los headers.

```bash
# Verificar certificado válido y HSTS real
curl -sSI https://<dominio>/ | rg -i 'strict-transport'
# ⛔ Esperado: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## Backups y restauración probada

- [ ] Backups automáticos de Supabase: Plan → Database → Backups, retención ≥ 7 días (confirmar en panel)
- [ ] `npm run menu:exportar` → genera `exports/menu-<fecha>.json` y `.csv` con productos **PUBLICADOS**
- [ ] **Restauración probada una vez en base de desarrollo** (ver `docs/runbook.md` §3):
  - Descargar backup de la última semana
  - Subir a base descartable
  - Verificar: `prisma/_prisma_migrations` coincide, datos íntegros
  - Anotar en runbook: cuánto tardó, comando de rollback, coincidencia de migraciones

---

## Si algo de "Después" falló

**Ir a `docs/runbook.md`. No improvisar en producción.**

| Fallo | Sección del runbook |
|-------|---------------------|
| Sitio no carga / 5xx | §1 |
| Panel no abre / 401 | §2 |
| Base no responde / P1001 | §3 |
| Imágenes rotan / Cloudinary | §4 |
| Nadie puede entrar al panel | §5 |
| Deploy rompió todo | §6 (rollback) |