# Tarea 24 — Recuperación de contraseña (self-service)

## Motivo

El proyecto no tenía ruta para completar el recovery de Supabase: el link
del mail se consumía en `/auth/v1/verify` y redirigía a la Site URL sin
nadie que intercambiara el token por sesión → `otp_expired` en pantalla.

## Configuración requerida en el dashboard de Supabase (manual)

1. **Authentication → URL Configuration → Site URL**: el dominio real de
   producción (no `localhost`).
2. **Redirect URLs**: `https://<dominio>/auth/confirm` y, para
   desarrollo, `http://localhost:3001/**` (comodín de puerto: el dev
   server de Next cambia de puerto cuando 3000 está ocupado, y el
   `redirectTo` se construye con el ORIGEN DEL REQUEST — si el puerto no
   está whitelisteada, el mail llega a un servidor inexistente o Supabase
   rechaza el envío).
3. **Email Templates → "Reset Password"**: suficiente con dejarla como
   está, ver la nota del flujo implícito abajo. Recomendado igual:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
   (server-side puro, tokens de un solo uso, sin fallback por hash).

## Flujo (con fallback para el flujo implícito)

```
/login «Olvidé mi contraseña»
  → requestPasswordResetAction (redirectTo = origin del request)
  → mail de Supabase
  → /auth/confirm (route handler)
      · token_hash + type=recovery → verifyOtp (server)
      · code (PKCE)                → exchangeCodeForSession (server)
      · SIN query params           → ¿tokens en el #fragmento?
                                     (la plantilla por defecto aterriza
                                     así: el fragmento NUNCA llega al
                                     servidor) → redirect a /auth/hash,
                                     que el navegador sigue CON el hash,
                                     y HashRecovery lo lee en el cliente
                                     y lo canjea por cookies de sesión
                                     vía POST /auth/session
  → /nueva-contrasena (FUERA del layout de /login: ese layout redirige
    a /admin a quien ya tiene sesión, y la sesión de recovery ES sesión)
  → updatePasswordAction
      · exige sesión válida vía getUser() (validación contra el servidor)
      · NO exige staff: cambiar la propia contraseña no requiere panel
      · PasswordResetSchema: min 8, max 200, confirmación idéntica
  → redirect /admin
```

### `POST /auth/session` — defensas

Same-origin estricto (Origin == Host), body JSON ≤ 32 KB, tokens ≤ 8 KB,
y confirmación contra el servidor de Auth: un 200 de este endpoint es
"sesión válida de verdad", no "setSession no tiró excepción".

## Decisiones de seguridad

- **Mensaje genérico solo para el éxito**: la anti-enumeración la
  garantiza Supabase (responde igual exista o no el email); si la API
  devuelve ERROR de infraestructura (URL inválida, redirect no permitido,
  rate limit), la action responde `ok: false` visible en pantalla. Un
  "te enviamos el link" tras un fallo de envío deja al usuario esperando
  un correo que nunca llega — fue el bug real detectado el 2026-10-08
  (`.env.local` con placeholders `PENDIENTE`, corregido en esa fecha).
- **Sin open redirect**: `/auth/confirm` redirige solo a constantes del
  servidor; jamás al `redirect_to` del querystring.
- **Errores de Supabase al log, no a la URL**: los `error_code` crudos le
  confirmarían a un atacante el estado del token robado.
- **Whitelist de errores en `/login`**: solo `link-invalido` tiene texto;
  ningún otro valor del querystring se pinta en pantalla.
- El proxy (`proxy.ts`) renueva sesión solo en `/admin` y `/login`; el
  intercambio del token en `/auth/confirm` escribe las cookies propias
  en el Route Handler y no necesita pasar por el proxy.

## Archivos

| Pieza | Archivo |
|---|---|
| Route Handler (OTP/PKCE) | `src/app/auth/confirm/route.ts` |
| Fallback flujo implícito | `src/app/auth/hash/page.tsx`, `src/components/admin/HashRecovery.tsx`, `src/app/auth/session/route.ts` |
| Página (fuera de /login) | `src/app/nueva-contrasena/page.tsx` |
| Formulario | `src/components/admin/NuevaContrasenaForm.tsx` |
| Módulo de auth | `src/server/auth/recovery.ts` |
| Actions | `requestPasswordResetAction`, `updatePasswordAction` en `src/server/auth/actions.ts` |
| Schema | `PasswordResetSchema` en `src/server/schemas/auth.schema.ts` |
| Entrada | `LoginForm` (sección «Olvidé mi contraseña» + error saneado) |
| Tests | `tests/unit/auth-schema-recovery.test.ts`, `NuevaContrasenaForm.component.test.tsx`, `HashRecovery.component.test.tsx` |
