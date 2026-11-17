-- ==============================================================================
-- 037_security_hardening_rls_fixes.sql
-- POS V2 - Hardening de Seguridad, Corrección de Políticas RLS y Aislamiento de Storage
-- Conforme al Manual Técnico y Operativo de Ciberseguridad (Security Shield)
-- ==============================================================================

begin;

-- 1. FUNCIÓN HELPER SEGURA PARA IDENTIFICAR SUPERADMINISTRADORES
-- ------------------------------------------------------------------------------
-- Unifica la validación tanto por role_code como por role, evitando fallos
-- de esquema entre distintas versiones de public.users.
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select true
    from public.users u
    where u.auth_user_id = auth.uid()
      and (
        u.role_code = 'superadmin' 
        or coalesce(to_jsonb(u)->>'role', '') = 'superadmin'
      )
      and u.is_active = true
    limit 1
  ), false);
$$;

grant execute on function public.is_superadmin() to authenticated;

-- 2. CORRECCIÓN DE POLÍTICAS RLS EN EL CRM Y SUSCRIPCIONES SAAS
-- ------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'crm_leads') then
    drop policy if exists "SuperAdmin full access on crm_leads" on public.crm_leads;
    create policy "SuperAdmin full access on crm_leads"
      on public.crm_leads
      for all
      to authenticated
      using (public.is_superadmin())
      with check (public.is_superadmin());
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'crm_activities') then
    drop policy if exists "SuperAdmin full access on crm_activities" on public.crm_activities;
    create policy "SuperAdmin full access on crm_activities"
      on public.crm_activities
      for all
      to authenticated
      using (public.is_superadmin())
      with check (public.is_superadmin());
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tenant_billing_transactions') then
    drop policy if exists "SuperAdmin full access on tenant_billing_transactions" on public.tenant_billing_transactions;
    create policy "SuperAdmin full access on tenant_billing_transactions"
      on public.tenant_billing_transactions
      for all
      to authenticated
      using (public.is_superadmin())
      with check (public.is_superadmin());
  end if;
end $$;

-- 3. BLINDAJE DEL CATÁLOGO MAESTRO (PREVENCIÓN DE ENVENENAMIENTO DE DATOS)
-- ------------------------------------------------------------------------------
-- Solo el SuperAdmin puede insertar productos verificados (is_verified = true)
-- Los comercios normales pueden colaborar pero sus altas entran como no verificadas (is_verified = false).
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'master_products') then
    drop policy if exists "master_products_insert_policy" on public.master_products;
    
    create policy "master_products_insert_policy" on public.master_products
      for insert
      to authenticated
      with check (
        -- Si es superadmin puede insertar directamente verificado
        public.is_superadmin() = true
        or
        -- Si es usuario de comercio, el registro debe quedar pendiente de verificación
        (is_verified = false)
      );

    -- Solo SuperAdmin puede modificar o eliminar del catálogo maestro
    drop policy if exists "master_products_modify_policy" on public.master_products;
    create policy "master_products_modify_policy" on public.master_products
      for update
      to authenticated
      using (public.is_superadmin())
      with check (public.is_superadmin());

    drop policy if exists "master_products_delete_policy" on public.master_products;
    create policy "master_products_delete_policy" on public.master_products
      for delete
      to authenticated
      using (public.is_superadmin());
  end if;
end $$;

-- 4. POLÍTICAS RLS PARA SUPABASE STORAGE (BUCKET PRODUCT-IMAGES)
-- ------------------------------------------------------------------------------
-- Aislamiento estricto: un comercio solo puede subir/modificar/borrar archivos
-- dentro de la carpeta que coincide con su propio tenant_id:
-- Ruta requerida: <tenant_id>/<product_id>/<timestamp>-<hash>.<ext>
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    
    -- Lectura pública de imágenes de producto
    drop policy if exists "product_images_public_read" on storage.objects;
    create policy "product_images_public_read"
      on storage.objects
      for select
      using (bucket_id = 'product-images');

    -- Subida aislada por tenant_id
    drop policy if exists "product_images_tenant_insert" on storage.objects;
    create policy "product_images_tenant_insert"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] = public.current_tenant_id()
      );

    -- Actualización y borrado aislados por tenant_id
    drop policy if exists "product_images_tenant_update" on storage.objects;
    create policy "product_images_tenant_update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] = public.current_tenant_id()
      );

    drop policy if exists "product_images_tenant_delete" on storage.objects;
    create policy "product_images_tenant_delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] = public.current_tenant_id()
      );
  end if;
end $$;

commit;
