-- 012_validate_tenant_isolation_single_result.sql
-- POS V2 - Validacion compacta de aislamiento por tenant.
--
-- Ejecutar despues de docs/sql/010_fix_tenant_rls_policies.sql.
-- No modifica datos permanentes. Solo crea una tabla temporal de resultados.

drop table if exists pg_temp.pos_rls_validation_results;

create temp table pos_rls_validation_results (
  sort_order integer,
  section text,
  check_name text,
  status text,
  details text,
  rows_count bigint
);

grant insert, select on pos_rls_validation_results to authenticated;
grant insert, select on pos_rls_validation_results to anon;

insert into pos_rls_validation_results
select
  10,
  'policies',
  'dev_all policies',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  coalesce(string_agg(tablename || '.' || policyname, ', ' order by tablename, policyname), 'no dev_all policies found'),
  count(*)
from pg_policies
where schemaname = 'public'
  and policyname in ('dev_all_anon', 'dev_all_auth');

insert into pos_rls_validation_results
select
  20,
  'policies',
  'authenticated open true policies',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  coalesce(string_agg(tablename || '.' || policyname, ', ' order by tablename, policyname), 'no authenticated true policies found'),
  count(*)
from pg_policies
where schemaname = 'public'
  and roles::text like '%authenticated%'
  and (qual = 'true' or with_check = 'true');

insert into pos_rls_validation_results
select
  30,
  'policies',
  'service_role open policies',
  'INFO',
  coalesce(string_agg(tablename || '.' || policyname, ', ' order by tablename, policyname), 'no service_role true policies found'),
  count(*)
from pg_policies
where schemaname = 'public'
  and roles::text like '%service_role%'
  and (qual = 'true' or with_check = 'true');

insert into pos_rls_validation_results
select
  40,
  'auth bridge',
  'users linked to auth',
  case when count(*) >= 2 then 'PASS' else 'WARN' end,
  coalesce(string_agg(t.trade_name || ': ' || u.email || ' -> ' || u.auth_user_id::text, ' | ' order by t.trade_name, u.email), 'no linked users'),
  count(*)
from public.users u
join public.tenants t on t.id = u.tenant_id
where u.auth_user_id is not null;

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'f4819a2c-1542-4d7a-a9b9-e0ac51c7d9ba';

insert into pos_rls_validation_results
select
  100,
  'La25 authenticated',
  'current tenant',
  case when public.current_tenant_id() = '9b559ba0-2b40-484d-a32a-18743a07fabe' then 'PASS' else 'FAIL' end,
  'auth_uid=' || coalesce(auth.uid()::text, '<null>')
    || ', app_user_id=' || coalesce(public.current_app_user_id(), '<null>')
    || ', tenant_id=' || coalesce(public.current_tenant_id(), '<null>'),
  null::bigint;

insert into pos_rls_validation_results
select
  110,
  'La25 authenticated',
  'visible tenants',
  case when count(*) = 1 and min(id) = '9b559ba0-2b40-484d-a32a-18743a07fabe' then 'PASS' else 'FAIL' end,
  coalesce(string_agg(trade_name || ' (' || id || ')', ', ' order by trade_name), 'no tenants visible'),
  count(*)
from public.tenants;

insert into pos_rls_validation_results
select
  120,
  'La25 authenticated',
  'cash_movements visible outside La25',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  coalesce(string_agg(coalesce(tenant_id, '<null>') || '=' || rows_count::text, ', ' order by tenant_id), 'only La25 or no rows visible'),
  coalesce(sum(rows_count), 0)
from (
  select tenant_id, count(*) as rows_count
  from public.cash_movements
  where tenant_id is distinct from '9b559ba0-2b40-484d-a32a-18743a07fabe'
  group by tenant_id
) leaked;

insert into pos_rls_validation_results
select
  130,
  'La25 authenticated',
  'products visible outside La25',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  coalesce(string_agg(coalesce(tenant_id, '<null>') || '=' || rows_count::text, ', ' order by tenant_id), 'only La25 or no rows visible'),
  coalesce(sum(rows_count), 0)
from (
  select tenant_id, count(*) as rows_count
  from public.products
  where tenant_id is distinct from '9b559ba0-2b40-484d-a32a-18743a07fabe'
  group by tenant_id
) leaked;

insert into pos_rls_validation_results
select
  140,
  'La25 authenticated',
  'customers visible outside La25',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  coalesce(string_agg(coalesce(tenant_id, '<null>') || '=' || rows_count::text, ', ' order by tenant_id), 'only La25 or no rows visible'),
  coalesce(sum(rows_count), 0)
from (
  select tenant_id, count(*) as rows_count
  from public.customers
  where tenant_id is distinct from '9b559ba0-2b40-484d-a32a-18743a07fabe'
  group by tenant_id
) leaked;

insert into pos_rls_validation_results
select
  150,
  'La25 authenticated',
  'sales visible outside La25',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  coalesce(string_agg(coalesce(tenant_id, '<null>') || '=' || rows_count::text, ', ' order by tenant_id), 'only La25 or no rows visible'),
  coalesce(sum(rows_count), 0)
from (
  select tenant_id, count(*) as rows_count
  from public.sales
  where tenant_id is distinct from '9b559ba0-2b40-484d-a32a-18743a07fabe'
  group by tenant_id
) leaked;

insert into pos_rls_validation_results
select
  160,
  'La25 authenticated',
  'La25 visible core data',
  'INFO',
  'products=' || (select count(*)::text from public.products)
    || ', customers=' || (select count(*)::text from public.customers)
    || ', sales=' || (select count(*)::text from public.sales)
    || ', cash_movements=' || (select count(*)::text from public.cash_movements),
  null::bigint;

commit;

begin;
set local role anon;

insert into pos_rls_validation_results
select
  200,
  'anon',
  'tenants visible',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'anon should see 0 tenants',
  count(*)
from public.tenants;

insert into pos_rls_validation_results
select
  210,
  'anon',
  'products visible',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'anon should see 0 products',
  count(*)
from public.products;

insert into pos_rls_validation_results
select
  220,
  'anon',
  'customers visible',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'anon should see 0 customers',
  count(*)
from public.customers;

insert into pos_rls_validation_results
select
  230,
  'anon',
  'sales visible',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'anon should see 0 sales',
  count(*)
from public.sales;

commit;

select
  section,
  check_name,
  status,
  details,
  rows_count
from pos_rls_validation_results
order by sort_order;
