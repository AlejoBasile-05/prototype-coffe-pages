-- Tarea 15 — Publicación de `products` en el canal de Realtime.
--
-- ⛔ Idempotente: `prisma migrate deploy` la puede volver a aplicar sin
--    romper nada, y una corrida nueva de `db:reset` o de un ambiente
--    nuevo queda alineada con la del local.
--
-- ⛔ Requisito: sin la publicación, la suscripción de `postgres_changes`
--    se conecta y NUNCA recibe un evento, sin ningún error visible. Es
--    el paso que más tiempo cuesta diagnosticar cuando falta (ver §6.2).
--
-- Desviación respecto del documento: se corre como migración Prisma y
-- no como archivo suelto en `supabase/migrations/`, porque el proyecto
-- versiona el esquema con `prisma migrate`. En Supabase el agente de
-- Realtime ya existe; en el Postgres vainilla del contenedor local no,
-- así que el primer IF crea la publicación.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END
$$;
