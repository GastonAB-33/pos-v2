-- POS V2 - Supabase schema + seed (development)
-- Generated from project analysis (services/modules/types/config/lib)

BEGIN;

SET search_path TO public;

-- ------------------------------------------------------------
-- Helpers
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
-- Core tables
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
  sale_mode text NOT NULL DEFAULT 'unit' CHECK (sale_mode IN ('unit', 'weight')),
  currency_code text NOT NULL DEFAULT 'ARS',
  is_favorite boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code),
  CHECK (price >= 0),
  CHECK (cost_price >= 0),
  CHECK (stock_max IS NULL OR stock_min IS NULL OR stock_max >= stock_min)
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

CREATE TABLE IF NOT EXISTS public.price_lists (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  price_mode text NOT NULL CHECK (price_mode IN ('percentage', 'fixed')),
  percentage_adjustment numeric(10,2) NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.customers (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  full_name text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('dni', 'cuit')),
  document_number text NOT NULL,
  fiscal_business_name text NULL,
  fiscal_address text NULL,
  fiscal_condition text NULL,
  price_list_id text NULL REFERENCES public.price_lists(id) ON DELETE SET NULL,
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
  type text NOT NULL CHECK (type IN ('cash', 'transfer', 'card', 'mercado_pago', 'current_account', 'other')),
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
  account_type text NOT NULL CHECK (account_type IN ('caja_ahorro', 'cuenta_corriente', 'billetera_virtual', 'otro')),
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
  installments integer NOT NULL CHECK (installments >= 1),
  interest_percent numeric(6,2) NOT NULL DEFAULT 0,
  card_brand text NULL,
  notes text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.promotions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text NULL,
  type text NOT NULL CHECK (type IN ('percentage_discount', 'fixed_discount', 'combo_price')),
  scope text NOT NULL CHECK (scope IN ('product', 'cart')),
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
  status text NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  subtotal numeric(14,2) NOT NULL,
  total numeric(14,2) NOT NULL,
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
  quantity numeric(14,3) NOT NULL,
  unit_cost numeric(14,2) NOT NULL,
  line_total numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id text NULL,
  opened_by_user_id text NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  closed_by_user_id text NULL REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('open', 'closed')),
  opened_at timestamptz NOT NULL,
  closed_at timestamptz NULL,
  opening_amount numeric(14,2) NOT NULL,
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
  status text NOT NULL CHECK (status IN ('draft', 'completed', 'cancelled')),
  subtotal numeric(14,2) NOT NULL,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL,
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
  quantity numeric(14,3) NOT NULL,
  unit_price numeric(14,2) NOT NULL,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL,
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
  amount numeric(14,2) NOT NULL,
  currency_code text NOT NULL DEFAULT 'ARS',
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  provider_status text NOT NULL CHECK (provider_status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  provider_reference text NULL,
  provider_metadata jsonb NULL,
  external_reference text NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_sale_payments_payment_method
    FOREIGN KEY (tenant_id, payment_method_code)
    REFERENCES public.payment_methods(tenant_id, code)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.current_account_movements (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id text NULL REFERENCES public.sales(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('debt', 'payment', 'adjustment')),
  amount numeric(14,2) NOT NULL,
  balance_after numeric(14,2) NOT NULL,
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
  issued_at timestamptz NOT NULL,
  customer_name text NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'card', 'mercado_pago', 'current_account', 'other')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(14,2) NOT NULL,
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
  document_type text NOT NULL CHECK (document_type IN ('A', 'B', 'C', 'PRESUPUESTO')),
  document_number text NOT NULL,
  issue_date timestamptz NOT NULL,
  customer_snapshot jsonb NULL,
  items_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(14,2) NOT NULL,
  tax_total numeric(14,2) NOT NULL,
  total numeric(14,2) NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'issued', 'cancelled')),
  arca_status text NOT NULL CHECK (arca_status IN ('pending', 'not_sent', 'accepted', 'rejected')),
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
  issue_date timestamptz NOT NULL,
  reason text NOT NULL CHECK (reason IN ('return', 'price_adjustment', 'cancellation', 'other')),
  subtotal numeric(14,2) NOT NULL,
  tax_total numeric(14,2) NOT NULL,
  total numeric(14,2) NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'issued', 'cancelled')),
  arca_status text NOT NULL CHECK (arca_status IN ('pending', 'not_sent', 'accepted', 'rejected')),
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
  negocio jsonb NOT NULL,
  pos jsonb NOT NULL,
  stock jsonb NOT NULL,
  caja jsonb NOT NULL,
  facturacion jsonb NOT NULL,
  codigos_balanza jsonb NOT NULL,
  apariencia jsonb NOT NULL,
  sistema jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'sale', 'purchase')),
  quantity numeric(14,3) NOT NULL,
  reference_type text NOT NULL,
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
  movement_type text NOT NULL CHECK (movement_type IN ('income', 'expense', 'sale_payment', 'adjustment')),
  amount numeric(14,2) NOT NULL,
  currency_code text NOT NULL DEFAULT 'ARS',
  reference_type text NOT NULL,
  reference_id text NULL,
  notes text NULL,
  created_by text NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Missing table needed by services/types
CREATE TABLE IF NOT EXISTS public.price_list_items (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  price_list_id text NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  fixed_price numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_permission_profiles_tenant ON public.permission_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON public.users(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_email_ci ON public.users(tenant_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_username_ci ON public.users(tenant_id, lower(username)) WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_active ON public.products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_tenant_category ON public.products(tenant_id, category);

CREATE INDEX IF NOT EXISTS idx_product_barcodes_tenant_product ON public.product_barcodes(tenant_id, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_barcodes_primary_per_product
  ON public.product_barcodes(tenant_id, product_id) WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_document ON public.customers(tenant_id, document_number);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_balance ON public.customers(tenant_id, current_balance);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON public.suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON public.payment_methods(tenant_id);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant ON public.bank_accounts(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_accounts_tenant_cbu ON public.bank_accounts(tenant_id, cbu) WHERE cbu IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_origin_banks_tenant ON public.origin_banks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_installment_plans_tenant ON public.installment_plans(tenant_id);

CREATE INDEX IF NOT EXISTS idx_price_lists_tenant ON public.price_lists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_tenant_price_list ON public.price_list_items(tenant_id, price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_tenant_product ON public.price_list_items(tenant_id, product_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_price_list_items_unique_product
  ON public.price_list_items(tenant_id, price_list_id, product_id);

CREATE INDEX IF NOT EXISTS idx_promotions_tenant ON public.promotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promotions_tenant_active ON public.promotions(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_tenant_scope_product ON public.promotions(tenant_id, scope, product_id);

CREATE INDEX IF NOT EXISTS idx_purchases_tenant ON public.purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchases_tenant_created_at ON public.purchases(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_items_tenant_purchase ON public.purchase_items(tenant_id, purchase_id);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_tenant ON public.cash_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_tenant_status ON public.cash_sessions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_tenant_opened_at ON public.cash_sessions(tenant_id, opened_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_sessions_open_per_user
  ON public.cash_sessions(tenant_id, opened_by_user_id) WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_sales_tenant ON public.sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created_at ON public.sales(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_customer ON public.sales(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_status ON public.sales(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_sale_items_tenant_sale ON public.sale_items(tenant_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_tenant_product ON public.sale_items(tenant_id, product_id);

CREATE INDEX IF NOT EXISTS idx_sale_payments_tenant_sale ON public.sale_payments(tenant_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_tenant_code ON public.sale_payments(tenant_id, payment_method_code);
CREATE INDEX IF NOT EXISTS idx_sale_payments_tenant_status ON public.sale_payments(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_current_account_movements_tenant_customer
  ON public.current_account_movements(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_current_account_movements_tenant_created_at
  ON public.current_account_movements(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_receipts_tenant_issued_at ON public.receipts(tenant_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant_sale ON public.receipts(tenant_id, sale_id);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_issue_date ON public.invoices(tenant_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_sale ON public.invoices(tenant_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_customer ON public.invoices(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON public.invoices(tenant_id, status, arca_status);

CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant_issue_date ON public.credit_notes(tenant_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant_invoice ON public.credit_notes(tenant_id, invoice_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_at ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_module_action ON public.audit_logs(tenant_id, module, action);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_product ON public.stock_movements(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_created_at ON public.stock_movements(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_type ON public.stock_movements(tenant_id, movement_type);

CREATE INDEX IF NOT EXISTS idx_cash_movements_tenant_session ON public.cash_movements(tenant_id, cash_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_tenant_created_at ON public.cash_movements(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_movements_tenant_type ON public.cash_movements(tenant_id, movement_type);

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
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

DROP TRIGGER IF EXISTS trg_set_updated_at_bank_accounts ON public.bank_accounts;
CREATE TRIGGER trg_set_updated_at_bank_accounts BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_origin_banks ON public.origin_banks;
CREATE TRIGGER trg_set_updated_at_origin_banks BEFORE UPDATE ON public.origin_banks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at_installment_plans ON public.installment_plans;
CREATE TRIGGER trg_set_updated_at_installment_plans BEFORE UPDATE ON public.installment_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_price_lists ON public.price_lists;
CREATE TRIGGER trg_set_updated_at_price_lists BEFORE UPDATE ON public.price_lists
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_price_list_items ON public.price_list_items;
CREATE TRIGGER trg_set_updated_at_price_list_items BEFORE UPDATE ON public.price_list_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_promotions ON public.promotions;
CREATE TRIGGER trg_set_updated_at_promotions BEFORE UPDATE ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_purchases ON public.purchases;
CREATE TRIGGER trg_set_updated_at_purchases BEFORE UPDATE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_purchase_items ON public.purchase_items;
CREATE TRIGGER trg_set_updated_at_purchase_items BEFORE UPDATE ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_current_account_movements ON public.current_account_movements;
CREATE TRIGGER trg_set_updated_at_current_account_movements BEFORE UPDATE ON public.current_account_movements
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

DROP TRIGGER IF EXISTS trg_set_updated_at_cash_sessions ON public.cash_sessions;
CREATE TRIGGER trg_set_updated_at_cash_sessions BEFORE UPDATE ON public.cash_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_cash_movements ON public.cash_movements;
CREATE TRIGGER trg_set_updated_at_cash_movements BEFORE UPDATE ON public.cash_movements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Disable RLS for development only
-- ------------------------------------------------------------
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
ALTER TABLE IF EXISTS public.current_account_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sale_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sale_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cash_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cash_movements DISABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Seed data (tenant: demo)
-- ------------------------------------------------------------
INSERT INTO public.tenants (
  id, legal_name, trade_name, cuit, is_active, created_at, updated_at
)
VALUES (
  'tenant-demo',
  'Demo SA',
  'Demo',
  '30-00000000-0',
  true,
  '2026-04-01T10:00:00Z',
  '2026-04-01T10:00:00Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.permission_profiles (
  id, tenant_id, name, description, is_active, permissions, created_at, updated_at
)
VALUES (
  'profile-admin-demo',
  'tenant-demo',
  'Administrador',
  'Acceso completo al sistema',
  true,
  '{
    "dashboard":{"read":true,"write":true},
    "pos":{"read":true,"write":true},
    "productos":{"read":true,"write":true},
    "clientes":{"read":true,"write":true},
    "cuentas_corrientes":{"read":true,"write":true},
    "stock":{"read":true,"write":true},
    "caja":{"read":true,"write":true},
    "compras":{"read":true,"write":true},
    "proveedores":{"read":true,"write":true},
    "listas_precios":{"read":true,"write":true},
    "promociones":{"read":true,"write":true},
    "medios_pago":{"read":true,"write":true},
    "facturacion":{"read":true,"write":true},
    "comprobantes":{"read":true,"write":true},
    "reportes":{"read":true,"write":true},
    "auditoria":{"read":true,"write":true},
    "configuracion":{"read":true,"write":true},
    "usuarios":{"read":true,"write":true}
  }'::jsonb,
  '2026-04-01T10:05:00Z',
  '2026-04-01T10:05:00Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.users (
  id, tenant_id, email, username, full_name, role_code, permission_profile_id, is_active, created_at, updated_at
)
VALUES (
  'user-admin-demo',
  'tenant-demo',
  'admin@demo.local',
  'admin',
  'Administrador Demo',
  'owner',
  'profile-admin-demo',
  true,
  '2026-04-01T10:10:00Z',
  '2026-04-01T10:10:00Z'
)
ON CONFLICT DO NOTHING;
INSERT INTO public.price_lists (
  id, tenant_id, name, code, description, is_active, price_mode, percentage_adjustment, created_at, updated_at
)
VALUES
(
  'pl-demo-base',
  'tenant-demo',
  'Lista base',
  'base',
  'Precios de mostrador',
  true,
  'percentage',
  0,
  '2026-04-01T10:20:00Z',
  '2026-04-01T10:20:00Z'
),
(
  'pl-demo-mayorista',
  'tenant-demo',
  'Mayorista',
  'mayorista',
  'Lista de precios mayorista',
  true,
  'fixed',
  null,
  '2026-04-01T10:21:00Z',
  '2026-04-01T10:21:00Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.customers (
  id, tenant_id, code, full_name, document_type, document_number,
  fiscal_business_name, fiscal_address, fiscal_condition, price_list_id,
  email, phone, address, observations, current_balance, is_active, created_at, updated_at
)
VALUES
(
  'customer-demo-1',
  'tenant-demo',
  'CLI-ANAG-001',
  'Ana Gonzalez',
  'dni',
  '30111222',
  null,
  null,
  'Consumidor final',
  'pl-demo-base',
  'ana@cliente.demo',
  '1122334455',
  'CABA',
  null,
  0,
  true,
  '2026-04-01T10:30:00Z',
  '2026-04-01T10:30:00Z'
),
(
  'customer-demo-2',
  'tenant-demo',
  'CLI-LOPE-001',
  'Comercial Lopez SRL',
  'cuit',
  '30711222334',
  'Comercial Lopez SRL',
  'Av. Siempreviva 742',
  'Responsable inscripto',
  'pl-demo-mayorista',
  'compras@lopez.demo',
  '1144556677',
  'Buenos Aires',
  'Cliente de cuenta corriente',
  5000,
  true,
  '2026-04-01T10:31:00Z',
  '2026-04-12T12:00:00Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.suppliers (
  id, tenant_id, code, name, phone, email, address, observations, is_active, created_at, updated_at
)
VALUES (
  'supplier-demo-1',
  'tenant-demo',
  'SUP-DEMO-001',
  'Distribuidora Centro',
  '1133344455',
  'ventas@distribuidoracentro.demo',
  'Parque Industrial Norte',
  'Proveedor principal de almacen',
  true,
  '2026-04-01T10:40:00Z',
  '2026-04-01T10:40:00Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.products (
  id, tenant_id, code, name, brand, supplier, description,
  price, cost_price, stock_current, stock_min, stock_max,
  category, subcategory, sale_mode, currency_code, is_favorite, is_active,
  created_at, updated_at
)
VALUES
(
  'product-demo-1',
  'tenant-demo',
  'PRD-YERBA-001',
  'Yerba Mate 1kg',
  'Matex',
  'Distribuidora Centro',
  'Yerba mate tradicional 1kg',
  3500,
  2000,
  28,
  5,
  100,
  'Almacen',
  'Infusiones',
  'unit',
  'ARS',
  true,
  true,
  '2026-04-01T10:50:00Z',
  '2026-04-12T11:00:00Z'
),
(
  'product-demo-2',
  'tenant-demo',
  'PRD-AZU-001',
  'Azucar 1kg',
  'Dulzor',
  'Distribuidora Centro',
  'Azucar comun 1kg',
  3200,
  1500,
  19,
  5,
  90,
  'Almacen',
  'Despensa',
  'unit',
  'ARS',
  false,
  true,
  '2026-04-01T10:51:00Z',
  '2026-04-12T11:05:00Z'
),
(
  'product-demo-3',
  'tenant-demo',
  '1234',
  'Queso Cremoso',
  'La Granja',
  'Distribuidora Centro',
  'Producto por peso para balanza',
  9500,
  7000,
  12.5,
  2,
  30,
  'Frescos',
  'Lacteos',
  'weight',
  'ARS',
  false,
  true,
  '2026-04-01T10:52:00Z',
  '2026-04-12T11:10:00Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.product_barcodes (
  id, tenant_id, product_id, barcode, is_primary, created_at, updated_at
)
VALUES
(
  'pbar-demo-1',
  'tenant-demo',
  'product-demo-1',
  '7791234567890',
  true,
  '2026-04-01T10:55:00Z',
  '2026-04-01T10:55:00Z'
),
(
  'pbar-demo-2',
  'tenant-demo',
  'product-demo-2',
  '7799876543210',
  true,
  '2026-04-01T10:55:30Z',
  '2026-04-01T10:55:30Z'
),
(
  'pbar-demo-3',
  'tenant-demo',
  'product-demo-3',
  '2001234005000',
  true,
  '2026-04-01T10:56:00Z',
  '2026-04-01T10:56:00Z'
),
(
  'pbar-demo-4',
  'tenant-demo',
  'product-demo-3',
  '1234',
  false,
  '2026-04-01T10:56:30Z',
  '2026-04-01T10:56:30Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.price_list_items (
  id, tenant_id, price_list_id, product_id, fixed_price, created_at, updated_at
)
VALUES
(
  'pli-demo-1',
  'tenant-demo',
  'pl-demo-mayorista',
  'product-demo-1',
  3300,
  '2026-04-01T11:00:00Z',
  '2026-04-01T11:00:00Z'
),
(
  'pli-demo-2',
  'tenant-demo',
  'pl-demo-mayorista',
  'product-demo-2',
  2900,
  '2026-04-01T11:00:30Z',
  '2026-04-01T11:00:30Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.payment_methods (
  id, tenant_id, name, code, type, is_active, affects_cash,
  surcharge_percent, discount_percent, notes, created_at, updated_at
)
VALUES
(
  'pm-demo-cash',
  'tenant-demo',
  'Efectivo',
  'cash',
  'cash',
  true,
  true,
  0,
  0,
  'Medio predeterminado POS',
  '2026-04-01T11:10:00Z',
  '2026-04-01T11:10:00Z'
),
(
  'pm-demo-card-debit',
  'tenant-demo',
  'Tarjeta de debito',
  'card_debit',
  'card',
  true,
  false,
  0,
  0,
  'Medio predeterminado POS',
  '2026-04-01T11:10:10Z',
  '2026-04-01T11:10:10Z'
),
(
  'pm-demo-card-credit',
  'tenant-demo',
  'Tarjeta de credito',
  'card_credit',
  'card',
  true,
  false,
  0,
  0,
  'Medio predeterminado POS',
  '2026-04-01T11:10:20Z',
  '2026-04-01T11:10:20Z'
),
(
  'pm-demo-transfer',
  'tenant-demo',
  'Transferencia',
  'transfer',
  'transfer',
  true,
  false,
  0,
  0,
  'Medio predeterminado POS',
  '2026-04-01T11:10:30Z',
  '2026-04-01T11:10:30Z'
),
(
  'pm-demo-current-account',
  'tenant-demo',
  'Cuenta corriente',
  'current_account',
  'current_account',
  true,
  false,
  0,
  0,
  'Medio predeterminado POS',
  '2026-04-01T11:10:40Z',
  '2026-04-01T11:10:40Z'
),
(
  'pm-demo-mercado-pago',
  'tenant-demo',
  'Mercado Pago',
  'mercado_pago',
  'mercado_pago',
  true,
  false,
  0,
  0,
  'Medio predeterminado POS',
  '2026-04-01T11:10:50Z',
  '2026-04-01T11:10:50Z'
)
ON CONFLICT DO NOTHING;
INSERT INTO public.bank_accounts (
  id, tenant_id, bank_name, account_type, holder_name, cbu, alias, currency_code, notes, is_active, created_at, updated_at
)
VALUES (
  'bank-demo-1',
  'tenant-demo',
  'Banco Nacion',
  'cuenta_corriente',
  'Demo SA',
  '0720123420000001234567',
  'demo.sa.nacion',
  'ARS',
  'Cuenta bancaria principal',
  true,
  '2026-04-01T11:15:00Z',
  '2026-04-01T11:15:00Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.origin_banks (
  id, tenant_id, code, name, is_active, created_at, updated_at
)
VALUES
(
  'obank-demo-1',
  'tenant-demo',
  'banco_nacion',
  'Banco Nacion',
  true,
  '2026-04-01T11:16:00Z',
  '2026-04-01T11:16:00Z'
),
(
  'obank-demo-2',
  'tenant-demo',
  'banco_galicia',
  'Banco Galicia',
  true,
  '2026-04-01T11:16:20Z',
  '2026-04-01T11:16:20Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.installment_plans (
  id, tenant_id, code, name, installments, interest_percent, card_brand, notes, is_active, created_at, updated_at
)
VALUES
(
  'iplan-demo-1',
  'tenant-demo',
  'cuotas_1_0',
  '1 cuota sin interes',
  1,
  0,
  null,
  'Plan base',
  true,
  '2026-04-01T11:17:00Z',
  '2026-04-01T11:17:00Z'
),
(
  'iplan-demo-2',
  'tenant-demo',
  'cuotas_3_10',
  '3 cuotas',
  3,
  10,
  null,
  'Plan base',
  true,
  '2026-04-01T11:17:20Z',
  '2026-04-01T11:17:20Z'
),
(
  'iplan-demo-3',
  'tenant-demo',
  'cuotas_6_20',
  '6 cuotas',
  6,
  20,
  null,
  'Plan base',
  true,
  '2026-04-01T11:17:40Z',
  '2026-04-01T11:17:40Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.promotions (
  id, tenant_id, name, code, description, type, scope, product_id,
  min_quantity, discount_percent, discount_amount, combo_price,
  starts_at, ends_at, is_active, created_at, updated_at
)
VALUES
(
  'promo-demo-1',
  'tenant-demo',
  'Yerba 10 OFF',
  'yerba_10',
  'Descuento de producto',
  'percentage_discount',
  'product',
  'product-demo-1',
  1,
  10,
  null,
  null,
  '2026-04-01T00:00:00Z',
  '2026-12-31T23:59:59Z',
  true,
  '2026-04-01T11:20:00Z',
  '2026-04-01T11:20:00Z'
),
(
  'promo-demo-2',
  'tenant-demo',
  'Descuento carrito',
  'carrito_500',
  'Descuento fijo en carrito',
  'fixed_discount',
  'cart',
  null,
  null,
  500,
  null,
  '2026-04-01T00:00:00Z',
  '2026-12-31T23:59:59Z',
  true,
  '2026-04-01T11:20:30Z',
  '2026-04-01T11:20:30Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.purchases (
  id, tenant_id, supplier_id, purchase_number, status, subtotal, total, notes, created_by, items, supplier, created_at, updated_at
)
VALUES (
  'purchase-demo-1',
  'tenant-demo',
  'supplier-demo-1',
  'CP-DEMO-0001',
  'confirmed',
  90000,
  90000,
  'Compra inicial demo',
  'user-admin-demo',
  '[]'::jsonb,
  null,
  '2026-04-10T09:00:00Z',
  '2026-04-10T09:00:00Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.purchase_items (
  id, tenant_id, purchase_id, product_id, product_name_snapshot, quantity, unit_cost, line_total, created_at, updated_at
)
VALUES
(
  'pitem-demo-1',
  'tenant-demo',
  'purchase-demo-1',
  'product-demo-1',
  'Yerba Mate 1kg',
  30,
  2000,
  60000,
  '2026-04-10T09:01:00Z',
  '2026-04-10T09:01:00Z'
),
(
  'pitem-demo-2',
  'tenant-demo',
  'purchase-demo-1',
  'product-demo-2',
  'Azucar 1kg',
  20,
  1500,
  30000,
  '2026-04-10T09:01:30Z',
  '2026-04-10T09:01:30Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.cash_sessions (
  id, tenant_id, branch_id, opened_by_user_id, closed_by_user_id, status,
  opened_at, closed_at, opening_amount, closing_amount, expected_closing_amount, closing_difference,
  notes, created_at, updated_at
)
VALUES
(
  'cash-session-demo-open',
  'tenant-demo',
  null,
  'user-admin-demo',
  null,
  'open',
  '2026-04-12T08:00:00Z',
  null,
  50000,
  null,
  null,
  null,
  'Caja principal abierta',
  '2026-04-12T08:00:00Z',
  '2026-04-12T08:00:00Z'
),
(
  'cash-session-demo-closed',
  'tenant-demo',
  null,
  'user-admin-demo',
  'user-admin-demo',
  'closed',
  '2026-04-11T08:00:00Z',
  '2026-04-11T18:00:00Z',
  45000,
  47200,
  47000,
  200,
  'Sesion cerrada de referencia',
  '2026-04-11T08:00:00Z',
  '2026-04-11T18:00:00Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.sales (
  id, tenant_id, sale_number, customer_id, cash_session_id, status,
  subtotal, discount_total, tax_total, total, currency_code, notes,
  current_account_id, arca_document_id, mercado_pago_preference_id,
  items, payments, customer, created_at, updated_at
)
VALUES
(
  'sale-demo-1',
  'tenant-demo',
  'VTA-DEMO-0001',
  'customer-demo-2',
  null,
  'completed',
  7000,
  500,
  0,
  6500,
  'ARS',
  'Venta en cuenta corriente',
  null,
  null,
  null,
  '[]'::jsonb,
  '[]'::jsonb,
  null,
  '2026-04-11T11:00:00Z',
  '2026-04-11T11:00:00Z'
),
(
  'sale-demo-2',
  'tenant-demo',
  'VTA-DEMO-0002',
  'customer-demo-1',
  'cash-session-demo-open',
  'completed',
  3200,
  0,
  0,
  3200,
  'ARS',
  'Venta mostrador',
  null,
  null,
  null,
  '[]'::jsonb,
  '[]'::jsonb,
  null,
  '2026-04-11T12:00:00Z',
  '2026-04-11T12:00:00Z'
)
ON CONFLICT DO NOTHING;
INSERT INTO public.sale_items (
  id, tenant_id, sale_id, product_id, product_name_snapshot, quantity,
  unit_price, discount_total, tax_total, line_total, metadata, created_at, updated_at
)
VALUES
(
  'sitem-demo-1',
  'tenant-demo',
  'sale-demo-1',
  'product-demo-1',
  'Yerba Mate 1kg',
  2,
  3500,
  500,
  0,
  6500,
  '{"pricing_snapshot":{"base_unit_price":3500},"promotion_snapshot":{"code":"yerba_10"}}'::jsonb,
  '2026-04-11T11:00:10Z',
  '2026-04-11T11:00:10Z'
),
(
  'sitem-demo-2',
  'tenant-demo',
  'sale-demo-2',
  'product-demo-2',
  'Azucar 1kg',
  1,
  3200,
  0,
  0,
  3200,
  '{"pricing_snapshot":{"base_unit_price":3200}}'::jsonb,
  '2026-04-11T12:00:10Z',
  '2026-04-11T12:00:10Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.sale_payments (
  id, tenant_id, sale_id, payment_method_code, provider, provider_code, amount, currency_code,
  status, provider_status, provider_reference, provider_metadata, external_reference, metadata, created_at, updated_at
)
VALUES
(
  'spay-demo-1',
  'tenant-demo',
  'sale-demo-1',
  'current_account',
  'internal',
  'internal',
  6500,
  'ARS',
  'pending',
  'pending',
  null,
  null,
  null,
  '{"payment_method_snapshot":{"code":"current_account","type":"current_account"}}'::jsonb,
  '2026-04-11T11:00:20Z',
  '2026-04-11T11:00:20Z'
),
(
  'spay-demo-2',
  'tenant-demo',
  'sale-demo-2',
  'cash',
  'internal',
  'internal',
  3200,
  'ARS',
  'approved',
  'approved',
  null,
  null,
  null,
  '{"payment_method_snapshot":{"code":"cash","type":"cash"}}'::jsonb,
  '2026-04-11T12:00:20Z',
  '2026-04-11T12:00:20Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.current_account_movements (
  id, tenant_id, customer_id, sale_id, type, amount, balance_after, notes, created_by, created_at, updated_at
)
VALUES
(
  'cam-demo-1',
  'tenant-demo',
  'customer-demo-2',
  'sale-demo-1',
  'debt',
  6500,
  6500,
  'Venta VTA-DEMO-0001',
  'user-admin-demo',
  '2026-04-11T11:01:00Z',
  '2026-04-11T11:01:00Z'
),
(
  'cam-demo-2',
  'tenant-demo',
  'customer-demo-2',
  null,
  'payment',
  1500,
  5000,
  'Pago parcial',
  'user-admin-demo',
  '2026-04-12T12:00:00Z',
  '2026-04-12T12:00:00Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.receipts (
  id, tenant_id, sale_id, sale_number, receipt_number, issued_at,
  customer_name, payment_method, items, total, notes, created_by, created_at, updated_at
)
VALUES
(
  'receipt-demo-1',
  'tenant-demo',
  'sale-demo-1',
  'VTA-DEMO-0001',
  'TCK-DEMO-0001',
  '2026-04-11T11:02:00Z',
  'Comercial Lopez SRL',
  'current_account',
  '[{"name":"Yerba Mate 1kg","quantity":2,"unit_price":3250,"subtotal":6500}]'::jsonb,
  6500,
  'Comprobante venta en cuenta corriente',
  'user-admin-demo',
  '2026-04-11T11:02:00Z',
  '2026-04-11T11:02:00Z'
),
(
  'receipt-demo-2',
  'tenant-demo',
  'sale-demo-2',
  'VTA-DEMO-0002',
  'TCK-DEMO-0002',
  '2026-04-11T12:02:00Z',
  'Ana Gonzalez',
  'cash',
  '[{"name":"Azucar 1kg","quantity":1,"unit_price":3200,"subtotal":3200}]'::jsonb,
  3200,
  'Comprobante venta mostrador',
  'user-admin-demo',
  '2026-04-11T12:02:00Z',
  '2026-04-11T12:02:00Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.invoices (
  id, tenant_id, sale_id, customer_id, document_type, document_number, issue_date,
  customer_snapshot, items_snapshot, subtotal, tax_total, total, status, arca_status,
  arca_reference, arca_message, notes, created_at, updated_at
)
VALUES
(
  'invoice-demo-1',
  'tenant-demo',
  'sale-demo-2',
  'customer-demo-1',
  'B',
  'B-00000001',
  '2026-04-11T12:05:00Z',
  '{
    "customer_id":"customer-demo-1",
    "full_name":"Ana Gonzalez",
    "business_name":"Ana Gonzalez",
    "document_type":"dni",
    "document_number":"30111222",
    "address":"CABA",
    "fiscal_condition":"Consumidor final"
  }'::jsonb,
  '[{
    "product_id":"product-demo-2",
    "product_name":"Azucar 1kg",
    "quantity":1,
    "unit_price":3200,
    "subtotal":3200,
    "tax_total":0,
    "total":3200
  }]'::jsonb,
  3200,
  0,
  3200,
  'issued',
  'not_sent',
  null,
  null,
  'Generada desde venta demo',
  '2026-04-11T12:05:00Z',
  '2026-04-11T12:05:00Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.credit_notes (
  id, tenant_id, invoice_id, sale_id, customer_id, document_number, issue_date, reason,
  subtotal, tax_total, total, status, arca_status, arca_reference, notes, created_at, updated_at
)
VALUES (
  'credit-note-demo-1',
  'tenant-demo',
  'invoice-demo-1',
  'sale-demo-2',
  'customer-demo-1',
  'NC-00000001',
  '2026-04-12T09:00:00Z',
  'price_adjustment',
  500,
  0,
  500,
  'issued',
  'not_sent',
  null,
  'Ajuste comercial demo',
  '2026-04-12T09:00:00Z',
  '2026-04-12T09:00:00Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.stock_movements (
  id, tenant_id, product_id, movement_type, quantity, reference_type, reference_id, notes, created_by, created_at, updated_at
)
VALUES
(
  'smov-demo-1',
  'tenant-demo',
  'product-demo-1',
  'purchase',
  30,
  'purchase',
  'purchase-demo-1',
  'Ingreso por compra CP-DEMO-0001',
  'user-admin-demo',
  '2026-04-10T09:02:00Z',
  '2026-04-10T09:02:00Z'
),
(
  'smov-demo-2',
  'tenant-demo',
  'product-demo-2',
  'purchase',
  20,
  'purchase',
  'purchase-demo-1',
  'Ingreso por compra CP-DEMO-0001',
  'user-admin-demo',
  '2026-04-10T09:02:30Z',
  '2026-04-10T09:02:30Z'
),
(
  'smov-demo-3',
  'tenant-demo',
  'product-demo-1',
  'sale',
  2,
  'sale',
  'sale-demo-1',
  'Salida por venta VTA-DEMO-0001',
  'user-admin-demo',
  '2026-04-11T11:00:30Z',
  '2026-04-11T11:00:30Z'
),
(
  'smov-demo-4',
  'tenant-demo',
  'product-demo-2',
  'sale',
  1,
  'sale',
  'sale-demo-2',
  'Salida por venta VTA-DEMO-0002',
  'user-admin-demo',
  '2026-04-11T12:00:30Z',
  '2026-04-11T12:00:30Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.cash_movements (
  id, tenant_id, cash_session_id, movement_type, amount, currency_code, reference_type, reference_id, notes, created_by, created_at, updated_at
)
VALUES
(
  'cmov-demo-1',
  'tenant-demo',
  'cash-session-demo-open',
  'sale_payment',
  3200,
  'ARS',
  'cash',
  'sale-demo-2',
  'Cobro venta VTA-DEMO-0002 - Efectivo',
  'user-admin-demo',
  '2026-04-11T12:00:40Z',
  '2026-04-11T12:00:40Z'
),
(
  'cmov-demo-2',
  'tenant-demo',
  'cash-session-demo-open',
  'income',
  1000,
  'ARS',
  'manual_income',
  null,
  'Ingreso manual',
  'user-admin-demo',
  '2026-04-12T09:30:00Z',
  '2026-04-12T09:30:00Z'
),
(
  'cmov-demo-3',
  'tenant-demo',
  'cash-session-demo-open',
  'expense',
  500,
  'ARS',
  'manual_expense',
  null,
  'Egreso manual',
  'user-admin-demo',
  '2026-04-12T10:15:00Z',
  '2026-04-12T10:15:00Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.audit_logs (
  id, tenant_id, user_id, module, action, entity_type, entity_id, description, metadata, created_at
)
VALUES
(
  'audit-demo-1',
  'tenant-demo',
  'user-admin-demo',
  'pos',
  'sale_confirmed',
  'sale',
  'sale-demo-1',
  'Venta confirmada: VTA-DEMO-0001',
  '{"sale_number":"VTA-DEMO-0001","total":6500,"payment_method_code":"current_account"}'::jsonb,
  '2026-04-11T11:03:00Z'
),
(
  'audit-demo-2',
  'tenant-demo',
  'user-admin-demo',
  'pos',
  'sale_confirmed',
  'sale',
  'sale-demo-2',
  'Venta confirmada: VTA-DEMO-0002',
  '{"sale_number":"VTA-DEMO-0002","total":3200,"payment_method_code":"cash"}'::jsonb,
  '2026-04-11T12:03:00Z'
),
(
  'audit-demo-3',
  'tenant-demo',
  'user-admin-demo',
  'facturacion',
  'generate_from_sale',
  'invoice',
  'invoice-demo-1',
  'Documento fiscal generado: B-00000001',
  '{"sale_id":"sale-demo-2","document_type":"B","total":3200}'::jsonb,
  '2026-04-11T12:05:30Z'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.tenant_settings (
  id, tenant_id, negocio, pos, stock, caja, facturacion, codigos_balanza, apariencia, sistema, created_at, updated_at
)
VALUES (
  'settings-tenant-demo',
  'tenant-demo',
  '{
    "trade_name":"Demo",
    "legal_name":"Demo SA",
    "cuit":"30-00000000-0",
    "address":"Av. Principal 123",
    "phone":"1140000000",
    "email":"admin@demo.local",
    "logo_url":null,
    "currency_code":"ARS",
    "timezone":"America/Buenos_Aires"
  }'::jsonb,
  '{
    "default_customer_id":null,
    "auto_print_receipt":false,
    "allow_sale_without_customer":true,
    "allow_negative_stock":false,
    "barcode_scan_quantity":1,
    "cart_behavior":"merge_same_product"
  }'::jsonb,
  '{
    "use_min_max":true,
    "alerts_active":true,
    "global_low_stock_threshold":5,
    "allow_manual_adjustments":true,
    "allow_negative_stock":false
  }'::jsonb,
  '{
    "require_open_session_for_sale":false,
    "default_opening_amount":50000,
    "allow_manual_movements":true,
    "require_notes_on_manual_movements":false
  }'::jsonb,
  '{
    "document_sequences":{"A":1,"B":2,"C":1,"PRESUPUESTO":1},
    "default_document_type":"B",
    "allow_budget_without_customer":true,
    "issuer_tax_name":"Demo SA",
    "issuer_cuit":"30-00000000-0",
    "issuer_address":"Av. Principal 123",
    "issuer_fiscal_condition":"Responsable inscripto",
    "arca":{
      "enabled":false,
      "mode":"mock",
      "cuit_emisor":"",
      "punto_venta":1,
      "certificado_alias":"",
      "fiscal_environment":"homologacion",
      "force_unavailable":false,
      "allow_internal_fallback":true
    }
  }'::jsonb,
  '{
    "scale_parser_enabled":false,
    "scale_prefix":"20",
    "code_length":13,
    "plu_start":3,
    "plu_length":4,
    "weight_start":7,
    "weight_length":5,
    "amount_start":7,
    "amount_length":5,
    "ean13_enabled":true
  }'::jsonb,
  '{
    "default_theme":"light",
    "accent_color":"#6054e8",
    "display_name":"POS V2",
    "density":"standard"
  }'::jsonb,
  '{
    "show_dev_flags":false,
    "data_provider":"supabase",
    "version":"2.0.0-dev",
    "enable_mock_auth_bypass":false,
    "allow_placeholder_export_import":true,
    "mercado_pago":{
      "enabled":true,
      "mode":"mock",
      "access_token":"",
      "public_key":"",
      "force_unavailable":false
    }
  }'::jsonb,
  '2026-04-01T10:15:00Z',
  '2026-04-12T12:10:00Z'
)
ON CONFLICT DO NOTHING;

COMMIT;
