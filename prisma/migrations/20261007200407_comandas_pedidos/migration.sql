-- Tarea 23 — Tablero de comandas: tablas `orders` y `order_items`.
--
-- Revierte la decisión de DESIGN.md §3.3 ("sin tabla Order"), que el
-- propio documento autorizaba a retrofitear: el pedido se registra al
-- confirmar el checkout y alimenta el tablero de cocina. El chat de
-- WhatsApp sigue siendo la confirmación humana.
--
-- Estructura del archivo, igual que `20261003184300_rls_y_lectura_realtime`:
--   1. Tablas
--   2. Publicación de Realtime
--   3. Revocación de privilegios
--   4. Permisos mínimos (SELECT de columnas) para `authenticated`
--   5. Políticas
--   6. RLS AL FINAL: una migración a medias nunca deja una tabla con
--      RLS habilitado y sin política que la deje pasar.
--
-- ⛔ Los roles `anon`/`authenticated` y `auth.uid()` son heterogéneos de
--    Supabase: todo lo que los toca va detrás de EXISTS sobre pg_roles,
--    igual que la migración de RLS. En el Postgres vainilla de Docker
--    queda RLS habilitado y sin políticas (fail-closed), y la app sigue
--    funcionando porque el dueño de las tablas no está sujeto a RLS.
--
-- ⛔ SIN `FORCE ROW LEVEL SECURITY`: el service role de Supabase y
--    Prisma deben conservar el bypass, o la app entera falla con 500.

-- ============================================================================
-- 1. Tablas
-- ============================================================================
-- Los enums se crean solo si no existen: `prisma migrate` los crea junto
-- con el resto del esquema, pero una aplicación manual del archivo no
-- debería romperse por un tipo ya creado.
DO $bloque$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus') THEN
    CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FulfillmentType') THEN
    CREATE TYPE "FulfillmentType" AS ENUM ('DELIVERY', 'PICKUP');
  END IF;
END
$bloque$;

CREATE TABLE IF NOT EXISTS "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" SERIAL NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "fulfillment" "FulfillmentType" NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "total" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "orders_orderNumber_key" ON "orders"("orderNumber");
CREATE INDEX IF NOT EXISTS "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "order_items" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "order_items_orderId_idx" ON "order_items"("orderId");

DO $bloque$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_orderId_fkey'
  ) THEN
    ALTER TABLE "order_items"
      ADD CONSTRAINT "order_items_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$bloque$;

-- ============================================================================
-- 2. Publicación de Realtime
-- ============================================================================
-- ⛔ Sin esto, la suscripción `postgres_changes` del tablero se conecta
--    y NUNCA recibe un evento, sin ningún error visible (mismo motivo
--    que la migración `20261003134210_realtime_publicacion`).
DO $bloque$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END
$bloque$;

-- ============================================================================
-- 3. Sin privilegios para `anon`: la comanda jamás sale por la anon key
-- ============================================================================
DO $bloque$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.orders FROM anon;
    REVOKE ALL ON TABLE public.order_items FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.orders FROM authenticated;
    REVOKE ALL ON TABLE public.order_items FROM authenticated;
  END IF;
END
$bloque$;

-- ============================================================================
-- 4. Lo único que se concede: SELECT al staff para el tablero y Realtime
-- ============================================================================
-- ⛔ El INSERT del checkout lo hace el SERVIDOR (service role, bypass de
--    RLS): un cliente anónimo nunca escribe esta tabla directamente. El
--    UPDATE de estado también va por Server Action con Prisma, así que a
--    `authenticated` no se le concede nada más que lectura.
DO $bloque$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON TABLE public.orders TO authenticated;
    GRANT SELECT ON TABLE public.order_items TO authenticated;
  END IF;
END
$bloque$;

-- ============================================================================
-- 5. Políticas: el staff logueado lee; nadie más
-- ============================================================================
-- Reutiliza `public.es_usuario_del_staff()`, creada por la migración de
-- RLS. Si no existe (Postgres vainilla sin el stub), no hay política y
-- `authenticated` no lee nada: fail-closed, nunca fail-open.
DO $bloque$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND to_regprocedure('auth.uid()') IS NOT NULL
     AND to_regprocedure('public.es_usuario_del_staff()') IS NOT NULL THEN

    PERFORM set_config('check_function_bodies', 'off', true);

    DROP POLICY IF EXISTS pedidos_lectura_staff ON public.orders;
    CREATE POLICY pedidos_lectura_staff
      ON public.orders
      FOR SELECT
      TO authenticated
      USING (public.es_usuario_del_staff());

    DROP POLICY IF EXISTS pedido_items_lectura_staff ON public.order_items;
    CREATE POLICY pedido_items_lectura_staff
      ON public.order_items
      FOR SELECT
      TO authenticated
      USING (public.es_usuario_del_staff());

    PERFORM set_config('check_function_bodies', 'on', true);
  END IF;
END
$bloque$;

-- ============================================================================
-- 6. ESTE ES EL PASO QUE CORTA EL ACCESO
-- ============================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
