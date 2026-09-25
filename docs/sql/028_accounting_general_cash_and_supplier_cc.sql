-- 028_accounting_general_cash_and_supplier_cc.sql
-- Modulo Contable: Crea las tablas general_cash_movements (Caja General / Caja Fuerte)
-- y supplier_current_account_movements (Cuentas Corrientes a Proveedores) con RLS multitenant.

-- 1. Tabla de Movimientos de Caja General (Caja Fuerte central)
create table if not exists public.general_cash_movements (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  origin_type text not null check (origin_type in (
    'daily_cash_close',
    'daily_cash_open',
    'bank_deposit',
    'supplier_payment',
    'manual_income',
    'manual_expense'
  )),
  concept text not null,
  balance_after numeric(14,2) not null default 0,
  reference_id text,
  notes text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indices para Caja General
create index if not exists general_cash_movements_tenant_idx
  on public.general_cash_movements(tenant_id, created_at desc);

-- 2. Tabla de Movimientos de Cuenta Corriente Proveedores
create table if not exists public.supplier_current_account_movements (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  supplier_id text not null references public.suppliers(id) on delete cascade,
  purchase_id text references public.purchases(id) on delete set null,
  type text not null check (type in (
    'debt',
    'payment',
    'purchase_debt',
    'supplier_payment',
    'credit_note',
    'debit_note',
    'initial_balance',
    'adjustment'
  )),
  amount numeric(14,2) not null check (amount > 0),
  balance_after numeric(14,2) not null default 0,
  payment_method_id text references public.payment_methods(id) on delete set null,
  payment_method_code text,
  notes text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indices para Cuenta Corriente Proveedores
create index if not exists supplier_cc_movements_tenant_supplier_idx
  on public.supplier_current_account_movements(tenant_id, supplier_id, created_at desc);

-- 3. Habilitar RLS (Row Level Security)
alter table public.general_cash_movements enable row level security;
alter table public.supplier_current_account_movements enable row level security;

-- 4. Politicas RLS para general_cash_movements
drop policy if exists general_cash_movements_select_own_tenant on public.general_cash_movements;
create policy general_cash_movements_select_own_tenant
  on public.general_cash_movements
  for select
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists general_cash_movements_insert_own_tenant on public.general_cash_movements;
create policy general_cash_movements_insert_own_tenant
  on public.general_cash_movements
  for insert
  to authenticated
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists general_cash_movements_update_own_tenant on public.general_cash_movements;
create policy general_cash_movements_update_own_tenant
  on public.general_cash_movements
  for update
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists general_cash_movements_delete_own_tenant on public.general_cash_movements;
create policy general_cash_movements_delete_own_tenant
  on public.general_cash_movements
  for delete
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists general_cash_movements_service_all on public.general_cash_movements;
create policy general_cash_movements_service_all
  on public.general_cash_movements
  for all
  to service_role
  using (true)
  with check (true);

-- 5. Politicas RLS para supplier_current_account_movements
drop policy if exists supplier_current_account_movements_select_own_tenant on public.supplier_current_account_movements;
create policy supplier_current_account_movements_select_own_tenant
  on public.supplier_current_account_movements
  for select
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists supplier_current_account_movements_insert_own_tenant on public.supplier_current_account_movements;
create policy supplier_current_account_movements_insert_own_tenant
  on public.supplier_current_account_movements
  for insert
  to authenticated
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists supplier_current_account_movements_update_own_tenant on public.supplier_current_account_movements;
create policy supplier_current_account_movements_update_own_tenant
  on public.supplier_current_account_movements
  for update
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists supplier_current_account_movements_delete_own_tenant on public.supplier_current_account_movements;
create policy supplier_current_account_movements_delete_own_tenant
  on public.supplier_current_account_movements
  for delete
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists supplier_current_account_movements_service_all on public.supplier_current_account_movements;
create policy supplier_current_account_movements_service_all
  on public.supplier_current_account_movements
  for all
  to service_role
  using (true)
  with check (true);
