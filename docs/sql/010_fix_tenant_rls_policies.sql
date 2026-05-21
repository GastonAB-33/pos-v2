-- 010_fix_tenant_rls_policies.sql
-- POS V2 - Correccion de RLS multi-tenant para esquema existente.
--
-- Objetivo:
-- - Eliminar policies temporales dev_all_anon/dev_all_auth que permiten acceso total.
-- - Restringir acceso authenticated al tenant del usuario logueado.
-- - Bloquear acceso anon a datos del POS.
--
-- Requisitos previos:
-- - public.users.auth_user_id existe y apunta al id de auth.users.
-- - Cada usuario activo tiene public.users.tenant_id.
--
-- Ejecutar en Supabase SQL Editor. No ejecutar parcialmente.

begin;

create or replace function public.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.is_active = true
  limit 1
$$;

create or replace function public.current_tenant_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.tenant_id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.is_active = true
  limit 1
$$;

create or replace function public.current_user_can_write(module_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((pp.permissions -> module_name ->> 'write')::boolean, false)
  from public.users u
  join public.permission_profiles pp
    on pp.id = u.permission_profile_id
   and pp.tenant_id = u.tenant_id
  where u.auth_user_id = auth.uid()
    and u.is_active = true
    and pp.is_active = true
  limit 1
$$;

create or replace function public.current_user_can_read(module_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((pp.permissions -> module_name ->> 'read')::boolean, false)
      or coalesce((pp.permissions -> module_name ->> 'write')::boolean, false)
  from public.users u
  join public.permission_profiles pp
    on pp.id = u.permission_profile_id
   and pp.tenant_id = u.tenant_id
  where u.auth_user_id = auth.uid()
    and u.is_active = true
    and pp.is_active = true
  limit 1
$$;

create or replace function public.belongs_to_current_tenant(row_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select row_tenant_id is not null
     and public.current_tenant_id() is not null
     and row_tenant_id = public.current_tenant_id()
$$;

grant execute on function public.current_app_user_id() to authenticated;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.current_user_can_write(text) to authenticated;
grant execute on function public.current_user_can_read(text) to authenticated;
grant execute on function public.belongs_to_current_tenant(text) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'audit_logs',
    'bank_accounts',
    'cash_movements',
    'cash_sessions',
    'credit_notes',
    'current_account_movements',
    'customers',
    'installment_plans',
    'invoices',
    'origin_banks',
    'payment_methods',
    'permission_profiles',
    'price_list_items',
    'price_lists',
    'product_barcodes',
    'products',
    'promotions',
    'purchase_items',
    'purchases',
    'receipts',
    'sale_items',
    'sale_payments',
    'sales',
    'stock_movements',
    'suppliers',
    'tenant_settings',
    'tenants',
    'users'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists dev_all_anon on public.%I', table_name);
    execute format('drop policy if exists dev_all_auth on public.%I', table_name);

    execute format('drop policy if exists %I_select_own_tenant on public.%I', table_name, table_name);
    execute format('drop policy if exists %I_insert_own_tenant on public.%I', table_name, table_name);
    execute format('drop policy if exists %I_update_own_tenant on public.%I', table_name, table_name);
    execute format('drop policy if exists %I_delete_own_tenant on public.%I', table_name, table_name);
    execute format('drop policy if exists %I_service_all on public.%I', table_name, table_name);
  end loop;
end $$;

drop policy if exists tenants_select_own on public.tenants;
create policy tenants_select_own
on public.tenants
for select
to authenticated
using (id = public.current_tenant_id());

drop policy if exists users_select_own_tenant on public.users;
create policy users_select_own_tenant
on public.users
for select
to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists users_insert_own_tenant on public.users;
create policy users_insert_own_tenant
on public.users
for insert
to authenticated
with check (tenant_id = public.current_tenant_id());

drop policy if exists users_update_own_tenant on public.users;
create policy users_update_own_tenant
on public.users
for update
to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists users_delete_own_tenant on public.users;
create policy users_delete_own_tenant
on public.users
for delete
to authenticated
using (tenant_id = public.current_tenant_id());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'audit_logs',
    'bank_accounts',
    'cash_movements',
    'cash_sessions',
    'credit_notes',
    'current_account_movements',
    'customers',
    'installment_plans',
    'invoices',
    'origin_banks',
    'payment_methods',
    'permission_profiles',
    'price_list_items',
    'price_lists',
    'product_barcodes',
    'products',
    'promotions',
    'purchase_items',
    'purchases',
    'receipts',
    'sale_items',
    'sale_payments',
    'sales',
    'stock_movements',
    'suppliers',
    'tenant_settings'
  ] loop
    execute format(
      'create policy %I_select_own_tenant on public.%I for select to authenticated using (public.belongs_to_current_tenant(tenant_id))',
      table_name,
      table_name
    );

    execute format(
      'create policy %I_insert_own_tenant on public.%I for insert to authenticated with check (public.belongs_to_current_tenant(tenant_id))',
      table_name,
      table_name
    );

    execute format(
      'create policy %I_update_own_tenant on public.%I for update to authenticated using (public.belongs_to_current_tenant(tenant_id)) with check (public.belongs_to_current_tenant(tenant_id))',
      table_name,
      table_name
    );

    execute format(
      'create policy %I_delete_own_tenant on public.%I for delete to authenticated using (public.belongs_to_current_tenant(tenant_id))',
      table_name,
      table_name
    );
  end loop;
end $$;

-- El rol service_role de Supabase normalmente bypassa RLS. Estas policies son explicitas
-- para herramientas internas que no tengan bypassrls en algun entorno local.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'audit_logs',
    'bank_accounts',
    'cash_movements',
    'cash_sessions',
    'credit_notes',
    'current_account_movements',
    'customers',
    'installment_plans',
    'invoices',
    'origin_banks',
    'payment_methods',
    'permission_profiles',
    'price_list_items',
    'price_lists',
    'product_barcodes',
    'products',
    'promotions',
    'purchase_items',
    'purchases',
    'receipts',
    'sale_items',
    'sale_payments',
    'sales',
    'stock_movements',
    'suppliers',
    'tenant_settings',
    'tenants',
    'users'
  ] loop
    execute format(
      'create policy %I_service_all on public.%I for all to service_role using (true) with check (true)',
      table_name,
      table_name
    );
  end loop;
end $$;

commit;

-- Resumen esperado:
-- - No deben quedar policies dev_all_anon/dev_all_auth.
-- - Deben quedar policies *_own_tenant para authenticated.
select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
