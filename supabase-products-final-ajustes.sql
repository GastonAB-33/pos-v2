-- POS V2 - Ajustes finales para Productos (foto)
-- Ejecutar una sola vez en Supabase.

BEGIN;

ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'product-images-public-read'
  ) THEN
    CREATE POLICY "product-images-public-read"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'product-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'product-images-public-write'
  ) THEN
    CREATE POLICY "product-images-public-write"
      ON storage.objects
      FOR INSERT
      WITH CHECK (bucket_id = 'product-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'product-images-public-update'
  ) THEN
    CREATE POLICY "product-images-public-update"
      ON storage.objects
      FOR UPDATE
      USING (bucket_id = 'product-images')
      WITH CHECK (bucket_id = 'product-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'product-images-public-delete'
  ) THEN
    CREATE POLICY "product-images-public-delete"
      ON storage.objects
      FOR DELETE
      USING (bucket_id = 'product-images');
  END IF;
END
$$;

COMMIT;
