-- POS V2 - Diagnostico y solucion para el usuario ale.97.28@gmail.com en el tenant La25
--
-- Explicacion del problema:
-- Supabase Auth maneja los correos de forma UNICA y GLOBAL para todo el proyecto.
-- El correo 'ale.97.28@gmail.com' ya habia sido registrado previamente (en pruebas o en el tenant demo).
-- Por eso, al intentar crearlo desde el formulario de La25, Supabase Auth rechaza la creacion diciendo
-- que el correo ya existe, aunque en la lista de empleados de La25 todavia no aparezca.
--
-- A continuacion tenes la SOLUCION DIRECTA para vincularlo a La25 con rol Administrador.

begin;

do $$
declare
  v_email text := 'ale.97.28@gmail.com';
  v_full_name text := 'Alejandro';
  v_username text := 'ale';
  
  v_auth_user_id uuid;
  v_tenant_id text;
  v_admin_profile_id text;
  v_existing_public_user_id text;
begin
  -- 1. Buscar el ID del usuario en Supabase Auth
  select id into v_auth_user_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_auth_user_id is null then
    raise notice 'No se encontro usuario en auth.users con email %. Podes crearlo directamente desde la aplicacion.', v_email;
    return;
  end if;

  -- 2. Buscar el tenant La25 (por UUID conocido, trade_name o slug)
  select id::text into v_tenant_id
  from public.tenants
  where id::text = '9b559ba0-2b40-484d-a32a-18743a07fabe'
     or lower(trade_name) in ('la25', 'la 25')
     or lower(coalesce(slug, '')) in ('la25', 'la-25')
  order by case when id::text = '9b559ba0-2b40-484d-a32a-18743a07fabe' then 0 else 1 end
  limit 1;

  if v_tenant_id is null then
    raise exception 'No se encontro el tenant La25 en la base de datos.';
  end if;

  -- 3. Buscar o crear el perfil de Administrador en La25
  select id::text into v_admin_profile_id
  from public.permission_profiles
  where tenant_id::text = v_tenant_id
  order by
    case
      when lower(name) in ('admin', 'administrador', 'owner', 'dueño', 'dueno') then 0
      else 1
    end,
    created_at asc nulls last
  limit 1;

  if v_admin_profile_id is null then
    v_admin_profile_id := gen_random_uuid()::text;
    insert into public.permission_profiles (
      id, tenant_id, name, description, is_active, permissions, created_at, updated_at
    ) values (
      v_admin_profile_id,
      v_tenant_id,
      'Administrador',
      'Acceso total a la administracion y modulos de La25',
      true,
      '{
        "pos": {"read": true, "write": true},
        "caja": {"read": true, "write": true},
        "stock": {"read": true, "write": true},
        "compras": {"read": true, "write": true},
        "auditoria": {"read": true, "write": true},
        "clientes": {"read": true, "write": true},
        "reportes": {"read": true, "write": true},
        "usuarios": {"read": true, "write": true},
        "dashboard": {"read": true, "write": true},
        "productos": {"read": true, "write": true},
        "facturacion": {"read": true, "write": true},
        "medios_pago": {"read": true, "write": true},
        "promociones": {"read": true, "write": true},
        "proveedores": {"read": true, "write": true},
        "comprobantes": {"read": true, "write": true},
        "configuracion": {"read": true, "write": true},
        "listas_precios": {"read": true, "write": true},
        "cuentas_corrientes": {"read": true, "write": true},
        "configuracion_agenda": {"read": true, "write": true},
        "configuracion_analisis": {"read": true, "write": true},
        "configuracion_sistema": {"read": true, "write": true},
        "configuracion_catalogo": {"read": true, "write": true},
        "configuracion_contable": {"read": true, "write": true}
      }'::jsonb,
      now(),
      now()
    );
  end if;

  -- 4. Buscar si ya existe fila en public.users vinculada a este auth_user o email
  select id::text into v_existing_public_user_id
  from public.users
  where auth_user_id = v_auth_user_id
     or lower(email) = lower(v_email)
  limit 1;

  if v_existing_public_user_id is not null then
    -- Reasignar al tenant La25 con perfil de Administrador y activarlo
    update public.users
    set tenant_id = v_tenant_id,
        permission_profile_id = v_admin_profile_id,
        auth_user_id = v_auth_user_id,
        email = lower(v_email),
        full_name = coalesce(nullif(full_name, ''), v_full_name),
        username = coalesce(nullif(username, ''), v_username),
        role_code = 'owner',
        is_active = true,
        updated_at = now()
    where id::text = v_existing_public_user_id;
    
    raise notice 'Usuario existente % reasignado exitosamente al tenant La25 con perfil Administrador.', v_email;
  else
    -- Insertar nuevo usuario en public.users para La25
    insert into public.users (
      id,
      tenant_id,
      auth_user_id,
      email,
      username,
      full_name,
      role_code,
      permission_profile_id,
      is_active,
      created_at,
      updated_at
    ) values (
      gen_random_uuid()::text,
      v_tenant_id,
      v_auth_user_id,
      lower(v_email),
      v_username,
      v_full_name,
      'owner',
      v_admin_profile_id,
      true,
      now(),
      now()
    );
    
    raise notice 'Usuario % insertado exitosamente en La25 vinculado a auth.users.', v_email;
  end if;

  -- 5. Sincronizar metadata en auth.users
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'tenant_id', v_tenant_id,
    'full_name', v_full_name,
    'username', v_username
  )
  where id = v_auth_user_id;

end $$;

commit;

-- 6. Consulta de comprobacion final
select 
  t.trade_name as comercio,
  u.id as usuario_id,
  u.full_name as nombre_completo,
  u.email,
  u.username,
  u.role_code,
  pp.name as perfil_permisos,
  u.is_active as activo,
  case 
    when u.auth_user_id is not null and au.id is not null then 'LISTO PARA INICIAR SESION'
    else 'FALTA VINCULAR AUTH'
  end as estado_login
from public.users u
join public.tenants t on t.id = u.tenant_id
left join public.permission_profiles pp on pp.id = u.permission_profile_id
left join auth.users au on au.id = u.auth_user_id
where lower(t.trade_name) in ('la25', 'la 25')
   or t.id::text = '9b559ba0-2b40-484d-a32a-18743a07fabe'
order by u.is_active desc, u.full_name asc;
