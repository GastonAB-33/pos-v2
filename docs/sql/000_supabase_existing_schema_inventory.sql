-- POS V2 - Inventario de esquema existente en Supabase
-- Ejecutar ANTES de cualquier migracion.
--
-- Objetivo:
-- - Ver que tablas POS ya existen.
-- - Detectar tablas faltantes.
-- - Detectar columnas faltantes.
-- - Revisar tipos actuales para decidir migraciones incrementales.
-- - Revisar RLS, policies, FK e indices.
--
-- Este archivo no modifica datos ni estructura.

-- 1) Resumen de tablas esperadas vs existentes.
with expected_tables(table_name) as (
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
),
actual_tables as (
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE'
)
select
  e.table_name,
  case when a.table_name is null then 'missing' else 'exists' end as status
from expected_tables e
left join actual_tables a on a.table_name = e.table_name
order by e.table_name;

-- 2) Tablas public no esperadas por el contrato POS.
with expected_tables(table_name) as (
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
select t.table_name as extra_public_table
from information_schema.tables t
left join expected_tables e on e.table_name = t.table_name
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and e.table_name is null
order by t.table_name;

-- 3) Contrato de columnas esperado vs columnas reales.
with expected_columns(table_name, column_name) as (
  values
    ('tenants', 'id'), ('tenants', 'legal_name'), ('tenants', 'trade_name'), ('tenants', 'cuit'), ('tenants', 'is_active'), ('tenants', 'created_at'), ('tenants', 'updated_at'),
    ('permission_profiles', 'id'), ('permission_profiles', 'tenant_id'), ('permission_profiles', 'name'), ('permission_profiles', 'description'), ('permission_profiles', 'is_active'), ('permission_profiles', 'permissions'), ('permission_profiles', 'created_at'), ('permission_profiles', 'updated_at'),
    ('users', 'id'), ('users', 'tenant_id'), ('users', 'auth_user_id'), ('users', 'email'), ('users', 'username'), ('users', 'full_name'), ('users', 'role_code'), ('users', 'permission_profile_id'), ('users', 'is_active'), ('users', 'created_at'), ('users', 'updated_at'),
    ('products', 'id'), ('products', 'tenant_id'), ('products', 'code'), ('products', 'name'), ('products', 'image_url'), ('products', 'brand'), ('products', 'supplier'), ('products', 'is_favorite'), ('products', 'description'), ('products', 'price'), ('products', 'cost_price'), ('products', 'stock_current'), ('products', 'stock_min'), ('products', 'stock_max'), ('products', 'category'), ('products', 'subcategory'), ('products', 'sale_mode'), ('products', 'currency_code'), ('products', 'price_without_vat'), ('products', 'vat_percent'), ('products', 'profit_percent'), ('products', 'is_active'), ('products', 'created_at'), ('products', 'updated_at'),
    ('product_barcodes', 'id'), ('product_barcodes', 'tenant_id'), ('product_barcodes', 'product_id'), ('product_barcodes', 'barcode'), ('product_barcodes', 'is_primary'), ('product_barcodes', 'created_at'), ('product_barcodes', 'updated_at'),
    ('customers', 'id'), ('customers', 'tenant_id'), ('customers', 'code'), ('customers', 'full_name'), ('customers', 'document_type'), ('customers', 'document_number'), ('customers', 'fiscal_business_name'), ('customers', 'fiscal_address'), ('customers', 'fiscal_condition'), ('customers', 'price_list_id'), ('customers', 'email'), ('customers', 'phone'), ('customers', 'address'), ('customers', 'observations'), ('customers', 'current_balance'), ('customers', 'is_active'), ('customers', 'created_at'), ('customers', 'updated_at'),
    ('suppliers', 'id'), ('suppliers', 'tenant_id'), ('suppliers', 'code'), ('suppliers', 'name'), ('suppliers', 'phone'), ('suppliers', 'email'), ('suppliers', 'address'), ('suppliers', 'observations'), ('suppliers', 'is_active'), ('suppliers', 'created_at'), ('suppliers', 'updated_at'),
    ('payment_methods', 'id'), ('payment_methods', 'tenant_id'), ('payment_methods', 'name'), ('payment_methods', 'code'), ('payment_methods', 'type'), ('payment_methods', 'is_active'), ('payment_methods', 'affects_cash'), ('payment_methods', 'surcharge_percent'), ('payment_methods', 'discount_percent'), ('payment_methods', 'notes'), ('payment_methods', 'created_at'), ('payment_methods', 'updated_at'),
    ('bank_accounts', 'id'), ('bank_accounts', 'tenant_id'), ('bank_accounts', 'bank_name'), ('bank_accounts', 'account_type'), ('bank_accounts', 'holder_name'), ('bank_accounts', 'cbu'), ('bank_accounts', 'alias'), ('bank_accounts', 'currency_code'), ('bank_accounts', 'notes'), ('bank_accounts', 'is_active'), ('bank_accounts', 'created_at'), ('bank_accounts', 'updated_at'),
    ('origin_banks', 'id'), ('origin_banks', 'tenant_id'), ('origin_banks', 'code'), ('origin_banks', 'name'), ('origin_banks', 'is_active'), ('origin_banks', 'created_at'), ('origin_banks', 'updated_at'),
    ('installment_plans', 'id'), ('installment_plans', 'tenant_id'), ('installment_plans', 'code'), ('installment_plans', 'name'), ('installment_plans', 'installments'), ('installment_plans', 'interest_percent'), ('installment_plans', 'card_brand'), ('installment_plans', 'notes'), ('installment_plans', 'is_active'), ('installment_plans', 'created_at'), ('installment_plans', 'updated_at'),
    ('price_lists', 'id'), ('price_lists', 'tenant_id'), ('price_lists', 'name'), ('price_lists', 'code'), ('price_lists', 'description'), ('price_lists', 'is_active'), ('price_lists', 'price_mode'), ('price_lists', 'percentage_adjustment'), ('price_lists', 'created_at'), ('price_lists', 'updated_at'),
    ('price_list_items', 'id'), ('price_list_items', 'tenant_id'), ('price_list_items', 'price_list_id'), ('price_list_items', 'product_id'), ('price_list_items', 'fixed_price'), ('price_list_items', 'created_at'), ('price_list_items', 'updated_at'),
    ('promotions', 'id'), ('promotions', 'tenant_id'), ('promotions', 'name'), ('promotions', 'code'), ('promotions', 'description'), ('promotions', 'type'), ('promotions', 'scope'), ('promotions', 'product_id'), ('promotions', 'min_quantity'), ('promotions', 'discount_percent'), ('promotions', 'discount_amount'), ('promotions', 'combo_price'), ('promotions', 'starts_at'), ('promotions', 'ends_at'), ('promotions', 'is_active'), ('promotions', 'created_at'), ('promotions', 'updated_at'),
    ('purchases', 'id'), ('purchases', 'tenant_id'), ('purchases', 'supplier_id'), ('purchases', 'purchase_number'), ('purchases', 'status'), ('purchases', 'subtotal'), ('purchases', 'total'), ('purchases', 'notes'), ('purchases', 'created_by'), ('purchases', 'created_at'), ('purchases', 'updated_at'),
    ('purchase_items', 'id'), ('purchase_items', 'tenant_id'), ('purchase_items', 'purchase_id'), ('purchase_items', 'product_id'), ('purchase_items', 'product_name_snapshot'), ('purchase_items', 'quantity'), ('purchase_items', 'unit_cost'), ('purchase_items', 'line_total'), ('purchase_items', 'created_at'), ('purchase_items', 'updated_at'),
    ('current_account_movements', 'id'), ('current_account_movements', 'tenant_id'), ('current_account_movements', 'customer_id'), ('current_account_movements', 'sale_id'), ('current_account_movements', 'type'), ('current_account_movements', 'amount'), ('current_account_movements', 'balance_after'), ('current_account_movements', 'notes'), ('current_account_movements', 'created_by'), ('current_account_movements', 'created_at'), ('current_account_movements', 'updated_at'),
    ('sales', 'id'), ('sales', 'tenant_id'), ('sales', 'sale_number'), ('sales', 'customer_id'), ('sales', 'cash_session_id'), ('sales', 'status'), ('sales', 'subtotal'), ('sales', 'discount_total'), ('sales', 'tax_total'), ('sales', 'total'), ('sales', 'currency_code'), ('sales', 'notes'), ('sales', 'current_account_id'), ('sales', 'arca_document_id'), ('sales', 'mercado_pago_preference_id'), ('sales', 'created_at'), ('sales', 'updated_at'),
    ('sale_items', 'id'), ('sale_items', 'tenant_id'), ('sale_items', 'sale_id'), ('sale_items', 'product_id'), ('sale_items', 'product_name_snapshot'), ('sale_items', 'quantity'), ('sale_items', 'unit_price'), ('sale_items', 'price'), ('sale_items', 'discount_total'), ('sale_items', 'tax_total'), ('sale_items', 'line_total'), ('sale_items', 'subtotal'), ('sale_items', 'metadata'), ('sale_items', 'created_at'), ('sale_items', 'updated_at'),
    ('sale_payments', 'id'), ('sale_payments', 'tenant_id'), ('sale_payments', 'sale_id'), ('sale_payments', 'payment_method_code'), ('sale_payments', 'provider'), ('sale_payments', 'provider_code'), ('sale_payments', 'amount'), ('sale_payments', 'currency_code'), ('sale_payments', 'status'), ('sale_payments', 'provider_status'), ('sale_payments', 'provider_reference'), ('sale_payments', 'provider_metadata'), ('sale_payments', 'external_reference'), ('sale_payments', 'metadata'), ('sale_payments', 'created_at'), ('sale_payments', 'updated_at'),
    ('receipts', 'id'), ('receipts', 'tenant_id'), ('receipts', 'sale_id'), ('receipts', 'sale_number'), ('receipts', 'receipt_number'), ('receipts', 'issued_at'), ('receipts', 'customer_name'), ('receipts', 'payment_method'), ('receipts', 'items'), ('receipts', 'total'), ('receipts', 'notes'), ('receipts', 'created_by'), ('receipts', 'created_at'), ('receipts', 'updated_at'),
    ('invoices', 'id'), ('invoices', 'tenant_id'), ('invoices', 'sale_id'), ('invoices', 'customer_id'), ('invoices', 'document_type'), ('invoices', 'document_number'), ('invoices', 'issue_date'), ('invoices', 'customer_snapshot'), ('invoices', 'items_snapshot'), ('invoices', 'subtotal'), ('invoices', 'tax_total'), ('invoices', 'total'), ('invoices', 'status'), ('invoices', 'arca_status'), ('invoices', 'arca_reference'), ('invoices', 'arca_message'), ('invoices', 'notes'), ('invoices', 'created_at'), ('invoices', 'updated_at'),
    ('credit_notes', 'id'), ('credit_notes', 'tenant_id'), ('credit_notes', 'invoice_id'), ('credit_notes', 'sale_id'), ('credit_notes', 'customer_id'), ('credit_notes', 'document_number'), ('credit_notes', 'issue_date'), ('credit_notes', 'reason'), ('credit_notes', 'subtotal'), ('credit_notes', 'tax_total'), ('credit_notes', 'total'), ('credit_notes', 'status'), ('credit_notes', 'arca_status'), ('credit_notes', 'arca_reference'), ('credit_notes', 'notes'), ('credit_notes', 'created_at'), ('credit_notes', 'updated_at'),
    ('audit_logs', 'id'), ('audit_logs', 'tenant_id'), ('audit_logs', 'user_id'), ('audit_logs', 'module'), ('audit_logs', 'action'), ('audit_logs', 'entity_type'), ('audit_logs', 'entity_id'), ('audit_logs', 'description'), ('audit_logs', 'metadata'), ('audit_logs', 'created_at'),
    ('tenant_settings', 'id'), ('tenant_settings', 'tenant_id'), ('tenant_settings', 'negocio'), ('tenant_settings', 'pos'), ('tenant_settings', 'stock'), ('tenant_settings', 'caja'), ('tenant_settings', 'facturacion'), ('tenant_settings', 'codigos_balanza'), ('tenant_settings', 'apariencia'), ('tenant_settings', 'sistema'), ('tenant_settings', 'created_at'), ('tenant_settings', 'updated_at'),
    ('stock_movements', 'id'), ('stock_movements', 'tenant_id'), ('stock_movements', 'product_id'), ('stock_movements', 'movement_type'), ('stock_movements', 'quantity'), ('stock_movements', 'reference_type'), ('stock_movements', 'reference_id'), ('stock_movements', 'notes'), ('stock_movements', 'created_by'), ('stock_movements', 'created_at'), ('stock_movements', 'updated_at'),
    ('cash_sessions', 'id'), ('cash_sessions', 'tenant_id'), ('cash_sessions', 'branch_id'), ('cash_sessions', 'opened_by_user_id'), ('cash_sessions', 'closed_by_user_id'), ('cash_sessions', 'status'), ('cash_sessions', 'opened_at'), ('cash_sessions', 'closed_at'), ('cash_sessions', 'opening_amount'), ('cash_sessions', 'closing_amount'), ('cash_sessions', 'expected_closing_amount'), ('cash_sessions', 'closing_difference'), ('cash_sessions', 'notes'), ('cash_sessions', 'created_at'), ('cash_sessions', 'updated_at'),
    ('cash_movements', 'id'), ('cash_movements', 'tenant_id'), ('cash_movements', 'cash_session_id'), ('cash_movements', 'movement_type'), ('cash_movements', 'amount'), ('cash_movements', 'currency_code'), ('cash_movements', 'reference_type'), ('cash_movements', 'reference_id'), ('cash_movements', 'notes'), ('cash_movements', 'created_by'), ('cash_movements', 'created_at'), ('cash_movements', 'updated_at')
),
actual_columns as (
  select table_name, column_name, data_type, udt_name, is_nullable, column_default
  from information_schema.columns
  where table_schema = 'public'
)
select
  e.table_name,
  e.column_name,
  case when a.column_name is null then 'missing' else 'exists' end as status,
  a.data_type,
  a.udt_name,
  a.is_nullable,
  a.column_default
from expected_columns e
left join actual_columns a
  on a.table_name = e.table_name
 and a.column_name = e.column_name
order by e.table_name, e.column_name;

-- 4) Columnas reales extra en tablas POS.
with expected_columns(table_name, column_name) as (
  values
    ('users', 'auth_user_id')
),
expected_tables(table_name) as (
  values
    ('tenants'), ('permission_profiles'), ('users'), ('products'), ('product_barcodes'), ('customers'), ('suppliers'), ('payment_methods'), ('bank_accounts'), ('origin_banks'), ('installment_plans'), ('price_lists'), ('price_list_items'), ('promotions'), ('purchases'), ('purchase_items'), ('current_account_movements'), ('sales'), ('sale_items'), ('sale_payments'), ('receipts'), ('invoices'), ('credit_notes'), ('audit_logs'), ('tenant_settings'), ('stock_movements'), ('cash_sessions'), ('cash_movements')
),
contract_columns as (
  -- Reutilizar resultado largo copiando desde la consulta anterior seria incomodo en SQL Editor.
  -- Esta consulta marca extras contra el contrato documentado en src/lib/database/tables.ts,
  -- excepto auth_user_id, que fue agregado para Supabase Auth.
  select table_name, column_name
  from information_schema.columns
  where false
  union all select 'users', 'auth_user_id'
)
select
  c.table_name,
  c.column_name as extra_column,
  c.data_type,
  c.udt_name
from information_schema.columns c
join expected_tables t on t.table_name = c.table_name
left join contract_columns ec
  on ec.table_name = c.table_name
 and ec.column_name = c.column_name
where c.table_schema = 'public'
  and ec.column_name is null
  and not exists (
    select 1
    from information_schema.columns c2
    where c2.table_schema = 'public'
      and c2.table_name = c.table_name
      and c2.column_name = c.column_name
      and c2.column_name in (
        'id', 'tenant_id', 'created_at', 'updated_at',
        'legal_name', 'trade_name', 'cuit', 'is_active',
        'name', 'description', 'permissions',
        'email', 'username', 'full_name', 'role_code', 'permission_profile_id',
        'code', 'image_url', 'brand', 'supplier', 'is_favorite', 'price', 'cost_price', 'stock_current', 'stock_min', 'stock_max', 'category', 'subcategory', 'sale_mode', 'currency_code', 'price_without_vat', 'vat_percent', 'profit_percent',
        'product_id', 'barcode', 'is_primary',
        'document_type', 'document_number', 'fiscal_business_name', 'fiscal_address', 'fiscal_condition', 'price_list_id', 'phone', 'address', 'observations', 'current_balance',
        'type', 'affects_cash', 'surcharge_percent', 'discount_percent', 'notes',
        'bank_name', 'account_type', 'holder_name', 'cbu', 'alias',
        'installments', 'interest_percent', 'card_brand',
        'price_mode', 'percentage_adjustment', 'fixed_price',
        'scope', 'min_quantity', 'discount_amount', 'combo_price', 'starts_at', 'ends_at',
        'supplier_id', 'purchase_number', 'status', 'subtotal', 'total', 'created_by',
        'purchase_id', 'product_name_snapshot', 'quantity', 'unit_cost', 'line_total',
        'customer_id', 'sale_id', 'amount', 'balance_after',
        'sale_number', 'cash_session_id', 'discount_total', 'tax_total', 'current_account_id', 'arca_document_id', 'mercado_pago_preference_id',
        'unit_price', 'price', 'metadata',
        'payment_method_code', 'provider', 'provider_code', 'provider_status', 'provider_reference', 'provider_metadata', 'external_reference',
        'receipt_number', 'issued_at', 'customer_name', 'payment_method', 'items',
        'document_number', 'issue_date', 'customer_snapshot', 'items_snapshot', 'arca_status', 'arca_reference', 'arca_message',
        'invoice_id', 'reason',
        'user_id', 'module', 'action', 'entity_type', 'entity_id',
        'negocio', 'pos', 'stock', 'caja', 'facturacion', 'codigos_balanza', 'apariencia', 'sistema',
        'movement_type', 'reference_type', 'reference_id',
        'branch_id', 'opened_by_user_id', 'closed_by_user_id', 'opened_at', 'closed_at', 'opening_amount', 'closing_amount', 'expected_closing_amount', 'closing_difference'
      )
  )
order by c.table_name, c.column_name;

-- 5) RLS por tabla.
select
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
order by tablename;

-- 6) Policies existentes.
select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 7) Foreign keys existentes.
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
order by tc.table_name, kcu.column_name;

-- 8) Indices existentes.
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- 9) Conteos por tabla POS existente. No falla si alguna tabla no existe.
create temp table if not exists tmp_pos_table_counts (
  table_name text primary key,
  rows_count bigint
) on commit drop;

truncate table tmp_pos_table_counts;

do $$
declare
  table_name text;
  rows_count bigint;
begin
  foreach table_name in array array[
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
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('select count(*)::bigint from public.%I', table_name) into rows_count;
      insert into tmp_pos_table_counts values (table_name, rows_count);
    end if;
  end loop;
end $$;

select *
from tmp_pos_table_counts
order by table_name;
