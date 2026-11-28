import { dbTables } from "@/lib/database/tables";
import { supabase } from "@/lib/supabase/client";
import {
  TenantCrudService,
  type CreateEntityInput,
} from "@/services/base/tenant-crud.service";
import { nowIso } from "@/services/base/entity-factory";
import { dataProvider } from "@/services/config/data-provider";
import type {
  AppearanceSettings,
  ArcaSettings,
  BarcodeScaleSettings,
  BusinessSettings,
  CashSettings,
  EntityRequirementsSettings,
  FacturacionSettings,
  MercadoPagoSettings,
  PosSettings,
  StockSettings,
  StoreSettings,
  SystemSettings,
  TenantSettings,
  TenantSettingsSectionKey,
} from "@/types/entities";

const crud = new TenantCrudService<TenantSettings>(dbTables.tenant_settings);

const resolveDefaultVersion = () => {
  const version = import.meta.env.VITE_APP_VERSION;
  if (typeof version === "string" && version.trim()) return version.trim();
  return "0.0.1";
};

export const createDefaultEntityRequirements = (): EntityRequirementsSettings => ({
  customer: {
    document_number: true,
    phone: false,
    email: false,
    address: false,
  },
  supplier: {
    tax_id: false,
    phone: false,
    email: false,
    address: false,
  },
});

const createDefaultBusinessSettings = (): BusinessSettings => ({
  trade_name: "Mi negocio",
  legal_name: "Mi negocio",
  cuit: "",
  address: "",
  phone: "",
  email: "",
  logo_url: null,
  currency_code: "ARS",
  timezone: "America/Buenos_Aires",
});

const createDefaultPosSettings = (): PosSettings => ({
  default_customer_id: null,
  default_payment_method_id: null,
  auto_print_receipt: false,
  allow_sale_without_customer: true,
  allow_negative_stock: false,
  barcode_scan_quantity: 1,
  cart_behavior: "merge_same_product",
  rounding_enabled: false,
  rounding_rule: "none",
  rounding_mode: "nearest",
  rounding_target: "cash_only",
  employee_discount_percent: 10,
  employee_discount_excluded_categories: [],
});

const createDefaultStockSettings = (): StockSettings => ({
  use_min_max: true,
  alerts_active: true,
  global_low_stock_threshold: 5,
  allow_manual_adjustments: true,
  allow_negative_stock: false,
  allow_purchases_profit_margin_adjustment: true,
  purchase_double_confirmation_enabled: false,
  purchase_auto_confirm_no_price_change: false,
  returnable_packages: [],
});

const createDefaultCashSettings = (): CashSettings => ({
  require_open_session_for_sale: false,
  default_opening_amount: 0,
  allow_manual_movements: true,
  require_notes_on_manual_movements: false,
  blind_cash_closing: false,
  cash_reconciliation_mode: "cash_only",
});

const createDefaultArcaSettings = (): ArcaSettings => ({
  enabled: false,
  mode: "mock",
  cuit_emisor: "",
  punto_venta: 1,
  certificado_alias: "",
  fiscal_environment: "homologacion",
  force_unavailable: false,
  allow_internal_fallback: true,
  certificate_crt: null,
  certificate_key: null,
  certificate_expiration: null,
  last_connection_status: "untested",
  last_connection_message: null,
});

const createDefaultFacturacionSettings = (): FacturacionSettings => ({
  document_sequences: {
    A: 1,
    B: 1,
    C: 1,
    PRESUPUESTO: 1,
  },
  default_document_type: "B",
  allow_budget_without_customer: true,
  issuer_tax_name: "",
  issuer_cuit: "",
  issuer_address: "",
  issuer_fiscal_condition: "",
  arca: createDefaultArcaSettings(),
  entity_requirements: createDefaultEntityRequirements(),
  payment_method_rules: {
    mandatory_methods: [],
    disabled_methods: [],
  },
});

const createDefaultBarcodeScaleSettings = (): BarcodeScaleSettings => ({
  scale_parser_enabled: false,
  scale_mode: "total_price",
  scale_prefix: "20",
  code_length: 13,
  plu_start: 3,
  plu_length: 4,
  weight_start: 8,
  weight_length: 5,
  weight_decimals: 3,
  amount_start: 7,
  amount_length: 6,
  amount_decimals: 2,
  ean13_enabled: true,
});

const createDefaultAppearanceSettings = (): AppearanceSettings => ({
  default_theme: "light",
  accent_color: "#0056b3",
  display_name: "POS V2",
  density: "standard",
});

const createDefaultMercadoPagoSettings = (): MercadoPagoSettings => ({
  enabled: true,
  mode: "mock",
  access_token: "",
  public_key: "",
  force_unavailable: false,
});

const createDefaultSystemSettings = (): SystemSettings => ({
  show_dev_flags: dataProvider === "mock",
  data_provider: dataProvider,
  version: resolveDefaultVersion(),
  enable_mock_auth_bypass: import.meta.env.DEV,
  allow_placeholder_export_import: true,
  mercado_pago: createDefaultMercadoPagoSettings(),
});

export const createDefaultStoreSettings = (): StoreSettings => ({
  is_enabled: true,
  store_name: "",
  store_description: "Catálogo online y pedidos directos por WhatsApp",
  banner_url: null,
  logo_url: null,
  whatsapp_phone: "",
  social_instagram: "",
  categories_mode: "all",
  featured_categories: [],
  navigation_mode: "categories",
  custom_lists: [],
  only_show_listed_products: false,
  hide_out_of_stock: false,
  allow_out_of_stock_orders: false,
  price_list_id: null,
  delivery_mode: "both",
  delivery_cost_type: "free",
  delivery_cost_amount: 0,
  delivery_free_threshold: 0,
  delivery_min_order: 0,
  delivery_zones_notes: "",
  takeaway_address: "",
  takeaway_instructions: "",
  down_payment_policy: "none",
  down_payment_percent: 50,
  payment_instructions: "",
  bank_name: "",
  bank_alias: "",
  bank_cbu: "",
  bank_account_holder: "",
  schedule_active: false,
  schedule_text: "",
  allow_orders_outside_hours: true,
});

type TenantSettingsMutable = Omit<
  TenantSettings,
  "id" | "tenant_id" | "created_at" | "updated_at"
>;

export type TenantSettingsUpdateInput = Partial<{
  [K in keyof TenantSettingsMutable]: Partial<TenantSettingsMutable[K]>;
}>;

const getTiendaStorageBackup = (tenantId?: string): Partial<StoreSettings> | null => {
  if (typeof window === "undefined" || !tenantId) return null;
  try {
    const raw = window.localStorage.getItem(`pos-v2-tienda-${tenantId}`);
    return raw ? (JSON.parse(raw) as Partial<StoreSettings>) : null;
  } catch {
    return null;
  }
};

const saveTiendaStorageBackup = (tenantId: string, tienda?: Partial<StoreSettings>) => {
  if (typeof window === "undefined" || !tenantId || !tienda) return;
  try {
    window.localStorage.setItem(`pos-v2-tienda-${tenantId}`, JSON.stringify(tienda));
  } catch {
    // Ignorar excepciones de almacenamiento
  }
};

const createDefaultSettingsInput = (): CreateEntityInput<TenantSettings> => ({
  negocio: createDefaultBusinessSettings(),
  pos: createDefaultPosSettings(),
  stock: createDefaultStockSettings(),
  caja: createDefaultCashSettings(),
  facturacion: createDefaultFacturacionSettings(),
  codigos_balanza: createDefaultBarcodeScaleSettings(),
  apariencia: createDefaultAppearanceSettings(),
  sistema: createDefaultSystemSettings(),
  tienda: createDefaultStoreSettings(),
});

const normalizeTenantSettings = (input: TenantSettings): TenantSettings => ({
  ...input,
  negocio: {
    ...createDefaultBusinessSettings(),
    ...(input.negocio ?? {}),
  },
  pos: {
    ...createDefaultPosSettings(),
    ...(input.pos ?? {}),
    default_customer_id: null,
    default_payment_method_id: input.pos?.default_payment_method_id ?? null,
    cart_behavior: "merge_same_product",
    barcode_scan_quantity: 1,
    allow_sale_without_customer: true,
    rounding_enabled: input.pos?.rounding_enabled ?? false,
    rounding_rule: input.pos?.rounding_enabled
      ? (input.pos?.rounding_rule && input.pos.rounding_rule !== "none" ? input.pos.rounding_rule : "10")
      : (input.pos?.rounding_rule ?? "none"),
    rounding_mode: input.pos?.rounding_mode ?? "nearest",
    rounding_target:
      (input.pos?.rounding_target as string) === "total" || input.pos?.rounding_target === "all_methods"
        ? "all_methods"
        : "cash_only",
    employee_discount_percent: input.pos?.employee_discount_percent ?? 10,
    employee_discount_excluded_categories: input.pos?.employee_discount_excluded_categories ?? [],
  },
  stock: {
    ...createDefaultStockSettings(),
    ...(input.stock ?? {}),
    returnable_packages: Array.isArray(input.stock?.returnable_packages)
      ? input.stock.returnable_packages
      : (input.stock?.returnable_packages ?? []),
  },
  caja: {
    ...createDefaultCashSettings(),
    ...(input.caja ?? {}),
  },
  facturacion: {
    ...createDefaultFacturacionSettings(),
    ...(input.facturacion ?? {}),
    document_sequences: {
      ...createDefaultFacturacionSettings().document_sequences,
      ...(input.facturacion?.document_sequences ?? {}),
    },
    arca: {
      ...createDefaultArcaSettings(),
      enabled:
        input.facturacion?.arca?.enabled ??
        ((input.facturacion as { arca_enabled?: boolean } | undefined)?.arca_enabled ??
          createDefaultFacturacionSettings().arca.enabled),
      mode:
        input.facturacion?.arca?.mode ??
        createDefaultFacturacionSettings().arca.mode,
      cuit_emisor:
        (input.facturacion?.arca?.cuit_emisor || "").trim() ||
        (input.facturacion?.issuer_cuit || "").trim() ||
        createDefaultFacturacionSettings().arca.cuit_emisor,
      punto_venta:
        input.facturacion?.arca?.punto_venta && input.facturacion.arca.punto_venta > 0
          ? input.facturacion.arca.punto_venta
          : createDefaultFacturacionSettings().arca.punto_venta,
      certificado_alias:
        input.facturacion?.arca?.certificado_alias ??
        createDefaultFacturacionSettings().arca.certificado_alias,
      fiscal_environment:
        input.facturacion?.arca?.fiscal_environment ??
        ((input.facturacion as { arca_sandbox?: boolean } | undefined)?.arca_sandbox === false
          ? "produccion"
          : "homologacion"),
      force_unavailable:
        input.facturacion?.arca?.force_unavailable ??
        createDefaultFacturacionSettings().arca.force_unavailable,
      allow_internal_fallback:
        input.facturacion?.arca?.allow_internal_fallback ??
        createDefaultFacturacionSettings().arca.allow_internal_fallback,
      certificate_crt:
        input.facturacion?.arca?.certificate_crt ??
        createDefaultFacturacionSettings().arca.certificate_crt,
      certificate_key:
        input.facturacion?.arca?.certificate_key ??
        createDefaultFacturacionSettings().arca.certificate_key,
      certificate_expiration:
        input.facturacion?.arca?.certificate_expiration ??
        createDefaultFacturacionSettings().arca.certificate_expiration,
      last_connection_status:
        input.facturacion?.arca?.last_connection_status ??
        createDefaultFacturacionSettings().arca.last_connection_status,
      last_connection_message:
        input.facturacion?.arca?.last_connection_message ??
        createDefaultFacturacionSettings().arca.last_connection_message,
    },
    payment_method_rules: {
      mandatory_methods: Array.isArray(input.facturacion?.payment_method_rules?.mandatory_methods)
        ? input.facturacion.payment_method_rules.mandatory_methods
        : [],
      disabled_methods: Array.isArray(input.facturacion?.payment_method_rules?.disabled_methods)
        ? input.facturacion.payment_method_rules.disabled_methods
        : [],
    },
    entity_requirements: {
      customer: {
        ...createDefaultEntityRequirements().customer,
        ...(input.facturacion?.entity_requirements?.customer ?? {}),
      },
      supplier: {
        ...createDefaultEntityRequirements().supplier,
        ...(input.facturacion?.entity_requirements?.supplier ?? {}),
      },
    },
  },
  codigos_balanza: {
    ...createDefaultBarcodeScaleSettings(),
    ...(input.codigos_balanza ?? {}),
  },
  apariencia: {
    ...createDefaultAppearanceSettings(),
    ...(input.apariencia ?? {}),
  },
  sistema: {
    ...createDefaultSystemSettings(),
    ...(input.sistema ?? {}),
    mercado_pago: {
      ...createDefaultMercadoPagoSettings(),
      ...(input.sistema?.mercado_pago ?? {}),
    },
  },
  tienda: {
    ...createDefaultStoreSettings(),
    ...(getTiendaStorageBackup(input.tenant_id) ?? {}),
    ...(((input.sistema as unknown as Record<string, unknown> | undefined)?.tienda as Partial<StoreSettings>) ?? {}),
    ...(input.tienda ?? {}),
  },
});

const mergeSettingsPayload = (
  current: TenantSettings,
  patch: TenantSettingsUpdateInput
): CreateEntityInput<TenantSettings> => ({
  negocio: {
    ...current.negocio,
    ...(patch.negocio ?? {}),
  },
  pos: {
    ...current.pos,
    ...(patch.pos ?? {}),
  },
  stock: {
    ...current.stock,
    ...(patch.stock ?? {}),
    returnable_packages: patch.stock?.returnable_packages !== undefined
      ? patch.stock.returnable_packages
      : current.stock.returnable_packages,
  },
  caja: {
    ...current.caja,
    ...(patch.caja ?? {}),
  },
  facturacion: {
    ...current.facturacion,
    ...(patch.facturacion ?? {}),
    document_sequences: {
      ...current.facturacion.document_sequences,
      ...(patch.facturacion?.document_sequences ?? {}),
    },
    arca: {
      ...createDefaultArcaSettings(),
      ...current.facturacion.arca,
      ...(patch.facturacion?.arca ?? {}),
      cuit_emisor:
        (patch.facturacion?.arca?.cuit_emisor || "").trim() ||
        (patch.facturacion?.issuer_cuit || "").trim() ||
        (current.facturacion.arca.cuit_emisor || "").trim() ||
        (current.facturacion.issuer_cuit || "").trim() ||
        "",
      punto_venta:
        (patch.facturacion?.arca?.punto_venta && patch.facturacion.arca.punto_venta > 0)
          ? patch.facturacion.arca.punto_venta
          : (current.facturacion.arca.punto_venta || 1),
    },
    entity_requirements: {
      customer: {
        ...createDefaultEntityRequirements().customer,
        ...(current.facturacion.entity_requirements?.customer ?? {}),
        ...(patch.facturacion?.entity_requirements?.customer ?? {}),
      },
      supplier: {
        ...createDefaultEntityRequirements().supplier,
        ...(current.facturacion.entity_requirements?.supplier ?? {}),
        ...(patch.facturacion?.entity_requirements?.supplier ?? {}),
      },
    },
  },
  codigos_balanza: {
    ...current.codigos_balanza,
    ...(patch.codigos_balanza ?? {}),
  },
  apariencia: {
    ...current.apariencia,
    ...(patch.apariencia ?? {}),
  },
  sistema: {
    ...createDefaultSystemSettings(),
    ...current.sistema,
    ...(patch.sistema ?? {}),
    mercado_pago: {
      ...createDefaultMercadoPagoSettings(),
      ...current.sistema.mercado_pago,
      ...(patch.sistema?.mercado_pago ?? {}),
    },
  },
  tienda: {
    ...createDefaultStoreSettings(),
    ...(current.tienda ?? {}),
    ...(patch.tienda ?? {}),
  },
});

const upsertTenantSettings = async (
  tenantId: string,
  input: CreateEntityInput<TenantSettings>,
  preferredId?: string
): Promise<TenantSettings> => {
  if (dataProvider === "mock") {
    const existing = await crud.getAllByTenant(tenantId);
    const current = existing[0] ?? null;

    if (current) {
      const updated = await crud.update(tenantId, current.id, input);
      if (updated) return updated;
    }

    return crud.create(tenantId, input);
  }

  if (input.tienda) {
    saveTiendaStorageBackup(tenantId, input.tienda);
  }

  // Asegurar que tienda también se guarde dentro de sistema.tienda (columna JSONB existente en Supabase)
  const safeInput = {
    ...input,
    sistema: {
      ...input.sistema,
      tienda: input.tienda,
    },
  };

  const timestamp = nowIso();
  let row: Record<string, unknown> = {
    id: preferredId ?? `settings-${tenantId}`,
    tenant_id: tenantId,
    ...safeInput,
    created_at: timestamp,
    updated_at: timestamp,
  };

  let firstAttempt = await supabase
    .from("tenant_settings")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  // Si la columna 'tienda' aún no existe como columna de primer nivel en Supabase (error 42703)
  if (
    firstAttempt.error &&
    firstAttempt.error.code === "42703" &&
    (firstAttempt.error.message?.toLowerCase().includes("tienda") ||
      String(firstAttempt.error.details || "").toLowerCase().includes("tienda"))
  ) {
    const { tienda: _removed, ...rowWithoutTienda } = row;
    row = rowWithoutTienda;

    firstAttempt = await supabase
      .from("tenant_settings")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
  }

  if (!firstAttempt.error) {
    const res = firstAttempt.data as TenantSettings;
    if (!res.tienda && input.tienda) {
      res.tienda = input.tienda;
    }
    return normalizeTenantSettings(res);
  }

  const conflictText = `${firstAttempt.error.message ?? ""} ${firstAttempt.error.details ?? ""}`.toLowerCase();
  const isTenantUniqueConflict =
    firstAttempt.error.code === "23505" && conflictText.includes("tenant_id");

  if (!isTenantUniqueConflict) {
    throw firstAttempt.error;
  }

  const existingByTenant = await supabase
    .from("tenant_settings")
    .select("id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existingByTenant.error) throw existingByTenant.error;

  let retryRow: Record<string, unknown> = {
    ...row,
    id: existingByTenant.data?.id ?? row.id,
  };

  let retryAttempt = await supabase
    .from("tenant_settings")
    .upsert(retryRow, { onConflict: "id" })
    .select()
    .single();

  if (
    retryAttempt.error &&
    retryAttempt.error.code === "42703" &&
    (retryAttempt.error.message?.toLowerCase().includes("tienda") ||
      String(retryAttempt.error.details || "").toLowerCase().includes("tienda"))
  ) {
    const { tienda: _removed2, ...retryWithoutTienda } = retryRow;
    retryRow = retryWithoutTienda;

    retryAttempt = await supabase
      .from("tenant_settings")
      .upsert(retryRow, { onConflict: "id" })
      .select()
      .single();
  }

  if (retryAttempt.error) throw retryAttempt.error;
  const retryRes = retryAttempt.data as TenantSettings;
  if (!retryRes.tienda && input.tienda) {
    retryRes.tienda = input.tienda;
  }
  return normalizeTenantSettings(retryRes);
};

const readOrCreateTenantSettings = async (tenantId: string): Promise<TenantSettings> => {
  try {
    const allRows = await crud.getAllByTenant(tenantId);
    const existing = allRows[0] ?? null;
    if (existing) return normalizeTenantSettings(existing);

    const created = await upsertTenantSettings(tenantId, createDefaultSettingsInput());
    return normalizeTenantSettings(created);
  } catch (error) {
    console.warn("Error leyendo/creando tenant_settings:", error);
    const timestamp = nowIso();
    return normalizeTenantSettings({
      id: `settings-${tenantId}`,
      tenant_id: tenantId,
      created_at: timestamp,
      updated_at: timestamp,
      ...createDefaultSettingsInput(),
    });
  }
};

export const settingsService = {
  getByTenant: async (tenantId: string): Promise<TenantSettings> => {
    return readOrCreateTenantSettings(tenantId);
  },

  updateByTenant: async (
    tenantId: string,
    patch: TenantSettingsUpdateInput
  ): Promise<TenantSettings> => {
    const current = await readOrCreateTenantSettings(tenantId);
    const merged = mergeSettingsPayload(current, patch);
    const upserted = await upsertTenantSettings(tenantId, merged, current.id);
    return normalizeTenantSettings(upserted);
  },

  updateSection: async <TSection extends TenantSettingsSectionKey>(
    tenantId: string,
    section: TSection,
    patch: Partial<TenantSettingsMutable[TSection]>
  ): Promise<TenantSettings> => {
    return settingsService.updateByTenant(tenantId, {
      [section]: patch,
    } as TenantSettingsUpdateInput);
  },

  resetSection: async (
    tenantId: string,
    section: TenantSettingsSectionKey
  ): Promise<TenantSettings> => {
    const defaults = createDefaultSettingsInput();
    const patch = {
      [section]: defaults[section],
    } as TenantSettingsUpdateInput;

    return settingsService.updateByTenant(tenantId, patch);
  },
};
