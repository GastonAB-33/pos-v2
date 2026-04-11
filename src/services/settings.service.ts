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
  FacturacionSettings,
  MercadoPagoSettings,
  PosSettings,
  StockSettings,
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
  auto_print_receipt: false,
  allow_sale_without_customer: true,
  allow_negative_stock: false,
  barcode_scan_quantity: 1,
  cart_behavior: "merge_same_product",
});

const createDefaultStockSettings = (): StockSettings => ({
  use_min_max: true,
  alerts_active: true,
  global_low_stock_threshold: 5,
  allow_manual_adjustments: true,
  allow_negative_stock: false,
});

const createDefaultCashSettings = (): CashSettings => ({
  require_open_session_for_sale: false,
  default_opening_amount: 0,
  allow_manual_movements: true,
  require_notes_on_manual_movements: false,
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
});

const createDefaultBarcodeScaleSettings = (): BarcodeScaleSettings => ({
  scale_parser_enabled: false,
  scale_prefix: "20",
  code_length: 13,
  plu_start: 3,
  plu_length: 4,
  weight_start: 7,
  weight_length: 5,
  amount_start: 7,
  amount_length: 5,
  ean13_enabled: true,
});

const createDefaultAppearanceSettings = (): AppearanceSettings => ({
  default_theme: "light",
  accent_color: "#6054e8",
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

type TenantSettingsMutable = Omit<
  TenantSettings,
  "id" | "tenant_id" | "created_at" | "updated_at"
>;

export type TenantSettingsUpdateInput = Partial<{
  [K in keyof TenantSettingsMutable]: Partial<TenantSettingsMutable[K]>;
}>;

const createDefaultSettingsInput = (): CreateEntityInput<TenantSettings> => ({
  negocio: createDefaultBusinessSettings(),
  pos: createDefaultPosSettings(),
  stock: createDefaultStockSettings(),
  caja: createDefaultCashSettings(),
  facturacion: createDefaultFacturacionSettings(),
  codigos_balanza: createDefaultBarcodeScaleSettings(),
  apariencia: createDefaultAppearanceSettings(),
  sistema: createDefaultSystemSettings(),
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
  },
  stock: {
    ...createDefaultStockSettings(),
    ...(input.stock ?? {}),
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
        input.facturacion?.arca?.cuit_emisor ??
        input.facturacion?.issuer_cuit ??
        createDefaultFacturacionSettings().arca.cuit_emisor,
      punto_venta:
        input.facturacion?.arca?.punto_venta ??
        createDefaultFacturacionSettings().arca.punto_venta,
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
});

const upsertTenantSettings = async (
  tenantId: string,
  input: CreateEntityInput<TenantSettings>
): Promise<TenantSettings> => {
  if (dataProvider === "mock") {
    return crud.create(tenantId, input);
  }

  const timestamp = nowIso();
  const row = {
    id: `settings-${tenantId}`,
    tenant_id: tenantId,
    ...input,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const { data, error } = await supabase
    .from("tenant_settings")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return data as TenantSettings;
};

const readOrCreateTenantSettings = async (tenantId: string): Promise<TenantSettings> => {
  const allRows = await crud.getAllByTenant(tenantId);
  const existing = allRows[0] ?? null;
  if (existing) return normalizeTenantSettings(existing);

  const created = await upsertTenantSettings(tenantId, createDefaultSettingsInput());
  return normalizeTenantSettings(created);
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

    const updated = await crud.update(tenantId, current.id, merged);
    if (!updated) {
      const created = await upsertTenantSettings(tenantId, merged);
      return normalizeTenantSettings(created);
    }

    return normalizeTenantSettings(updated);
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
