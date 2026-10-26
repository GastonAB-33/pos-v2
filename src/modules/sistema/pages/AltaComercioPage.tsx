import { useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useToast } from "@/components/ui/useToast";
import { normalizeTenantSlug } from "@/utils/tenant-slug";

const sqlText = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const PLACEHOLDER_AUTH_USER_ID = "00000000-0000-0000-0000-000000000000";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const defaultForm = {
  legalName: "",
  tradeName: "",
  slug: "",
  cuit: "",
  email: "",
  phone: "",
  address: "",
  authUserId: PLACEHOLDER_AUTH_USER_ID,
  adminEmail: "",
  adminUsername: "admin",
  adminFullName: "Administrador",
  allowNegativeStock: false,
  requireOpenSessionForSale: false,
  scaleEnabled: false,
  scaleMode: "total_price",
  scalePrefix: "20",
};

type TenantOnboardingForm = typeof defaultForm;

const booleanSql = (value: boolean) => (value ? "true" : "false");

const buildTenantSql = (form: TenantOnboardingForm): string => {
  const adminEmail = normalizeEmail(form.adminEmail || form.email);
  const tenantEmail = normalizeEmail(form.email || adminEmail);
  const tenantSlug = normalizeTenantSlug(form.slug || form.tradeName);

  return `-- Alta de comercio POS V2
-- 1) Crear primero el usuario admin en Supabase Auth.
-- 2) Reemplazar v_auth_user_id por el User UID real.
-- 3) Ejecutar en Supabase SQL Editor.

begin;

do $$
declare
  v_tenant_legal_name text := ${sqlText(form.legalName)};
  v_tenant_trade_name text := ${sqlText(form.tradeName)};
  v_tenant_slug text := ${sqlText(tenantSlug)};
  v_tenant_cuit text := ${sqlText(form.cuit)};
  v_tenant_email text := ${sqlText(tenantEmail)};
  v_tenant_phone text := ${sqlText(form.phone)};
  v_tenant_address text := ${sqlText(form.address)};

  v_auth_user_id uuid := ${sqlText(form.authUserId)}::uuid;
  v_admin_email text := ${sqlText(adminEmail)};
  v_admin_username text := ${sqlText(form.adminUsername)};
  v_admin_full_name text := ${sqlText(form.adminFullName)};

  v_allow_negative_stock boolean := ${booleanSql(form.allowNegativeStock)};
  v_require_open_session_for_sale boolean := ${booleanSql(form.requireOpenSessionForSale)};
  v_scale_enabled boolean := ${booleanSql(form.scaleEnabled)};
  v_scale_mode text := ${sqlText(form.scaleMode)};
  v_scale_prefix text := ${sqlText(form.scalePrefix)};

  v_tenant_id text;
  v_admin_profile_id text;
  v_seller_profile_id text;
  v_admin_user_id text;
  v_cash_payment_method_id text;
  v_admin_permissions jsonb := '{}'::jsonb;
  v_seller_permissions jsonb := '{}'::jsonb;
  v_module text;
begin
  if v_tenant_slug = '' then
    raise exception 'El slug del comercio no puede quedar vacio.';
  end if;

  if v_admin_email = '' or position('@' in v_admin_email) = 0 then
    raise exception 'El email administrador no es valido.';
  end if;

  if v_auth_user_id = '${PLACEHOLDER_AUTH_USER_ID}'::uuid then
    raise exception 'Editar v_auth_user_id con el UUID real del usuario administrador creado en Supabase Auth.';
  end if;

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
        slug = excluded.slug,
        is_active = true,
        updated_at = now()
  returning id into v_tenant_id;

  insert into public.permission_profiles (tenant_id, name, description, is_active, permissions)
  values (v_tenant_id, 'Administrador', 'Acceso completo al sistema', true, v_admin_permissions)
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

  insert into public.users (tenant_id, auth_user_id, email, username, full_name, role_code, permission_profile_id, is_active)
  values (v_tenant_id, v_auth_user_id, v_admin_email, v_admin_username, v_admin_full_name, 'owner', v_admin_profile_id, true)
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
      'address', v_tenant_address,
      'phone', v_tenant_phone,
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
      'allow_negative_stock', v_allow_negative_stock,
      'barcode_scan_quantity', 1,
      'cart_behavior', 'merge_same_product'
    ),
    jsonb_build_object(
      'use_min_max', true,
      'alerts_active', true,
      'global_low_stock_threshold', 5,
      'allow_manual_adjustments', true,
      'allow_negative_stock', v_allow_negative_stock
    ),
    jsonb_build_object(
      'require_open_session_for_sale', v_require_open_session_for_sale,
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
      'scale_parser_enabled', v_scale_enabled,
      'scale_mode', v_scale_mode,
      'scale_prefix', v_scale_prefix,
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
    'bootstrap_tenant',
    'tenant',
    v_tenant_id,
    'Tenant inicializado con usuario administrador y perfil vendedor',
    jsonb_build_object(
      'tenant_trade_name', v_tenant_trade_name,
      'admin_email', v_admin_email,
      'admin_profile_id', v_admin_profile_id,
      'seller_profile_id', v_seller_profile_id
    )
  );

  raise notice 'Tenant listo: %, admin interno: %, perfil vendedor: %', v_tenant_id, v_admin_user_id, v_seller_profile_id;
end $$;

commit;
`;
};

export const AltaComercioPage = () => {
  const toast = useToast();
  const [form, setForm] = useState<TenantOnboardingForm>(defaultForm);

  const generatedSql = useMemo(() => buildTenantSql(form), [form]);
  const generatedSlug = normalizeTenantSlug(form.slug || form.tradeName);
  const adminEmail = normalizeEmail(form.adminEmail || form.email);
  const validationMessages = useMemo(() => {
    const messages: string[] = [];

    if (!form.tradeName.trim()) messages.push("Completar nombre comercial.");
    if (!generatedSlug) messages.push("Definir un slug valido para el enlace del comercio.");
    if (!form.legalName.trim()) messages.push("Completar razon social.");
    if (!form.cuit.trim()) messages.push("Completar CUIT.");
    if (!adminEmail || !adminEmail.includes("@")) messages.push("Completar email administrador valido.");
    if (!form.adminUsername.trim()) messages.push("Completar usuario administrador.");
    if (!form.adminFullName.trim()) messages.push("Completar nombre del administrador.");
    if (form.authUserId === PLACEHOLDER_AUTH_USER_ID || !UUID_PATTERN.test(form.authUserId.trim())) {
      messages.push("Reemplazar Supabase Auth User UID por el UUID real del usuario admin.");
    }

    return messages;
  }, [adminEmail, form, generatedSlug]);
  const canCopySql = validationMessages.length === 0;

  const updateField = <TKey extends keyof TenantOnboardingForm>(
    key: TKey,
    value: TenantOnboardingForm[TKey]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const copySql = async () => {
    if (!canCopySql) {
      toast.error("Faltan datos obligatorios para generar un alta segura");
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedSql);
      toast.success("SQL copiado");
    } catch {
      toast.error("No se pudo copiar el SQL");
    }
  };

  return (
    <PagePlaceholder title="Alta de comercio" description="Generador de onboarding multi-tenant">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,520px)_1fr]">
        <section className="ui-card space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">Enlace del comercio</p>
            <p className="mt-1 font-mono">/{generatedSlug || "slug"}/login</p>
            <p className="mt-1">El slug debe ser unico. Si cambia, cambia tambien el enlace que recibe el cliente.</p>
          </div>

          {validationMessages.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="font-semibold">Pendiente para copiar SQL</p>
              <ul className="mt-1 list-inside list-disc space-y-1">
                {validationMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs text-slate-500">
              Razon social
              <input
                className="ui-input"
                value={form.legalName}
                onChange={(event) => updateField("legalName", event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-500">
              Nombre comercial
              <input
                className="ui-input"
                value={form.tradeName}
                onChange={(event) => updateField("tradeName", event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-500">
              Slug de acceso
              <input
                className="ui-input"
                value={form.slug}
                placeholder={normalizeTenantSlug(form.tradeName) || "la25"}
                onChange={(event) => updateField("slug", event.target.value)}
              />
              <span className="text-[11px] text-slate-400">
                URL: /{generatedSlug || "slug"}
              </span>
            </label>
            <label className="grid gap-1 text-xs text-slate-500">
              CUIT
              <input
                className="ui-input"
                value={form.cuit}
                onChange={(event) => updateField("cuit", event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-500">
              Email comercio
              <input
                className="ui-input"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-500">
              Telefono
              <input
                className="ui-input"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-500">
              Direccion
              <input
                className="ui-input"
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs text-slate-500 md:col-span-2">
              Supabase Auth User UID
              <input
                className="ui-input font-mono text-xs"
                value={form.authUserId}
                onChange={(event) => updateField("authUserId", event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-500">
              Email admin
              <input
                className="ui-input"
                value={form.adminEmail}
                onChange={(event) => updateField("adminEmail", event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-500">
              Usuario admin
              <input
                className="ui-input"
                value={form.adminUsername}
                onChange={(event) => updateField("adminUsername", event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-500 md:col-span-2">
              Nombre admin
              <input
                className="ui-input"
                value={form.adminFullName}
                onChange={(event) => updateField("adminFullName", event.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.requireOpenSessionForSale}
                onChange={(event) => updateField("requireOpenSessionForSale", event.target.checked)}
              />
              Caja abierta para vender
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.allowNegativeStock}
                onChange={(event) => updateField("allowNegativeStock", event.target.checked)}
              />
              Permitir stock negativo
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.scaleEnabled}
                onChange={(event) => updateField("scaleEnabled", event.target.checked)}
              />
              Balanza EAN13
            </label>
            <label className="grid gap-1 text-xs text-slate-500">
              Prefijo balanza
              <input
                className="ui-input"
                value={form.scalePrefix}
                onChange={(event) => updateField("scalePrefix", event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-500 md:col-span-2">
              Modo balanza
              <select
                className="ui-input"
                value={form.scaleMode}
                onChange={(event) => updateField("scaleMode", event.target.value)}
              >
                <option value="total_price">Importe total</option>
                <option value="weight">Peso</option>
              </select>
            </label>
          </div>
        </section>

        <section className="ui-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">SQL generado</h2>
            <button
              type="button"
              className="ui-btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void copySql()}
              disabled={!canCopySql}
            >
              Copiar SQL
            </button>
          </div>
          <textarea
            className="ui-input min-h-[620px] font-mono text-xs"
            value={generatedSql}
            onChange={() => undefined}
            spellCheck={false}
          />
        </section>
      </div>
    </PagePlaceholder>
  );
};
