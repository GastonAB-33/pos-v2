-- POS V2 - Align existing Supabase schema with current app expectations
-- Safe for development environments with partially-created tables.

-- ------------------------------------------------------------
-- 1. Inspect current public schema
-- ------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

BEGIN;

SET search_path TO public;

-- ------------------------------------------------------------
-- 2. Helpers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 3. Create missing tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id text PRIMARY KEY,
  legal_name text NOT NULL,
  trade_name text NOT NULL,
  cuit text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permission_profiles (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NULL,
  username text NULL,
  full_name text NOT NULL,
  role_code text NULL,
  permission_profile_id text NOT NULL REFERENCES public.permission_profiles(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CHECK (email IS NOT NULL OR username IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.products (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  brand text NULL,
  supplier text NULL,
  description text NULL,
  price numeric(14,2) NOT NULL DEFAULT 0,
  cost_price numeric(14,2) NOT NULL DEFAULT 0,
  stock_current numeric(14,3) NOT NULL DEFAULT 0,
  stock_min numeric(14,3) NULL,
  stock_max numeric(14,3) NULL,
  category text NOT NULL,
  subcategory text NULL,
  sale_mode text NOT NULL DEFAULT 'unit',
  currency_code text NOT NULL DEFAULT 'ARS',
  is_favorite boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.product_barcodes (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  barcode text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, barcode)
);

CREATE TABLE IF NOT EXISTS public.customers (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  full_name text NOT NULL,
  document_type text NOT NULL,
  document_number text NOT NULL,
  fiscal_business_name text NULL,
  fiscal_address text NULL,
  fiscal_condition text NULL,
  price_list_id text NULL,
  email text NULL,
  phone text NULL,
  address text NULL,
  observations text NULL,
  current_balance numeric(14,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  phone text NULL,
  email text NULL,
  address text NULL,
  observations text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  affects_cash boolean NOT NULL DEFAULT false,
  surcharge_percent numeric(6,2) NOT NULL DEFAULT 0,
  discount_percent numeric(6,2) NOT NULL DEFAULT 0,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_type text NOT NULL,
  holder_name text NOT NULL,
  cbu text NULL,
  alias text NULL,
  currency_code text NOT NULL DEFAULT 'ARS',
  notes text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.origin_banks (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.installment_plans (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  installments integer NOT NULL,
  interest_percent numeric(6,2) NOT NULL DEFAULT 0,
  card_brand text NULL,
  notes text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.price_lists (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  price_mode text NOT NULL DEFAULT 'percentage',
  percentage_adjustment numeric(10,2) NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.price_list_items (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  price_list_id text NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  fixed_price numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promotions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text NULL,
  type text NOT NULL,
  scope text NOT NULL,
  product_id text NULL REFERENCES public.products(id) ON DELETE SET NULL,
  min_quantity numeric(14,3) NULL,
  discount_percent numeric(6,2) NULL,
  discount_amount numeric(14,2) NULL,
  combo_price numeric(14,2) NULL,
  starts_at timestamptz NULL,
  ends_at timestamptz NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id text NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  purchase_number text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  notes text NULL,
  created_by text NULL REFERENCES public.users(id) ON DELETE SET NULL,
  items jsonb NULL,
  supplier jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, purchase_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchase_id text NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name_snapshot text NOT NULL,
  quantity numeric(14,3) NOT NULL DEFAULT 0,
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id text NULL,
  opened_by_user_id text NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  closed_by_user_id text NULL REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT NOW(),
  closed_at timestamptz NULL,
  opening_amount numeric(14,2) NOT NULL DEFAULT 0,
  closing_amount numeric(14,2) NULL,
  expected_closing_amount numeric(14,2) NULL,
  closing_difference numeric(14,2) NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_number text NOT NULL,
  customer_id text NULL REFERENCES public.customers(id) ON DELETE SET NULL,
  cash_session_id text NULL REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'completed',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'ARS',
  notes text NULL,
  current_account_id text NULL,
  arca_document_id text NULL,
  mercado_pago_preference_id text NULL,
  items jsonb NULL,
  payments jsonb NULL,
  customer jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, sale_number)
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id text NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name_snapshot text NOT NULL,
  quantity numeric(14,3) NOT NULL DEFAULT 0,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sale_payments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id text NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  payment_method_code text NOT NULL,
  provider text NOT NULL DEFAULT 'internal',
  provider_code text NOT NULL DEFAULT 'internal',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'ARS',
  status text NOT NULL DEFAULT 'approved',
  provider_status text NOT NULL DEFAULT 'approved',
  provider_reference text NULL,
  provider_metadata jsonb NULL,
  external_reference text NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.current_account_movements (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id text NULL REFERENCES public.sales(id) ON DELETE SET NULL,
  type text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  balance_after numeric(14,2) NOT NULL DEFAULT 0,
  notes text NULL,
  created_by text NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.receipts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id text NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  sale_number text NOT NULL,
  receipt_number text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT NOW(),
  customer_name text NULL,
  payment_method text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(14,2) NOT NULL DEFAULT 0,
  notes text NULL,
  created_by text NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, receipt_number),
  UNIQUE (tenant_id, sale_id)
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id text NULL REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_id text NULL REFERENCES public.customers(id) ON DELETE SET NULL,
  document_type text NOT NULL,
  document_number text NOT NULL,
  issue_date timestamptz NOT NULL DEFAULT NOW(),
  customer_snapshot jsonb NULL,
  items_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  arca_status text NOT NULL DEFAULT 'pending',
  arca_reference text NULL,
  arca_message text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, document_number)
);

CREATE TABLE IF NOT EXISTS public.credit_notes (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id text NULL REFERENCES public.invoices(id) ON DELETE SET NULL,
  sale_id text NULL REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_id text NULL REFERENCES public.customers(id) ON DELETE SET NULL,
  document_number text NOT NULL,
  issue_date timestamptz NOT NULL DEFAULT NOW(),
  reason text NOT NULL,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  arca_status text NOT NULL DEFAULT 'pending',
  arca_reference text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, document_number)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id text NULL REFERENCES public.users(id) ON DELETE SET NULL,
  module text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NULL,
  description text NOT NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  id text PRIMARY KEY,
  tenant_id text NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  negocio jsonb NOT NULL DEFAULT '{}'::jsonb,
  pos jsonb NOT NULL DEFAULT '{}'::jsonb,
  stock jsonb NOT NULL DEFAULT '{}'::jsonb,
  caja jsonb NOT NULL DEFAULT '{}'::jsonb,
  facturacion jsonb NOT NULL DEFAULT '{}'::jsonb,
  codigos_balanza jsonb NOT NULL DEFAULT '{}'::jsonb,
  apariencia jsonb NOT NULL DEFAULT '{}'::jsonb,
  sistema jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  quantity numeric(14,3) NOT NULL DEFAULT 0,
  reference_type text NOT NULL DEFAULT 'manual',
  reference_id text NULL,
  notes text NULL,
  created_by text NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cash_session_id text NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'ARS',
  reference_type text NOT NULL DEFAULT 'manual',
  reference_id text NULL,
  notes text NULL,
  created_by text NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 4. Align legacy tables with current app schema
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS cost_price numeric(14,2);
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS stock_current numeric(14,3);
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS stock_min numeric(14,3);
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS stock_max numeric(14,3);
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS subcategory text;
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS sale_mode text;
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS currency_code text;
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS is_favorite boolean;
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE IF EXISTS public.product_barcodes ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.product_barcodes ADD COLUMN IF NOT EXISTS is_primary boolean;
ALTER TABLE IF EXISTS public.product_barcodes ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE IF EXISTS public.suppliers ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE IF EXISTS public.payment_methods ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE IF EXISTS public.payment_methods ADD COLUMN IF NOT EXISTS affects_cash boolean;
ALTER TABLE IF EXISTS public.payment_methods ADD COLUMN IF NOT EXISTS surcharge_percent numeric(6,2);
ALTER TABLE IF EXISTS public.payment_methods ADD COLUMN IF NOT EXISTS discount_percent numeric(6,2);
ALTER TABLE IF EXISTS public.payment_methods ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE IF EXISTS public.payment_methods ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE IF EXISTS public.price_lists ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE IF EXISTS public.price_list_items ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.price_list_items ADD COLUMN IF NOT EXISTS fixed_price numeric(14,2);
ALTER TABLE IF EXISTS public.price_list_items ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE IF EXISTS public.cash_sessions ADD COLUMN IF NOT EXISTS branch_id text;
ALTER TABLE IF EXISTS public.cash_sessions ADD COLUMN IF NOT EXISTS opened_by_user_id text;
ALTER TABLE IF EXISTS public.cash_sessions ADD COLUMN IF NOT EXISTS closed_by_user_id text;
ALTER TABLE IF EXISTS public.cash_sessions ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE IF EXISTS public.cash_sessions ADD COLUMN IF NOT EXISTS expected_closing_amount numeric(14,2);
ALTER TABLE IF EXISTS public.cash_sessions ADD COLUMN IF NOT EXISTS closing_difference numeric(14,2);
ALTER TABLE IF EXISTS public.cash_sessions ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE IF EXISTS public.cash_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE IF EXISTS public.cash_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE IF EXISTS public.cash_movements ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.cash_movements ADD COLUMN IF NOT EXISTS movement_type text;
ALTER TABLE IF EXISTS public.cash_movements ADD COLUMN IF NOT EXISTS currency_code text;
ALTER TABLE IF EXISTS public.cash_movements ADD COLUMN IF NOT EXISTS reference_type text;
ALTER TABLE IF EXISTS public.cash_movements ADD COLUMN IF NOT EXISTS reference_id text;
ALTER TABLE IF EXISTS public.cash_movements ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE IF EXISTS public.cash_movements ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE IF EXISTS public.cash_movements ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS sale_number text;
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS cash_session_id text;
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS subtotal numeric(14,2);
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS discount_total numeric(14,2);
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS tax_total numeric(14,2);
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS currency_code text;
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS current_account_id text;
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS arca_document_id text;
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS mercado_pago_preference_id text;
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS items jsonb;
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS payments jsonb;
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS customer jsonb;
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE IF EXISTS public.sale_items ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.sale_items ADD COLUMN IF NOT EXISTS product_name_snapshot text;
ALTER TABLE IF EXISTS public.sale_items ADD COLUMN IF NOT EXISTS unit_price numeric(14,2);
ALTER TABLE IF EXISTS public.sale_items ADD COLUMN IF NOT EXISTS discount_total numeric(14,2);
ALTER TABLE IF EXISTS public.sale_items ADD COLUMN IF NOT EXISTS tax_total numeric(14,2);
ALTER TABLE IF EXISTS public.sale_items ADD COLUMN IF NOT EXISTS line_total numeric(14,2);
ALTER TABLE IF EXISTS public.sale_items ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE IF EXISTS public.sale_items ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE IF EXISTS public.sale_items ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE IF EXISTS public.sale_payments ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.sale_payments ADD COLUMN IF NOT EXISTS payment_method_code text;
ALTER TABLE IF EXISTS public.sale_payments ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE IF EXISTS public.sale_payments ADD COLUMN IF NOT EXISTS provider_code text;
ALTER TABLE IF EXISTS public.sale_payments ADD COLUMN IF NOT EXISTS currency_code text;
ALTER TABLE IF EXISTS public.sale_payments ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE IF EXISTS public.sale_payments ADD COLUMN IF NOT EXISTS provider_status text;
ALTER TABLE IF EXISTS public.sale_payments ADD COLUMN IF NOT EXISTS provider_reference text;
ALTER TABLE IF EXISTS public.sale_payments ADD COLUMN IF NOT EXISTS provider_metadata jsonb;
ALTER TABLE IF EXISTS public.sale_payments ADD COLUMN IF NOT EXISTS external_reference text;
ALTER TABLE IF EXISTS public.sale_payments ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE IF EXISTS public.sale_payments ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE IF EXISTS public.stock_movements ADD COLUMN IF NOT EXISTS movement_type text;
ALTER TABLE IF EXISTS public.stock_movements ADD COLUMN IF NOT EXISTS reference_type text;
ALTER TABLE IF EXISTS public.stock_movements ADD COLUMN IF NOT EXISTS reference_id text;
ALTER TABLE IF EXISTS public.stock_movements ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE IF EXISTS public.stock_movements ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE IF EXISTS public.stock_movements ADD COLUMN IF NOT EXISTS updated_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'cost'
  ) THEN
    EXECUTE $sql$
      UPDATE public.products
      SET
        cost_price = COALESCE(cost_price, cost, 0),
        stock_current = COALESCE(stock_current, stock, 0),
        stock_min = COALESCE(stock_min, min_stock, 0),
        sale_mode = COALESCE(
          NULLIF(sale_mode, ''),
          CASE
            WHEN lower(COALESCE(unit, '')) IN ('kg', 'kilo', 'kilos', 'gr', 'g', 'weight', 'peso') THEN 'weight'
            ELSE 'unit'
          END
        ),
        currency_code = COALESCE(NULLIF(currency_code, ''), 'ARS'),
        is_favorite = COALESCE(is_favorite, false),
        updated_at = COALESCE(updated_at, created_at, NOW())
    $sql$;
  ELSE
    UPDATE public.products
    SET
      cost_price = COALESCE(cost_price, 0),
      stock_current = COALESCE(stock_current, 0),
      stock_min = COALESCE(stock_min, 0),
      sale_mode = COALESCE(NULLIF(sale_mode, ''), 'unit'),
      currency_code = COALESCE(NULLIF(currency_code, ''), 'ARS'),
      is_favorite = COALESCE(is_favorite, false),
      updated_at = COALESCE(updated_at, created_at, NOW());
  END IF;
END
$$;

-- ------------------------------------------------------------


UPDATE public.product_barcodes pb
SET
  tenant_id = COALESCE(pb.tenant_id, p.tenant_id),
  is_primary = COALESCE(pb.is_primary, false),
  updated_at = COALESCE(pb.updated_at, pb.created_at, NOW())
FROM public.products p
WHERE pb.product_id = p.id;

UPDATE public.customers
SET
  code = COALESCE(NULLIF(code, ''), 'CUS-' || upper(left(id, 8))),
  document_type = COALESCE(NULLIF(document_type, ''), 'dni'),
  document_number = COALESCE(NULLIF(document_number, ''), upper(left(id, 8))),
  updated_at = COALESCE(updated_at, created_at, NOW())
WHERE to_regclass('public.customers') IS NOT NULL;

UPDATE public.suppliers
SET
  code = COALESCE(NULLIF(code, ''), 'SUP-' || upper(left(id, 8))),
  updated_at = COALESCE(updated_at, created_at, NOW())
WHERE to_regclass('public.suppliers') IS NOT NULL;

UPDATE public.payment_methods
SET
  code = COALESCE(
    NULLIF(code, ''),
    CASE
      WHEN lower(COALESCE(type, '')) = 'cash' THEN 'cash'
      WHEN lower(COALESCE(type, '')) = 'transfer' THEN 'transfer'
      WHEN lower(COALESCE(type, '')) = 'mercado_pago' THEN 'mercado_pago'
      WHEN lower(COALESCE(type, '')) = 'current_account' THEN 'current_account'
      WHEN lower(COALESCE(name, '')) LIKE '%debito%' THEN 'card_debit'
      WHEN lower(COALESCE(name, '')) LIKE '%credito%' THEN 'card_credit'
      ELSE lower(regexp_replace(COALESCE(name, 'medio_pago'), '[^a-zA-Z0-9]+', '_', 'g'))
    END
  ),
  affects_cash = COALESCE(affects_cash, lower(COALESCE(type, '')) = 'cash'),
  surcharge_percent = COALESCE(surcharge_percent, 0),
  discount_percent = COALESCE(discount_percent, 0),
  updated_at = COALESCE(updated_at, created_at, NOW())
WHERE to_regclass('public.payment_methods') IS NOT NULL;

UPDATE public.price_lists
SET
  code = COALESCE(
    NULLIF(code, ''),
    lower(regexp_replace(COALESCE(name, 'lista'), '[^a-zA-Z0-9]+', '_', 'g'))
  ),
  price_mode = COALESCE(NULLIF(price_mode, ''), 'percentage'),
  updated_at = COALESCE(updated_at, created_at, NOW())
WHERE to_regclass('public.price_lists') IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'price_list_items' AND column_name = 'price'
  ) THEN
    EXECUTE $sql$
      UPDATE public.price_list_items pli
      SET
        tenant_id = COALESCE(pli.tenant_id, pl.tenant_id),
        fixed_price = COALESCE(pli.fixed_price, pli.price, 0),
        updated_at = COALESCE(pli.updated_at, pli.created_at, NOW())
      FROM public.price_lists pl
      WHERE pli.price_list_id = pl.id
    $sql$;
  ELSE
    UPDATE public.price_list_items pli
    SET
      tenant_id = COALESCE(pli.tenant_id, pl.tenant_id),
      fixed_price = COALESCE(pli.fixed_price, 0),
      updated_at = COALESCE(pli.updated_at, pli.created_at, NOW())
    FROM public.price_lists pl
    WHERE pli.price_list_id = pl.id;
  END IF;
END
$$;

UPDATE public.cash_sessions
SET
  status = COALESCE(NULLIF(status, ''), CASE WHEN closed_at IS NULL THEN 'open' ELSE 'closed' END),
  opening_amount = COALESCE(opening_amount, 0),
  expected_closing_amount = COALESCE(expected_closing_amount, closing_amount, opening_amount, 0),
  closing_difference = COALESCE(closing_difference, COALESCE(closing_amount, 0) - COALESCE(expected_closing_amount, COALESCE(closing_amount, 0))),
  created_at = COALESCE(created_at, opened_at, NOW()),
  updated_at = COALESCE(updated_at, created_at, NOW())
WHERE to_regclass('public.cash_sessions') IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_movements' AND column_name = 'type'
  ) THEN
    EXECUTE $sql$
      UPDATE public.cash_movements cm
      SET
        tenant_id = COALESCE(cm.tenant_id, cs.tenant_id),
        movement_type = COALESCE(
          NULLIF(cm.movement_type, ''),
          CASE lower(COALESCE(cm.type, ''))
            WHEN 'income' THEN 'income'
            WHEN 'expense' THEN 'expense'
            WHEN 'sale_payment' THEN 'sale_payment'
            ELSE 'adjustment'
          END
        ),
        currency_code = COALESCE(NULLIF(cm.currency_code, ''), 'ARS'),
        reference_type = COALESCE(NULLIF(cm.reference_type, ''), 'legacy'),
        notes = COALESCE(cm.notes, cm.description),
        updated_at = COALESCE(cm.updated_at, cm.created_at, NOW())
      FROM public.cash_sessions cs
      WHERE cm.cash_session_id = cs.id
    $sql$;
  ELSE
    UPDATE public.cash_movements cm
    SET
      tenant_id = COALESCE(cm.tenant_id, cs.tenant_id),
      movement_type = COALESCE(NULLIF(cm.movement_type, ''), 'adjustment'),
      currency_code = COALESCE(NULLIF(cm.currency_code, ''), 'ARS'),
      reference_type = COALESCE(NULLIF(cm.reference_type, ''), 'legacy'),
      updated_at = COALESCE(cm.updated_at, cm.created_at, NOW())
    FROM public.cash_sessions cs
    WHERE cm.cash_session_id = cs.id;
  END IF;
END
$$;

UPDATE public.sales
SET
  sale_number = COALESCE(NULLIF(sale_number, ''), 'VTA-' || upper(left(id, 8))),
  status = COALESCE(NULLIF(status, ''), 'completed'),
  subtotal = COALESCE(subtotal, total, 0),
  discount_total = COALESCE(discount_total, 0),
  tax_total = COALESCE(tax_total, 0),
  currency_code = COALESCE(NULLIF(currency_code, ''), 'ARS'),
  items = COALESCE(items, '[]'::jsonb),
  payments = COALESCE(payments, '[]'::jsonb),
  updated_at = COALESCE(updated_at, created_at, NOW())
WHERE to_regclass('public.sales') IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_items' AND column_name = 'price'
  ) THEN
    EXECUTE $sql$
      UPDATE public.sale_items si
      SET
        tenant_id = COALESCE(si.tenant_id, s.tenant_id),
        product_name_snapshot = COALESCE(
          NULLIF(si.product_name_snapshot, ''),
          (SELECT p.name FROM public.products p WHERE p.id = si.product_id),
          'Producto'
        ),
        unit_price = COALESCE(si.unit_price, si.price, 0),
        discount_total = COALESCE(si.discount_total, 0),
        tax_total = COALESCE(si.tax_total, 0),
        line_total = COALESCE(si.line_total, si.subtotal, COALESCE(si.unit_price, si.price, 0) * COALESCE(si.quantity, 0)),
        metadata = COALESCE(si.metadata, '{}'::jsonb),
        created_at = COALESCE(si.created_at, s.created_at, NOW()),
        updated_at = COALESCE(si.updated_at, si.created_at, NOW())
      FROM public.sales s
      WHERE si.sale_id = s.id
    $sql$;
  ELSE
    UPDATE public.sale_items si
    SET
      tenant_id = COALESCE(si.tenant_id, s.tenant_id),
      product_name_snapshot = COALESCE(
        NULLIF(si.product_name_snapshot, ''),
        (SELECT p.name FROM public.products p WHERE p.id = si.product_id),
        'Producto'
      ),
      unit_price = COALESCE(si.unit_price, 0),
      discount_total = COALESCE(si.discount_total, 0),
      tax_total = COALESCE(si.tax_total, 0),
      line_total = COALESCE(si.line_total, COALESCE(si.unit_price, 0) * COALESCE(si.quantity, 0)),
      metadata = COALESCE(si.metadata, '{}'::jsonb),
      created_at = COALESCE(si.created_at, s.created_at, NOW()),
      updated_at = COALESCE(si.updated_at, si.created_at, NOW())
    FROM public.sales s
    WHERE si.sale_id = s.id;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_payments' AND column_name = 'payment_method_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.sale_payments sp
      SET
        tenant_id = COALESCE(sp.tenant_id, s.tenant_id),
        payment_method_code = COALESCE(
          sp.payment_method_code,
          (SELECT pm.code FROM public.payment_methods pm WHERE pm.id = sp.payment_method_id)
        ),
        provider = COALESCE(NULLIF(sp.provider, ''), 'internal'),
        provider_code = COALESCE(NULLIF(sp.provider_code, ''), 'internal'),
        currency_code = COALESCE(NULLIF(sp.currency_code, ''), 'ARS'),
        status = COALESCE(NULLIF(sp.status, ''), 'approved'),
        provider_status = COALESCE(NULLIF(sp.provider_status, ''), COALESCE(NULLIF(sp.status, ''), 'approved')),
        provider_metadata = COALESCE(sp.provider_metadata, '{}'::jsonb),
        metadata = COALESCE(sp.metadata, '{}'::jsonb),
        updated_at = COALESCE(sp.updated_at, sp.created_at, NOW())
      FROM public.sales s
      WHERE sp.sale_id = s.id
    $sql$;
  ELSE
    UPDATE public.sale_payments sp
    SET
      tenant_id = COALESCE(sp.tenant_id, s.tenant_id),
      provider = COALESCE(NULLIF(sp.provider, ''), 'internal'),
      provider_code = COALESCE(NULLIF(sp.provider_code, ''), 'internal'),
      currency_code = COALESCE(NULLIF(sp.currency_code, ''), 'ARS'),
      status = COALESCE(NULLIF(sp.status, ''), 'approved'),
      provider_status = COALESCE(NULLIF(sp.provider_status, ''), COALESCE(NULLIF(sp.status, ''), 'approved')),
      provider_metadata = COALESCE(sp.provider_metadata, '{}'::jsonb),
      metadata = COALESCE(sp.metadata, '{}'::jsonb),
      updated_at = COALESCE(sp.updated_at, sp.created_at, NOW())
    FROM public.sales s
    WHERE sp.sale_id = s.id;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'type'
  ) THEN
    EXECUTE $sql$
      UPDATE public.stock_movements
      SET
        movement_type = COALESCE(
          NULLIF(movement_type, ''),
          CASE lower(COALESCE(type, ''))
            WHEN 'in' THEN 'in'
            WHEN 'out' THEN 'out'
            WHEN 'sale' THEN 'sale'
            WHEN 'purchase' THEN 'purchase'
            ELSE 'adjustment'
          END
        ),
        reference_type = COALESCE(NULLIF(reference_type, ''), COALESCE(NULLIF(reference, ''), 'legacy')),
        notes = COALESCE(notes, reference),
        updated_at = COALESCE(updated_at, created_at, NOW())
    $sql$;
  ELSE
    UPDATE public.stock_movements
    SET
      movement_type = COALESCE(NULLIF(movement_type, ''), 'adjustment'),
      reference_type = COALESCE(NULLIF(reference_type, ''), 'legacy'),
      updated_at = COALESCE(updated_at, created_at, NOW());
  END IF;
END
$$;

-- 5. Defaults, indexes, triggers, and safe foreign keys
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.products ALTER COLUMN cost_price SET DEFAULT 0;
ALTER TABLE IF EXISTS public.products ALTER COLUMN stock_current SET DEFAULT 0;
ALTER TABLE IF EXISTS public.products ALTER COLUMN sale_mode SET DEFAULT 'unit';
ALTER TABLE IF EXISTS public.products ALTER COLUMN currency_code SET DEFAULT 'ARS';
ALTER TABLE IF EXISTS public.products ALTER COLUMN is_favorite SET DEFAULT false;

ALTER TABLE IF EXISTS public.product_barcodes ALTER COLUMN is_primary SET DEFAULT false;

ALTER TABLE IF EXISTS public.payment_methods ALTER COLUMN affects_cash SET DEFAULT false;
ALTER TABLE IF EXISTS public.payment_methods ALTER COLUMN surcharge_percent SET DEFAULT 0;
ALTER TABLE IF EXISTS public.payment_methods ALTER COLUMN discount_percent SET DEFAULT 0;

ALTER TABLE IF EXISTS public.price_lists ALTER COLUMN price_mode SET DEFAULT 'percentage';

ALTER TABLE IF EXISTS public.cash_sessions ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE IF EXISTS public.cash_sessions ALTER COLUMN opening_amount SET DEFAULT 0;

ALTER TABLE IF EXISTS public.cash_movements ALTER COLUMN currency_code SET DEFAULT 'ARS';
ALTER TABLE IF EXISTS public.cash_movements ALTER COLUMN reference_type SET DEFAULT 'manual';

ALTER TABLE IF EXISTS public.sales ALTER COLUMN status SET DEFAULT 'completed';
ALTER TABLE IF EXISTS public.sales ALTER COLUMN subtotal SET DEFAULT 0;
ALTER TABLE IF EXISTS public.sales ALTER COLUMN discount_total SET DEFAULT 0;
ALTER TABLE IF EXISTS public.sales ALTER COLUMN tax_total SET DEFAULT 0;
ALTER TABLE IF EXISTS public.sales ALTER COLUMN currency_code SET DEFAULT 'ARS';

ALTER TABLE IF EXISTS public.sale_items ALTER COLUMN unit_price SET DEFAULT 0;
ALTER TABLE IF EXISTS public.sale_items ALTER COLUMN discount_total SET DEFAULT 0;
ALTER TABLE IF EXISTS public.sale_items ALTER COLUMN tax_total SET DEFAULT 0;
ALTER TABLE IF EXISTS public.sale_items ALTER COLUMN line_total SET DEFAULT 0;

ALTER TABLE IF EXISTS public.sale_payments ALTER COLUMN provider SET DEFAULT 'internal';
ALTER TABLE IF EXISTS public.sale_payments ALTER COLUMN provider_code SET DEFAULT 'internal';
ALTER TABLE IF EXISTS public.sale_payments ALTER COLUMN currency_code SET DEFAULT 'ARS';
ALTER TABLE IF EXISTS public.sale_payments ALTER COLUMN status SET DEFAULT 'approved';
ALTER TABLE IF EXISTS public.sale_payments ALTER COLUMN provider_status SET DEFAULT 'approved';

ALTER TABLE IF EXISTS public.stock_movements ALTER COLUMN reference_type SET DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_category ON public.products(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_tenant_product ON public.product_barcodes(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_document ON public.customers(tenant_id, document_number);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON public.suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON public.payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_price_lists_tenant ON public.price_lists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_tenant_price_list ON public.price_list_items(tenant_id, price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_tenant_product ON public.price_list_items(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_tenant_status ON public.cash_sessions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created_at ON public.sales(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_customer ON public.sales(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_tenant_sale ON public.sale_items(tenant_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_tenant_sale ON public.sale_payments(tenant_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_tenant_code ON public.sale_payments(tenant_id, payment_method_code);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_product ON public.stock_movements(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_tenant_session ON public.cash_movements(tenant_id, cash_session_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uq_payment_methods_tenant_code'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.payment_methods
      GROUP BY tenant_id, code
      HAVING COUNT(*) > 1
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX uq_payment_methods_tenant_code ON public.payment_methods(tenant_id, code)';
    ELSE
      RAISE NOTICE 'Skipping uq_payment_methods_tenant_code because duplicates exist in payment_methods.';
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uq_price_list_items_unique_product'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.price_list_items
      GROUP BY tenant_id, price_list_id, product_id
      HAVING COUNT(*) > 1
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX uq_price_list_items_unique_product ON public.price_list_items(tenant_id, price_list_id, product_id)';
    ELSE
      RAISE NOTICE 'Skipping uq_price_list_items_unique_product because duplicates exist in price_list_items.';
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_customers_price_list'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT fk_customers_price_list
      FOREIGN KEY (price_list_id) REFERENCES public.price_lists(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_barcodes_tenant'
  ) THEN
    ALTER TABLE public.product_barcodes
      ADD CONSTRAINT fk_product_barcodes_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_price_list_items_tenant'
  ) THEN
    ALTER TABLE public.price_list_items
      ADD CONSTRAINT fk_price_list_items_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cash_movements_tenant'
  ) THEN
    ALTER TABLE public.cash_movements
      ADD CONSTRAINT fk_cash_movements_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sale_items_tenant'
  ) THEN
    ALTER TABLE public.sale_items
      ADD CONSTRAINT fk_sale_items_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sale_payments_tenant'
  ) THEN
    ALTER TABLE public.sale_payments
      ADD CONSTRAINT fk_sale_payments_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uq_payment_methods_tenant_code'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sale_payments_payment_method'
  ) THEN
    ALTER TABLE public.sale_payments
      ADD CONSTRAINT fk_sale_payments_payment_method
      FOREIGN KEY (tenant_id, payment_method_code)
      REFERENCES public.payment_methods(tenant_id, code)
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_tenants ON public.tenants;
CREATE TRIGGER trg_set_updated_at_tenants BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_permission_profiles ON public.permission_profiles;
CREATE TRIGGER trg_set_updated_at_permission_profiles BEFORE UPDATE ON public.permission_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_users ON public.users;
CREATE TRIGGER trg_set_updated_at_users BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_products ON public.products;
CREATE TRIGGER trg_set_updated_at_products BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_product_barcodes ON public.product_barcodes;
CREATE TRIGGER trg_set_updated_at_product_barcodes BEFORE UPDATE ON public.product_barcodes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_customers ON public.customers;
CREATE TRIGGER trg_set_updated_at_customers BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_suppliers ON public.suppliers;
CREATE TRIGGER trg_set_updated_at_suppliers BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_payment_methods ON public.payment_methods;
CREATE TRIGGER trg_set_updated_at_payment_methods BEFORE UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_price_lists ON public.price_lists;
CREATE TRIGGER trg_set_updated_at_price_lists BEFORE UPDATE ON public.price_lists
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_price_list_items ON public.price_list_items;
CREATE TRIGGER trg_set_updated_at_price_list_items BEFORE UPDATE ON public.price_list_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_cash_sessions ON public.cash_sessions;
CREATE TRIGGER trg_set_updated_at_cash_sessions BEFORE UPDATE ON public.cash_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_cash_movements ON public.cash_movements;
CREATE TRIGGER trg_set_updated_at_cash_movements BEFORE UPDATE ON public.cash_movements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_sales ON public.sales;
CREATE TRIGGER trg_set_updated_at_sales BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_sale_items ON public.sale_items;
CREATE TRIGGER trg_set_updated_at_sale_items BEFORE UPDATE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_sale_payments ON public.sale_payments;
CREATE TRIGGER trg_set_updated_at_sale_payments BEFORE UPDATE ON public.sale_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_current_account_movements ON public.current_account_movements;
CREATE TRIGGER trg_set_updated_at_current_account_movements BEFORE UPDATE ON public.current_account_movements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_receipts ON public.receipts;
CREATE TRIGGER trg_set_updated_at_receipts BEFORE UPDATE ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_invoices ON public.invoices;
CREATE TRIGGER trg_set_updated_at_invoices BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_credit_notes ON public.credit_notes;
CREATE TRIGGER trg_set_updated_at_credit_notes BEFORE UPDATE ON public.credit_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_tenant_settings ON public.tenant_settings;
CREATE TRIGGER trg_set_updated_at_tenant_settings BEFORE UPDATE ON public.tenant_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_stock_movements ON public.stock_movements;
CREATE TRIGGER trg_set_updated_at_stock_movements BEFORE UPDATE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE IF EXISTS public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permission_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_barcodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bank_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.origin_banks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.installment_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.price_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.price_list_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promotions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cash_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cash_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sale_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sale_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.current_account_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_movements DISABLE ROW LEVEL SECURITY;

COMMIT;
