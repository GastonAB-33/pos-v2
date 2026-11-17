CREATE OR REPLACE FUNCTION get_tenant_telemetry(p_tenant_id text DEFAULT NULL, p_slug text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod_count int := 0;
  v_sales_count int := 0;
  v_matched_tenant_id text := NULL;
  v_matched_slug text := NULL;
BEGIN
  -- 1. Coincidencia exacta por tenant_id o slug
  SELECT id, slug INTO v_matched_tenant_id, v_matched_slug
  FROM tenants
  WHERE (p_tenant_id IS NOT NULL AND id = p_tenant_id)
     OR (p_slug IS NOT NULL AND slug = p_slug)
  ORDER BY created_at DESC
  LIMIT 1;

  -- 2. Si no hubo coincidencia o se busca por slug base (ej: 'pepesito' buscando 'pepesito-2')
  IF (v_matched_tenant_id IS NULL OR v_prod_count = 0) AND p_slug IS NOT NULL AND p_slug <> '' THEN
    SELECT id, slug INTO v_matched_tenant_id, v_matched_slug
    FROM tenants
    WHERE slug ILIKE p_slug || '%' OR id ILIKE 'tenant-' || p_slug || '%'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- 3. Si aún no hubo coincidencia, buscar por prefijo de ID
  IF v_matched_tenant_id IS NULL AND p_tenant_id IS NOT NULL AND p_tenant_id <> '' THEN
    SELECT id, slug INTO v_matched_tenant_id, v_matched_slug
    FROM tenants
    WHERE id ILIKE p_tenant_id || '%'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_matched_tenant_id IS NOT NULL THEN
    SELECT count(*) INTO v_prod_count FROM products WHERE tenant_id = v_matched_tenant_id;
    SELECT count(*) INTO v_sales_count FROM sales WHERE tenant_id = v_matched_tenant_id;

    RETURN json_build_object(
      'tenant_id', v_matched_tenant_id,
      'slug', v_matched_slug,
      'products_count', v_prod_count,
      'sales_count', v_sales_count,
      'found', true
    );
  END IF;

  RETURN json_build_object(
    'tenant_id', p_tenant_id,
    'slug', p_slug,
    'products_count', 0,
    'sales_count', 0,
    'found', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_tenant_telemetry(text, text) TO anon, authenticated, service_role;
