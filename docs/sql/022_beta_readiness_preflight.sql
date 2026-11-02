-- POS V2 - Preflight para invitar clientes beta.
-- Ejecutar en Supabase SQL Editor despues de aplicar:
-- - docs/sql/019_promotion_bundles_and_barcodes.sql
-- - docs/sql/021_tenant_slugs.sql
--
-- No modifica datos. Devuelve PASS/FAIL/INFO.

with
expected_tables(table_name) as (
  values
    ('tenants'),
    ('users'),
    ('tenant_settings'),
    ('permission_profiles'),
    ('products'),
    ('product_barcodes'),
    ('customers'),
    ('sales'),
    ('sale_items'),
    ('sale_payments'),
    ('cash_sessions'),
    ('cash_movements'),
    ('current_account_movements'),
    ('payment_methods'),
    ('purchases'),
    ('purchase_items'),
    ('stock_movements'),
    ('promotions'),
    ('promotion_items'),
    ('promotion_barcodes')
),
tenant_scoped_tables(table_name) as (
  values
    ('users'),
    ('tenant_settings'),
    ('permission_profiles'),
    ('products'),
    ('product_barcodes'),
    ('customers'),
    ('sales'),
    ('sale_items'),
    ('sale_payments'),
    ('cash_sessions'),
    ('cash_movements'),
    ('current_account_movements'),
    ('payment_methods'),
    ('purchases'),
    ('purchase_items'),
    ('stock_movements'),
    ('promotions'),
    ('promotion_items'),
    ('promotion_barcodes')
),
table_checks as (
  select
    'schema' as section,
    'tablas requeridas' as check_name,
    case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
    coalesce(string_agg(et.table_name, ', ' order by et.table_name), 'todas las tablas requeridas existen') as details
  from expected_tables et
  left join information_schema.tables t
    on t.table_schema = 'public'
   and t.table_name = et.table_name
  where t.table_name is null
),
slug_column_check as (
  select
    'slugs' as section,
    'columna tenants.slug' as check_name,
    case when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tenants'
        and column_name = 'slug'
    ) then 'PASS' else 'FAIL' end as status,
    'requerida para enlaces tipo /la25/login' as details
),
slug_duplicate_check as (
  select
    'slugs' as section,
    'slugs duplicados o vacios' as check_name,
    case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
    coalesce(string_agg(problem, ' | ' order by problem), 'sin duplicados ni vacios') as details
  from (
    select 'slug vacio en tenant ' || id as problem
    from public.tenants
    where slug is null or trim(slug) = ''
    union all
    select 'slug duplicado: ' || slug || ' (' || count(*)::text || ')' as problem
    from public.tenants
    group by slug
    having count(*) > 1
  ) problems
),
slug_rpc_check as (
  select
    'slugs' as section,
    'RPC pos_public_tenant_by_slug' as check_name,
    case when exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'pos_public_tenant_by_slug'
    ) then 'PASS' else 'FAIL' end as status,
    'necesaria para validar comercio antes del login' as details
),
rls_check as (
  select
    'rls' as section,
    'RLS activo en tablas tenant-scoped' as check_name,
    case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
    coalesce(string_agg(tst.table_name, ', ' order by tst.table_name), 'RLS activo en todas') as details
  from tenant_scoped_tables tst
  left join pg_class c on c.relname = tst.table_name
  left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where coalesce(c.relrowsecurity, false) = false
),
dev_policy_check as (
  select
    'rls' as section,
    'policies dev_all abiertas' as check_name,
    case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
    coalesce(string_agg(tablename || '.' || policyname, ', ' order by tablename, policyname), 'no hay dev_all policies') as details
  from pg_policies
  where schemaname = 'public'
    and policyname like 'dev_all%'
),
open_anon_policy_check as (
  select
    'rls' as section,
    'policies anon abiertas' as check_name,
    case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
    coalesce(string_agg(tablename || '.' || policyname, ', ' order by tablename, policyname), 'anon no tiene policies abiertas') as details
  from pg_policies
  where schemaname = 'public'
    and 'anon' = any(roles)
    and (qual = 'true' or with_check = 'true')
),
auth_link_check as (
  select
    'usuarios' as section,
    'usuarios activos sin auth_user_id' as check_name,
    case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
    coalesce(
      string_agg(coalesce(u.email, u.username, u.id), ', ' order by coalesce(u.email, u.username, u.id)),
      'todos los usuarios activos de tenants activos tienen auth_user_id'
    ) as details
  from public.users u
  join public.tenants t on t.id = u.tenant_id
  where u.is_active = true
    and t.is_active = true
    and u.auth_user_id is null
),
tenant_bootstrap_check as (
  select
    'tenants' as section,
    'tenants incompletos' as check_name,
    case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
    coalesce(string_agg(problem, ' | ' order by problem), 'tenants con settings, perfiles, usuarios y medios de pago') as details
  from (
    select t.trade_name || ' [' || t.id || ' / ' || coalesce(t.slug, '-') || ']: sin tenant_settings' as problem
    from public.tenants t
    left join public.tenant_settings ts on ts.tenant_id = t.id
    where t.is_active = true and ts.id is null
    union all
    select t.trade_name || ' [' || t.id || ' / ' || coalesce(t.slug, '-') || ']: sin perfiles' as problem
    from public.tenants t
    where t.is_active = true
      and not exists (select 1 from public.permission_profiles pp where pp.tenant_id = t.id and pp.is_active = true)
    union all
    select t.trade_name || ' [' || t.id || ' / ' || coalesce(t.slug, '-') || ']: sin usuario activo' as problem
    from public.tenants t
    where t.is_active = true
      and not exists (select 1 from public.users u where u.tenant_id = t.id and u.is_active = true)
    union all
    select t.trade_name || ' [' || t.id || ' / ' || coalesce(t.slug, '-') || ']: sin medios de pago activos' as problem
    from public.tenants t
    where t.is_active = true
      and not exists (select 1 from public.payment_methods pm where pm.tenant_id = t.id and pm.is_active = true)
  ) problems
)
select *
from (
  select * from table_checks
  union all select * from slug_column_check
  union all select * from slug_duplicate_check
  union all select * from slug_rpc_check
  union all select * from rls_check
  union all select * from dev_policy_check
  union all select * from open_anon_policy_check
  union all select * from auth_link_check
  union all select * from tenant_bootstrap_check
) results
order by
  case status when 'FAIL' then 0 when 'PASS' then 1 else 2 end,
  section,
  check_name;
