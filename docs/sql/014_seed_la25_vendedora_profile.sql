-- Crea o actualiza un perfil operativo limitado para empleadas de La25.
-- Tambien permite asignar ese perfil a una usuaria existente por email.
--
-- Ajustar v_assign_email si se quiere asignar a otra empleada.

do $$
declare
  v_tenant_id text := '9b559ba0-2b40-484d-a32a-18743a07fabe';
  v_profile_id text;
  v_assign_email text := 'empleada.prueba.la25.codex@example.com';
  v_permissions jsonb := jsonb_build_object(
    'dashboard', jsonb_build_object('read', true, 'write', false),
    'pos', jsonb_build_object('read', true, 'write', true),
    'productos', jsonb_build_object('read', true, 'write', false),
    'clientes', jsonb_build_object('read', true, 'write', true),
    'cuentas_corrientes', jsonb_build_object('read', true, 'write', true),
    'stock', jsonb_build_object('read', true, 'write', false),
    'caja', jsonb_build_object('read', true, 'write', true),
    'compras', jsonb_build_object('read', false, 'write', false),
    'proveedores', jsonb_build_object('read', false, 'write', false),
    'listas_precios', jsonb_build_object('read', true, 'write', false),
    'promociones', jsonb_build_object('read', true, 'write', false),
    'medios_pago', jsonb_build_object('read', false, 'write', false),
    'facturacion', jsonb_build_object('read', false, 'write', false),
    'comprobantes', jsonb_build_object('read', true, 'write', false),
    'reportes', jsonb_build_object('read', true, 'write', false),
    'auditoria', jsonb_build_object('read', false, 'write', false),
    'configuracion', jsonb_build_object('read', false, 'write', false),
    'configuracion_agenda', jsonb_build_object('read', false, 'write', false),
    'configuracion_catalogo', jsonb_build_object('read', false, 'write', false),
    'configuracion_analisis', jsonb_build_object('read', false, 'write', false),
    'configuracion_sistema', jsonb_build_object('read', false, 'write', false),
    'configuracion_contable', jsonb_build_object('read', false, 'write', false),
    'usuarios', jsonb_build_object('read', false, 'write', false)
  );
begin
  select id
  into v_profile_id
  from public.permission_profiles
  where tenant_id = v_tenant_id
    and name = 'Vendedora'
  limit 1;

  if v_profile_id is null then
    v_profile_id := gen_random_uuid()::text;

    insert into public.permission_profiles (
      id,
      tenant_id,
      name,
      description,
      is_active,
      permissions,
      created_at,
      updated_at
    )
    values (
      v_profile_id,
      v_tenant_id,
      'Vendedora',
      'Perfil operativo para ventas, caja, clientes y cuentas corrientes.',
      true,
      v_permissions,
      now(),
      now()
    );
  else
    update public.permission_profiles
    set description = 'Perfil operativo para ventas, caja, clientes y cuentas corrientes.',
        is_active = true,
        permissions = v_permissions,
        updated_at = now()
    where id = v_profile_id;
  end if;

  update public.users
  set permission_profile_id = v_profile_id,
      role_code = 'vendedora',
      updated_at = now()
  where tenant_id = v_tenant_id
    and lower(email) = lower(v_assign_email);
end $$;

select
  pp.id as profile_id,
  pp.name as profile_name,
  u.email as assigned_user_email,
  u.role_code
from public.permission_profiles pp
left join public.users u
  on u.permission_profile_id = pp.id
 and u.tenant_id = pp.tenant_id
 and lower(u.email) = lower('empleada.prueba.la25.codex@example.com')
where pp.tenant_id = '9b559ba0-2b40-484d-a32a-18743a07fabe'
  and pp.name = 'Vendedora';
