-- POS V2 - RLS multi-tenant para Supabase Auth
-- Requiere ejecutar antes docs/sql/001_supabase_base_schema.sql.
-- Modelo:
-- - auth.users contiene credenciales.
-- - public.users.auth_user_id apunta a auth.users.id.
-- - public.users.tenant_id define el comercio activo del usuario.

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
  select row_tenant_id = public.current_tenant_id()
$$;

alter table public.tenants enable row level security;
alter table public.permission_profiles enable row level security;
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.product_barcodes enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.payment_methods enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.origin_banks enable row level security;
alter table public.installment_plans enable row level security;
alter table public.price_lists enable row level security;
alter table public.price_list_items enable row level security;
alter table public.promotions enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.current_account_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.receipts enable row level security;
alter table public.invoices enable row level security;
alter table public.credit_notes enable row level security;
alter table public.audit_logs enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.stock_movements enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;

drop policy if exists tenants_select_own on public.tenants;
create policy tenants_select_own
on public.tenants
for select
to authenticated
using (id = public.current_tenant_id());

drop policy if exists tenants_service_all on public.tenants;
create policy tenants_service_all
on public.tenants
for all
to service_role
using (true)
with check (true);

-- Politicas tenant-scoped genericas. Los permisos finos de modulo siguen en UI;
-- la barrera critica aqui es que ningun usuario cruce tenant.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'permission_profiles',
    'users',
    'products',
    'product_barcodes',
    'customers',
    'suppliers',
    'payment_methods',
    'bank_accounts',
    'origin_banks',
    'installment_plans',
    'price_lists',
    'price_list_items',
    'promotions',
    'purchases',
    'purchase_items',
    'current_account_movements',
    'sales',
    'sale_items',
    'sale_payments',
    'receipts',
    'invoices',
    'credit_notes',
    'tenant_settings',
    'stock_movements',
    'cash_sessions',
    'cash_movements'
  ] loop
    execute format('drop policy if exists %I_select_own_tenant on public.%I', table_name, table_name);
    execute format(
      'create policy %I_select_own_tenant on public.%I for select to authenticated using (tenant_id = public.current_tenant_id())',
      table_name,
      table_name
    );

    execute format('drop policy if exists %I_insert_own_tenant on public.%I', table_name, table_name);
    execute format(
      'create policy %I_insert_own_tenant on public.%I for insert to authenticated with check (tenant_id = public.current_tenant_id())',
      table_name,
      table_name
    );

    execute format('drop policy if exists %I_update_own_tenant on public.%I', table_name, table_name);
    execute format(
      'create policy %I_update_own_tenant on public.%I for update to authenticated using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id())',
      table_name,
      table_name
    );

    execute format('drop policy if exists %I_delete_own_tenant on public.%I', table_name, table_name);
    execute format(
      'create policy %I_delete_own_tenant on public.%I for delete to authenticated using (tenant_id = public.current_tenant_id())',
      table_name,
      table_name
    );

    execute format('drop policy if exists %I_service_all on public.%I', table_name, table_name);
    execute format(
      'create policy %I_service_all on public.%I for all to service_role using (true) with check (true)',
      table_name,
      table_name
    );
  end loop;
end $$;

drop policy if exists audit_logs_insert_own_tenant on public.audit_logs;
drop policy if exists audit_logs_select_own_tenant on public.audit_logs;
create policy audit_logs_select_own_tenant
on public.audit_logs
for select
to authenticated
using (tenant_id = public.current_tenant_id());

create policy audit_logs_insert_own_tenant
on public.audit_logs
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and (user_id is null or user_id = public.current_app_user_id())
);

drop policy if exists audit_logs_service_all on public.audit_logs;
create policy audit_logs_service_all
on public.audit_logs
for all
to service_role
using (true)
with check (true);

commit;
