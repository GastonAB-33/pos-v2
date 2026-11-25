-- 040_sync_tenant_inherited_images.sql
-- Sincronización masiva de fotografías del Catálogo Maestro Global (public.master_products)
-- hacia los productos de tenants que no tienen foto cargada (image_url IS NULL o vacía).
-- MANTIENE 100% INTACTOS:
--   - Nombres personalizados del comercio
--   - Precios de venta y costos
--   - Categorías y subcategorías
--   - Control de stock y existencias
--   - Descripciones y notas

-- 1. Sincronizar por tabla de códigos de barras (public.product_barcodes)
UPDATE public.products p
SET image_url = mp.image_url,
    updated_at = now()
FROM public.product_barcodes pb
JOIN public.master_products mp ON mp.barcode = pb.barcode
WHERE p.id = pb.product_id
  AND (p.image_url IS NULL OR trim(p.image_url) = '')
  AND mp.image_url IS NOT NULL
  AND trim(mp.image_url) != '';

-- 2. Sincronizar por código directo de producto (public.products.code)
UPDATE public.products p
SET image_url = mp.image_url,
    updated_at = now()
FROM public.master_products mp
WHERE p.code = mp.barcode
  AND (p.image_url IS NULL OR trim(p.image_url) = '')
  AND mp.image_url IS NOT NULL
  AND trim(mp.image_url) != '';
