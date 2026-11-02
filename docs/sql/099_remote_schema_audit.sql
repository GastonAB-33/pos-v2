with
tables_json as (
  select jsonb_agg(
    jsonb_build_object(
      'table_name', c.relname,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity
    )
    order by c.relname
  ) as data
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
),
columns_json as (
  select jsonb_agg(
    jsonb_build_object(
      'table_name', table_name,
      'column_name', column_name,
      'data_type', data_type,
      'udt_name', udt_name,
      'is_nullable', is_nullable,
      'column_default', column_default
    )
    order by table_name, ordinal_position
  ) as data
  from information_schema.columns
  where table_schema = 'public'
),
constraints_json as (
  select jsonb_agg(
    jsonb_build_object(
      'table_name', tc.table_name,
      'constraint_name', tc.constraint_name,
      'constraint_type', tc.constraint_type,
      'columns', cols.columns
    )
    order by tc.table_name, tc.constraint_type, tc.constraint_name
  ) as data
  from information_schema.table_constraints tc
  left join lateral (
    select jsonb_agg(kcu.column_name order by kcu.ordinal_position) as columns
    from information_schema.key_column_usage kcu
    where kcu.constraint_schema = tc.constraint_schema
      and kcu.constraint_name = tc.constraint_name
      and kcu.table_schema = tc.table_schema
      and kcu.table_name = tc.table_name
  ) cols on true
  where tc.table_schema = 'public'
),
indexes_json as (
  select jsonb_agg(
    jsonb_build_object(
      'table_name', tablename,
      'index_name', indexname,
      'index_def', indexdef
    )
    order by tablename, indexname
  ) as data
  from pg_indexes
  where schemaname = 'public'
),
policies_json as (
  select jsonb_agg(
    jsonb_build_object(
      'table_name', tablename,
      'policy_name', policyname,
      'roles', roles,
      'cmd', cmd,
      'qual', qual,
      'with_check', with_check
    )
    order by tablename, policyname
  ) as data
  from pg_policies
  where schemaname = 'public'
),
functions_json as (
  select jsonb_agg(
    jsonb_build_object(
      'function_name', p.proname,
      'arguments', pg_get_function_arguments(p.oid),
      'return_type', pg_get_function_result(p.oid),
      'security_definer', p.prosecdef
    )
    order by p.proname, pg_get_function_arguments(p.oid)
  ) as data
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
tenants_json as (
  select jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'trade_name', t.trade_name,
      'slug', t.slug,
      'cuit', t.cuit,
      'is_active', t.is_active,
      'users_count', coalesce(u.users_count, 0),
      'profiles_count', coalesce(pp.profiles_count, 0),
      'payment_methods_count', coalesce(pm.payment_methods_count, 0),
      'settings_count', coalesce(ts.settings_count, 0)
    )
    order by t.trade_name
  ) as data
  from public.tenants t
  left join lateral (
    select count(*) as users_count from public.users u where u.tenant_id = t.id
  ) u on true
  left join lateral (
    select count(*) as profiles_count from public.permission_profiles pp where pp.tenant_id = t.id
  ) pp on true
  left join lateral (
    select count(*) as payment_methods_count from public.payment_methods pm where pm.tenant_id = t.id
  ) pm on true
  left join lateral (
    select count(*) as settings_count from public.tenant_settings ts where ts.tenant_id = t.id
  ) ts on true
),
users_json as (
  select jsonb_agg(
    jsonb_build_object(
      'tenant_trade_name', t.trade_name,
      'tenant_slug', t.slug,
      'id', u.id,
      'email', u.email,
      'username', u.username,
      'full_name', u.full_name,
      'role_code', u.role_code,
      'is_active', u.is_active,
      'auth_user_id', u.auth_user_id,
      'auth_email', au.email
    )
    order by t.trade_name, u.email nulls last, u.username nulls last
  ) as data
  from public.users u
  join public.tenants t on t.id = u.tenant_id
  left join auth.users au on au.id = u.auth_user_id
)
select jsonb_pretty(jsonb_build_object(
  'tables', coalesce((select data from tables_json), '[]'::jsonb),
  'columns', coalesce((select data from columns_json), '[]'::jsonb),
  'constraints', coalesce((select data from constraints_json), '[]'::jsonb),
  'indexes', coalesce((select data from indexes_json), '[]'::jsonb),
  'policies', coalesce((select data from policies_json), '[]'::jsonb),
  'functions', coalesce((select data from functions_json), '[]'::jsonb),
  'tenants', coalesce((select data from tenants_json), '[]'::jsonb),
  'users', coalesce((select data from users_json), '[]'::jsonb)
)) as audit_json;
