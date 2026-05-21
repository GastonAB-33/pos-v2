-- POS V2 - Auditoria especifica de tenants, usuarios Auth y datos existentes
-- Ejecutar despues del inventario 000.
--
-- Este archivo no modifica datos ni estructura.

-- 1) Tenants existentes.
select
  id,
  legal_name,
  trade_name,
  cuit,
  is_active,
  created_at,
  updated_at
from public.tenants
order by trade_name, created_at;

-- 2) Usuarios internos y vinculacion con Supabase Auth.
-- Compatible con esquemas viejos donde public.users.auth_user_id aun no existe.
create temp table if not exists tmp_pos_auth_users_audit (
  trade_name text,
  app_user_id text,
  auth_user_id uuid,
  auth_user_exists boolean,
  app_email text,
  auth_email text,
  username text,
  full_name text,
  role_code text,
  permission_profile_id text,
  permission_profile_name text,
  is_active boolean,
  profile_is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
) on commit drop;

truncate table tmp_pos_auth_users_audit;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'auth_user_id'
  ) then
    execute $dyn$
      insert into tmp_pos_auth_users_audit
      select
        t.trade_name,
        u.id as app_user_id,
        u.auth_user_id,
        au.id is not null as auth_user_exists,
        u.email as app_email,
        au.email as auth_email,
        u.username,
        u.full_name,
        u.role_code,
        u.permission_profile_id,
        pp.name as permission_profile_name,
        u.is_active,
        pp.is_active as profile_is_active,
        u.created_at,
        u.updated_at
      from public.users u
      join public.tenants t on t.id = u.tenant_id
      left join auth.users au on au.id = u.auth_user_id
      left join public.permission_profiles pp
        on pp.id = u.permission_profile_id
       and pp.tenant_id = u.tenant_id
    $dyn$;
  else
    insert into tmp_pos_auth_users_audit
    select
      t.trade_name,
      u.id as app_user_id,
      null::uuid as auth_user_id,
      false as auth_user_exists,
      u.email as app_email,
      null::text as auth_email,
      u.username,
      u.full_name,
      u.role_code,
      u.permission_profile_id,
      pp.name as permission_profile_name,
      u.is_active,
      pp.is_active as profile_is_active,
      u.created_at,
      u.updated_at
    from public.users u
    join public.tenants t on t.id = u.tenant_id
    left join public.permission_profiles pp
      on pp.id = u.permission_profile_id
     and pp.tenant_id = u.tenant_id;
  end if;
end $$;

select *
from tmp_pos_auth_users_audit
order by trade_name, full_name;

-- 3) Usuarios internos con problema de Auth o perfil.
select
  trade_name,
  app_user_id,
  app_email as email,
  username,
  full_name,
  case
    when auth_user_id is null then 'missing_auth_user_id_column_or_value'
    when auth_user_exists = false then 'auth_user_not_found'
    when permission_profile_name is null then 'permission_profile_not_found'
    when profile_is_active = false then 'permission_profile_inactive'
    when is_active = false then 'user_inactive'
    else 'ok'
  end as issue
from tmp_pos_auth_users_audit
where
  auth_user_id is null
  or auth_user_exists = false
  or permission_profile_name is null
  or profile_is_active = false
  or is_active = false
order by trade_name, full_name;

-- 4) Perfiles por tenant y permisos resumidos.
select
  t.trade_name,
  pp.id,
  pp.name,
  pp.is_active,
  pp.permissions,
  pp.created_at,
  pp.updated_at
from public.permission_profiles pp
join public.tenants t on t.id = pp.tenant_id
order by t.trade_name, pp.name;

-- 5) Distribucion de datos por tenant.
select
  t.id as tenant_id,
  t.trade_name,
  coalesce(u.count_rows, 0) as users_count,
  coalesce(p.count_rows, 0) as products_count,
  coalesce(pb.count_rows, 0) as product_barcodes_count,
  coalesce(c.count_rows, 0) as customers_count,
  coalesce(pm.count_rows, 0) as payment_methods_count,
  coalesce(ob.count_rows, 0) as origin_banks_count,
  coalesce(ip.count_rows, 0) as installment_plans_count,
  coalesce(cs.count_rows, 0) as cash_sessions_count,
  coalesce(cm.count_rows, 0) as cash_movements_count,
  coalesce(s.count_rows, 0) as sales_count,
  coalesce(al.count_rows, 0) as audit_logs_count,
  coalesce(ts.count_rows, 0) as tenant_settings_count
from public.tenants t
left join lateral (select count(*) as count_rows from public.users x where x.tenant_id = t.id) u on true
left join lateral (select count(*) as count_rows from public.products x where x.tenant_id = t.id) p on true
left join lateral (select count(*) as count_rows from public.product_barcodes x where x.tenant_id = t.id) pb on true
left join lateral (select count(*) as count_rows from public.customers x where x.tenant_id = t.id) c on true
left join lateral (select count(*) as count_rows from public.payment_methods x where x.tenant_id = t.id) pm on true
left join lateral (select count(*) as count_rows from public.origin_banks x where x.tenant_id = t.id) ob on true
left join lateral (select count(*) as count_rows from public.installment_plans x where x.tenant_id = t.id) ip on true
left join lateral (select count(*) as count_rows from public.cash_sessions x where x.tenant_id = t.id) cs on true
left join lateral (select count(*) as count_rows from public.cash_movements x where x.tenant_id = t.id) cm on true
left join lateral (select count(*) as count_rows from public.sales x where x.tenant_id = t.id) s on true
left join lateral (select count(*) as count_rows from public.audit_logs x where x.tenant_id = t.id) al on true
left join lateral (select count(*) as count_rows from public.tenant_settings x where x.tenant_id = t.id) ts on true
order by t.trade_name;

-- 6) Tenants referenciados en tablas operativas que no existen en public.tenants.
with used_tenants as (
  select tenant_id, 'permission_profiles' as source_table from public.permission_profiles
  union all select tenant_id, 'users' from public.users
  union all select tenant_id, 'products' from public.products
  union all select tenant_id, 'product_barcodes' from public.product_barcodes
  union all select tenant_id, 'customers' from public.customers
  union all select tenant_id, 'payment_methods' from public.payment_methods
  union all select tenant_id, 'origin_banks' from public.origin_banks
  union all select tenant_id, 'installment_plans' from public.installment_plans
  union all select tenant_id, 'cash_sessions' from public.cash_sessions
  union all select tenant_id, 'cash_movements' from public.cash_movements
  union all select tenant_id, 'sales' from public.sales
  union all select tenant_id, 'audit_logs' from public.audit_logs
  union all select tenant_id, 'tenant_settings' from public.tenant_settings
)
select
  u.tenant_id,
  array_agg(distinct u.source_table order by u.source_table) as source_tables
from used_tenants u
left join public.tenants t on t.id = u.tenant_id
where t.id is null
group by u.tenant_id
order by u.tenant_id;

-- 7) Productos existentes por tenant.
select
  t.trade_name,
  p.id,
  p.code,
  p.name,
  p.price,
  p.stock_current,
  p.category,
  p.is_active,
  p.created_at
from public.products p
join public.tenants t on t.id = p.tenant_id
order by t.trade_name, p.name;

-- 8) Cajas existentes por tenant.
select
  t.trade_name,
  cs.id,
  cs.opened_by_user_id,
  u.full_name as opened_by_name,
  cs.status,
  cs.opening_amount,
  cs.opened_at,
  cs.closed_at,
  cs.closing_amount,
  cs.expected_closing_amount,
  cs.closing_difference
from public.cash_sessions cs
join public.tenants t on t.id = cs.tenant_id
left join public.users u on u.id = cs.opened_by_user_id
order by t.trade_name, cs.opened_at desc;

-- 9) RLS y policies de tablas criticas.
select
  pt.tablename,
  pt.rowsecurity as rls_enabled,
  count(p.policyname) as policies_count
from pg_tables pt
left join pg_policies p
  on p.schemaname = pt.schemaname
 and p.tablename = pt.tablename
where pt.schemaname = 'public'
  and pt.tablename in (
    'tenants',
    'users',
    'permission_profiles',
    'products',
    'customers',
    'sales',
    'sale_items',
    'sale_payments',
    'cash_sessions',
    'cash_movements',
    'current_account_movements',
    'tenant_settings'
  )
group by pt.tablename, pt.rowsecurity
order by pt.tablename;
