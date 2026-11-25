-- ==============================================================================
-- 041_fix_la25_user_and_permissions.sql
-- Solución para el inicio de sesión de ale.97.28+la25@gmail.com en La25
--
-- Corrige el error: "No se encontro el perfil de permisos asignado"
-- 1. Localiza el tenant La25
-- 2. Asegura el perfil de permisos "Administrador" (con todos los módulos activos)
-- 3. Vincula el usuario auth.users (ale.97.28+la25@gmail.com) con public.users
-- 4. Asigna permission_profile_id válido, role_code = 'owner' e is_active = true
-- ==============================================================================

begin;

do $$
declare
  v_email text := 'ale.97.28+la25@gmail.com';
  v_full_name text := 'Alejandro';
  v_username text := 'ale_la25';

  v_auth_user_id uuid;
  v_tenant_id text;
  v_admin_profile_id text;
  v_existing_public_user_id text;
begin
  -- 1. Buscar el ID del usuario en Supabase Auth (priorizando ale.97.28+la25@gmail.com)
  select id into v_auth_user_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  -- Si no existe con +la25, buscar ale.97.28@gmail.com como fallback
  if v_auth_user_id is null then
    select id into v_auth_user_id
    from auth.users
    where lower(email) = 'ale.97.28@gmail.com'
    limit 1;
  end if;

  if v_auth_user_id is null then
    raise notice 'No se encontro usuario en auth.users con email % o ale.97.28@gmail.com.', v_email;
  else
    raise notice 'Usuario encontrado en auth.users con id: %', v_auth_user_id;
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

  raise notice 'Tenant La25 encontrado con id: %', v_tenant_id;

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
      'Acceso total a la administración y módulos de La25',
      true,
      '{
        "pos": {"read": true, "write": true},
        "caja": {"read": true, "write": true},
        "stock": {"read": true, "write": true},
        "bancos": {"read": true, "write": true},
        "compras": {"read": true, "write": true},
        "auditoria": {"read": true, "write": true},
        "clientes": {"read": true, "write": true},
        "empleados": {"read": true, "write": true},
        "reportes": {"read": true, "write": true},
        "usuarios": {"read": true, "write": true},
        "dashboard": {"read": true, "write": true},
        "productos": {"read": true, "write": true},
        "facturacion": {"read": true, "write": true},
        "medios_pago": {"read": true, "write": true},
        "promociones": {"read": true, "write": true},
        "proveedores": {"read": true, "write": true},
        "caja_general": {"read": true, "write": true},
        "comprobantes": {"read": true, "write": true},
        "configuracion": {"read": true, "write": true},
        "listas_precios": {"read": true, "write": true},
        "cuentas_corrientes": {"read": true, "write": true},
        "cuentas_corrientes_proveedores": {"read": true, "write": true},
        "configuracion_agenda": {"read": true, "write": true},
        "configuracion_analisis": {"read": true, "write": true},
        "configuracion_sistema": {"read": true, "write": true},
        "configuracion_catalogo": {"read": true, "write": true},
        "configuracion_contable": {"read": true, "write": true}
      }'::jsonb,
      now(),
      now()
    );
    raise notice 'Perfil Administrador creado con id: %', v_admin_profile_id;
  else
    -- Asegurar que el perfil existente esté activo y con todos los permisos
    update public.permission_profiles
    set is_active = true,
        permissions = '{
          "pos": {"read": true, "write": true},
          "caja": {"read": true, "write": true},
          "stock": {"read": true, "write": true},
          "bancos": {"read": true, "write": true},
          "compras": {"read": true, "write": true},
          "auditoria": {"read": true, "write": true},
          "clientes": {"read": true, "write": true},
          "empleados": {"read": true, "write": true},
          "reportes": {"read": true, "write": true},
          "usuarios": {"read": true, "write": true},
          "dashboard": {"read": true, "write": true},
          "productos": {"read": true, "write": true},
          "facturacion": {"read": true, "write": true},
          "medios_pago": {"read": true, "write": true},
          "promociones": {"read": true, "write": true},
          "proveedores": {"read": true, "write": true},
          "caja_general": {"read": true, "write": true},
          "comprobantes": {"read": true, "write": true},
          "configuracion": {"read": true, "write": true},
          "listas_precios": {"read": true, "write": true},
          "cuentas_corrientes": {"read": true, "write": true},
          "cuentas_corrientes_proveedores": {"read": true, "write": true},
          "configuracion_agenda": {"read": true, "write": true},
          "configuracion_analisis": {"read": true, "write": true},
          "configuracion_sistema": {"read": true, "write": true},
          "configuracion_catalogo": {"read": true, "write": true},
          "configuracion_contable": {"read": true, "write": true}
        }'::jsonb,
        updated_at = now()
    where id::text = v_admin_profile_id;
    raise notice 'Perfil Administrador existente % actualizado y reactivado.', v_admin_profile_id;
  end if;

  -- 4. Buscar si ya existe fila en public.users vinculada a este auth_user o email
  if v_auth_user_id is not null then
    select id::text into v_existing_public_user_id
    from public.users
    where auth_user_id = v_auth_user_id
       or lower(email) in (lower(v_email), 'ale.97.28@gmail.com')
    order by case when auth_user_id = v_auth_user_id then 0 else 1 end
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

      raise notice 'Usuario existente % reasignado con perfil Administrador a La25.', v_email;
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

      raise notice 'Usuario % insertado exitosamente en public.users para La25.', v_email;
    end if;

    -- 5. Sincronizar metadata en auth.users
    update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'tenant_id', v_tenant_id,
      'full_name', v_full_name,
      'username', v_username
    )
    where id = v_auth_user_id;
  end if;

  -- 6. Reparar cualquier otro usuario en La25 que tenga permission_profile_id nulo o roto
  update public.users
  set permission_profile_id = v_admin_profile_id,
      updated_at = now()
  where tenant_id::text = v_tenant_id
    and (permission_profile_id is null or permission_profile_id = '' or permission_profile_id not in (
      select id::text from public.permission_profiles where tenant_id::text = v_tenant_id
    ));

end $$;

commit;

-- 7. Consulta de verificación del estado del usuario y sus permisos
select 
  t.trade_name as comercio,
  u.id as usuario_id,
  u.full_name as nombre_completo,
  u.email,
  u.username,
  u.role_code,
  pp.name as perfil_permisos,
  pp.is_active as perfil_activo,
  u.is_active as usuario_activo,
  case 
    when u.auth_user_id is not null and pp.id is not null and pp.is_active = true then 'LISTO PARA INICIAR SESION'
    else 'FALTA PERFIL O AUTH'
  end as estado_login
from public.users u
join public.tenants t on t.id = u.tenant_id
left join public.permission_profiles pp on pp.id = u.permission_profile_id
where lower(t.trade_name) in ('la25', 'la 25')
   or t.id::text = '9b559ba0-2b40-484d-a32a-18743a07fabe'
order by u.is_active desc, u.full_name asc;
