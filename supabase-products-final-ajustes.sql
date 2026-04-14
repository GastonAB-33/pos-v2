-- POS V2 - Ajustes finales para Productos (foto)
-- Ejecutar una sola vez en Supabase.

BEGIN;

ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS image_url text;

COMMIT;
