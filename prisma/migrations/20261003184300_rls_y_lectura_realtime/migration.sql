-- Tarea 19 §6.1 — RLS: el panel no se apoya solo en `verifyAdminSession()`.
--
-- ⛔ Habilita RLS **al final**, después de función, permisos y políticas
--    (§4.3): activarlo al principio cortaría el acceso antes de que exista
--    la política que lo deja pasar, y una migración a medio aplicar deja la
--    tabla en el peor de los dos mundos.
--
-- ⛔ `force row level security` NO está a propósito: Prisma y el service
--    role de Supabase deben conservar el bypass. Con RLS forzado, el
--    `service_role` deja de saltarlo y la aplicación entera se rompe con
--    500 en el primer request de catálogo.
--
-- ⚠️ Desviación respecto de §6.1: la doc la plantea como SQL suelto en
--    `supabase/migrations/`. Acá corre como migración Prisma, porque el
--    proyecto versiona el esquema con `prisma migrate` (mismo criterio que
--    la migración de la Tarea 15). La publicación de Realtime que la doc
--    menciona en el mismo punto YA la agrega la Tarea 15 y no se repite.
--
-- ⚠️ Roles y `auth.uid()` son heterogéneos de Supabase (§2.4): en un
--    Postgres vainilla no existen. Por eso TODO lo que los necesita va
--    detrás de un EXISTS sobre `pg_roles`. En local queda RLS habilitado y
--    sin políticas —fail-closed para `authenticated`, y la app sigue
--    funcionando porque el dueño de las tablas no está sujeto a RLS sin
--    FORCE—. En Supabase entra todo.

-- ============================================================================
-- 1. Función de seguridad
-- ============================================================================
-- ⛔ `security definer`: el staff ya está en el JWT y ya ve la base, así que
--    la función no agrega permiso propio; lo que hace es NO volver a
--    repetir el chequeo de sesión en el servidor.
-- ⛔ `search_path` vacío y todo calificado con `public.`: sin esto, un objeto
--    malicioso creado antes en otro esquema homónimo (`auth.staff_members`,
--    por ejemplo) pasa por delante del real.
--
-- ⚠️ Desviación de §6.1: el filtro es `s.id = auth.uid()` y NO agrega
--    `AND s.is_active = true`, porque `StaffMember` no tiene esa columna —
--    la baja de una persona es BORRAR su fila, que es lo que ya hace
--    `verifyAdminSession()`. Inventar un `is_active` que no existe rompe la
--    migración entera, y un `COALESCE(s.is_active, true)` para zafar sería
--    peor: dejaría pasar a quien ya fue dado de baja.
--
-- ⚠️ El `::text` no es cosmético: `staff_members.id` es `text` y
--    `auth.uid()` devuelve `uuid`. Sin la conversión, Postgres no encuentra
--    el operador y la política no se crea.
DO $bloque$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND to_regprocedure('auth.uid()') IS NOT NULL THEN

    -- ⚠️ `check_function_bodies` apagado SÓLO para la creación: el cuerpo
    --    llama a `auth.uid()` y en un Postgres sin el esquema `auth` el
    --    validador lo rechaza aunque la policy que lo usa sea válida.
    --    `set_config(..., true)` es el equivalente de `SET LOCAL`: muere con
    --    la transacción y no filtra al resto de la sesión.
    PERFORM set_config('check_function_bodies', 'off', true);

    CREATE OR REPLACE FUNCTION public.es_usuario_del_staff()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = ''
    AS $cuerpo$
      SELECT EXISTS (
        SELECT 1
        FROM public.staff_members s
        WHERE s.id = auth.uid()::text
      );
    $cuerpo$;

    PERFORM set_config('check_function_bodies', 'on', true);
  END IF;
END
$bloque$;

-- ============================================================================
-- 2. Sin privilegios de lectura para `anon` ni para `authenticated`
-- ============================================================================
-- ⛔ El catálogo público lo sirve Next con el service role; `anon` no
--    necesita ni una fila. Si mañana alguien expone la anon key para leer
--    "más rápido", ya encuentra la puerta cerrada por permiso y no por
--    costumbre.
--
-- ⛔ `REVOKE ALL ON TABLE` NO alcanza para los permisos por COLUMNA que
--    haya dejado una corrida anterior: siguen vivos. Por eso el bloque
--    recorre `pg_attribute` y revoca columna por columna. Es la diferencia
--    entre "no veo `name` porque no me lo dieron" y "no veo `name` porque
--    nadie lo puede volver a pedir".
DO $bloque$
DECLARE
  tabla text;
  columna text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['products', 'categories', 'product_variants',
                              'business_settings', 'staff_members']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tabla);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', tabla);

      FOR columna IN
        SELECT attname
        FROM pg_attribute
        WHERE attrelid = format('public.%I', tabla)::regclass
          AND attnum > 0
          AND NOT attisdropped
      LOOP
        EXECUTE format('REVOKE ALL (%I) ON TABLE public.%I FROM authenticated',
                       columna, tabla);
      END LOOP;
    END IF;
  END LOOP;
END
$bloque$;

-- ============================================================================
-- 3. Lo único que se concede: el par que necesita el canal de disponibilidad
-- ============================================================================
-- ⛔ `("id", "isAvailable")` y NADA más. Con `name` incluido —como hacía la
--    versión anterior de este archivo— cualquier usuario con un JWT válido
--    se llevaba el catálogo completo saltándose la API: el RLS filtra
--    filas, pero un permiso de columna no lo filtra. `id` no se puede
--    adivinar y `isAvailable` es el único dato que la UI necesita para
--    pintar el switch en vivo.
--
-- ⚠️ `"isAvailable"` y no `is_available` como escribe §6.1: el proyecto
--    versiona el esquema con Prisma y las columnas van en camelCase entre
--    comillas dobles. Sin las comillas, Postgres lo pliega a minúsculas y
--    la migración muere con `column "isavailable" does not exist`.
DO $bloque$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ("id", "isAvailable") ON TABLE public.products TO authenticated;

    -- La fila propia: un staff necesita ver la suya para la pantalla de
    -- perfil, y el `id` está firme en el WHERE de la política de abajo, no
    -- como parámetro. Sin `name`: el directorio del equipo no es un dato
    -- que el panel necesite para autenticar a nadie.
    GRANT SELECT ("id", "email", "role") ON TABLE public.staff_members TO authenticated;
  END IF;
END
$bloque$;

-- ============================================================================
-- 4. Políticas de lectura
-- ============================================================================
-- ⛔ `DROP POLICY IF EXISTS` + `CREATE`: reejecutable sin adivinar nada. Es
--    idempotente de verdad —la segunda pasada deja exactamente el mismo
--    estado— y más simple que consultar `pg_policies` y reescribir la
--    definición a mano.
DO $bloque$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND to_regprocedure('auth.uid()') IS NOT NULL THEN

    PERFORM set_config('check_function_bodies', 'off', true);

    -- El panel (y el canal de Realtime, que usa la misma conexión del
    -- usuario): lee productos, pero RLS no alcanza si el permiso de
    -- tabla es total, así que las dos capas hacen falta.
    DROP POLICY IF EXISTS productos_lectura_staff_disponibilidad ON public.products;
    CREATE POLICY productos_lectura_staff_disponibilidad
      ON public.products
      FOR SELECT
      TO authenticated
      USING (public.es_usuario_del_staff());

    -- Un staff ve SU fila y ninguna otra: lo que hace falta es un destino
    -- para el mensaje "tu sesión ya no es válida", no el directorio del
    -- equipo.
    DROP POLICY IF EXISTS staff_lee_su_propia_fila ON public.staff_members;
    CREATE POLICY staff_lee_su_propia_fila
      ON public.staff_members
      FOR SELECT
      TO authenticated
      USING (id = auth.uid()::text);

    PERFORM set_config('check_function_bodies', 'on', true);
  END IF;
END
$bloque$;

-- ============================================================================
-- 5. ESTE ES EL PASO QUE CORTA EL ACCESO
-- ============================================================================
-- ⛔ Va al final, dentro del mismo archivo, para que una aplicación parcial
--    no deje una tabla con RLS habilitado y ninguna política que la deje
--    pasar. Ver §2.4 de la doc.
--
-- ⚠️ `categories`, `product_variants` y `business_settings` quedan SIN
--    política a propósito: los lee el servidor con el service role. Para un
--    `authenticated` no existe una fila que ver, que es la respuesta
--    correcta mientras la API sea la única puerta de lectura.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- ⛔ `FORCE ROW LEVEL SECURITY` NO se agrega, y esto no es olvido: con RLS
--    forzado, el service role de Supabase deja de hacer bypass y la
--    aplicación entera empieza a fallar con 500. Si algún día hace falta,
--    es con una política de service role explícita, no con FORCE.