-- POS V2 - Reset controlado a un unico tenant activo de pruebas.
--
-- Objetivo:
-- - Desactivar tenants basura existentes.
-- - Dejar un solo tenant activo para pruebas internas/Codex.
-- - Vincularlo al usuario Supabase Auth ale.97.28@gmail.com.
--
-- IMPORTANTE:
-- - Este SQL NO cambia la contrasena de Supabase Auth.
-- - La contrasena se debe definir en Authentication > Users o con funcion admin.
-- - Ejecutar solo si confirmaste que los tenants actuales son basura.

begin;

do $$
declare
  v_auth_email text := 'ale.97.28@gmail.com';
  v_auth_user_id uuid;

  v_tenant_legal_name text := 'Tenant Pruebas Codex';
  v_tenant_trade_name text := 'Pruebas Codex';
  v_tenant_slug text := 'codex';
  v_tenant_cuit text := '20-00000000-0';
  v_tenant_email text := v_auth_email;

  v_tenant_id text;
  v_admin_profile_id text;
  v_seller_profile_id text;
  v_admin_user_id text;
  v_cash_payment_method_id text;
  v_admin_permissions jsonb := '{}'::jsonb;
  v_seller_permissions jsonb := '{}'::jsonb;
  v_module text;
begin
  select au.id
    into v_auth_user_id
  from auth.users au
  where lower(au.email) = lower(v_auth_email)
  limit 1;

  if v_auth_user_id is null then
    raise exception 'No existe usuario Supabase Auth con email %. Crealo primero en Authentication > Users.', v_auth_email;
  end if;

  -- Desactivar todo lo existente antes de crear/dejar activo el tenant de prueba.
  update public.users
  set is_active = false,
      updated_at = now()
  where is_active = true;

  update public.tenants
  set is_active = false,
      updated_at = now()
  where is_active = true;

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

  insert into public.tenants (legal_name, trade_name, slug, cuit, is_active)
  values (v_tenant_legal_name, v_tenant_trade_name, v_tenant_slug, v_tenant_cuit, true)
  on conflict (slug) do update
    set legal_name = excluded.legal_name,
        trade_name = excluded.trade_name,
        cuit = excluded.cuit,
        is_active = true,
        updated_at = now()
  returning id into v_tenant_id;

  insert into public.permission_profiles (tenant_id, name, description, is_active, permissions)
  values (v_tenant_id, 'Administrador', 'Acceso completo al tenant de pruebas', true, v_admin_permissions)
  on conflict (tenant_id, name) do update
    set description = excluded.description,
        is_active = true,
        permissions = excluded.permissions,
        updated_at = now()
  returning id into v_admin_profile_id;

  insert into public.permission_profiles (tenant_id, name, description, is_active, permissions)
  values (v_tenant_id, 'Vendedora', 'Operacion diaria de venta, caja, clientes y cuentas corrientes', true, v_seller_permissions)
  on conflict (tenant_id, name) do update
    set description = excluded.description,
        is_active = true,
        permissions = excluded.permissions,
        updated_at = now()
  returning id into v_seller_profile_id;

  insert into public.users (
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
    v_tenant_id,
    v_auth_user_id,
    v_auth_email,
    'admin',
    'Usuario Pruebas Codex',
    'owner',
    v_admin_profile_id,
    true
  )
  on conflict (auth_user_id) do update
    set tenant_id = excluded.tenant_id,
        email = excluded.email,
        username = excluded.username,
        full_name = excluded.full_name,
        role_code = excluded.role_code,
        permission_profile_id = excluded.permission_profile_id,
        is_active = true,
        updated_at = now()
  returning id into v_admin_user_id;

  insert into public.payment_methods (tenant_id, name, code, type, is_active, affects_cash, surcharge_percent, discount_percent, notes)
  values
    (v_tenant_id, 'Efectivo', 'cash', 'cash', true, true, 0, 0, 'Medio predefinido del sistema'),
    (v_tenant_id, 'Tarjeta de debito', 'card_debit', 'card_debit', true, false, 0, 0, 'Medio predefinido del sistema'),
    (v_tenant_id, 'Tarjeta de credito', 'card_credit', 'card_credit', true, false, 0, 0, 'Medio predefinido del sistema'),
    (v_tenant_id, 'Transferencia bancaria', 'transfer', 'transfer', true, false, 0, 0, 'Medio predefinido del sistema'),
    (v_tenant_id, 'Mercado Pago', 'mercado_pago', 'mercado_pago', true, false, 0, 0, 'Medio predefinido del sistema'),
    (v_tenant_id, 'Cheque', 'cheque', 'cheque', true, false, 0, 0, 'Medio predefinido del sistema'),
    (v_tenant_id, 'Cuenta corriente', 'current_account', 'current_account', true, false, 0, 0, 'Medio predefinido del sistema')
  on conflict (tenant_id, code) do update
    set name = excluded.name,
        type = excluded.type,
        affects_cash = excluded.affects_cash,
        is_active = true,
        updated_at = now();

  select id into v_cash_payment_method_id
  from public.payment_methods
  where tenant_id = v_tenant_id and code = 'cash'
  limit 1;

  insert into public.tenant_settings (tenant_id, negocio, pos, stock, caja, facturacion, codigos_balanza, apariencia, sistema)
  values (
    v_tenant_id,
    jsonb_build_object(
      'trade_name', v_tenant_trade_name,
      'slug', v_tenant_slug,
      'legal_name', v_tenant_legal_name,
      'cuit', v_tenant_cuit,
      'address', '',
      'phone', '',
      'email', v_tenant_email,
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
  )
  on conflict (tenant_id) do update
    set negocio = excluded.negocio,
        pos = excluded.pos,
        stock = excluded.stock,
        caja = excluded.caja,
        facturacion = excluded.facturacion,
        codigos_balanza = excluded.codigos_balanza,
        apariencia = excluded.apariencia,
        sistema = excluded.sistema,
        updated_at = now();

  insert into public.audit_logs (tenant_id, user_id, module, action, entity_type, entity_id, description, metadata)
  values (
    v_tenant_id,
    v_admin_user_id,
    'sistema',
    'reset_single_test_tenant',
    'tenant',
    v_tenant_id,
    'Base reducida a un unico tenant activo de pruebas',
    jsonb_build_object(
      'tenant_trade_name', v_tenant_trade_name,
      'tenant_slug', v_tenant_slug,
      'admin_email', v_auth_email,
      'seller_profile_id', v_seller_profile_id
    )
  );

  raise notice 'Tenant activo listo: %, slug: %, admin: %, auth uid: %', v_tenant_id, v_tenant_slug, v_admin_user_id, v_auth_user_id;
end $$;

commit;

-- Verificacion rapida.
select
  t.id as tenant_id,
  t.trade_name,
  t.slug,
  t.is_active as tenant_active,
  u.id as app_user_id,
  u.email,
  u.username,
  u.full_name,
  u.is_active as user_active,
  u.auth_user_id
from public.tenants t
left join public.users u on u.tenant_id = t.id and u.is_active = true
where t.is_active = true
order by t.trade_name;
