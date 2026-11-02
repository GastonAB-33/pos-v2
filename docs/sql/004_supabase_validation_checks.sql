-- POS V2 - Validaciones post-migracion
-- Ejecutar despues de 001, 002 y bootstrap de tenants.

-- 1) Tablas esperadas.
with expected(table_name) as (
  values
    ('tenants'),
    ('permission_profiles'),
    ('users'),
    ('products'),
    ('product_barcodes'),
    ('customers'),
    ('suppliers'),
    ('payment_methods'),
    ('bank_accounts'),
    ('origin_banks'),
    ('installment_plans'),
    ('price_lists'),
    ('price_list_items'),
    ('promotions'),
    ('purchases'),
    ('purchase_items'),
    ('current_account_movements'),
    ('sales'),
    ('sale_items'),
    ('sale_payments'),
    ('receipts'),
    ('invoices'),
    ('credit_notes'),
    ('audit_logs'),
    ('tenant_settings'),
    ('stock_movements'),
    ('cash_sessions'),
    ('cash_movements')
)
select e.table_name as missing_table
from expected e
left join information_schema.tables t
  on t.table_schema = 'public'
 and t.table_name = e.table_name
where t.table_name is null
order by e.table_name;

-- 2) Tablas tenant-scoped sin tenant_id.
with tenant_scoped(table_name) as (
  values
    ('permission_profiles'),
    ('users'),
    ('products'),
    ('product_barcodes'),
    ('customers'),
    ('suppliers'),
    ('payment_methods'),
    ('bank_accounts'),
    ('origin_banks'),
    ('installment_plans'),
    ('price_lists'),
    ('price_list_items'),
    ('promotions'),
    ('purchases'),
    ('purchase_items'),
    ('current_account_movements'),
    ('sales'),
    ('sale_items'),
    ('sale_payments'),
    ('receipts'),
    ('invoices'),
    ('credit_notes'),
    ('audit_logs'),
    ('tenant_settings'),
    ('stock_movements'),
    ('cash_sessions'),
    ('cash_movements')
)
select ts.table_name as table_without_tenant_id
from tenant_scoped ts
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = ts.table_name
 and c.column_name = 'tenant_id'
where c.column_name is null
order by ts.table_name;

-- 3) RLS deshabilitado en tablas POS.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'tenants',
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
    'audit_logs',
    'tenant_settings',
    'stock_movements',
    'cash_sessions',
    'cash_movements'
  )
  and rowsecurity = false
order by tablename;

-- 4) Usuarios internos sin vinculo Auth.
select
  t.trade_name,
  u.id,
  u.email,
  u.username,
  u.full_name,
  u.is_active
from public.users u
join public.tenants t on t.id = u.tenant_id
where u.auth_user_id is null
order by t.trade_name, u.full_name;

-- 5) Usuarios Auth vinculados a mas de un usuario interno.
select
  auth_user_id,
  count(*) as linked_users
from public.users
where auth_user_id is not null
group by auth_user_id
having count(*) > 1;

-- 6) Resumen por tenant.
select
  t.id,
  t.trade_name,
  count(distinct u.id) as users_count,
  count(distinct p.id) as products_count,
  count(distinct c.id) as customers_count,
  count(distinct s.id) as sales_count
from public.tenants t
left join public.users u on u.tenant_id = t.id
left join public.products p on p.tenant_id = t.id
left join public.customers c on c.tenant_id = t.id
left join public.sales s on s.tenant_id = t.id
group by t.id, t.trade_name
order by t.trade_name;

-- 7) Tenants referenciados que no existen. Debe devolver 0 filas.
with used_tenants as (
  select tenant_id from public.permission_profiles
  union select tenant_id from public.users
  union select tenant_id from public.products
  union select tenant_id from public.product_barcodes
  union select tenant_id from public.customers
  union select tenant_id from public.suppliers
  union select tenant_id from public.payment_methods
  union select tenant_id from public.bank_accounts
  union select tenant_id from public.origin_banks
  union select tenant_id from public.installment_plans
  union select tenant_id from public.price_lists
  union select tenant_id from public.price_list_items
  union select tenant_id from public.promotions
  union select tenant_id from public.purchases
  union select tenant_id from public.purchase_items
  union select tenant_id from public.current_account_movements
  union select tenant_id from public.sales
  union select tenant_id from public.sale_items
  union select tenant_id from public.sale_payments
  union select tenant_id from public.receipts
  union select tenant_id from public.invoices
  union select tenant_id from public.credit_notes
  union select tenant_id from public.audit_logs
  union select tenant_id from public.tenant_settings
  union select tenant_id from public.stock_movements
  union select tenant_id from public.cash_sessions
  union select tenant_id from public.cash_movements
)
select distinct u.tenant_id
from used_tenants u
left join public.tenants t on t.id = u.tenant_id
where t.id is null
order by u.tenant_id;

