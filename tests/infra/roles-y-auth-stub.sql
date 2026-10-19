-- Roles de Supabase + `auth.uid()`/`auth.jwt()` para el Postgres de CI (Tarea 20 §7).
-- ⛔ NUNCA se aplica en Supabase: sólo contra el `services: postgres` del runner.
--
-- Por qué va ANTES de `prisma migrate deploy`: la migración
-- `20261003184300_rls_y_lectura_realtime` tiene guardas `IF EXISTS (rol
-- 'authenticated') AND to_regprocedure('auth.uid()')`. En un Postgres pelado
-- son falsas, la migración pasa igual y aplica RLS SIN UNA SOLA POLÍTICA: toda
-- lectura devuelve cero filas y los tests de autorización pasarían mintiendo.
--
-- ⛔ `auth.uid()` y `auth.jwt()` devuelven `NULL` salvo que la sesión haya
--    puesto los GUC `request.jwt.claim.sub` / `request.jwt.claims`, y en CI no
--    hay sesión: ninguna sesión de test es un staff, así que nadie pasa.
--
-- ⛔ `check_function_bodies` apagado sólo al crear: en algunos Postgres el
--    validador compila el cuerpo y sin `::text` no encuentra `uuid = text`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;

SELECT set_config('check_function_bodies', 'off', true);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $cuerpo$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid; $cuerpo$;

SELECT set_config('check_function_bodies', 'on', true);

-- ⛔ `auth.jwt()` no la usa la migración actual. Va igual porque una política
--    que la invoque en el futuro fallaría en el deploy con "auth.jwt() does
--    not exist", que es la forma más cara de descubrir que falta algo.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
  AS $cuerpo$ SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb; $cuerpo$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role;