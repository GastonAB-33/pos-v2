-- 015_enforce_module_write_permissions.sql
-- POS V2 - Endurece RLS para que las escrituras respeten permisos por modulo.
--
-- Ejecutar en Supabase SQL Editor despues de 010_fix_tenant_rls_policies.sql.
--
-- Objetivo:
-- - Mantener aislamiento por tenant.
-- - Permitir lectura solo si el usuario puede leer/escribir el modulo asociado.
-- - Permitir insert/update/delete solo si el usuario puede escribir el modulo asociado.
-- - Excepciones controladas:
--   - El POS puede leer configuracion/catalogos necesarios para vender, sin editarlos.
--   - El POS puede escribir auditoria solo del modulo que esta operando.
--   - El POS puede actualizar solo stock de productos durante una venta,
--   sin poder editar nombre, precio, codigo ni otros datos comerciales del producto.

begin;

create or replace function public.can_read_module(module_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_read(module_name)
$$;

create or replace function public.can_write_module(module_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_write(module_name)
$$;

grant execute on function public.can_read_module(text) to authenticated;
grant execute on function public.can_write_module(text) to authenticated;

create or replace function public.enforce_products_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_can_write('productos') then
    return new;
  end if;

  if public.current_user_can_write('pos') or public.current_user_can_write('stock') then
    if new.id is not distinct from old.id
      and new.tenant_id is not distinct from old.tenant_id
      and new.code is not distinct from old.code
      and new.name is not distinct from old.name
      and new.description is not distinct from old.description
      and new.category is not distinct from old.category
      and new.cost is not distinct from old.cost
      and new.price is not distinct from old.price
      and new.min_stock is not distinct from old.min_stock
      and new.unit is not distinct from old.unit
      and new.is_active is not distinct from old.is_active
      and new.created_at is not distinct from old.created_at
      and new.brand is not distinct from old.brand
      and new.supplier is not distinct from old.supplier
      and new.cost_price is not distinct from old.cost_price
      and new.stock_min is not distinct from old.stock_min
      and new.stock_max is not distinct from old.stock_max
      and new.subcategory is not distinct from old.subcategory
      and new.sale_mode is not distinct from old.sale_mode
      and new.currency_code is not distinct from old.currency_code
      and new.is_favorite is not distinct from old.is_favorite
      and new.price_without_vat is not distinct from old.price_without_vat
      and new.vat_percent is not distinct from old.vat_percent
      and new.profit_percent is not distinct from old.profit_percent
      and new.image_url is not distinct from old.image_url
    then
      return new;
    end if;
  end if;

  raise exception 'No tenes permisos para modificar datos de productos'
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_enforce_products_update_permissions on public.products;
create trigger trg_enforce_products_update_permissions
before update on public.products
for each row
execute function public.enforce_products_update_permissions();

do $$
declare
  item record;
begin
  for item in
    select *
    from (
      values
        ('audit_logs', 'auditoria', 'auditoria'),
        ('bank_accounts', 'configuracion_contable', 'configuracion_contable'),
        ('cash_movements', 'caja', 'caja'),
        ('cash_sessions', 'caja', 'caja'),
        ('credit_notes', 'facturacion', 'facturacion'),
        ('current_account_movements', 'cuentas_corrientes', 'cuentas_corrientes'),
        ('customers', 'clientes', 'clientes'),
        ('installment_plans', 'medios_pago', 'medios_pago'),
        ('invoices', 'facturacion', 'facturacion'),
        ('origin_banks', 'medios_pago', 'medios_pago'),
        ('payment_methods', 'medios_pago', 'medios_pago'),
        ('permission_profiles', 'usuarios', 'usuarios'),
        ('price_list_items', 'listas_precios', 'listas_precios'),
        ('price_lists', 'listas_precios', 'listas_precios'),
        ('product_barcodes', 'productos', 'productos'),
        ('products', 'productos', 'productos'),
        ('promotions', 'promociones', 'promociones'),
        ('purchase_items', 'compras', 'compras'),
        ('purchases', 'compras', 'compras'),
        ('receipts', 'comprobantes', 'pos'),
        ('sale_items', 'pos', 'pos'),
        ('sale_payments', 'pos', 'pos'),
        ('sales', 'pos', 'pos'),
        ('stock_movements', 'stock', 'pos'),
        ('suppliers', 'proveedores', 'proveedores'),
        ('tenant_settings', 'configuracion', 'configuracion')
    ) as mapping(table_name, read_module, write_module)
  loop
    execute format('drop policy if exists %I_select_own_tenant on public.%I', item.table_name, item.table_name);
    execute format('drop policy if exists %I_insert_own_tenant on public.%I', item.table_name, item.table_name);
    execute format('drop policy if exists %I_update_own_tenant on public.%I', item.table_name, item.table_name);
    execute format('drop policy if exists %I_delete_own_tenant on public.%I', item.table_name, item.table_name);

    execute format(
      'create policy %I_select_own_tenant on public.%I for select to authenticated using (public.belongs_to_current_tenant(tenant_id) and public.can_read_module(%L))',
      item.table_name,
      item.table_name,
      item.read_module
    );

    execute format(
      'create policy %I_insert_own_tenant on public.%I for insert to authenticated with check (public.belongs_to_current_tenant(tenant_id) and public.can_write_module(%L))',
      item.table_name,
      item.table_name,
      item.write_module
    );

    execute format(
      'create policy %I_update_own_tenant on public.%I for update to authenticated using (public.belongs_to_current_tenant(tenant_id) and public.can_write_module(%L)) with check (public.belongs_to_current_tenant(tenant_id) and public.can_write_module(%L))',
      item.table_name,
      item.table_name,
      item.write_module,
      item.write_module
    );

    execute format(
      'create policy %I_delete_own_tenant on public.%I for delete to authenticated using (public.belongs_to_current_tenant(tenant_id) and public.can_write_module(%L))',
      item.table_name,
      item.table_name,
      item.write_module
    );
  end loop;
end $$;

-- Politicas especiales.

drop policy if exists audit_logs_insert_own_tenant on public.audit_logs;
create policy audit_logs_insert_own_tenant
on public.audit_logs
for insert
to authenticated
with check (
  public.belongs_to_current_tenant(tenant_id)
  and (
    public.can_write_module('auditoria')
    or public.can_write_module(module)
  )
);

drop policy if exists bank_accounts_select_own_tenant on public.bank_accounts;
create policy bank_accounts_select_own_tenant
on public.bank_accounts
for select
to authenticated
using (
  public.belongs_to_current_tenant(tenant_id)
  and (
    public.can_read_module('configuracion_contable')
    or public.can_read_module('pos')
  )
);

drop policy if exists installment_plans_select_own_tenant on public.installment_plans;
create policy installment_plans_select_own_tenant
on public.installment_plans
for select
to authenticated
using (
  public.belongs_to_current_tenant(tenant_id)
  and (
    public.can_read_module('medios_pago')
    or public.can_read_module('pos')
  )
);

drop policy if exists origin_banks_select_own_tenant on public.origin_banks;
create policy origin_banks_select_own_tenant
on public.origin_banks
for select
to authenticated
using (
  public.belongs_to_current_tenant(tenant_id)
  and (
    public.can_read_module('medios_pago')
    or public.can_read_module('pos')
  )
);

drop policy if exists payment_methods_select_own_tenant on public.payment_methods;
create policy payment_methods_select_own_tenant
on public.payment_methods
for select
to authenticated
using (
  public.belongs_to_current_tenant(tenant_id)
  and (
    public.can_read_module('medios_pago')
    or public.can_read_module('pos')
  )
);

drop policy if exists products_update_own_tenant on public.products;
create policy products_update_own_tenant
on public.products
for update
to authenticated
using (
  public.belongs_to_current_tenant(tenant_id)
  and (
    public.can_write_module('productos')
    or public.can_write_module('pos')
    or public.can_write_module('stock')
  )
)
with check (
  public.belongs_to_current_tenant(tenant_id)
  and (
    public.can_write_module('productos')
    or public.can_write_module('pos')
    or public.can_write_module('stock')
  )
);

drop policy if exists users_select_own_tenant on public.users;
create policy users_select_own_tenant
on public.users
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.can_read_module('usuarios')
    or id = public.current_app_user_id()
  )
);

drop policy if exists users_insert_own_tenant on public.users;
create policy users_insert_own_tenant
on public.users
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.can_write_module('usuarios')
);

drop policy if exists users_update_own_tenant on public.users;
create policy users_update_own_tenant
on public.users
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.can_write_module('usuarios')
)
with check (
  tenant_id = public.current_tenant_id()
  and public.can_write_module('usuarios')
);

drop policy if exists users_delete_own_tenant on public.users;
create policy users_delete_own_tenant
on public.users
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.can_write_module('usuarios')
);

drop policy if exists tenants_select_own on public.tenants;
create policy tenants_select_own
on public.tenants
for select
to authenticated
using (id = public.current_tenant_id());

drop policy if exists tenant_settings_select_own_tenant on public.tenant_settings;
create policy tenant_settings_select_own_tenant
on public.tenant_settings
for select
to authenticated
using (
  public.belongs_to_current_tenant(tenant_id)
  and (
    public.can_read_module('configuracion')
    or public.can_read_module('pos')
    or public.can_read_module('caja')
  )
);

commit;

select
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('products', 'users', 'sales', 'customers', 'cash_movements', 'current_account_movements')
order by tablename, policyname;
