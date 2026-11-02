-- POS V2 - Preparar tenant La25 y usuario real de Patricia
-- Ejecutar despues de 006_supabase_auth_bridge_incremental.sql.
--
-- Este script:
-- - Mantiene el tenant_id interno existente.
-- - Asegura que el comercio se llame La25.
-- - Actualiza el email del usuario Patricia Martinez.
-- - Intenta vincularlo con auth.users si ya existe ese email en Supabase Auth.
--
-- IMPORTANTE:
-- Antes o despues de ejecutar este script, crear en Supabase Auth el usuario:
--   patricia.mart00@gmail.com
-- con la contrasena que vaya a usar Patricia.

begin;

do $$
declare
  v_trade_name text := 'La25';
  v_patricia_email text := 'patricia.mart00@gmail.com';
  v_patricia_username text := 'PatriciaMartinez';
  v_patricia_full_name text := 'Patricia Martinez';
  v_tenant_id text;
  v_user_id text;
  v_auth_user_id uuid;
begin
  select id
  into v_tenant_id
  from public.tenants
  where lower(trade_name) = lower(v_trade_name)
  limit 1;

  if v_tenant_id is null then
    raise exception 'No se encontro tenant con trade_name=%', v_trade_name;
  end if;

  update public.tenants
  set
    trade_name = v_trade_name,
    updated_at = now()
  where id = v_tenant_id;

  select id
  into v_user_id
  from public.users
  where tenant_id = v_tenant_id
    and (
      lower(coalesce(username, '')) = lower(v_patricia_username)
      or lower(full_name) = lower(v_patricia_full_name)
      or lower(coalesce(email, '')) in (
        lower(v_patricia_email),
        lower('ale.97.28@gmail.com')
      )
    )
  order by created_at
  limit 1;

  if v_user_id is null then
    raise exception 'No se encontro usuario Patricia en tenant %', v_trade_name;
  end if;

  select id
  into v_auth_user_id
  from auth.users
  where lower(email) = lower(v_patricia_email)
  limit 1;

  update public.users
  set
    email = v_patricia_email,
    username = v_patricia_username,
    full_name = v_patricia_full_name,
    auth_user_id = v_auth_user_id,
    is_active = true,
    updated_at = now()
  where id = v_user_id;

  raise notice 'Tenant La25: %, usuario Patricia: %, auth_user_id: %',
    v_tenant_id,
    v_user_id,
    coalesce(v_auth_user_id::text, 'PENDIENTE: crear usuario en Supabase Auth');
end $$;

commit;

select
  t.id as tenant_id_interno,
  t.trade_name,
  u.id as app_user_id,
  u.email,
  u.username,
  u.full_name,
  u.auth_user_id,
  au.email as auth_email,
  case
    when u.auth_user_id is null then 'pending_create_auth_user_or_rerun_script'
    when au.id is null then 'broken_auth_reference'
    else 'ready_for_login'
  end as status
from public.users u
join public.tenants t on t.id = u.tenant_id
left join auth.users au on au.id = u.auth_user_id
where lower(t.trade_name) = lower('La25')
order by u.full_name;

