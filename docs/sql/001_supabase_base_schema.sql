-- POS V2 - Esquema base Supabase
-- Ejecutar primero en un proyecto Supabase nuevo o revisado.
-- Idempotente en la mayor parte de objetos; revisar antes de aplicar en produccion.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.tenants (
  id text primary key default gen_random_uuid()::text,
  legal_name text not null,
  trade_name text not null,
  cuit text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_cuit_key unique (cuit)
);

create table if not exists public.permission_profiles (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permission_profiles_tenant_name_key unique (tenant_id, name)
);

create table if not exists public.users (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text,
  username text,
  full_name text not null,
  role_code text,
  permission_profile_id text not null references public.permission_profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_tenant_email_key unique (tenant_id, email),
  constraint users_tenant_username_key unique (tenant_id, username)
);

create table if not exists public.products (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  image_url text,
  brand text,
  supplier text,
  is_favorite boolean not null default false,
  description text,
  price numeric(14,2) not null default 0,
  cost_price numeric(14,2) not null default 0,
  stock_current numeric(14,3) not null default 0,
  stock_min numeric(14,3),
  stock_max numeric(14,3),
  category text not null default 'General',
  subcategory text,
  sale_mode text not null default 'unit' check (sale_mode in ('unit', 'weight')),
  currency_code text not null default 'ARS',
  price_without_vat numeric(14,2),
  vat_percent numeric(7,3),
  profit_percent numeric(7,3),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_tenant_code_key unique (tenant_id, code)
);

create table if not exists public.product_barcodes (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  barcode text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_barcodes_tenant_barcode_key unique (tenant_id, barcode)
);

create table if not exists public.customers (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  code text not null,
  full_name text not null,
  document_type text not null check (document_type in ('dni', 'cuit')),
  document_number text not null,
  fiscal_business_name text,
  fiscal_address text,
  fiscal_condition text,
  price_list_id text,
  email text,
  phone text,
  address text,
  observations text,
  current_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_tenant_code_key unique (tenant_id, code),
  constraint customers_tenant_document_key unique (tenant_id, document_type, document_number)
);

create table if not exists public.suppliers (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  phone text,
  email text,
  address text,
  observations text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_tenant_code_key unique (tenant_id, code)
);

create table if not exists public.payment_methods (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  name text not null,
  code text not null,
  type text not null check (type in ('cash', 'card_debit', 'card_credit', 'transfer', 'mercado_pago', 'cheque', 'current_account')),
  is_active boolean not null default true,
  affects_cash boolean not null default false,
  surcharge_percent numeric(7,3) not null default 0,
  discount_percent numeric(7,3) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_methods_tenant_code_key unique (tenant_id, code)
);

create table if not exists public.bank_accounts (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  bank_name text not null,
  account_type text not null check (account_type in ('caja_ahorro', 'cuenta_corriente', 'billetera_virtual', 'otro')),
  holder_name text not null,
  cbu text,
  alias text,
  currency_code text not null default 'ARS',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.origin_banks (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint origin_banks_tenant_code_key unique (tenant_id, code)
);

create table if not exists public.installment_plans (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  installments integer not null check (installments > 0),
  interest_percent numeric(7,3) not null default 0,
  card_brand text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint installment_plans_tenant_code_key unique (tenant_id, code)
);

create table if not exists public.price_lists (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  is_active boolean not null default true,
  price_mode text not null check (price_mode in ('percentage', 'fixed')),
  percentage_adjustment numeric(8,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_lists_tenant_code_key unique (tenant_id, code)
);

create table if not exists public.price_list_items (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  price_list_id text not null references public.price_lists(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  fixed_price numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_list_items_unique_product unique (tenant_id, price_list_id, product_id)
);

create table if not exists public.promotions (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  type text not null check (type in ('percentage_discount', 'fixed_discount', 'combo_price')),
  scope text not null check (scope in ('product', 'cart')),
  product_id text references public.products(id) on delete cascade,
  min_quantity numeric(14,3),
  discount_percent numeric(7,3),
  discount_amount numeric(14,2),
  combo_price numeric(14,2),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_tenant_code_key unique (tenant_id, code)
);

create table if not exists public.purchases (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  supplier_id text not null references public.suppliers(id),
  purchase_number text not null,
  status text not null check (status in ('confirmed', 'cancelled')),
  subtotal numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchases_tenant_number_key unique (tenant_id, purchase_number)
);

create table if not exists public.purchase_items (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  purchase_id text not null references public.purchases(id) on delete cascade,
  product_id text not null references public.products(id),
  product_name_snapshot text not null,
  quantity numeric(14,3) not null,
  unit_cost numeric(14,2) not null,
  line_total numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  sale_number text not null,
  customer_id text references public.customers(id) on delete set null,
  cash_session_id text,
  status text not null check (status in ('draft', 'completed', 'cancelled')),
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  currency_code text not null default 'ARS',
  notes text,
  current_account_id text,
  arca_document_id text,
  mercado_pago_preference_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_tenant_number_key unique (tenant_id, sale_number)
);

create table if not exists public.sale_items (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  sale_id text not null references public.sales(id) on delete cascade,
  product_id text not null references public.products(id),
  product_name_snapshot text not null,
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  price numeric(14,2),
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  subtotal numeric(14,2),
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sale_payments (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  sale_id text not null references public.sales(id) on delete cascade,
  payment_method_code text not null,
  provider text not null default 'internal',
  provider_code text not null default 'internal',
  amount numeric(14,2) not null,
  currency_code text not null default 'ARS',
  status text not null check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  provider_status text not null check (provider_status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  provider_reference text,
  provider_metadata jsonb,
  external_reference text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receipts (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  sale_id text not null references public.sales(id) on delete cascade,
  sale_number text not null,
  receipt_number text not null,
  issued_at timestamptz not null default now(),
  customer_name text,
  payment_method text not null,
  items jsonb not null default '[]'::jsonb,
  total numeric(14,2) not null default 0,
  notes text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receipts_tenant_number_key unique (tenant_id, receipt_number)
);

create table if not exists public.current_account_movements (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  sale_id text references public.sales(id) on delete set null,
  type text not null check (type in ('debt', 'payment', 'adjustment')),
  amount numeric(14,2) not null,
  balance_after numeric(14,2) not null,
  notes text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  sale_id text references public.sales(id) on delete set null,
  customer_id text references public.customers(id) on delete set null,
  document_type text not null check (document_type in ('A', 'B', 'C', 'PRESUPUESTO')),
  document_number text not null,
  issue_date timestamptz not null default now(),
  customer_snapshot jsonb,
  items_snapshot jsonb not null default '[]'::jsonb,
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  status text not null check (status in ('draft', 'issued', 'cancelled')),
  arca_status text not null check (arca_status in ('pending', 'not_sent', 'accepted', 'rejected')),
  arca_reference text,
  arca_message text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_tenant_document_key unique (tenant_id, document_type, document_number)
);

create table if not exists public.credit_notes (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  invoice_id text references public.invoices(id) on delete set null,
  sale_id text references public.sales(id) on delete set null,
  customer_id text references public.customers(id) on delete set null,
  document_number text not null,
  issue_date timestamptz not null default now(),
  reason text not null check (reason in ('return', 'price_adjustment', 'cancellation', 'other')),
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  status text not null check (status in ('draft', 'issued', 'cancelled')),
  arca_status text not null check (arca_status in ('pending', 'not_sent', 'accepted', 'rejected')),
  arca_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_notes_tenant_document_key unique (tenant_id, document_number)
);

create table if not exists public.tenant_settings (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  negocio jsonb not null default '{}'::jsonb,
  pos jsonb not null default '{}'::jsonb,
  stock jsonb not null default '{}'::jsonb,
  caja jsonb not null default '{}'::jsonb,
  facturacion jsonb not null default '{}'::jsonb,
  codigos_balanza jsonb not null default '{}'::jsonb,
  apariencia jsonb not null default '{}'::jsonb,
  sistema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_settings_tenant_key unique (tenant_id)
);

create table if not exists public.stock_movements (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment', 'sale', 'purchase')),
  quantity numeric(14,3) not null,
  reference_type text not null,
  reference_id text,
  notes text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cash_sessions (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  branch_id text,
  opened_by_user_id text not null references public.users(id),
  closed_by_user_id text references public.users(id),
  status text not null check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_amount numeric(14,2) not null default 0,
  closing_amount numeric(14,2),
  expected_closing_amount numeric(14,2),
  closing_difference numeric(14,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_cash_session_fk'
      and conrelid = 'public.sales'::regclass
  ) then
    alter table public.sales
      add constraint sales_cash_session_fk
      foreign key (cash_session_id) references public.cash_sessions(id) on delete set null;
  end if;
end $$;

create table if not exists public.cash_movements (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  cash_session_id text not null references public.cash_sessions(id) on delete cascade,
  movement_type text not null check (movement_type in ('income', 'expense', 'sale_payment', 'adjustment')),
  amount numeric(14,2) not null,
  currency_code text not null default 'ARS',
  reference_type text not null,
  reference_id text,
  notes text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  user_id text references public.users(id) on delete set null,
  module text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  description text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tenants_active_idx on public.tenants(is_active);

create index if not exists users_tenant_idx on public.users(tenant_id);
create index if not exists users_auth_user_id_idx on public.users(auth_user_id);
create index if not exists products_tenant_idx on public.products(tenant_id);
create index if not exists products_tenant_active_idx on public.products(tenant_id, is_active);
create index if not exists product_barcodes_tenant_product_idx on public.product_barcodes(tenant_id, product_id);
create index if not exists customers_tenant_idx on public.customers(tenant_id);
create index if not exists customers_tenant_active_idx on public.customers(tenant_id, is_active);
create index if not exists sales_tenant_created_idx on public.sales(tenant_id, created_at desc);
create index if not exists sale_items_tenant_sale_idx on public.sale_items(tenant_id, sale_id);
create index if not exists sale_payments_tenant_sale_idx on public.sale_payments(tenant_id, sale_id);
create index if not exists receipts_tenant_sale_idx on public.receipts(tenant_id, sale_id);
create index if not exists current_account_movements_tenant_customer_idx on public.current_account_movements(tenant_id, customer_id, created_at);
create index if not exists stock_movements_tenant_product_idx on public.stock_movements(tenant_id, product_id, created_at desc);
create index if not exists cash_sessions_tenant_user_status_idx on public.cash_sessions(tenant_id, opened_by_user_id, status);
create index if not exists cash_movements_tenant_session_idx on public.cash_movements(tenant_id, cash_session_id, created_at desc);
create index if not exists audit_logs_tenant_created_idx on public.audit_logs(tenant_id, created_at desc);

do $$
declare
  table_name text;
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
    'tenant_settings',
    'stock_movements',
    'cash_sessions',
    'cash_movements'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

commit;
