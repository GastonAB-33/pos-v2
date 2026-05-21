-- 011_validate_tenant_isolation.sql
-- POS V2 - Validacion de aislamiento tenant tras ejecutar 010.
--
-- IMPORTANTE:
-- Ejecutar despues de docs/sql/010_fix_tenant_rls_policies.sql.
-- Este script no modifica datos. Usa SET LOCAL ROLE authenticated para simular
-- la sesion de un usuario real y comprobar RLS desde SQL Editor.
--
-- Si SET ROLE authenticated falla en tu proyecto, haceme llegar el error y
-- hacemos la validacion desde el navegador con el token real del usuario.

-- 1) Verificar que no queden policies abiertas de desarrollo.
select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    policyname in ('dev_all_anon', 'dev_all_auth')
    or qual = 'true'
    or with_check = 'true'
  )
order by tablename, policyname;

-- Esperado: 0 filas, salvo policies service_role si decidimos mantenerlas.
-- Si aparecen dev_all_anon/dev_all_auth, NO esta corregido.

-- 2) Copiar estos valores para saber que usuarios se pueden simular.
select
  t.trade_name,
  u.id as app_user_id,
  u.email,
  u.auth_user_id,
  u.tenant_id
from public.users u
join public.tenants t on t.id = u.tenant_id
where u.auth_user_id is not null
order by t.trade_name, u.email;

-- 3) Validacion simulando usuario de La25.
-- Reemplazar el uuid si cambia el usuario de prueba.
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'f4819a2c-1542-4d7a-a9b9-e0ac51c7d9ba';

select
  'contexto La25' as check_name,
  auth.uid() as auth_uid,
  public.current_app_user_id() as app_user_id,
  public.current_tenant_id() as tenant_id;

select 'tenants visibles' as check_name, id, trade_name
from public.tenants
order by trade_name;

select 'cash_movements por tenant visibles' as check_name, tenant_id, count(*) as rows_count
from public.cash_movements
group by tenant_id
order by tenant_id;

select 'products por tenant visibles' as check_name, tenant_id, count(*) as rows_count
from public.products
group by tenant_id
order by tenant_id;

select 'customers por tenant visibles' as check_name, tenant_id, count(*) as rows_count
from public.customers
group by tenant_id
order by tenant_id;

select 'sales por tenant visibles' as check_name, tenant_id, count(*) as rows_count
from public.sales
group by tenant_id
order by tenant_id;

rollback;

-- Esperado para La25:
-- - current_tenant_id = 9b559ba0-2b40-484d-a32a-18743a07fabe
-- - tenants visibles: solo La25
-- - cash_movements/products/customers/sales: solo tenant_id de La25
-- - ningun tenant_id = demo

-- 4) Validacion de usuario anon.
-- Debe ver 0 datos operativos.
begin;
set local role anon;

select 'anon tenants visibles' as check_name, count(*) as rows_count
from public.tenants;

select 'anon products visibles' as check_name, count(*) as rows_count
from public.products;

select 'anon customers visibles' as check_name, count(*) as rows_count
from public.customers;

select 'anon sales visibles' as check_name, count(*) as rows_count
from public.sales;

rollback;

-- Esperado para anon: todos los rows_count deben ser 0.

-- 5) Validacion opcional de bloqueo de insert cross-tenant.
-- Debe fallar con RLS si se descomenta.
--
-- begin;
-- set local role authenticated;
-- set local request.jwt.claim.sub = 'f4819a2c-1542-4d7a-a9b9-e0ac51c7d9ba';
--
-- insert into public.products (
--   id,
--   tenant_id,
--   code,
--   name,
--   price,
--   stock_current,
--   is_active,
--   created_at,
--   updated_at
-- )
-- values (
--   'rls-cross-tenant-test',
--   'demo',
--   'RLS-TEST',
--   'Producto que NO debe insertarse',
--   1,
--   1,
--   true,
--   now(),
--   now()
-- );
--
-- rollback;
--
-- Esperado al descomentar: ERROR por row-level security policy.
