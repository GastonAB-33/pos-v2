-- 009_link_la25_test_user.sql
-- Vincula un usuario existente de Supabase Auth al tenant La25 como administrador.
--
-- Uso:
-- 1. En Supabase Dashboard > Authentication > Users, crea un usuario con email y password
--    que vos controles para probar el comercio La25.
-- 2. Cambia v_auth_email por ese email.
-- 3. Ejecuta este script en SQL Editor.
-- 4. Inicia sesion en el POS con ese email/password.
--
-- Importante: este script NO crea el usuario Auth ni define la password. Solo conecta
-- auth.users con public.users y el tenant La25.

do $$
declare
  v_auth_email text := 'CAMBIAR_POR_EMAIL_DE_PRUEBA';
  v_full_name text := 'Usuario prueba La25';
  v_username text := 'prueba_la25';

  v_auth_user_id uuid;
  v_tenant_id text;
  v_profile_id uuid;
  v_existing_user_id text;
begin
  select au.id
  into v_auth_user_id
  from auth.users au
  where lower(au.email) = lower(v_auth_email)
  limit 1;

  if v_auth_user_id is null then
    raise exception 'No existe auth.users con email %. Primero crea ese usuario en Authentication > Users.', v_auth_email;
  end if;

  select t.id::text
  into v_tenant_id
  from public.tenants t
  where lower(t.trade_name) = lower('La25')
  limit 1;

  if v_tenant_id is null then
    raise exception 'No existe tenant con trade_name La25.';
  end if;

  select pp.id
  into v_profile_id
  from public.permission_profiles pp
  where pp.tenant_id::text = v_tenant_id
  order by
    case
      when lower(pp.name) in ('admin', 'administrador', 'owner', 'dueno', 'dueño') then 0
      else 1
    end,
    pp.created_at asc nulls last
  limit 1;

  if v_profile_id is null then
    raise exception 'El tenant La25 no tiene permission_profiles. Crea o revisa los perfiles primero.';
  end if;

  select u.id::text
  into v_existing_user_id
  from public.users u
  where lower(u.email) = lower(v_auth_email)
     or u.auth_user_id = v_auth_user_id
  limit 1;

  if v_existing_user_id is not null then
    update public.users
    set tenant_id = v_tenant_id,
        permission_profile_id = v_profile_id,
        email = lower(v_auth_email),
        username = v_username,
        full_name = v_full_name,
        auth_user_id = v_auth_user_id,
        updated_at = now()
    where id::text = v_existing_user_id;
  else
    insert into public.users (
      id,
      tenant_id,
      permission_profile_id,
      email,
      username,
      full_name,
      auth_user_id,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      v_tenant_id,
      v_profile_id,
      lower(v_auth_email),
      v_username,
      v_full_name,
      v_auth_user_id,
      now(),
      now()
    );
  end if;
end $$;

select
  t.trade_name,
  u.id as app_user_id,
  u.email,
  u.username,
  u.full_name,
  u.auth_user_id,
  au.email as auth_email,
  case
    when u.auth_user_id is not null and au.id is not null then 'ready_for_login'
    else 'pending'
  end as status
from public.users u
join public.tenants t on t.id = u.tenant_id
left join auth.users au on au.id = u.auth_user_id
where lower(t.trade_name) = lower('La25')
order by u.created_at desc nulls last, u.email;
