-- POS V2 - Reset controlado a dos tenants activos de pruebas.
--
-- Objetivo:
-- - Desactivar tenants/usuarios basura existentes.
-- - Dejar activos solo dos tenants:
--   1) Tenant demo / slug demo / ale.97.28@gmail.com
--   2) Tenant Angie / slug angie / angiepaulacaterinamolina.7@gmail.com
-- - Ambos quedan como administradores owner de su propio comercio.
-- - Sirve para probar aislamiento multi-tenant real.
--
-- IMPORTANTE:
-- - Este SQL NO cambia contrasenas de Supabase Auth.
-- - Ambos emails deben existir primero en Authentication > Users.
-- - Ejecutar solo si confirmaste que los tenants actuales son basura o prescindibles.

begin;

create or replace function public.pos_bootstrap_test_tenant(
  p_legal_name text,
  p_trade_name text,
  p_slug text,
  p_cuit text,
  p_admin_email text,
  p_admin_full_name text,
  p_admin_permissions jsonb,
  p_seller_permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_auth_user_id uuid;
  v_tenant_id text;
  v_admin_profile_id text;
  v_seller_profile_id text;
  v_admin_user_id text;
  v_cash_payment_method_id text;
  v_payment_method record;
  v_settings_id text;
begin
  select au.id
    into v_auth_user_id
  from auth.users au
  where lower(au.email) = lower(p_admin_email)
  limit 1;

  if v_auth_user_id is null then
    raise exception 'No existe usuario Supabase Auth con email %', p_admin_email;
  end if;

  insert into public.tenants (id, legal_name, trade_name, slug, cuit, is_active)
  values (gen_random_uuid()::text, p_legal_name, p_trade_name, p_slug, p_cuit, true)
  on conflict (slug) do update
    set legal_name = excluded.legal_name,
        trade_name = excluded.trade_name,
        cuit = excluded.cuit,
        is_active = true,
        updated_at = now()
  returning id into v_tenant_id;

  select id into v_admin_profile_id
  from public.permission_profiles
  where tenant_id = v_tenant_id
    and lower(name) = 'administrador'
  order by created_at asc
  limit 1;

  if v_admin_profile_id is null then
    insert into public.permission_profiles (id, tenant_id, name, description, is_active, permissions)
    values (gen_random_uuid()::text, v_tenant_id, 'Administrador', 'Acceso completo al tenant de pruebas', true, p_admin_permissions)
    returning id into v_admin_profile_id;
  else
    update public.permission_profiles
    set description = 'Acceso completo al tenant de pruebas',
        is_active = true,
        permissions = p_admin_permissions,
        updated_at = now()
    where id = v_admin_profile_id;
  end if;

  select id into v_seller_profile_id
  from public.permission_profiles
  where tenant_id = v_tenant_id
    and lower(name) = 'vendedora'
  order by created_at asc
  limit 1;

  if v_seller_profile_id is null then
    insert into public.permission_profiles (id, tenant_id, name, description, is_active, permissions)
    values (gen_random_uuid()::text, v_tenant_id, 'Vendedora', 'Operacion diaria de venta, caja, clientes y cuentas corrientes', true, p_seller_permissions)
    returning id into v_seller_profile_id;
  else
    update public.permission_profiles
    set description = 'Operacion diaria de venta, caja, clientes y cuentas corrientes',
        is_active = true,
        permissions = p_seller_permissions,
        updated_at = now()
    where id = v_seller_profile_id;
  end if;

  select u.id
    into v_admin_user_id
  from public.users u
  where u.auth_user_id = v_auth_user_id
     or lower(coalesce(u.email, '')) = lower(p_admin_email)
  order by
    case when u.auth_user_id = v_auth_user_id then 0 else 1 end,
    u.created_at asc
  limit 1;

  if v_admin_user_id is not null then
    update public.users
    set tenant_id = v_tenant_id,
        auth_user_id = v_auth_user_id,
        email = lower(p_admin_email),
        username = 'admin',
        full_name = p_admin_full_name,
        role_code = 'owner',
        permission_profile_id = v_admin_profile_id,
        is_active = true,
        updated_at = now()
    where id = v_admin_user_id;
  end if;

  if v_admin_user_id is null then
    insert into public.users (
      id,
      tenant_id,
      auth_user_id,
      email,
      username,
      full_name,
      role_code,
      permission_profile_id,
      is_active
    )
    values (
      gen_random_uuid()::text,
      v_tenant_id,
      v_auth_user_id,
      lower(p_admin_email),
      'admin',
      p_admin_full_name,
      'owner',
      v_admin_profile_id,
      true
    )
    returning id into v_admin_user_id;
  end if;

  for v_payment_method in
    select *
    from (
      values
        ('Efectivo', 'cash', 'cash', true),
        ('Tarjeta de debito', 'card_debit', 'card_debit', false),
        ('Tarjeta de credito', 'card_credit', 'card_credit', false),
        ('Transferencia bancaria', 'transfer', 'transfer', false),
        ('Mercado Pago', 'mercado_pago', 'mercado_pago', false),
        ('Cheque', 'cheque', 'cheque', false),
        ('Cuenta corriente', 'current_account', 'current_account', false)
    ) as rows(name, code, type, affects_cash)
  loop
    update public.payment_methods
    set name = v_payment_method.name,
        type = v_payment_method.type,
        affects_cash = v_payment_method.affects_cash,
        surcharge_percent = 0,
        discount_percent = 0,
        notes = 'Medio predefinido del sistema',
        is_active = true,
        updated_at = now()
    where tenant_id = v_tenant_id
      and code = v_payment_method.code;

    if not found then
      insert into public.payment_methods (
        id,
        tenant_id,
        name,
        code,
        type,
        is_active,
        affects_cash,
        surcharge_percent,
        discount_percent,
        notes
      )
      values (
        gen_random_uuid()::text,
        v_tenant_id,
        v_payment_method.name,
        v_payment_method.code,
        v_payment_method.type,
        true,
        v_payment_method.affects_cash,
        0,
        0,
        'Medio predefinido del sistema'
      );
    end if;
  end loop;

  select id into v_cash_payment_method_id
  from public.payment_methods
  where tenant_id = v_tenant_id and code = 'cash'
  limit 1;

  select id into v_settings_id
  from public.tenant_settings
  where tenant_id = v_tenant_id
  order by created_at asc
  limit 1;

  if v_settings_id is null then
    insert into public.tenant_settings (id, tenant_id, negocio, pos, stock, caja, facturacion, codigos_balanza, apariencia, sistema)
    values (
      gen_random_uuid()::text,
      v_tenant_id,
      jsonb_build_object(
      'trade_name', p_trade_name,
      'slug', p_slug,
      'legal_name', p_legal_name,
      'cuit', p_cuit,
      'address', '',
      'phone', '',
      'email', lower(p_admin_email),
      'logo_url', null,
      'currency_code', 'ARS',
      'timezone', 'America/Buenos_Aires'
      ),
      jsonb_build_object(
      'default_customer_id', null,
      'default_payment_method_id', v_cash_payment_method_id,
      'auto_print_receipt', false,
      'allow_sale_without_customer', true,
      'allow_negative_stock', true,
      'barcode_scan_quantity', 1,
      'cart_behavior', 'merge_same_product'
      ),
      jsonb_build_object(
      'use_min_max', true,
      'alerts_active', true,
      'global_low_stock_threshold', 5,
      'allow_manual_adjustments', true,
      'allow_negative_stock', true
      ),
      jsonb_build_object(
      'require_open_session_for_sale', false,
      'default_opening_amount', 0,
      'allow_manual_movements', true,
      'require_notes_on_manual_movements', false
      ),
      jsonb_build_object(
      'document_sequences', '{"A": 1, "B": 1, "C": 1, "PRESUPUESTO": 1}'::jsonb,
      'default_document_type', 'B',
      'allow_budget_without_customer', true,
      'issuer_tax_name', '',
      'issuer_cuit', '',
      'issuer_address', '',
      'issuer_fiscal_condition', '',
      'arca', '{"enabled": false, "mode": "mock", "cuit_emisor": "", "punto_venta": 1, "certificado_alias": "", "fiscal_environment": "homologacion", "force_unavailable": false, "allow_internal_fallback": true}'::jsonb
      ),
      jsonb_build_object(
      'scale_parser_enabled', true,
      'scale_mode', 'total_price',
      'scale_prefix', '20',
      'code_length', 13,
      'plu_start', 3,
      'plu_length', 4,
      'weight_start', 7,
      'weight_length', 5,
      'weight_decimals', 3,
      'amount_start', 7,
      'amount_length', 6,
      'amount_decimals', 2,
      'ean13_enabled', true
      ),
      '{"default_theme": "light", "accent_color": "#6054e8", "display_name": "POS V2", "density": "standard"}'::jsonb,
      '{"show_dev_flags": false, "data_provider": "supabase", "version": "1.0.0", "enable_mock_auth_bypass": false, "allow_placeholder_export_import": false, "mercado_pago": {"enabled": true, "mode": "mock", "access_token": "", "public_key": "", "force_unavailable": false}}'::jsonb
    );
  else
    update public.tenant_settings
    set negocio = jsonb_build_object(
          'trade_name', p_trade_name,
          'slug', p_slug,
          'legal_name', p_legal_name,
          'cuit', p_cuit,
          'address', '',
          'phone', '',
          'email', lower(p_admin_email),
          'logo_url', null,
          'currency_code', 'ARS',
          'timezone', 'America/Buenos_Aires'
        ),
        pos = jsonb_build_object(
          'default_customer_id', null,
          'default_payment_method_id', v_cash_payment_method_id,
          'auto_print_receipt', false,
          'allow_sale_without_customer', true,
          'allow_negative_stock', true,
          'barcode_scan_quantity', 1,
          'cart_behavior', 'merge_same_product'
        ),
        stock = jsonb_build_object(
          'use_min_max', true,
          'alerts_active', true,
          'global_low_stock_threshold', 5,
          'allow_manual_adjustments', true,
          'allow_negative_stock', true
        ),
        caja = jsonb_build_object(
          'require_open_session_for_sale', false,
          'default_opening_amount', 0,
          'allow_manual_movements', true,
          'require_notes_on_manual_movements', false
        ),
        facturacion = jsonb_build_object(
          'document_sequences', '{"A": 1, "B": 1, "C": 1, "PRESUPUESTO": 1}'::jsonb,
          'default_document_type', 'B',
          'allow_budget_without_customer', true,
          'issuer_tax_name', '',
          'issuer_cuit', '',
          'issuer_address', '',
          'issuer_fiscal_condition', '',
          'arca', '{"enabled": false, "mode": "mock", "cuit_emisor": "", "punto_venta": 1, "certificado_alias": "", "fiscal_environment": "homologacion", "force_unavailable": false, "allow_internal_fallback": true}'::jsonb
        ),
        codigos_balanza = jsonb_build_object(
          'scale_parser_enabled', true,
          'scale_mode', 'total_price',
          'scale_prefix', '20',
          'code_length', 13,
          'plu_start', 3,
          'plu_length', 4,
          'weight_start', 7,
          'weight_length', 5,
          'weight_decimals', 3,
          'amount_start', 7,
          'amount_length', 6,
          'amount_decimals', 2,
          'ean13_enabled', true
        ),
        apariencia = '{"default_theme": "light", "accent_color": "#6054e8", "display_name": "POS V2", "density": "standard"}'::jsonb,
        sistema = '{"show_dev_flags": false, "data_provider": "supabase", "version": "1.0.0", "enable_mock_auth_bypass": false, "allow_placeholder_export_import": false, "mercado_pago": {"enabled": true, "mode": "mock", "access_token": "", "public_key": "", "force_unavailable": false}}'::jsonb,
        updated_at = now()
    where id = v_settings_id;
  end if;

  insert into public.audit_logs (id, tenant_id, user_id, module, action, entity_type, entity_id, description, metadata)
  values (
    gen_random_uuid()::text,
    v_tenant_id,
    v_admin_user_id,
    'sistema',
    'reset_two_test_tenants',
    'tenant',
    v_tenant_id,
    'Tenant de pruebas inicializado',
    jsonb_build_object(
      'tenant_trade_name', p_trade_name,
      'tenant_slug', p_slug,
      'admin_email', lower(p_admin_email),
      'seller_profile_id', v_seller_profile_id
    )
  );
end;
$fn$;

do $$
declare
  v_admin_permissions jsonb := '{}'::jsonb;
  v_seller_permissions jsonb := '{}'::jsonb;
  v_module text;
begin
  foreach v_module in array array[
    'dashboard', 'pos', 'productos', 'clientes', 'cuentas_corrientes', 'stock',
    'caja', 'compras', 'proveedores', 'listas_precios', 'promociones',
    'medios_pago', 'facturacion', 'comprobantes', 'reportes', 'auditoria',
    'configuracion', 'configuracion_agenda', 'configuracion_catalogo',
    'configuracion_analisis', 'configuracion_sistema',
    'configuracion_contable', 'usuarios'
  ] loop
    v_admin_permissions := jsonb_set(v_admin_permissions, array[v_module], '{"read": true, "write": true}'::jsonb, true);
  end loop;

  foreach v_module in array array['dashboard', 'pos', 'clientes', 'cuentas_corrientes', 'caja', 'comprobantes'] loop
    v_seller_permissions := jsonb_set(v_seller_permissions, array[v_module], '{"read": true, "write": true}'::jsonb, true);
  end loop;

  foreach v_module in array array[
    'productos', 'stock', 'compras', 'proveedores', 'listas_precios',
    'promociones', 'medios_pago', 'facturacion', 'reportes', 'auditoria',
    'configuracion', 'configuracion_agenda', 'configuracion_catalogo',
    'configuracion_analisis', 'configuracion_sistema',
    'configuracion_contable', 'usuarios'
  ] loop
    v_seller_permissions := jsonb_set(v_seller_permissions, array[v_module], '{"read": true, "write": false}'::jsonb, true);
  end loop;

  if not exists (select 1 from auth.users where lower(email) = 'ale.97.28@gmail.com') then
    raise exception 'Falta crear/verificar en Supabase Auth el usuario ale.97.28@gmail.com';
  end if;

  if not exists (select 1 from auth.users where lower(email) = 'angiepaulacaterinamolina.7@gmail.com') then
    raise exception 'Falta crear/verificar en Supabase Auth el usuario angiepaulacaterinamolina.7@gmail.com';
  end if;

  update public.users
  set is_active = false,
      updated_at = now()
  where is_active = true;

  update public.tenants
  set is_active = false,
      updated_at = now()
  where is_active = true;

  perform public.pos_bootstrap_test_tenant(
    'Tenant demo',
    'Tenant demo',
    'demo',
    '20-00000001-0',
    'ale.97.28@gmail.com',
    'Ale Demo',
    v_admin_permissions,
    v_seller_permissions
  );

  perform public.pos_bootstrap_test_tenant(
    'Tenant Angie',
    'Tenant Angie',
    'angie',
    '20-00000002-0',
    'angiepaulacaterinamolina.7@gmail.com',
    'Angie Molina',
    v_admin_permissions,
    v_seller_permissions
  );
end $$;

commit;

select
  t.id as tenant_id,
  t.trade_name,
  t.slug,
  t.is_active as tenant_active,
  u.id as app_user_id,
  u.email,
  u.username,
  u.full_name,
  u.role_code,
  u.is_active as user_active,
  u.auth_user_id
from public.tenants t
join public.users u on u.tenant_id = t.id
where t.is_active = true
order by t.slug, u.email;
