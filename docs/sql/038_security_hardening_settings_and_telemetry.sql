-- ==============================================================================
-- 038_security_hardening_settings_and_telemetry.sql
-- POS V2 - Hardening de Permisos en Configuración y Cierre de Fuga en Telemetría
-- Conforme al Estándar pos-security-shield
-- ==============================================================================

begin;

-- 1. BLINDAJE DE TENANT_SETTINGS (PROTECCIÓN DE CERTIFICADOS FISCALES Y CLAVES)
-- ------------------------------------------------------------------------------
-- Solo usuarios con permiso 'configuracion:write' o rol 'superadmin' pueden
-- actualizar o modificar la configuración de un comercio.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tenant_settings') then
    
    -- Eliminar políticas previas que permitían UPDATE a cualquier cajero/empleado
    drop policy if exists tenant_settings_update_own_tenant on public.tenant_settings;
    drop policy if exists tenant_settings_insert_own_tenant on public.tenant_settings;
    drop policy if exists tenant_settings_delete_own_tenant on public.tenant_settings;

    -- Política de actualización protegida por permiso de módulo
    create policy tenant_settings_update_own_tenant
      on public.tenant_settings
      for update
      to authenticated
      using (
        public.belongs_to_current_tenant(tenant_id)
        and (
          public.current_user_can_write('configuracion') = true
          or public.is_superadmin() = true
        )
      )
      with check (
        public.belongs_to_current_tenant(tenant_id)
        and (
          public.current_user_can_write('configuracion') = true
          or public.is_superadmin() = true
        )
      );

    -- Inserción controlada
    create policy tenant_settings_insert_own_tenant
      on public.tenant_settings
      for insert
      to authenticated
      with check (
        public.belongs_to_current_tenant(tenant_id)
        and (
          public.current_user_can_write('configuracion') = true
          or public.is_superadmin() = true
        )
      );

    -- Borrado prohibido para usuarios normales
    create policy tenant_settings_delete_own_tenant
      on public.tenant_settings
      for delete
      to authenticated
      using (public.is_superadmin() = true);

  end if;
end $$;


-- 2. BLINDAJE Y CIERRE DE FUGA EN RPC GET_TENANT_TELEMETRY
-- ------------------------------------------------------------------------------
-- Revocar ejecución pública anónima y restringir exclusivamente a SuperAdmin o service_role.

-- Revocar permisos anteriores a anon
revoke execute on function public.get_tenant_telemetry(text, text) from anon;
grant execute on function public.get_tenant_telemetry(text, text) to authenticated, service_role;

-- Recrear la función con validación de rol interna
create or replace function public.get_tenant_telemetry(p_tenant_id text default null, p_slug text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod_count int := 0;
  v_sales_count int := 0;
  v_matched_tenant_id text := null;
  v_matched_slug text := null;
begin
  -- Validación estricta: Solo SuperAdmin o la clave service_role pueden invocar esta función
  if not (public.is_superadmin() or current_user = 'service_role') then
    raise exception 'Acceso no autorizado: Se requieren permisos de SuperAdmin para consultar métricas de comercios.';
  end if;

  -- 1. Coincidencia exacta por tenant_id o slug
  select id, slug into v_matched_tenant_id, v_matched_slug
  from public.tenants
  where (p_tenant_id is not null and id = p_tenant_id)
     or (p_slug is not null and slug = p_slug)
  order by created_at desc
  limit 1;

  -- 2. Coincidencia por slug base
  if (v_matched_tenant_id is null) and p_slug is not null and p_slug <> '' then
    select id, slug into v_matched_tenant_id, v_matched_slug
    from public.tenants
    where slug ilike p_slug || '%' or id ilike 'tenant-' || p_slug || '%'
    order by created_at desc
    limit 1;
  end if;

  -- 3. Coincidencia por prefijo de ID
  if v_matched_tenant_id is null and p_tenant_id is not null and p_tenant_id <> '' then
    select id, slug into v_matched_tenant_id, v_matched_slug
    from public.tenants
    where id ilike p_tenant_id || '%'
    order by created_at desc
    limit 1;
  end if;

  if v_matched_tenant_id is not null then
    select count(*) into v_prod_count from public.products where tenant_id = v_matched_tenant_id;
    select count(*) into v_sales_count from public.sales where tenant_id = v_matched_tenant_id;

    return json_build_object(
      'tenant_id', v_matched_tenant_id,
      'slug', v_matched_slug,
      'products_count', v_prod_count,
      'sales_count', v_sales_count,
      'found', true
    );
  end if;

  return json_build_object(
    'tenant_id', p_tenant_id,
    'slug', p_slug,
    'products_count', 0,
    'sales_count', 0,
    'found', false
  );
end;
$$;

commit;
