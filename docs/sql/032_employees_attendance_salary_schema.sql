-- 032_employees_attendance_salary_schema.sql
-- Modulo Agenda • Empleados: Esquema de base de datos para personal,
-- registro de asistencia (ingreso/egreso), cuentas corrientes de empleados y liquidación/pagos de sueldo.

begin;

-- ============================================================================
-- 1. TABLA: public.employees (Legajos de Empleados)
-- ============================================================================
create table if not exists public.employees (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  code text not null,
  full_name text not null,
  document_type text not null default 'dni',
  document_number text not null,
  phone text,
  email text,
  address text,
  position text not null default 'Empleado',
  base_salary numeric(14,2) not null default 0,
  hourly_rate numeric(14,2),
  hire_date text,
  current_balance numeric(14,2) not null default 0,
  current_account_enabled boolean not null default true,
  current_account_limit numeric(14,2),
  observations text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_tenant_code_key unique (tenant_id, code)
);

create index if not exists employees_tenant_active_idx
  on public.employees(tenant_id, is_active);

create index if not exists employees_tenant_name_idx
  on public.employees(tenant_id, full_name);

-- ============================================================================
-- 2. TABLA: public.employee_attendance (Horarios y Asistencia)
-- ============================================================================
create table if not exists public.employee_attendance (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  employee_id text not null references public.employees(id) on delete cascade,
  date text not null,
  check_in text not null,
  check_out text,
  total_hours numeric(6,2),
  status text not null default 'present' check (status in ('present', 'late', 'absent', 'justified', 'early_leave')),
  notes text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_attendance_tenant_emp_date_idx
  on public.employee_attendance(tenant_id, employee_id, date desc);

create index if not exists employee_attendance_tenant_date_idx
  on public.employee_attendance(tenant_id, date desc);

-- ============================================================================
-- 3. TABLA: public.employee_current_account_movements (Cuenta Corriente Empleados)
-- ============================================================================
create table if not exists public.employee_current_account_movements (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  employee_id text not null references public.employees(id) on delete cascade,
  sale_id text references public.sales(id) on delete set null,
  type text not null check (type in ('debt', 'payment', 'adjustment')),
  amount numeric(14,2) not null check (amount > 0),
  balance_after numeric(14,2) not null default 0,
  category text not null default 'other' check (
    category in ('product_purchase', 'salary_deduction', 'advance', 'cash_payment', 'adjustment', 'other')
  ),
  notes text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_cc_movements_tenant_emp_idx
  on public.employee_current_account_movements(tenant_id, employee_id, created_at desc);

-- ============================================================================
-- 4. TABLA: public.employee_salary_payments (Saldos Pagados / Liquidaciones)
-- ============================================================================
create table if not exists public.employee_salary_payments (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.tenants(id) on delete cascade,
  employee_id text not null references public.employees(id) on delete cascade,
  period text not null,
  gross_amount numeric(14,2) not null default 0,
  deductions_amount numeric(14,2) not null default 0,
  current_account_discount_applied numeric(14,2) not null default 0,
  bonuses_amount numeric(14,2) not null default 0,
  net_amount_paid numeric(14,2) not null default 0,
  payment_method_code text not null default 'cash',
  payment_date text not null default to_char(now(), 'YYYY-MM-DD'),
  notes text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_salary_payments_tenant_emp_idx
  on public.employee_salary_payments(tenant_id, employee_id, payment_date desc);

-- ============================================================================
-- 5. TRIGGERS: updated_at automático
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists set_employees_updated_at on public.employees;
    create trigger set_employees_updated_at
      before update on public.employees
      for each row execute function public.set_updated_at();

    drop trigger if exists set_employee_attendance_updated_at on public.employee_attendance;
    create trigger set_employee_attendance_updated_at
      before update on public.employee_attendance
      for each row execute function public.set_updated_at();

    drop trigger if exists set_employee_current_account_movements_updated_at on public.employee_current_account_movements;
    create trigger set_employee_current_account_movements_updated_at
      before update on public.employee_current_account_movements
      for each row execute function public.set_updated_at();

    drop trigger if exists set_employee_salary_payments_updated_at on public.employee_salary_payments;
    create trigger set_employee_salary_payments_updated_at
      before update on public.employee_salary_payments
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ============================================================================
-- 6. HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================================================
alter table public.employees enable row level security;
alter table public.employee_attendance enable row level security;
alter table public.employee_current_account_movements enable row level security;
alter table public.employee_salary_payments enable row level security;

-- ============================================================================
-- 7. POLÍTICAS RLS (Multi-Tenant Isolation)
-- ============================================================================

-- Policies: public.employees
drop policy if exists employees_select_own_tenant on public.employees;
create policy employees_select_own_tenant
  on public.employees
  for select
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employees_insert_own_tenant on public.employees;
create policy employees_insert_own_tenant
  on public.employees
  for insert
  to authenticated
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employees_update_own_tenant on public.employees;
create policy employees_update_own_tenant
  on public.employees
  for update
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employees_delete_own_tenant on public.employees;
create policy employees_delete_own_tenant
  on public.employees
  for delete
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employees_service_all on public.employees;
create policy employees_service_all
  on public.employees
  for all
  to service_role
  using (true)
  with check (true);

-- Policies: public.employee_attendance
drop policy if exists employee_attendance_select_own_tenant on public.employee_attendance;
create policy employee_attendance_select_own_tenant
  on public.employee_attendance
  for select
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_attendance_insert_own_tenant on public.employee_attendance;
create policy employee_attendance_insert_own_tenant
  on public.employee_attendance
  for insert
  to authenticated
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_attendance_update_own_tenant on public.employee_attendance;
create policy employee_attendance_update_own_tenant
  on public.employee_attendance
  for update
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_attendance_delete_own_tenant on public.employee_attendance;
create policy employee_attendance_delete_own_tenant
  on public.employee_attendance
  for delete
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_attendance_service_all on public.employee_attendance;
create policy employee_attendance_service_all
  on public.employee_attendance
  for all
  to service_role
  using (true)
  with check (true);

-- Policies: public.employee_current_account_movements
drop policy if exists employee_cc_movements_select_own_tenant on public.employee_current_account_movements;
create policy employee_cc_movements_select_own_tenant
  on public.employee_current_account_movements
  for select
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_cc_movements_insert_own_tenant on public.employee_current_account_movements;
create policy employee_cc_movements_insert_own_tenant
  on public.employee_current_account_movements
  for insert
  to authenticated
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_cc_movements_update_own_tenant on public.employee_current_account_movements;
create policy employee_cc_movements_update_own_tenant
  on public.employee_current_account_movements
  for update
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_cc_movements_delete_own_tenant on public.employee_current_account_movements;
create policy employee_cc_movements_delete_own_tenant
  on public.employee_current_account_movements
  for delete
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_cc_movements_service_all on public.employee_current_account_movements;
create policy employee_cc_movements_service_all
  on public.employee_current_account_movements
  for all
  to service_role
  using (true)
  with check (true);

-- Policies: public.employee_salary_payments
drop policy if exists employee_salary_payments_select_own_tenant on public.employee_salary_payments;
create policy employee_salary_payments_select_own_tenant
  on public.employee_salary_payments
  for select
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_salary_payments_insert_own_tenant on public.employee_salary_payments;
create policy employee_salary_payments_insert_own_tenant
  on public.employee_salary_payments
  for insert
  to authenticated
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_salary_payments_update_own_tenant on public.employee_salary_payments;
create policy employee_salary_payments_update_own_tenant
  on public.employee_salary_payments
  for update
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_salary_payments_delete_own_tenant on public.employee_salary_payments;
create policy employee_salary_payments_delete_own_tenant
  on public.employee_salary_payments
  for delete
  to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_salary_payments_service_all on public.employee_salary_payments;
create policy employee_salary_payments_service_all
  on public.employee_salary_payments
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================================
-- 8. ASIGNAR PERMISOS A ROLES SUPABASE
-- ============================================================================
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.employee_attendance to authenticated;
grant select, insert, update, delete on public.employee_current_account_movements to authenticated;
grant select, insert, update, delete on public.employee_salary_payments to authenticated;

grant all on public.employees to service_role;
grant all on public.employee_attendance to service_role;
grant all on public.employee_current_account_movements to service_role;
grant all on public.employee_salary_payments to service_role;

-- ============================================================================
-- 9. ACTUALIZAR PERMISOS DE MÓDULO EMPLEADOS EN PERMISSION_PROFILES
-- ============================================================================
update public.permission_profiles
set permissions = jsonb_set(
  permissions,
  '{empleados}',
  '{"read": true, "write": true}'::jsonb,
  true
)
where not (permissions ? 'empleados');

commit;
