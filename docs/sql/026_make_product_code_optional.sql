-- 026_make_product_code_optional.sql
-- Hace opcional el código de producto para que el sistema no lo invente ni genere automáticamente.
-- En PostgreSQL, una restricción UNIQUE(tenant_id, code) permite múltiples filas con valor NULL
-- sin que colisionen entre sí.
--
-- ESTADO: EJECUTADO Y APLICADO con éxito en la base de datos de Supabase.

alter table public.products
  alter column code drop not null;

-- ============================================================================
-- CONSULTA OPCIONAL: Limpiar códigos autogenerados IMP-% en La25
--
-- Si deseas quitar automáticamente todos los códigos tipo IMP-00363, IMP-00364, etc.
-- que fueron inyectados por la importación masiva de 1.237 productos, pero
-- CONSERVANDO intactos los códigos numéricos cargados manualmente por Patricia
-- (como 45, 52, 61, etc.), descomenta y ejecuta el siguiente bloque:
-- ============================================================================

-- update public.products
-- set
--   code = null,
--   updated_at = now()
-- where tenant_id = (select id from public.tenants where lower(trade_name) = 'la25' limit 1)
--   and code like 'IMP-%';
