import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
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
  requireOpenSessionForSale: true,
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
    raise exception 'El slug del comercio no puede quedar vacío.';
  end if;

  if v_admin_email = '' or position('@' in v_admin_email) = 0 then
    raise exception 'El email administrador no es válido.';
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

  foreach v_module in array array['productos', 'stock', 'facturacion', 'reportes'] loop
    v_seller_permissions := jsonb_set(v_seller_permissions, array[v_module], '{"read": true, "write": false}'::jsonb, true);
  end loop;

  insert into public.tenants (
    name,
    legal_name,
    slug,
    cuit,
    email,
    phone,
    address,
    is_active
  )
  values (
    v_tenant_trade_name,
    v_tenant_legal_name,
    v_tenant_slug,
    nullif(v_tenant_cuit, ''),
    nullif(v_tenant_email, ''),
    nullif(v_tenant_phone, ''),
    nullif(v_tenant_address, ''),
    true
  )
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
    'Acceso total a todos los modulos del comercio',
    true,
    v_admin_permissions
  )
  returning id into v_admin_profile_id;

  insert into public.permission_profiles (
    tenant_id,
    name,
    description,
    is_active,
    permissions
  )
  values (
    v_tenant_id,
    'Vendedor',
    'Operacion diaria de ventas, caja y clientes',
    true,
    v_seller_permissions
  )
  returning id into v_seller_profile_id;

  insert into public.users (
    auth_user_id,
    tenant_id,
    permission_profile_id,
    username,
    full_name,
    email,
    is_active
  )
  values (
    v_auth_user_id,
    v_tenant_id,
    v_admin_profile_id,
    v_admin_username,
    v_admin_full_name,
    v_admin_email,
    true
  )
  returning id into v_admin_user_id;

  insert into public.settings (
    tenant_id,
    allow_negative_stock,
    require_open_session_for_sale,
    scale_barcode_enabled,
    scale_barcode_mode,
    scale_barcode_prefix
  )
  values (
    v_tenant_id,
    v_allow_negative_stock,
    v_require_open_session_for_sale,
    v_scale_enabled,
    v_scale_mode,
    v_scale_prefix
  );

  insert into public.payment_methods (
    tenant_id,
    code,
    name,
    type,
    affects_cash,
    is_active
  )
  values (
    v_tenant_id,
    'cash',
    'Efectivo',
    'cash',
    true,
    true
  )
  returning id into v_cash_payment_method_id;

  insert into public.payment_methods (tenant_id, code, name, type, affects_cash, is_active)
  values
    (v_tenant_id, 'card_debit', 'Tarjeta de Debito', 'card', false, true),
    (v_tenant_id, 'card_credit', 'Tarjeta de Credito', 'card', false, true),
    (v_tenant_id, 'transfer', 'Transferencia', 'transfer', false, true),
    (v_tenant_id, 'mercado_pago', 'Mercado Pago', 'qr', false, true),
    (v_tenant_id, 'current_account', 'Cuenta Corriente', 'other', false, true);

  raise notice 'Alta exitosa: tenant_id=%, admin_user_id=%, slug=%',
    v_tenant_id,
    v_admin_user_id,
    v_tenant_slug;
end $$;

commit;
`;
};

export const AltaComercioPage = () => {
  const toast = useToast();
  const [form, setForm] = useState<TenantOnboardingForm>(defaultForm);
  const [copied, setCopied] = useState(false);

  const generatedSlug = useMemo(
    () => normalizeTenantSlug(form.slug || form.tradeName),
    [form.slug, form.tradeName]
  );

  const generatedSql = useMemo(() => buildTenantSql(form), [form]);

  const validationMessages = useMemo(() => {
    const messages: string[] = [];

    if (!form.tradeName.trim()) {
      messages.push("Falta el nombre comercial");
    }

    if (!generatedSlug) {
      messages.push("Falta definir un slug de acceso válido");
    }

    const adminEmail = normalizeEmail(form.adminEmail || form.email);
    if (!adminEmail || !adminEmail.includes("@")) {
      messages.push("El email administrador no es válido");
    }

    if (!UUID_PATTERN.test(form.authUserId)) {
      messages.push("El UID de Supabase Auth debe tener formato UUID");
    } else if (form.authUserId === PLACEHOLDER_AUTH_USER_ID) {
      messages.push("Reemplazar el UUID de marcador por el Auth UID real");
    }

    return messages;
  }, [form.authUserId, form.adminEmail, form.email, form.tradeName, generatedSlug]);

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
      setCopied(true);
      toast.success("Script SQL copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el SQL");
    }
  };

  return (
    <div className="ui-page operational-page alta-comercio-page space-y-4 w-full min-w-0 max-w-full">
      {/* Encabezado Principal Flotante Moderno */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">SISTEMA</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">ALTA DE COMERCIO</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Alta de Comercio
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Generador de onboarding multi-tenant y provisionamiento seguro en base de datos.
          </p>
        </div>

        {/* Fila de Botones Píldora */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => void copySql()}
            disabled={!canCopySql}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? "¡Copiado!" : "Copiar script SQL"}</span>
          </button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,540px)_1fr]">
        {/* Formulario de Configuración */}
        <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="rounded-xl sm:rounded-2xl border border-blue-200/80 bg-blue-50/70 p-3.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
            <p className="font-bold">Enlace de acceso del comercio</p>
            <p className="mt-1 font-mono font-semibold">/{generatedSlug || "slug"}/login</p>
            <p className="mt-1 text-blue-700 dark:text-blue-300">
              El slug debe ser único en toda la plataforma. Si cambia, también cambia el enlace que recibe el cliente.
            </p>
          </div>

          {validationMessages.length ? (
            <div className="rounded-xl sm:rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-bold">Requisitos pendientes para generar SQL:</p>
              <ul className="mt-1.5 list-inside list-disc space-y-1">
                {validationMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
              Datos comerciales
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Razón social
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={form.legalName}
                  onChange={(event) => updateField("legalName", event.target.value)}
                  placeholder="Ej: Distribuidora Central S.R.L."
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Nombre comercial
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={form.tradeName}
                  onChange={(event) => updateField("tradeName", event.target.value)}
                  placeholder="Ej: La 25 Minimarket"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Slug de acceso
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 font-mono"
                  value={form.slug}
                  placeholder={normalizeTenantSlug(form.tradeName) || "la25"}
                  onChange={(event) => updateField("slug", event.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  CUIT
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 font-mono"
                  value={form.cuit}
                  onChange={(event) => updateField("cuit", event.target.value)}
                  placeholder="30-12345678-9"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Email comercio
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="comercio@ejemplo.com"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Teléfono
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 font-mono"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="11-2345-6789"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Dirección
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={form.address}
                  onChange={(event) => updateField("address", event.target.value)}
                  placeholder="Av. Corrientes 1234, CABA"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
              Usuario Administrador Inicial
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Supabase Auth User UID
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-mono text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={form.authUserId}
                  onChange={(event) => updateField("authUserId", event.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Email admin
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={form.adminEmail}
                  onChange={(event) => updateField("adminEmail", event.target.value)}
                  placeholder="admin@comercio.com"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Usuario admin
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={form.adminUsername}
                  onChange={(event) => updateField("adminUsername", event.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Nombre completo admin
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={form.adminFullName}
                  onChange={(event) => updateField("adminFullName", event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
              Configuraciones operativas iniciales
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  checked={form.allowNegativeStock}
                  onChange={(event) => updateField("allowNegativeStock", event.target.checked)}
                />
                <span>Permitir ventas con stock negativo</span>
              </label>

              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  checked={form.scaleEnabled}
                  onChange={(event) => updateField("scaleEnabled", event.target.checked)}
                />
                <span>Habilitar códigos de barras de balanza EAN-13</span>
              </label>

              {form.scaleEnabled ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Prefijo balanza
                    </label>
                    <input
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 font-mono"
                      value={form.scalePrefix}
                      onChange={(event) => updateField("scalePrefix", event.target.value)}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Modo balanza
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 cursor-pointer"
                      value={form.scaleMode}
                      onChange={(event) => updateField("scaleMode", event.target.value)}
                    >
                      <option value="total_price">Importe total</option>
                      <option value="weight">Peso</option>
                    </select>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>

        {/* Panel de SQL Generado */}
        <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Script SQL generado</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pega este script directamente en el SQL Editor de tu consola de Supabase.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copySql()}
              disabled={!canCopySql}
              className="inline-flex items-center gap-2 rounded-xl sm:rounded-2xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? "¡Copiado!" : "Copiar"}</span>
            </button>
          </div>
          <textarea
            className="flex-1 min-h-[580px] w-full rounded-xl sm:rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4 font-mono text-xs text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-950 dark:text-slate-200"
            value={generatedSql}
            readOnly
            spellCheck={false}
          />
        </section>
      </div>
    </div>
  );
};