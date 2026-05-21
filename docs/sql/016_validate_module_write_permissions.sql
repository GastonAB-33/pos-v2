-- 016_validate_module_write_permissions.sql
-- Validacion posterior a 015_enforce_module_write_permissions.sql.
--
-- Como usar:
-- 1. Reemplazar v_auth_uid por el UID de una empleada con perfil Vendedora.
-- 2. Ejecutar en Supabase SQL Editor.
-- 3. Revisar que todos los checks criticos indiquen PASS.

do $$
declare
  v_auth_uid uuid := '8d6ab08e-886f-40eb-946d-5654a8009f18';
  v_tenant_id text := '9b559ba0-2b40-484d-a32a-18743a07fabe';
  v_product_id text;
  v_original_updated_at timestamptz;
  v_original_name text;
  v_error text;
begin
  create temp table if not exists pos_module_permission_validation (
    check_name text,
    status text,
    details text
  );

  truncate pos_module_permission_validation;
  grant insert, select on pos_module_permission_validation to authenticated;

  perform set_config('request.jwt.claim.sub', v_auth_uid::text, true);
  perform set_config('role', 'authenticated', true);

  insert into pos_module_permission_validation
  select
    'vendedora permisos esperados',
    case
      when public.current_user_can_write('pos') = true
       and public.current_user_can_write('caja') = true
       and public.current_user_can_write('cuentas_corrientes') = true
       and public.current_user_can_write('productos') = false
       and public.current_user_can_write('usuarios') = false
      then 'PASS'
      else 'FAIL'
    end,
    format(
      'pos=%s caja=%s cc=%s productos=%s usuarios=%s',
      public.current_user_can_write('pos'),
      public.current_user_can_write('caja'),
      public.current_user_can_write('cuentas_corrientes'),
      public.current_user_can_write('productos'),
      public.current_user_can_write('usuarios')
    );

  select id, name, updated_at
  into v_product_id, v_original_name, v_original_updated_at
  from public.products
  where tenant_id = v_tenant_id
  limit 1;

  begin
    update public.products
    set name = name || ' NO_DEBE_QUEDAR'
    where id = v_product_id;

    update public.products
    set name = v_original_name,
        updated_at = v_original_updated_at
    where id = v_product_id;

    insert into pos_module_permission_validation
    values (
      'vendedora no edita datos comerciales de productos',
      'FAIL',
      'La actualizacion de name fue permitida'
    );
  exception
    when insufficient_privilege then
      insert into pos_module_permission_validation
      values (
        'vendedora no edita datos comerciales de productos',
        'PASS',
        sqlerrm
      );
    when others then
      get stacked diagnostics v_error = message_text;
      insert into pos_module_permission_validation
      values (
        'vendedora no edita datos comerciales de productos',
        case when v_error ilike '%permisos%' then 'PASS' else 'FAIL' end,
        v_error
      );
  end;

  begin
    update public.products
    set updated_at = now()
    where id = v_product_id;

    update public.products
    set updated_at = v_original_updated_at
    where id = v_product_id;

    insert into pos_module_permission_validation
    values (
      'vendedora puede actualizar stock/updated_at para POS',
      'PASS',
      'Actualizacion tecnica permitida'
    );
  exception
    when others then
      insert into pos_module_permission_validation
      values (
        'vendedora puede actualizar stock/updated_at para POS',
        'FAIL',
        sqlerrm
      );
  end;

  insert into pos_module_permission_validation
  select
    'vendedora solo ve su propio usuario',
    case when count(*) = 1 and bool_and(auth_user_id = v_auth_uid) then 'PASS' else 'FAIL' end,
    format('usuarios visibles=%s', count(*))
  from public.users
  where tenant_id = v_tenant_id;
end $$;

select *
from pos_module_permission_validation
order by check_name;
