-- POS V2 - Bootstrap de tenant + usuario admin
-- Requiere:
-- 1) Ejecutar 001_supabase_base_schema.sql.
-- 2) Ejecutar 002_supabase_rls_policies.sql.
-- 3) Crear antes el usuario en Supabase Auth y copiar su UUID.
--
-- IMPORTANTE:
-- Editar las variables del bloque "CONFIGURACION" antes de ejecutar.
-- No guardar contrasenas en este archivo.

begin;

do $$
declare
  -- CONFIGURACION: editar estos valores.
  v_auth_user_id uuid := '00000000-0000-0000-0000-000000000000';
  v_admin_email text := 'admin@comercio.com';
  v_admin_username text := 'admin';
  v_admin_full_name text := 'Administradora';
  v_tenant_legal_name text := 'Comercio de prueba';
  v_tenant_trade_name text := 'Comercio';
  v_tenant_cuit text := '20-00000000-0';

  v_tenant_id text;
  v_profile_id text;
  v_admin_user_id text;
  v_permissions jsonb := '{}'::jsonb;
  v_module text;
begin
  if v_auth_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Editar v_auth_user_id con el UUID real del usuario creado en Supabase Auth.';
  end if;

  foreach v_module in array array[
    'dashboard',
    'pos',
    'productos',
    'clientes',
    'cuentas_corrientes',
    'stock',
    'caja',
    'compras',
    'proveedores',
    'listas_precios',
    'promociones',
    'medios_pago',
    'facturacion',
    'comprobantes',
    'reportes',
    'auditoria',
    'configuracion',
    'configuracion_agenda',
    'configuracion_catalogo',
    'configuracion_analisis',
    'configuracion_sistema',
    'configuracion_contable',
    'usuarios'
  ] loop
    v_permissions := jsonb_set(
      v_permissions,
      array[v_module],
      '{"read": true, "write": true}'::jsonb,
      true
    );
  end loop;

  insert into public.tenants (
    legal_name,
    trade_name,
    cuit,
    is_active
  )
  values (
    v_tenant_legal_name,
    v_tenant_trade_name,
    v_tenant_cuit,
    true
  )
  on conflict (cuit) do update
    set legal_name = excluded.legal_name,
        trade_name = excluded.trade_name,
        is_active = true,
        updated_at = now()
  returning id into v_tenant_id;

  insert into public.permission_profiles (
    tenant_id,
    name,
    description,
    is_active,
    permissions
  )
  values (
    v_tenant_id,
    'Administrador',
    'Acceso completo al sistema',
    true,
    v_permissions
  )
  on conflict (tenant_id, name) do update
    set description = excluded.description,
        is_active = true,
        permissions = excluded.permissions,
        updated_at = now()
  returning id into v_profile_id;

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
    v_admin_email,
    v_admin_username,
    v_admin_full_name,
    'owner',
    v_profile_id,
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

  insert into public.tenant_settings (
    tenant_id,
    negocio,
    pos,
    stock,
    caja,
    facturacion,
    codigos_balanza,
    apariencia,
    sistema
  )
  values (
    v_tenant_id,
    jsonb_build_object(
      'trade_name', v_tenant_trade_name,
      'legal_name', v_tenant_legal_name,
      'cuit', v_tenant_cuit,
      'address', '',
      'phone', '',
      'email', v_admin_email,
      'logo_url', null,
      'currency_code', 'ARS',
      'timezone', 'America/Buenos_Aires'
    ),
    '{"default_customer_id": null, "auto_print_receipt": false, "allow_sale_without_customer": true, "allow_negative_stock": false, "barcode_scan_quantity": 1, "cart_behavior": "merge_same_product"}'::jsonb,
    '{"use_min_max": true, "alerts_active": true, "global_low_stock_threshold": 5, "allow_manual_adjustments": true, "allow_negative_stock": false}'::jsonb,
    '{"require_open_session_for_sale": false, "default_opening_amount": 0, "allow_manual_movements": true, "require_notes_on_manual_movements": false}'::jsonb,
    '{"document_sequences": {"A": 1, "B": 1, "C": 1, "PRESUPUESTO": 1}, "default_document_type": "B", "allow_budget_without_customer": true, "issuer_tax_name": "", "issuer_cuit": "", "issuer_address": "", "issuer_fiscal_condition": "", "arca": {"enabled": false, "mode": "mock", "cuit_emisor": "", "punto_venta": 1, "certificado_alias": "", "fiscal_environment": "homologacion", "force_unavailable": false, "allow_internal_fallback": true}}'::jsonb,
    '{"scale_parser_enabled": false, "scale_prefix": "20", "code_length": 13, "plu_start": 3, "plu_length": 4, "weight_start": 7, "weight_length": 5, "amount_start": 7, "amount_length": 5, "ean13_enabled": true}'::jsonb,
    '{"default_theme": "light", "accent_color": "#6054e8", "display_name": "POS V2", "density": "standard"}'::jsonb,
    '{"show_dev_flags": false, "data_provider": "supabase", "version": "1.0.0", "enable_mock_auth_bypass": false, "allow_placeholder_export_import": false, "mercado_pago": {"enabled": true, "mode": "mock", "access_token": "", "public_key": "", "force_unavailable": false}}'::jsonb
  )
  on conflict (tenant_id) do update
    set negocio = excluded.negocio,
        updated_at = now();

  insert into public.payment_methods (
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

  insert into public.audit_logs (
    tenant_id,
    user_id,
    module,
    action,
    entity_type,
    entity_id,
    description,
    metadata
  )
  values (
    v_tenant_id,
    v_admin_user_id,
    'sistema',
    'bootstrap_tenant',
    'tenant',
    v_tenant_id,
    'Tenant inicializado con usuario administrador',
    jsonb_build_object(
      'tenant_trade_name', v_tenant_trade_name,
      'admin_email', v_admin_email
    )
  );

  raise notice 'Tenant creado/actualizado: %, usuario admin interno: %', v_tenant_id, v_admin_user_id;
end $$;

commit;

