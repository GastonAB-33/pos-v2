-- ============================================================================
-- 033_la25_employees_diagnostics_and_fix.sql
-- Diagnóstico y Solución Integral para el Módulo de Empleados en el Tenant La25
-- ============================================================================
--
-- MOTIVOS POR LOS QUE NO APARECEN REGISTROS EN LA25:
-- 1. TABLAS NO APLICADAS EN SUPABASE: Si no se corrió el script 032, las tablas
--    'employees', 'employee_attendance', 'employee_current_account_movements' y
--    'employee_salary_payments' no existen en la base de datos de producción.
-- 2. DIFERENCIA ENTRE USUARIOS Y EMPLEADOS: 'public.users' son las cuentas de login
--    al POS (Alejandro, Patricia, etc.), mientras que 'public.employees' son los
--    legajos de personal (sueldo, horario, cuenta corriente). Son entidades separadas.
-- 3. PERFIL DE PERMISOS: Los perfiles anteriores de La25 no tenían la clave 'empleados'
--    en su JSON de permisos.
-- 4. AUSENCIA DE REGISTROS DE EMPLEADOS: En el tenant demo se autoseembran empleados ficticios
--    (Lucas Benítez, Mariana Rossi), pero en comercios reales como La25 NO se inventan datos
--    por regla de seguridad, por lo que arranca en 0 registros hasta dar de alta el primer legajo.
-- ============================================================================

begin;

-- 1. Asegurar que la tabla public.employees exista con todas sus columnas
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
  discount_percent numeric(5,2),
  observations text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_tenant_code_key unique (tenant_id, code)
);

-- Si la tabla ya existía de antes, asegurarse de que tenga la columna discount_percent
alter table public.employees add column if not exists discount_percent numeric(5,2);

create index if not exists employees_tenant_active_idx
  on public.employees(tenant_id, is_active);

create index if not exists employees_tenant_name_idx
  on public.employees(tenant_id, full_name);

-- 2. Asegurar tabla public.employee_attendance
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

-- 3. Asegurar tabla public.employee_current_account_movements
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

-- 4. Asegurar tabla public.employee_salary_payments
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
  payment_type text default 'salary',
  advances_discount_applied numeric(14,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_salary_payments_tenant_emp_idx
  on public.employee_salary_payments(tenant_id, employee_id, payment_date desc);

-- 5. Habilitar RLS y Políticas de Aislamiento Multi-Tenant
alter table public.employees enable row level security;
alter table public.employee_attendance enable row level security;
alter table public.employee_current_account_movements enable row level security;
alter table public.employee_salary_payments enable row level security;

-- Policies: public.employees
drop policy if exists employees_select_own_tenant on public.employees;
create policy employees_select_own_tenant
  on public.employees for select to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employees_insert_own_tenant on public.employees;
create policy employees_insert_own_tenant
  on public.employees for insert to authenticated
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employees_update_own_tenant on public.employees;
create policy employees_update_own_tenant
  on public.employees for update to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employees_delete_own_tenant on public.employees;
create policy employees_delete_own_tenant
  on public.employees for delete to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employees_service_all on public.employees;
create policy employees_service_all
  on public.employees for all to service_role
  using (true) with check (true);

-- Policies: public.employee_attendance
drop policy if exists employee_attendance_select_own_tenant on public.employee_attendance;
create policy employee_attendance_select_own_tenant
  on public.employee_attendance for select to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_attendance_insert_own_tenant on public.employee_attendance;
create policy employee_attendance_insert_own_tenant
  on public.employee_attendance for insert to authenticated
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_attendance_update_own_tenant on public.employee_attendance;
create policy employee_attendance_update_own_tenant
  on public.employee_attendance for update to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_attendance_delete_own_tenant on public.employee_attendance;
create policy employee_attendance_delete_own_tenant
  on public.employee_attendance for delete to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_attendance_service_all on public.employee_attendance;
create policy employee_attendance_service_all
  on public.employee_attendance for all to service_role
  using (true) with check (true);

-- Policies: public.employee_current_account_movements
drop policy if exists employee_cc_movements_select_own_tenant on public.employee_current_account_movements;
create policy employee_cc_movements_select_own_tenant
  on public.employee_current_account_movements for select to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_cc_movements_insert_own_tenant on public.employee_current_account_movements;
create policy employee_cc_movements_insert_own_tenant
  on public.employee_current_account_movements for insert to authenticated
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_cc_movements_update_own_tenant on public.employee_current_account_movements;
create policy employee_cc_movements_update_own_tenant
  on public.employee_current_account_movements for update to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_cc_movements_delete_own_tenant on public.employee_current_account_movements;
create policy employee_cc_movements_delete_own_tenant
  on public.employee_current_account_movements for delete to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_cc_movements_service_all on public.employee_current_account_movements;
create policy employee_cc_movements_service_all
  on public.employee_current_account_movements for all to service_role
  using (true) with check (true);

-- Policies: public.employee_salary_payments
drop policy if exists employee_salary_payments_select_own_tenant on public.employee_salary_payments;
create policy employee_salary_payments_select_own_tenant
  on public.employee_salary_payments for select to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_salary_payments_insert_own_tenant on public.employee_salary_payments;
create policy employee_salary_payments_insert_own_tenant
  on public.employee_salary_payments for insert to authenticated
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_salary_payments_update_own_tenant on public.employee_salary_payments;
create policy employee_salary_payments_update_own_tenant
  on public.employee_salary_payments for update to authenticated
  using (public.belongs_to_current_tenant(tenant_id))
  with check (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_salary_payments_delete_own_tenant on public.employee_salary_payments;
create policy employee_salary_payments_delete_own_tenant
  on public.employee_salary_payments for delete to authenticated
  using (public.belongs_to_current_tenant(tenant_id));

drop policy if exists employee_salary_payments_service_all on public.employee_salary_payments;
create policy employee_salary_payments_service_all
  on public.employee_salary_payments for all to service_role
  using (true) with check (true);

-- 6. Otorgar permisos GRANT a los roles de Supabase
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.employee_attendance to authenticated;
grant select, insert, update, delete on public.employee_current_account_movements to authenticated;
grant select, insert, update, delete on public.employee_salary_payments to authenticated;

grant all on public.employees to service_role;
grant all on public.employee_attendance to service_role;
grant all on public.employee_current_account_movements to service_role;
grant all on public.employee_salary_payments to service_role;

-- 7. Actualizar permisos en TODOS los perfiles de La25
update public.permission_profiles
set permissions = jsonb_set(
  permissions,
  '{empleados}',
  '{"read": true, "write": true}'::jsonb,
  true
)
where tenant_id = '9b559ba0-2b40-484d-a32a-18743a07fabe'
   or tenant_id in (select id from public.tenants where lower(trade_name) in ('la25', 'la 25'));

-- 8. ALTA DE EMPLEADOS INICIALES PARA LA25 (Si aún no tiene ningún empleado registrado)
do $$
declare
  v_tenant_id text;
  v_emp_count int;
  v_patricia_user record;
  v_emp_id text;
begin
  select id::text into v_tenant_id
  from public.tenants
  where id::text = '9b559ba0-2b40-484d-a32a-18743a07fabe'
     or lower(trade_name) in ('la25', 'la 25')
  limit 1;

  if v_tenant_id is null then
    raise notice 'Tenant La25 no encontrado para autosembrado.';
    return;
  end if;

  select count(*) into v_emp_count
  from public.employees
  where tenant_id = v_tenant_id;

  if v_emp_count = 0 then
    -- Buscar usuario Patricia Martinez de La25 si existe en public.users
    select * into v_patricia_user
    from public.users
    where tenant_id = v_tenant_id
      and (lower(full_name) like '%patricia%' or lower(email) like '%patricia%')
    limit 1;

    -- Registrar legajo inicial EMP-001 para Patricia Martínez
    v_emp_id := gen_random_uuid()::text;
    insert into public.employees (
      id, tenant_id, code, full_name, document_type, document_number,
      phone, email, position, base_salary, hourly_rate, hire_date,
      current_balance, current_account_enabled, current_account_limit,
      discount_percent, observations, is_active
    ) values (
      v_emp_id,
      v_tenant_id,
      'EMP-001',
      coalesce(v_patricia_user.full_name, 'Patricia Martinez'),
      'dni',
      '27123456',
      coalesce(v_patricia_user.username, '11 2345-6789'),
      coalesce(v_patricia_user.email, 'patricia.mart00@gmail.com'),
      'Encargada / Administración',
      650000,
      4000,
      to_char(now(), 'YYYY-MM-DD'),
      0,
      true,
      100000,
      10,
      'Legajo de personal registrado para La25',
      true
    );

    raise notice 'Empleado EMP-001 (%s) creado exitosamente para La25.', coalesce(v_patricia_user.full_name, 'Patricia Martinez');
  else
    raise notice 'El tenant La25 ya posee % empleados registrados.', v_emp_count;
  end if;
end $$;

commit;

-- ============================================================================
-- VERIFICACIÓN FINAL: Listado de empleados activos en La25
-- ============================================================================
select 
  t.trade_name as comercio,
  e.code as legajo,
  e.full_name as nombre,
  e.position as puesto,
  e.base_salary as sueldo_base,
  e.current_balance as saldo_cuenta_corriente,
  e.is_active as activo,
  e.created_at
from public.employees e
join public.tenants t on t.id = e.tenant_id
where t.id = '9b559ba0-2b40-484d-a32a-18743a07fabe'
   or lower(t.trade_name) in ('la25', 'la 25')
order by e.code asc;
