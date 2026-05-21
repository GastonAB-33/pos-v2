import { useMemo, useState } from "react";
import { LoadingState } from "@/components/ui/UiStates";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useAccountingCatalogs } from "@/modules/configuracion/hooks/useAccountingCatalogs";
import { useConfiguracionModule } from "@/modules/configuracion/hooks/useConfiguracionModule";
import { dataProvider } from "@/services/config/data-provider";
import { useUiStore } from "@/store/ui.store";
import type { AppModule } from "@/types/modules";
import type {
  AppearanceSettings,
  BarcodeScaleMode,
  FacturacionSettings,
  MercadoPagoMode,
  BankAccount,
  TenantSettings,
  TenantSettingsSectionKey,
} from "@/types/entities";

const toNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bankAccountTypeOptions: Array<{
  value: BankAccount["account_type"];
  label: string;
}> = [
  { value: "caja_ahorro", label: "Caja de ahorro" },
  { value: "cuenta_corriente", label: "Cuenta corriente" },
  { value: "billetera_virtual", label: "Billetera virtual" },
  { value: "otro", label: "Otro" },
];

type ConfiguracionModuleScope = "all" | "agenda" | "catalogo" | "analisis" | "sistema" | "contable";

interface ConfiguracionScopePreset {
  title: string;
  description: string;
  permissionModule: AppModule;
  allowSaveAll: boolean;
  visibleSections: {
    negocio: boolean;
    pos: boolean;
    stock: boolean;
    caja: boolean;
    facturacion: boolean;
    contableCatalogos: boolean;
    codigos_balanza: boolean;
    apariencia: boolean;
    sistema: boolean;
  };
}

const configuracionScopePresets: Record<ConfiguracionModuleScope, ConfiguracionScopePreset> = {
  all: {
    title: "Configuracion",
    description: "Parametros centrales del negocio listos para escalar",
    permissionModule: "configuracion",
    allowSaveAll: true,
    visibleSections: {
      negocio: true,
      pos: true,
      stock: true,
      caja: true,
      facturacion: true,
      contableCatalogos: true,
      codigos_balanza: true,
      apariencia: true,
      sistema: true,
    },
  },
  agenda: {
    title: "Configuracion de Agenda",
    description: "Configuraciones relacionadas con agenda y datos base del negocio",
    permissionModule: "configuracion_agenda",
    allowSaveAll: false,
    visibleSections: {
      negocio: true,
      pos: false,
      stock: false,
      caja: false,
      facturacion: false,
      contableCatalogos: false,
      codigos_balanza: false,
      apariencia: false,
      sistema: false,
    },
  },
  catalogo: {
    title: "Configuracion de Catalogo",
    description: "Configuraciones operativas para catalogo, stock y codigos",
    permissionModule: "configuracion_catalogo",
    allowSaveAll: false,
    visibleSections: {
      negocio: false,
      pos: true,
      stock: true,
      caja: false,
      facturacion: false,
      contableCatalogos: false,
      codigos_balanza: true,
      apariencia: false,
      sistema: false,
    },
  },
  analisis: {
    title: "Configuracion de Analisis",
    description: "Configuraciones del modulo de analisis",
    permissionModule: "configuracion_analisis",
    allowSaveAll: false,
    visibleSections: {
      negocio: false,
      pos: false,
      stock: false,
      caja: false,
      facturacion: false,
      contableCatalogos: false,
      codigos_balanza: false,
      apariencia: false,
      sistema: false,
    },
  },
  sistema: {
    title: "Configuracion de Sistema",
    description: "Preferencias de sistema, integraciones y apariencia",
    permissionModule: "configuracion_sistema",
    allowSaveAll: false,
    visibleSections: {
      negocio: false,
      pos: false,
      stock: false,
      caja: false,
      facturacion: false,
      contableCatalogos: false,
      codigos_balanza: false,
      apariencia: true,
      sistema: true,
    },
  },
  contable: {
    title: "Configuracion Contable",
    description: "Configuraciones de caja, facturacion y catalogos contables",
    permissionModule: "configuracion_contable",
    allowSaveAll: false,
    visibleSections: {
      negocio: false,
      pos: false,
      stock: false,
      caja: true,
      facturacion: true,
      contableCatalogos: true,
      codigos_balanza: false,
      apariencia: false,
      sistema: false,
    },
  },
};

interface ConfiguracionPageProps {
  scope?: ConfiguracionModuleScope;
}

export const ConfiguracionPage = ({ scope = "all" }: ConfiguracionPageProps) => {
  const scopePreset = configuracionScopePresets[scope];
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadConfiguracion = canRead(scopePreset.permissionModule);
  const canWriteConfiguracion = canWrite(scopePreset.permissionModule);

  const setTheme = useUiStore((state) => state.setTheme);
  const setAccentColor = useUiStore((state) => state.setAccentColor);
  const setDensity = useUiStore((state) => state.setDensity);

  const {
    draft,
    setDraft,
    customers,
    paymentMethods,
    isLoading,
    isSavingAll,
    savingSection,
    feedback,
    clearFeedback,
    reload,
    saveSection,
    resetSection,
    saveAll,
  } = useConfiguracionModule(tenantId, user?.id ?? null);

  const {
    bankAccounts,
    originBanks,
    installmentPlans,
    isLoading: isAccountingLoading,
    feedback: accountingFeedback,
    clearFeedback: clearAccountingFeedback,
    upsertBankAccount,
    toggleBankAccount,
    upsertOriginBank,
    toggleOriginBank,
    upsertInstallmentPlan,
    toggleInstallmentPlan,
  } = useAccountingCatalogs(tenantId, user?.id ?? null, canReadConfiguracion);

  const [bankAccountForm, setBankAccountForm] = useState({
    bank_name: "",
    account_type: "caja_ahorro" as BankAccount["account_type"],
    holder_name: "",
    cbu: "",
    alias: "",
    currency_code: "ARS",
    notes: "",
    is_active: true,
  });

  const [originBankForm, setOriginBankForm] = useState({
    code: "",
    name: "",
    is_active: true,
  });

  const [installmentPlanForm, setInstallmentPlanForm] = useState({
    code: "",
    name: "",
    installments: 1,
    interest_percent: 0,
    card_brand: "",
    notes: "",
    is_active: true,
  });

  const customerNameById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer.full_name])),
    [customers]
  );

  const updateSection = <TSection extends TenantSettingsSectionKey>(
    section: TSection,
    patch: Partial<TenantSettings[TSection]>
  ) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        [section]: {
          ...current[section],
          ...patch,
        },
      };
    });
  };

  const updateDocumentSequence = (
    key: keyof FacturacionSettings["document_sequences"],
    value: number
  ) => {
    setDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        facturacion: {
          ...current.facturacion,
          document_sequences: {
            ...current.facturacion.document_sequences,
            [key]: value,
          },
        },
      };
    });
  };

  const updateMercadoPagoSettings = (
    patch: Partial<TenantSettings["sistema"]["mercado_pago"]>
  ) => {
    setDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        sistema: {
          ...current.sistema,
          mercado_pago: {
            ...current.sistema.mercado_pago,
            ...patch,
          },
        },
      };
    });
  };

  const applyAppearance = (appearance: AppearanceSettings) => {
    setTheme(appearance.default_theme);
    setAccentColor(appearance.accent_color);
    setDensity(appearance.density);
  };

  const handleSaveSection = async (section: TenantSettingsSectionKey) => {
    if (!draft) return;

    const appearanceBeforeSave = draft.apariencia;
    await saveSection(section);

    if (section === "apariencia") {
      applyAppearance(appearanceBeforeSave);
    }
  };

  const handleSaveAll = async () => {
    if (!draft) return;

    const appearanceBeforeSave = draft.apariencia;
    await saveAll();
    applyAppearance(appearanceBeforeSave);
  };

  const mercadoPagoModeLabel: Record<MercadoPagoMode, string> = {
    mock: "Mock",
    sandbox: "Sandbox",
    real: "Real",
  };

  if (!tenantId) {
    return (
      <PagePlaceholder
        title={scopePreset.title}
        description="No hay tenant activo para operar el modulo"
      />
    );
  }

  if (!canReadConfiguracion) {
    return (
      <PagePlaceholder
        title={scopePreset.title}
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  if (isLoading || !draft) {
    return (
      <PagePlaceholder
        title={scopePreset.title}
        description={scopePreset.description}
      >
        <LoadingState message="Cargando configuracion..." />
      </PagePlaceholder>
    );
  }

  const mercadoPagoConfig = draft.sistema.mercado_pago;
  const hasMercadoPagoCredentials = Boolean(
    mercadoPagoConfig.access_token.trim() && mercadoPagoConfig.public_key.trim()
  );
  const mercadoPagoConfigured =
    mercadoPagoConfig.enabled &&
    (mercadoPagoConfig.mode === "mock" || hasMercadoPagoCredentials) &&
    !mercadoPagoConfig.force_unavailable;
  const hasVisibleSettings = Object.values(scopePreset.visibleSections).some(Boolean);

  return (
    <PagePlaceholder
      title={scopePreset.title}
      description={scopePreset.description}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Tenant settings activos para {draft.negocio.trade_name || "negocio sin nombre"}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="ui-btn-ghost"
              onClick={() => {
                clearFeedback();
                void reload();
              }}
              disabled={isLoading || isSavingAll}
            >
              Recargar
            </button>

            {scopePreset.allowSaveAll ? (
              <button
                type="button"
                className="ui-btn-primary"
                onClick={() => {
                  void handleSaveAll();
                }}
                disabled={!canWriteConfiguracion || isSavingAll}
              >
                {isSavingAll ? "Guardando..." : "Guardar todo"}
              </button>
            ) : null}
          </div>
        </div>

        {feedback ? (
          <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>
            {feedback.message}
          </div>
        ) : null}

        {scopePreset.visibleSections.contableCatalogos && accountingFeedback ? (
          <div
            className={
              accountingFeedback.type === "success" ? "ui-success-state" : "ui-error-state"
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span>{accountingFeedback.message}</span>
              <button
                type="button"
                className="ui-btn-ghost px-2 py-1 text-xs"
                onClick={clearAccountingFeedback}
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : null}

        {!hasVisibleSettings ? (
          <section className="ui-card">
            <p className="text-sm text-slate-600">
              Este modulo todavia no tiene configuraciones disponibles.
            </p>
          </section>
        ) : null}

        <section className="ui-card space-y-3" hidden={!scopePreset.visibleSections.negocio}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Negocio</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="ui-btn-ghost"
                onClick={() => {
                  void resetSection("negocio");
                }}
                disabled={!canWriteConfiguracion || savingSection.negocio}
              >
                Restablecer
              </button>
              <button
                type="button"
                className="ui-btn-primary"
                onClick={() => {
                  void handleSaveSection("negocio");
                }}
                disabled={!canWriteConfiguracion || savingSection.negocio}
              >
                {savingSection.negocio ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input className="ui-input" value={draft.negocio.trade_name} onChange={(event) => updateSection("negocio", { trade_name: event.target.value })} placeholder="Nombre comercial" disabled={!canWriteConfiguracion} />
            <input className="ui-input" value={draft.negocio.legal_name} onChange={(event) => updateSection("negocio", { legal_name: event.target.value })} placeholder="Razon social" disabled={!canWriteConfiguracion} />
            <input className="ui-input" value={draft.negocio.cuit} onChange={(event) => updateSection("negocio", { cuit: event.target.value })} placeholder="CUIT" disabled={!canWriteConfiguracion} />
            <input className="ui-input" value={draft.negocio.address} onChange={(event) => updateSection("negocio", { address: event.target.value })} placeholder="Domicilio" disabled={!canWriteConfiguracion} />
            <input className="ui-input" value={draft.negocio.phone} onChange={(event) => updateSection("negocio", { phone: event.target.value })} placeholder="Telefono" disabled={!canWriteConfiguracion} />
            <input className="ui-input" type="email" value={draft.negocio.email} onChange={(event) => updateSection("negocio", { email: event.target.value })} placeholder="Email" disabled={!canWriteConfiguracion} />
            <input className="ui-input" value={draft.negocio.logo_url ?? ""} onChange={(event) => updateSection("negocio", { logo_url: event.target.value || null })} placeholder="Logo URL (placeholder)" disabled={!canWriteConfiguracion} />
            <input className="ui-input" value={draft.negocio.currency_code} onChange={(event) => updateSection("negocio", { currency_code: event.target.value.toUpperCase() })} placeholder="Moneda" disabled={!canWriteConfiguracion} />
            <input className="ui-input md:col-span-2" value={draft.negocio.timezone} onChange={(event) => updateSection("negocio", { timezone: event.target.value })} placeholder="Zona horaria" disabled={!canWriteConfiguracion} />
          </div>
        </section>

        <section className="ui-card space-y-3" hidden={!scopePreset.visibleSections.pos}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">POS</h2>
            <div className="flex items-center gap-2">
              <button type="button" className="ui-btn-ghost" onClick={() => { void resetSection("pos"); }} disabled={!canWriteConfiguracion || savingSection.pos}>Restablecer</button>
              <button type="button" className="ui-btn-primary" onClick={() => { void handleSaveSection("pos"); }} disabled={!canWriteConfiguracion || savingSection.pos}>{savingSection.pos ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select className="ui-input" value={draft.pos.default_customer_id ?? ""} onChange={(event) => updateSection("pos", { default_customer_id: event.target.value || null })} disabled={!canWriteConfiguracion}>
              <option value="">Sin cliente por defecto</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.full_name}</option>
              ))}
            </select>

            <select className="ui-input" value={draft.pos.default_payment_method_id ?? ""} onChange={(event) => updateSection("pos", { default_payment_method_id: event.target.value || null })} disabled={!canWriteConfiguracion}>
              <option value="">Medio de pago por defecto: automatico</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>{method.name}</option>
              ))}
            </select>

            <select className="ui-input" value={draft.pos.cart_behavior} onChange={(event) => updateSection("pos", { cart_behavior: event.target.value as TenantSettings["pos"]["cart_behavior"] })} disabled={!canWriteConfiguracion}>
              <option value="merge_same_product">Carrito: fusionar items iguales</option>
              <option value="separate_lines">Carrito: lineas separadas</option>
            </select>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.pos.auto_print_receipt} onChange={(event) => updateSection("pos", { auto_print_receipt: event.target.checked })} disabled={!canWriteConfiguracion} />
              Impresion automatica
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.pos.allow_sale_without_customer} onChange={(event) => updateSection("pos", { allow_sale_without_customer: event.target.checked })} disabled={!canWriteConfiguracion} />
              Permitir venta sin cliente
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.pos.allow_negative_stock} onChange={(event) => updateSection("pos", { allow_negative_stock: event.target.checked })} disabled={!canWriteConfiguracion} />
              Permitir stock negativo en venta
            </label>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Cantidad inicial al escanear</label>
              <input
                className="ui-input"
                type="number"
                step="0.001"
                min="0.001"
                value={draft.pos.barcode_scan_quantity}
                onChange={(event) =>
                  updateSection("pos", {
                    barcode_scan_quantity: Math.max(
                      0.001,
                      toNumber(event.target.value, draft.pos.barcode_scan_quantity)
                    ),
                  })
                }
                disabled={!canWriteConfiguracion}
              />
            </div>

            <p className="text-xs text-slate-500 md:col-span-2">
              Cliente por defecto: {draft.pos.default_customer_id ? customerNameById.get(draft.pos.default_customer_id) ?? "Cliente no encontrado" : "No configurado"}
            </p>
            <p className="text-xs text-slate-500 md:col-span-2">
              Medio de pago por defecto: {draft.pos.default_payment_method_id ? paymentMethods.find((method) => method.id === draft.pos.default_payment_method_id)?.name ?? "Medio no encontrado" : "Automatico"}
            </p>
          </div>
        </section>

        <section className="ui-card space-y-3" hidden={!scopePreset.visibleSections.stock}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Stock</h2>
            <div className="flex items-center gap-2">
              <button type="button" className="ui-btn-ghost" onClick={() => { void resetSection("stock"); }} disabled={!canWriteConfiguracion || savingSection.stock}>Restablecer</button>
              <button type="button" className="ui-btn-primary" onClick={() => { void handleSaveSection("stock"); }} disabled={!canWriteConfiguracion || savingSection.stock}>{savingSection.stock ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.stock.use_min_max} onChange={(event) => updateSection("stock", { use_min_max: event.target.checked })} disabled={!canWriteConfiguracion} />
              Usar stock minimo/maximo
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.stock.alerts_active} onChange={(event) => updateSection("stock", { alerts_active: event.target.checked })} disabled={!canWriteConfiguracion} />
              Alertas de stock activas
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.stock.allow_manual_adjustments} onChange={(event) => updateSection("stock", { allow_manual_adjustments: event.target.checked })} disabled={!canWriteConfiguracion} />
              Permitir ajustes manuales
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.stock.allow_negative_stock} onChange={(event) => updateSection("stock", { allow_negative_stock: event.target.checked })} disabled={!canWriteConfiguracion} />
              Permitir stock negativo
            </label>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Umbral global por defecto</label>
              <input
                className="ui-input"
                type="number"
                min="0"
                value={draft.stock.global_low_stock_threshold}
                onChange={(event) =>
                  updateSection("stock", {
                    global_low_stock_threshold: Math.max(
                      0,
                      Math.floor(
                        toNumber(
                          event.target.value,
                          draft.stock.global_low_stock_threshold
                        )
                      )
                    ),
                  })
                }
                disabled={!canWriteConfiguracion}
              />
            </div>
          </div>
        </section>

        <section className="ui-card space-y-3" hidden={!scopePreset.visibleSections.caja}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Caja</h2>
            <div className="flex items-center gap-2">
              <button type="button" className="ui-btn-ghost" onClick={() => { void resetSection("caja"); }} disabled={!canWriteConfiguracion || savingSection.caja}>Restablecer</button>
              <button type="button" className="ui-btn-primary" onClick={() => { void handleSaveSection("caja"); }} disabled={!canWriteConfiguracion || savingSection.caja}>{savingSection.caja ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.caja.require_open_session_for_sale} onChange={(event) => updateSection("caja", { require_open_session_for_sale: event.target.checked })} disabled={!canWriteConfiguracion} />
              Exigir caja abierta para vender
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.caja.allow_manual_movements} onChange={(event) => updateSection("caja", { allow_manual_movements: event.target.checked })} disabled={!canWriteConfiguracion} />
              Permitir ingresos/egresos manuales
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.caja.require_notes_on_manual_movements} onChange={(event) => updateSection("caja", { require_notes_on_manual_movements: event.target.checked })} disabled={!canWriteConfiguracion} />
              Requerir observacion en movimientos manuales
            </label>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Monto inicial por defecto</label>
              <input
                className="ui-input"
                type="number"
                step="0.01"
                min="0"
                value={draft.caja.default_opening_amount}
                onChange={(event) =>
                  updateSection("caja", {
                    default_opening_amount: Math.max(
                      0,
                      toNumber(event.target.value, draft.caja.default_opening_amount)
                    ),
                  })
                }
                disabled={!canWriteConfiguracion}
              />
            </div>
          </div>
        </section>

        <section className="ui-card space-y-3" hidden={!scopePreset.visibleSections.facturacion}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Facturacion</h2>
            <div className="flex items-center gap-2">
              <button type="button" className="ui-btn-ghost" onClick={() => { void resetSection("facturacion"); }} disabled={!canWriteConfiguracion || savingSection.facturacion}>Restablecer</button>
              <button type="button" className="ui-btn-primary" onClick={() => { void handleSaveSection("facturacion"); }} disabled={!canWriteConfiguracion || savingSection.facturacion}>{savingSection.facturacion ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select className="ui-input" value={draft.facturacion.default_document_type} onChange={(event) => updateSection("facturacion", { default_document_type: event.target.value as FacturacionSettings["default_document_type"] })} disabled={!canWriteConfiguracion}>
              <option value="A">Factura A</option>
              <option value="B">Factura B</option>
              <option value="C">Factura C</option>
              <option value="PRESUPUESTO">Presupuesto</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.facturacion.allow_budget_without_customer} onChange={(event) => updateSection("facturacion", { allow_budget_without_customer: event.target.checked })} disabled={!canWriteConfiguracion} />
              Permitir presupuesto sin cliente
            </label>
            <input className="ui-input" value={draft.facturacion.issuer_tax_name} onChange={(event) => updateSection("facturacion", { issuer_tax_name: event.target.value })} placeholder="Razon social emisor" disabled={!canWriteConfiguracion} />
            <input className="ui-input" value={draft.facturacion.issuer_cuit} onChange={(event) => updateSection("facturacion", { issuer_cuit: event.target.value })} placeholder="CUIT emisor" disabled={!canWriteConfiguracion} />
            <input className="ui-input" value={draft.facturacion.issuer_address} onChange={(event) => updateSection("facturacion", { issuer_address: event.target.value })} placeholder="Domicilio fiscal emisor" disabled={!canWriteConfiguracion} />
            <input className="ui-input" value={draft.facturacion.issuer_fiscal_condition} onChange={(event) => updateSection("facturacion", { issuer_fiscal_condition: event.target.value })} placeholder="Condicion fiscal emisor" disabled={!canWriteConfiguracion} />
            <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">ARCA</h3>
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      "ui-badge",
                      draft.facturacion.arca.mode === "mock"
                        ? "ui-badge--info"
                        : draft.facturacion.arca.mode === "sandbox"
                          ? "ui-badge--warn"
                          : "ui-badge--success",
                    ].join(" ")}
                  >
                    {draft.facturacion.arca.mode === "mock"
                      ? "Mock"
                      : draft.facturacion.arca.mode === "sandbox"
                        ? "Sandbox"
                        : "Real"}
                  </span>
                  <span className={draft.facturacion.arca.force_unavailable ? "ui-badge ui-badge--danger" : "ui-badge ui-badge--success"}>
                    {draft.facturacion.arca.force_unavailable ? "No disponible" : "Disponible"}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.facturacion.arca.enabled}
                    onChange={(event) =>
                      updateSection("facturacion", {
                        arca: {
                          ...draft.facturacion.arca,
                          enabled: event.target.checked,
                        },
                      })
                    }
                    disabled={!canWriteConfiguracion}
                  />
                  Habilitar ARCA
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.facturacion.arca.force_unavailable}
                    onChange={(event) =>
                      updateSection("facturacion", {
                        arca: {
                          ...draft.facturacion.arca,
                          force_unavailable: event.target.checked,
                        },
                      })
                    }
                    disabled={!canWriteConfiguracion}
                  />
                  Forzar no disponible
                </label>

                <select
                  className="ui-input"
                  value={draft.facturacion.arca.mode}
                  onChange={(event) =>
                    updateSection("facturacion", {
                      arca: {
                        ...draft.facturacion.arca,
                        mode: event.target.value as FacturacionSettings["arca"]["mode"],
                      },
                    })
                  }
                  disabled={!canWriteConfiguracion}
                >
                  <option value="mock">Modo mock</option>
                  <option value="sandbox">Modo sandbox / homologacion</option>
                  <option value="real">Modo real</option>
                </select>

                <select
                  className="ui-input"
                  value={draft.facturacion.arca.fiscal_environment}
                  onChange={(event) =>
                    updateSection("facturacion", {
                      arca: {
                        ...draft.facturacion.arca,
                        fiscal_environment:
                          event.target.value as FacturacionSettings["arca"]["fiscal_environment"],
                      },
                    })
                  }
                  disabled={!canWriteConfiguracion}
                >
                  <option value="homologacion">Entorno homologacion</option>
                  <option value="produccion">Entorno produccion</option>
                </select>

                <input
                  className="ui-input"
                  value={draft.facturacion.arca.cuit_emisor}
                  onChange={(event) =>
                    updateSection("facturacion", {
                      arca: {
                        ...draft.facturacion.arca,
                        cuit_emisor: event.target.value.trim(),
                      },
                    })
                  }
                  placeholder="CUIT emisor ARCA"
                  disabled={!canWriteConfiguracion}
                />

                <input
                  className="ui-input"
                  type="number"
                  min="1"
                  value={draft.facturacion.arca.punto_venta}
                  onChange={(event) =>
                    updateSection("facturacion", {
                      arca: {
                        ...draft.facturacion.arca,
                        punto_venta: Math.max(
                          1,
                          Math.floor(toNumber(event.target.value, draft.facturacion.arca.punto_venta))
                        ),
                      },
                    })
                  }
                  placeholder="Punto de venta"
                  disabled={!canWriteConfiguracion}
                />

                <input
                  className="ui-input md:col-span-2"
                  value={draft.facturacion.arca.certificado_alias}
                  onChange={(event) =>
                    updateSection("facturacion", {
                      arca: {
                        ...draft.facturacion.arca,
                        certificado_alias: event.target.value.trim(),
                      },
                    })
                  }
                  placeholder="Alias/referencia de certificado"
                  disabled={!canWriteConfiguracion}
                />

                <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={draft.facturacion.arca.allow_internal_fallback}
                    onChange={(event) =>
                      updateSection("facturacion", {
                        arca: {
                          ...draft.facturacion.arca,
                          allow_internal_fallback: event.target.checked,
                        },
                      })
                    }
                    disabled={!canWriteConfiguracion}
                  />
                  Permitir fallback a factura interna cuando ARCA no este disponible
                </label>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                El frontend no ejecuta firma ni certificados reales. Esta configuracion prepara el envio a backend/edge.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Secuencia A</label>
              <input className="ui-input" type="number" min="1" value={draft.facturacion.document_sequences.A} onChange={(event) => updateDocumentSequence("A", Math.max(1, Math.floor(toNumber(event.target.value, draft.facturacion.document_sequences.A))))} disabled={!canWriteConfiguracion} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Secuencia B</label>
              <input className="ui-input" type="number" min="1" value={draft.facturacion.document_sequences.B} onChange={(event) => updateDocumentSequence("B", Math.max(1, Math.floor(toNumber(event.target.value, draft.facturacion.document_sequences.B))))} disabled={!canWriteConfiguracion} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Secuencia C</label>
              <input className="ui-input" type="number" min="1" value={draft.facturacion.document_sequences.C} onChange={(event) => updateDocumentSequence("C", Math.max(1, Math.floor(toNumber(event.target.value, draft.facturacion.document_sequences.C))))} disabled={!canWriteConfiguracion} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Secuencia Presupuesto</label>
              <input className="ui-input" type="number" min="1" value={draft.facturacion.document_sequences.PRESUPUESTO} onChange={(event) => updateDocumentSequence("PRESUPUESTO", Math.max(1, Math.floor(toNumber(event.target.value, draft.facturacion.document_sequences.PRESUPUESTO))))} disabled={!canWriteConfiguracion} />
            </div>
          </div>
        </section>

        <section className="ui-card space-y-3" hidden={!scopePreset.visibleSections.contableCatalogos}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Contable y cobranzas</h2>
              <p className="text-xs text-slate-500">
                Catalogos usados en POS para cuentas destino, transferencias y planes de cuotas.
              </p>
            </div>
            {isAccountingLoading ? <span className="text-xs text-slate-500">Cargando...</span> : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <article className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-900">Cuentas bancarias del comercio</h3>

              <div className="space-y-2">
                <input
                  className="ui-input"
                  value={bankAccountForm.bank_name}
                  onChange={(event) =>
                    setBankAccountForm((current) => ({ ...current, bank_name: event.target.value }))
                  }
                  placeholder="Banco"
                  disabled={!canWriteConfiguracion}
                />
                <select
                  className="ui-input"
                  value={bankAccountForm.account_type}
                  onChange={(event) =>
                    setBankAccountForm((current) => ({
                      ...current,
                      account_type: event.target.value as BankAccount["account_type"],
                    }))
                  }
                  disabled={!canWriteConfiguracion}
                >
                  {bankAccountTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  className="ui-input"
                  value={bankAccountForm.holder_name}
                  onChange={(event) =>
                    setBankAccountForm((current) => ({ ...current, holder_name: event.target.value }))
                  }
                  placeholder="Titular"
                  disabled={!canWriteConfiguracion}
                />
                <input
                  className="ui-input"
                  value={bankAccountForm.cbu}
                  onChange={(event) =>
                    setBankAccountForm((current) => ({ ...current, cbu: event.target.value }))
                  }
                  placeholder="CBU (opcional)"
                  disabled={!canWriteConfiguracion}
                />
                <input
                  className="ui-input"
                  value={bankAccountForm.alias}
                  onChange={(event) =>
                    setBankAccountForm((current) => ({ ...current, alias: event.target.value }))
                  }
                  placeholder="Alias (opcional)"
                  disabled={!canWriteConfiguracion}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="ui-input"
                    value={bankAccountForm.currency_code}
                    onChange={(event) =>
                      setBankAccountForm((current) => ({
                        ...current,
                        currency_code: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="Moneda"
                    disabled={!canWriteConfiguracion}
                  />
                  <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={bankAccountForm.is_active}
                      onChange={(event) =>
                        setBankAccountForm((current) => ({ ...current, is_active: event.target.checked }))
                      }
                      disabled={!canWriteConfiguracion}
                    />
                    Activa
                  </label>
                </div>
                <button
                  type="button"
                  className="ui-btn-primary w-full"
                  disabled={!canWriteConfiguracion}
                  onClick={() => {
                    void upsertBankAccount({
                      ...bankAccountForm,
                      cbu: bankAccountForm.cbu || null,
                      alias: bankAccountForm.alias || null,
                      notes: bankAccountForm.notes || null,
                    }).then((saved) => {
                      if (!saved) return;
                      setBankAccountForm({
                        bank_name: "",
                        account_type: "caja_ahorro",
                        holder_name: "",
                        cbu: "",
                        alias: "",
                        currency_code: "ARS",
                        notes: "",
                        is_active: true,
                      });
                    });
                  }}
                >
                  Agregar cuenta
                </button>
              </div>

              <div className="max-h-56 space-y-2 overflow-auto pr-1">
                {bankAccounts.map((account) => (
                  <div key={account.id} className="rounded-lg bg-white p-2">
                    <p className="text-sm font-medium text-slate-900">{account.bank_name}</p>
                    <p className="text-xs text-slate-500">
                      {account.holder_name} | {account.currency_code}
                    </p>
                    <p className="text-xs text-slate-500">
                      {account.alias || "Sin alias"} | {account.cbu || "Sin CBU"}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span
                        className={
                          account.is_active ? "ui-badge ui-badge--success" : "ui-badge ui-badge--warn"
                        }
                      >
                        {account.is_active ? "Activa" : "Inactiva"}
                      </span>
                      <button
                        type="button"
                        className="ui-btn-ghost px-2 py-1 text-xs"
                        onClick={() => {
                          void toggleBankAccount(account.id);
                        }}
                        disabled={!canWriteConfiguracion}
                      >
                        {account.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-900">Bancos de origen</h3>

              <div className="space-y-2">
                <input
                  className="ui-input"
                  value={originBankForm.name}
                  onChange={(event) =>
                    setOriginBankForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Nombre de banco"
                  disabled={!canWriteConfiguracion}
                />
                <input
                  className="ui-input"
                  value={originBankForm.code}
                  onChange={(event) =>
                    setOriginBankForm((current) => ({ ...current, code: event.target.value }))
                  }
                  placeholder="Codigo (opcional)"
                  disabled={!canWriteConfiguracion}
                />
                <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={originBankForm.is_active}
                    onChange={(event) =>
                      setOriginBankForm((current) => ({ ...current, is_active: event.target.checked }))
                    }
                    disabled={!canWriteConfiguracion}
                  />
                  Activo
                </label>
                <button
                  type="button"
                  className="ui-btn-primary w-full"
                  disabled={!canWriteConfiguracion}
                  onClick={() => {
                    void upsertOriginBank(originBankForm).then((saved) => {
                      if (!saved) return;
                      setOriginBankForm({
                        code: "",
                        name: "",
                        is_active: true,
                      });
                    });
                  }}
                >
                  Agregar banco
                </button>
              </div>

              <div className="max-h-56 space-y-2 overflow-auto pr-1">
                {originBanks.map((bank) => (
                  <div key={bank.id} className="rounded-lg bg-white p-2">
                    <p className="text-sm font-medium text-slate-900">{bank.name}</p>
                    <p className="text-xs text-slate-500">{bank.code}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span
                        className={bank.is_active ? "ui-badge ui-badge--success" : "ui-badge ui-badge--warn"}
                      >
                        {bank.is_active ? "Activo" : "Inactivo"}
                      </span>
                      <button
                        type="button"
                        className="ui-btn-ghost px-2 py-1 text-xs"
                        onClick={() => {
                          void toggleOriginBank(bank.id);
                        }}
                        disabled={!canWriteConfiguracion}
                      >
                        {bank.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-900">Planes de cuotas</h3>

              <div className="space-y-2">
                <input
                  className="ui-input"
                  value={installmentPlanForm.name}
                  onChange={(event) =>
                    setInstallmentPlanForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Nombre del plan"
                  disabled={!canWriteConfiguracion}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="ui-input"
                    type="number"
                    min="1"
                    value={installmentPlanForm.installments}
                    onChange={(event) =>
                      setInstallmentPlanForm((current) => ({
                        ...current,
                        installments: Math.max(1, Math.floor(toNumber(event.target.value, 1))),
                      }))
                    }
                    placeholder="Cuotas"
                    disabled={!canWriteConfiguracion}
                  />
                  <input
                    className="ui-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={installmentPlanForm.interest_percent}
                    onChange={(event) =>
                      setInstallmentPlanForm((current) => ({
                        ...current,
                        interest_percent: Math.max(0, toNumber(event.target.value, 0)),
                      }))
                    }
                    placeholder="Interes %"
                    disabled={!canWriteConfiguracion}
                  />
                </div>
                <input
                  className="ui-input"
                  value={installmentPlanForm.card_brand}
                  onChange={(event) =>
                    setInstallmentPlanForm((current) => ({ ...current, card_brand: event.target.value }))
                  }
                  placeholder="Marca de tarjeta (opcional)"
                  disabled={!canWriteConfiguracion}
                />
                <input
                  className="ui-input"
                  value={installmentPlanForm.code}
                  onChange={(event) =>
                    setInstallmentPlanForm((current) => ({ ...current, code: event.target.value }))
                  }
                  placeholder="Codigo (opcional)"
                  disabled={!canWriteConfiguracion}
                />
                <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={installmentPlanForm.is_active}
                    onChange={(event) =>
                      setInstallmentPlanForm((current) => ({ ...current, is_active: event.target.checked }))
                    }
                    disabled={!canWriteConfiguracion}
                  />
                  Activo
                </label>
                <button
                  type="button"
                  className="ui-btn-primary w-full"
                  disabled={!canWriteConfiguracion}
                  onClick={() => {
                    void upsertInstallmentPlan({
                      ...installmentPlanForm,
                      code:
                        installmentPlanForm.code ||
                        `plan_${installmentPlanForm.installments}_${Math.round(installmentPlanForm.interest_percent)}`,
                      card_brand: installmentPlanForm.card_brand || null,
                      notes: installmentPlanForm.notes || null,
                    }).then((saved) => {
                      if (!saved) return;
                      setInstallmentPlanForm({
                        code: "",
                        name: "",
                        installments: 1,
                        interest_percent: 0,
                        card_brand: "",
                        notes: "",
                        is_active: true,
                      });
                    });
                  }}
                >
                  Agregar plan
                </button>
              </div>

              <div className="max-h-56 space-y-2 overflow-auto pr-1">
                {installmentPlans.map((plan) => (
                  <div key={plan.id} className="rounded-lg bg-white p-2">
                    <p className="text-sm font-medium text-slate-900">{plan.name}</p>
                    <p className="text-xs text-slate-500">
                      {plan.installments} cuotas | {plan.interest_percent.toFixed(2)}%
                    </p>
                    <p className="text-xs text-slate-500">
                      {plan.card_brand ? `Tarjeta: ${plan.card_brand}` : "Todas las tarjetas"}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span
                        className={plan.is_active ? "ui-badge ui-badge--success" : "ui-badge ui-badge--warn"}
                      >
                        {plan.is_active ? "Activo" : "Inactivo"}
                      </span>
                      <button
                        type="button"
                        className="ui-btn-ghost px-2 py-1 text-xs"
                        onClick={() => {
                          void toggleInstallmentPlan(plan.id);
                        }}
                        disabled={!canWriteConfiguracion}
                      >
                        {plan.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="ui-card space-y-3" hidden={!scopePreset.visibleSections.codigos_balanza}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Codigos de barras y balanza</h2>
            <div className="flex items-center gap-2">
              <button type="button" className="ui-btn-ghost" onClick={() => { void resetSection("codigos_balanza"); }} disabled={!canWriteConfiguracion || savingSection.codigos_balanza}>Restablecer</button>
              <button type="button" className="ui-btn-primary" onClick={() => { void handleSaveSection("codigos_balanza"); }} disabled={!canWriteConfiguracion || savingSection.codigos_balanza}>{savingSection.codigos_balanza ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.codigos_balanza.scale_parser_enabled} onChange={(event) => updateSection("codigos_balanza", { scale_parser_enabled: event.target.checked })} disabled={!canWriteConfiguracion} />
              Activar parser de balanza
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.codigos_balanza.ean13_enabled} onChange={(event) => updateSection("codigos_balanza", { ean13_enabled: event.target.checked })} disabled={!canWriteConfiguracion} />
              Compatibilidad EAN13
            </label>
            <select className="ui-input" value={draft.codigos_balanza.scale_mode} onChange={(event) => updateSection("codigos_balanza", { scale_mode: event.target.value as BarcodeScaleMode })} disabled={!canWriteConfiguracion}>
              <option value="total_price">Codigo con importe total</option>
              <option value="weight">Codigo con peso</option>
            </select>
            <input className="ui-input" value={draft.codigos_balanza.scale_prefix} onChange={(event) => updateSection("codigos_balanza", { scale_prefix: event.target.value })} placeholder="Prefijo de balanza" disabled={!canWriteConfiguracion} />
            <input className="ui-input" type="number" min="8" max="18" value={draft.codigos_balanza.code_length} onChange={(event) => updateSection("codigos_balanza", { code_length: Math.max(8, Math.floor(toNumber(event.target.value, draft.codigos_balanza.code_length))) })} placeholder="Longitud total" disabled={!canWriteConfiguracion} />
            <input className="ui-input" type="number" min="1" value={draft.codigos_balanza.plu_start} onChange={(event) => updateSection("codigos_balanza", { plu_start: Math.max(1, Math.floor(toNumber(event.target.value, draft.codigos_balanza.plu_start))) })} placeholder="Inicio PLU" disabled={!canWriteConfiguracion} />
            <input className="ui-input" type="number" min="1" value={draft.codigos_balanza.plu_length} onChange={(event) => updateSection("codigos_balanza", { plu_length: Math.max(1, Math.floor(toNumber(event.target.value, draft.codigos_balanza.plu_length))) })} placeholder="Largo PLU" disabled={!canWriteConfiguracion} />
            <input className="ui-input" type="number" min="1" value={draft.codigos_balanza.weight_start} onChange={(event) => updateSection("codigos_balanza", { weight_start: Math.max(1, Math.floor(toNumber(event.target.value, draft.codigos_balanza.weight_start))) })} placeholder="Inicio peso" disabled={!canWriteConfiguracion} />
            <input className="ui-input" type="number" min="1" value={draft.codigos_balanza.weight_length} onChange={(event) => updateSection("codigos_balanza", { weight_length: Math.max(1, Math.floor(toNumber(event.target.value, draft.codigos_balanza.weight_length))) })} placeholder="Largo peso" disabled={!canWriteConfiguracion} />
            <input className="ui-input" type="number" min="0" max="4" value={draft.codigos_balanza.weight_decimals} onChange={(event) => updateSection("codigos_balanza", { weight_decimals: Math.max(0, Math.floor(toNumber(event.target.value, draft.codigos_balanza.weight_decimals))) })} placeholder="Decimales peso" disabled={!canWriteConfiguracion} />
            <input className="ui-input" type="number" min="1" value={draft.codigos_balanza.amount_start} onChange={(event) => updateSection("codigos_balanza", { amount_start: Math.max(1, Math.floor(toNumber(event.target.value, draft.codigos_balanza.amount_start))) })} placeholder="Inicio importe" disabled={!canWriteConfiguracion} />
            <input className="ui-input" type="number" min="1" value={draft.codigos_balanza.amount_length} onChange={(event) => updateSection("codigos_balanza", { amount_length: Math.max(1, Math.floor(toNumber(event.target.value, draft.codigos_balanza.amount_length))) })} placeholder="Largo importe" disabled={!canWriteConfiguracion} />
            <input className="ui-input" type="number" min="0" max="4" value={draft.codigos_balanza.amount_decimals} onChange={(event) => updateSection("codigos_balanza", { amount_decimals: Math.max(0, Math.floor(toNumber(event.target.value, draft.codigos_balanza.amount_decimals))) })} placeholder="Decimales importe" disabled={!canWriteConfiguracion} />
          </div>
        </section>

        <section className="ui-card space-y-3" hidden={!scopePreset.visibleSections.apariencia}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Apariencia</h2>
            <div className="flex items-center gap-2">
              <button type="button" className="ui-btn-ghost" onClick={() => { void resetSection("apariencia"); }} disabled={!canWriteConfiguracion || savingSection.apariencia}>Restablecer</button>
              <button type="button" className="ui-btn-primary" onClick={() => { void handleSaveSection("apariencia"); }} disabled={!canWriteConfiguracion || savingSection.apariencia}>{savingSection.apariencia ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select className="ui-input" value={draft.apariencia.default_theme} onChange={(event) => updateSection("apariencia", { default_theme: event.target.value as AppearanceSettings["default_theme"] })} disabled={!canWriteConfiguracion}>
              <option value="light">Modo claro</option>
              <option value="dark">Modo oscuro</option>
            </select>
            <select className="ui-input" value={draft.apariencia.density} onChange={(event) => updateSection("apariencia", { density: event.target.value as AppearanceSettings["density"] })} disabled={!canWriteConfiguracion}>
              <option value="standard">Vista estandar</option>
              <option value="compact">Vista compacta</option>
            </select>
            <input className="ui-input" type="color" value={draft.apariencia.accent_color} onChange={(event) => updateSection("apariencia", { accent_color: event.target.value })} disabled={!canWriteConfiguracion} />
            <input className="ui-input" value={draft.apariencia.display_name} onChange={(event) => updateSection("apariencia", { display_name: event.target.value })} placeholder="Nombre visible" disabled={!canWriteConfiguracion} />
          </div>

          <button
            type="button"
            className="ui-btn-ghost"
            disabled={!canWriteConfiguracion}
            onClick={() => applyAppearance(draft.apariencia)}
          >
            Aplicar vista previa
          </button>
        </section>

        <section className="ui-card space-y-3" hidden={!scopePreset.visibleSections.sistema}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Sistema</h2>
            <div className="flex items-center gap-2">
              <button type="button" className="ui-btn-ghost" onClick={() => { void resetSection("sistema"); }} disabled={!canWriteConfiguracion || savingSection.sistema}>Restablecer</button>
              <button type="button" className="ui-btn-primary" onClick={() => { void handleSaveSection("sistema"); }} disabled={!canWriteConfiguracion || savingSection.sistema}>{savingSection.sistema ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="ui-input">
              Proveedor de datos actual: <strong>{draft.sistema.data_provider}</strong>
            </div>
            <div className="ui-input">
              Version visible: <strong>{draft.sistema.version}</strong>
            </div>

            {dataProvider === "mock" ? (
              <>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={draft.sistema.show_dev_flags} onChange={(event) => updateSection("sistema", { show_dev_flags: event.target.checked })} disabled={!canWriteConfiguracion} />
                  Mostrar flags mock/dev
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={draft.sistema.enable_mock_auth_bypass} onChange={(event) => updateSection("sistema", { enable_mock_auth_bypass: event.target.checked })} disabled={!canWriteConfiguracion} />
                  Habilitar bypass mock visible
                </label>
              </>
            ) : (
              <p className="text-sm text-slate-500 md:col-span-2">
                Flags de desarrollo ocultos porque el proveedor activo no es mock.
              </p>
            )}

            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input type="checkbox" checked={draft.sistema.allow_placeholder_export_import} onChange={(event) => updateSection("sistema", { allow_placeholder_export_import: event.target.checked })} disabled={!canWriteConfiguracion} />
              Habilitar placeholder de export/import
            </label>

            <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Mercado Pago</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      "ui-badge",
                      mercadoPagoConfig.mode === "mock"
                        ? "ui-badge--info"
                        : mercadoPagoConfig.mode === "sandbox"
                          ? "ui-badge--warn"
                          : "ui-badge--success",
                    ].join(" ")}
                  >
                    {mercadoPagoModeLabel[mercadoPagoConfig.mode]}
                  </span>
                  <span className={mercadoPagoConfigured ? "ui-badge ui-badge--success" : "ui-badge ui-badge--danger"}>
                    {mercadoPagoConfigured ? "Disponible" : "No configurado"}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={mercadoPagoConfig.enabled}
                    onChange={(event) => updateMercadoPagoSettings({ enabled: event.target.checked })}
                    disabled={!canWriteConfiguracion}
                  />
                  Habilitar Mercado Pago
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={mercadoPagoConfig.force_unavailable}
                    onChange={(event) =>
                      updateMercadoPagoSettings({ force_unavailable: event.target.checked })
                    }
                    disabled={!canWriteConfiguracion}
                  />
                  Marcar como no disponible
                </label>

                <select
                  className="ui-input"
                  value={mercadoPagoConfig.mode}
                  onChange={(event) =>
                    updateMercadoPagoSettings({
                      mode: event.target.value as MercadoPagoMode,
                    })
                  }
                  disabled={!canWriteConfiguracion}
                >
                  <option value="mock">Modo mock</option>
                  <option value="sandbox">Modo sandbox</option>
                  <option value="real">Modo real</option>
                </select>

                <input
                  className="ui-input"
                  type="password"
                  value={mercadoPagoConfig.access_token}
                  onChange={(event) =>
                    updateMercadoPagoSettings({ access_token: event.target.value.trim() })
                  }
                  placeholder="Access token (usar backend en produccion)"
                  disabled={!canWriteConfiguracion}
                />

                <input
                  className="ui-input md:col-span-2"
                  value={mercadoPagoConfig.public_key}
                  onChange={(event) =>
                    updateMercadoPagoSettings({ public_key: event.target.value.trim() })
                  }
                  placeholder="Public key"
                  disabled={!canWriteConfiguracion}
                />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                En modo sandbox/real, el frontend no debe enviar credenciales directo a Mercado Pago.
                Esta configuracion deja el sistema preparado para backend/edge functions.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PagePlaceholder>
  );
};
