-- 029_bank_account_movements.sql
-- Modulo Contable: Crea la tabla bank_account_movements para el registro de ingresos y egresos
-- en cuentas bancarias y billeteras virtuales con RLS multitenant y calculo de saldos.

create table if not exists public.bank_account_movements (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  bank_account_id text not null references public.bank_accounts(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  origin_type text not null check (origin_type in (
    'pos_sale',
    'customer_collection',
    'supplier_payment',
    'service_expense',
    'manual_income',
    'manual_expense',
    'account_transfer'
  )),
  concept text not null,
  amount numeric(14,2) not null check (amount > 0),
  balance_after numeric(14,2) not null default 0,
  reference_id text,
  voucher_number text,
  notes text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indices
create index if not exists bank_account_movements_tenant_bank_idx
  on public.bank_account_movements(tenant_id, bank_account_id, created_at desc);

create index if not exists bank_account_movements_tenant_created_idx
  on public.bank_account_movements(tenant_id, created_at desc);

-- RLS
alter table public.bank_account_movements enable row level security;

drop policy if exists bank_account_movements_select_own_tenant on public.bank_account_movements;
create policy bank_account_movements_select_own_tenant
  on public.bank_account_movements
  for select
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists bank_account_movements_insert_own_tenant on public.bank_account_movements;
create policy bank_account_movements_insert_own_tenant
  on public.bank_account_movements
  for insert
  to authenticated
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists bank_account_movements_update_own_tenant on public.bank_account_movements;
create policy bank_account_movements_update_own_tenant
  on public.bank_account_movements
  for update
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists bank_account_movements_delete_own_tenant on public.bank_account_movements;
create policy bank_account_movements_delete_own_tenant
  on public.bank_account_movements
  for delete
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists bank_account_movements_service_all on public.bank_account_movements;
create policy bank_account_movements_service_all
  on public.bank_account_movements
  for all
  to service_role
  using (true)
  with check (true);
