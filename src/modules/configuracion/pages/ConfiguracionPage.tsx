import { useMemo, useState } from "react";
import { LoadingState } from "@/components/ui/UiStates";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { IconButton } from "@/components/ui/IconButton";
import {
  Building2,
  CheckCircle2,
  FileText,
  Package,
  Palette,
  RefreshCw,
  Scale,
  Settings,
  ShoppingCart,
  Sparkles,
  Store,
  Type,
  Wallet,
} from "lucide-react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useAccountingCatalogs } from "@/modules/configuracion/hooks/useAccountingCatalogs";
import { useConfiguracionModule } from "@/modules/configuracion/hooks/useConfiguracionModule";
import { useUiStore, type UiFontSize } from "@/store/ui.store";
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
    title: "Configuración del Sistema",
    description: "Parámetros centrales del negocio, apariencia, accesibilidad e integraciones",
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
    title: "Configuración de Agenda",
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
    title: "Configuración de Catálogo",
    description: "Configuraciones operativas para catálogo, stock y códigos",
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
    title: "Configuración de Análisis",
    description: "Configuraciones del módulo de análisis",
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
    title: "Configuración de Sistema",
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
    title: "Configuración Contable",
    description: "Configuraciones de caja, facturación y catálogos contables",
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

type ConfigTabKey =
  | "negocio"
  | "pos"
  | "apariencia"
  | "caja"
  | "stock"
  | "facturacion"
  | "contableCatalogos"
  | "codigos_balanza"
  | "sistema";

interface ConfigTabDefinition {
  id: ConfigTabKey;
  label: string;
  icon: typeof Store;
  badge?: string;
  description: string;
}

const configTabs: ConfigTabDefinition[] = [
  { id: "negocio", label: "Negocio", icon: Store, description: "Datos comerciales y de contacto" },
  { id: "pos", label: "Punto de Venta", icon: ShoppingCart, description: "Comportamiento de caja y scanner" },
  { id: "apariencia", label: "Apariencia y Letra", icon: Palette, badge: "Accesibilidad", description: "Tema y tamaño de letra/interfaz" },
  { id: "caja", label: "Caja y Tesorería", icon: Wallet, description: "Sesiones y movimientos iniciales" },
  { id: "stock", label: "Stock e Inventario", icon: Package, description: "Alertas y umbrales de stock" },
  { id: "facturacion", label: "Facturación & ARCA", icon: FileText, description: "Emisión fiscal y comprobantes" },
  { id: "contableCatalogos", label: "Bancos y Cobros", icon: Building2, description: "Cuentas bancarias y planes de cuotas" },
  { id: "codigos_balanza", label: "Balanza & Códigos", icon: Scale, description: "Formatos PLU y códigos de peso/monto" },
  { id: "sistema", label: "Integraciones & Sistema", icon: Settings, description: "MercadoPago y parámetros avanzados" },
];

const fontSizeOptions: Array<{
  id: UiFontSize;
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
  pixelSize: string;
}> = [
  {
    id: "compact",
    label: "Compacto",
    shortLabel: "A-",
    badge: "14px (87.5%)",
    description: "Para pantallas pequeñas o ver mayor densidad de datos.",
    pixelSize: "14px",
  },
  {
    id: "normal",
    label: "Normal",
    shortLabel: "A",
    badge: "16px (100%)",
    description: "Tamaño estándar predeterminado del sistema.",
    pixelSize: "16px",
  },
  {
    id: "large",
    label: "Grande (Recomendado)",
    shortLabel: "A+",
    badge: "18px (112.5%)",
    description: "Excelente para pantallas de caja POS y fácil lectura.",
    pixelSize: "18px",
  },
  {
    id: "extra-large",
    label: "Muy Grande",
    shortLabel: "A++",
    badge: "20px (125%)",
    description: "Máxima visibilidad a distancia y prevención de fatiga visual.",
    pixelSize: "20px",
  },
];

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
  const fontSize = useUiStore((state) => state.fontSize);
  const setFontSize = useUiStore((state) => state.setFontSize);

  const [activeTab, setActiveTab] = useState<ConfigTabKey>(() => {
    if (scopePreset.visibleSections.apariencia && scope === "sistema") return "apariencia";
    if (scopePreset.visibleSections.negocio) return "negocio";
    const firstVisible = configTabs.find((tab) => scopePreset.visibleSections[tab.id]);
    return firstVisible ? firstVisible.id : "negocio";
  });

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

  const visibleTabs = useMemo(
    () => configTabs.filter((tab) => scopePreset.visibleSections[tab.id]),
    [scopePreset]
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
    if (appearance.font_size) {
      setFontSize(appearance.font_size);
    }
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
        description="No hay un comercio activo"
      />
    );
  }

  if (!canReadConfiguracion) {
    return (
      <PagePlaceholder
        title={scopePreset.title}
        description="No tenés permisos de lectura para este módulo"
      />
    );
  }

  if (isLoading) {
    return (
      <PagePlaceholder
        title={scopePreset.title}
        description={scopePreset.description}
      >
        <LoadingState message="Cargando configuración del sistema..." />
      </PagePlaceholder>
    );
  }

  if (!draft) {
    return (
      <PagePlaceholder
        title={scopePreset.title}
        description={scopePreset.description}
      >
        <div className="ui-card space-y-4 text-center py-10">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No se pudo obtener la configuración del comercio actual.
          </p>
          <button
            type="button"
            className="ui-btn-primary mx-auto gap-2"
            onClick={() => void reload()}
          >
            <RefreshCw size={16} />
            <span>Reintentar carga</span>
          </button>
        </div>
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

  const selectedFontSizeObj =
    fontSizeOptions.find((opt) => opt.id === (draft.apariencia.font_size ?? fontSize)) ??
    fontSizeOptions[1];

  return (
    <PagePlaceholder title={scopePreset.title} description={scopePreset.description}>
      <div className="space-y-6">
        {/* Encabezado Principal y Acciones */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Store size={22} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {draft.negocio.trade_name || "Configuración del comercio"}
              </h1>
              <p className="text-xs text-slate-500">
                {draft.negocio.cuit ? `CUIT: ${draft.negocio.cuit} · ` : ""}
                {draft.negocio.email || "Configuración general"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IconButton
              icon={RefreshCw}
              label="Recargar"
              onClick={() => {
                clearFeedback();
                void reload();
              }}
              loading={isLoading}
              disabled={isSavingAll}
            />

            {scopePreset.allowSaveAll ? (
              <button
                type="button"
                className="ui-btn-primary gap-2"
                onClick={() => {
                  void handleSaveAll();
                }}
                disabled={!canWriteConfiguracion || isSavingAll}
              >
                <CheckCircle2 size={16} />
                <span>{isSavingAll ? "Guardando todo..." : "Guardar todo"}</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Notificaciones y Feedbacks */}
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
              Este módulo todavía no tiene configuraciones disponibles.
            </p>
          </section>
        ) : null}

        {/* Navegación por Pestañas / Menú Horizontal de Categorías */}
        {visibleTabs.length > 1 ? (
          <nav aria-label="Categorías de configuración" className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
            {visibleTabs.map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                    isActive
                      ? "bg-blue-600 text-white shadow-sm dark:bg-blue-600"
                      : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                  ].join(" ")}
                >
                  <IconComp size={16} />
                  <span>{tab.label}</span>
                  {tab.badge ? (
                    <span
                      className={[
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        isActive ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                      ].join(" ")}
                    >
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        ) : null}

        {/* SECCIÓN: NEGOCIO */}
        <section
          className="ui-card space-y-4"
          hidden={!scopePreset.visibleSections.negocio || (visibleTabs.length > 1 && activeTab !== "negocio")}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Store className="text-blue-600 dark:text-blue-400" size={20} />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Datos del Negocio</h2>
                <p className="text-xs text-slate-500">Información comercial, razón social y datos de contacto de tu comercio</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="ui-btn-ghost"
                onClick={() => { void resetSection("negocio"); }}
                disabled={!canWriteConfiguracion || savingSection.negocio}
              >
                Restablecer
              </button>
              <button
                type="button"
                className="ui-btn-primary"
                onClick={() => { void handleSaveSection("negocio"); }}
                disabled={!canWriteConfiguracion || savingSection.negocio}
              >
                {savingSection.negocio ? "Guardando..." : "Guardar Negocio"}
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Nombre Comercial</label>
              <input className="ui-input" value={draft.negocio.trade_name} onChange={(event) => updateSection("negocio", { trade_name: event.target.value })} placeholder="Ej: Mi Almacén POS" disabled={!canWriteConfiguracion} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Razón Social</label>
              <input className="ui-input" value={draft.negocio.legal_name} onChange={(event) => updateSection("negocio", { legal_name: event.target.value })} placeholder="Ej: Comercio S.R.L." disabled={!canWriteConfiguracion} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">CUIT</label>
              <input className="ui-input" value={draft.negocio.cuit} onChange={(event) => updateSection("negocio", { cuit: event.target.value })} placeholder="20-12345678-9" disabled={!canWriteConfiguracion} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Domicilio Comercial</label>
              <input className="ui-input" value={draft.negocio.address} onChange={(event) => updateSection("negocio", { address: event.target.value })} placeholder="Av. Principal 1234" disabled={!canWriteConfiguracion} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Teléfono / WhatsApp</label>
              <input className="ui-input" value={draft.negocio.phone} onChange={(event) => updateSection("negocio", { phone: event.target.value })} placeholder="Ej: +54 9 11 1234-5678" disabled={!canWriteConfiguracion} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Email de Contacto</label>
              <input className="ui-input" type="email" value={draft.negocio.email} onChange={(event) => updateSection("negocio", { email: event.target.value })} placeholder="contacto@comercio.com" disabled={!canWriteConfiguracion} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Moneda del Sistema</label>
              <input className="ui-input" value={draft.negocio.currency_code} onChange={(event) => updateSection("negocio", { currency_code: event.target.value.toUpperCase() })} placeholder="ARS" disabled={!canWriteConfiguracion} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Zona Horaria</label>
              <input className="ui-input" value={draft.negocio.timezone} onChange={(event) => updateSection("negocio", { timezone: event.target.value })} placeholder="America/Argentina/Buenos_Aires" disabled={!canWriteConfiguracion} />
            </div>
          </div>
        </section>

        {/* SECCIÓN: PUNTO DE VENTA (POS) */}
        <section
          className="ui-card space-y-4"
          hidden={!scopePreset.visibleSections.pos || (visibleTabs.length > 1 && activeTab !== "pos")}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-blue-600 dark:text-blue-400" size={20} />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Punto de Venta (POS)</h2>
                <p className="text-xs text-slate-500">Parámetros operativos de cobro, impresión y comportamiento de la caja</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" className="ui-btn-ghost" onClick={() => { void resetSection("pos"); }} disabled={!canWriteConfiguracion || savingSection.pos}>Restablecer</button>
              <button type="button" className="ui-btn-primary" onClick={() => { void handleSaveSection("pos"); }} disabled={!canWriteConfiguracion || savingSection.pos}>{savingSection.pos ? "Guardando..." : "Guardar POS"}</button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Cliente por defecto al iniciar cobro</label>
              <select className="ui-input" value={draft.pos.default_customer_id ?? ""} onChange={(event) => updateSection("pos", { default_customer_id: event.target.value || null })} disabled={!canWriteConfiguracion}>
                <option value="">Consumidor Final (Sin cliente grabado)</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.full_name}</option>
                ))}
              </select>
              {draft.pos.default_customer_id ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  Seleccionado: {customerNameById.get(draft.pos.default_customer_id) ?? "Cliente no encontrado"}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Medio de pago por defecto</label>
              <select className="ui-input" value={draft.pos.default_payment_method_id ?? ""} onChange={(event) => updateSection("pos", { default_payment_method_id: event.target.value || null })} disabled={!canWriteConfiguracion}>
                <option value="">Efectivo / Selección automática</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>{method.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Agrupación de ítems en el carrito</label>
              <select className="ui-input" value={draft.pos.cart_behavior} onChange={(event) => updateSection("pos", { cart_behavior: event.target.value as TenantSettings["pos"]["cart_behavior"] })} disabled={!canWriteConfiguracion}>
                <option value="merge_same_product">Sumar cantidad al escanear mismo producto</option>
                <option value="separate_lines">Agregar cada escaneo en una nueva línea</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Cantidad inicial al escanear código</label>
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

            <div className="md:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Reglas de Operación</span>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input type="checkbox" className="h-4 w-4 rounded text-blue-600" checked={draft.pos.auto_print_receipt} onChange={(event) => updateSection("pos", { auto_print_receipt: event.target.checked })} disabled={!canWriteConfiguracion} />
                  <span>Impresión automática de ticket</span>
                </label>

                <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input type="checkbox" className="h-4 w-4 rounded text-blue-600" checked={draft.pos.allow_sale_without_customer} onChange={(event) => updateSection("pos", { allow_sale_without_customer: event.target.checked })} disabled={!canWriteConfiguracion} />
                  <span>Permitir venta sin seleccionar cliente</span>
                </label>

                <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input type="checkbox" className="h-4 w-4 rounded text-blue-600" checked={draft.pos.allow_negative_stock} onChange={(event) => updateSection("pos", { allow_negative_stock: event.target.checked })} disabled={!canWriteConfiguracion} />
                  <span>Permitir venta sin stock disponible</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN: APARIENCIA Y ACCESIBILIDAD (NUEVO DISEÑO CON TAMAÑO DE LETRA) */}
        <section
          className="ui-card space-y-6"
          hidden={!scopePreset.visibleSections.apariencia || (visibleTabs.length > 1 && activeTab !== "apariencia")}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Palette className="text-blue-600 dark:text-blue-400" size={20} />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Apariencia, Tema y Accesibilidad Visual
                </h2>
                <p className="text-xs text-slate-500">
                  Personalizá el tamaño de las letras, zoom de pantalla y colores para que tus cajeros operen con total comodidad
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="ui-btn-ghost"
                onClick={() => { void resetSection("apariencia"); }}
                disabled={!canWriteConfiguracion || savingSection.apariencia}
              >
                Restablecer
              </button>
              <button
                type="button"
                className="ui-btn-primary"
                onClick={() => { void handleSaveSection("apariencia"); }}
                disabled={!canWriteConfiguracion || savingSection.apariencia}
              >
                {savingSection.apariencia ? "Guardando..." : "Guardar Apariencia"}
              </button>
            </div>
          </div>

          {/* TARJETA DESTACADA: TAMAÑO DE FUENTE E INTERFAZ (ACCESIBILIDAD) */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Type className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Tamaño de Letras e Interfaz (Escala de Pantalla)
                </h3>
              </div>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                Escala actual: {selectedFontSizeObj.label}
              </span>
            </div>

            <p className="mb-4 text-xs text-slate-600 dark:text-slate-400">
              Seleccioná el tamaño en el que querés ver las pantallas del sistema. Al cambiarlo, todos los números, botones, totales de caja y listas de productos se reescalan automáticamente.
            </p>

            {/* Selector de Opciones de Tamaño */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
              {fontSizeOptions.map((option) => {
                const isSelected = (draft.apariencia.font_size ?? fontSize) === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      updateSection("apariencia", { font_size: option.id });
                      setFontSize(option.id);
                    }}
                    disabled={!canWriteConfiguracion}
                    className={[
                      "flex flex-col justify-between rounded-xl border p-4 text-left transition-all",
                      isSelected
                        ? "border-blue-600 bg-white ring-2 ring-blue-500/30 dark:bg-slate-900 dark:border-blue-500"
                        : "border-slate-200 bg-white/70 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700",
                    ].join(" ")}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          {option.shortLabel}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {option.badge}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                        {option.label}
                      </p>
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {option.description}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                      <span className="text-[11px] text-slate-400">Base {option.pixelSize}</span>
                      {isSelected ? (
                        <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* VISTA PREVIA EN TIEMPO REAL */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  Vista Previa Interactiva de Cobro POS
                </span>
                <span className="text-xs text-slate-400">Escala activa: {selectedFontSizeObj.pixelSize}</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">Producto de prueba</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Coca-Cola 2.25L Retornable
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="ui-badge ui-badge--success">Stock: 48 u.</span>
                    <span className="text-xs text-slate-500">Código: 7791234567890</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs text-slate-500">Total a cobrar</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    $2.450,00
                  </p>
                  <button type="button" className="ui-btn-primary mt-1 text-xs py-1 px-3">
                    Cobrar ($2.450)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* TEMA Y OTROS PARÁMETROS DE APARIENCIA */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Tema Predeterminado</label>
              <select className="ui-input" value={draft.apariencia.default_theme} onChange={(event) => updateSection("apariencia", { default_theme: event.target.value as AppearanceSettings["default_theme"] })} disabled={!canWriteConfiguracion}>
                <option value="light">Modo Claro (Recomendado para día)</option>
                <option value="dark">Modo Oscuro (Recomendado para noche)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Densidad de Filas y Tablas</label>
              <select className="ui-input" value={draft.apariencia.density} onChange={(event) => updateSection("apariencia", { density: event.target.value as AppearanceSettings["density"] })} disabled={!canWriteConfiguracion}>
                <option value="standard">Vista Estándar (Cómoda)</option>
                <option value="compact">Vista Compacta (Mayor cantidad de filas)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Color de Acento de la Marca</label>
              <div className="flex items-center gap-3">
                <input className="h-10 w-16 cursor-pointer rounded border border-slate-200 p-1" type="color" value={draft.apariencia.accent_color} onChange={(event) => updateSection("apariencia", { accent_color: event.target.value })} disabled={!canWriteConfiguracion} />
                <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{draft.apariencia.accent_color}</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Nombre Visible del Comercio en Topbar</label>
              <input className="ui-input" value={draft.apariencia.display_name} onChange={(event) => updateSection("apariencia", { display_name: event.target.value })} placeholder="Ej: Sucursal Centro" disabled={!canWriteConfiguracion} />
            </div>
          </div>
        </section>

        {/* SECCIÓN: CAJA Y TESORERÍA */}
        <section
          className="ui-card space-y-4"
          hidden={!scopePreset.visibleSections.caja || (visibleTabs.length > 1 && activeTab !== "caja")}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Wallet className="text-blue-600 dark:text-blue-400" size={20} />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Caja y Tesorería</h2>
                <p className="text-xs text-slate-500">Apertura, cierre y reglas de movimiento de fondos en el punto de venta</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" className="ui-btn-ghost" onClick={() => { void resetSection("caja"); }} disabled={!canWriteConfiguracion || savingSection.caja}>Restablecer</button>
              <button type="button" className="ui-btn-primary" onClick={() => { void handleSaveSection("caja"); }} disabled={!canWriteConfiguracion || savingSection.caja}>{savingSection.caja ? "Guardando..." : "Guardar Caja"}</button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Monto Inicial Sugerido al Abrir Caja</label>
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

            <div className="md:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Reglas de Control de Caja</span>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input type="checkbox" className="h-4 w-4 rounded text-blue-600" checked={draft.caja.require_open_session_for_sale} onChange={(event) => updateSection("caja", { require_open_session_for_sale: event.target.checked })} disabled={!canWriteConfiguracion} />
                  <span>Exigir caja abierta para realizar ventas</span>
                </label>

                <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input type="checkbox" className="h-4 w-4 rounded text-blue-600" checked={draft.caja.allow_manual_movements} onChange={(event) => updateSection("caja", { allow_manual_movements: event.target.checked })} disabled={!canWriteConfiguracion} />
                  <span>Permitir ingresos/egresos manuales</span>
                </label>

                <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input type="checkbox" className="h-4 w-4 rounded text-blue-600" checked={draft.caja.require_notes_on_manual_movements} onChange={(event) => updateSection("caja", { require_notes_on_manual_movements: event.target.checked })} disabled={!canWriteConfiguracion} />
                  <span>Exigir motivo en movimientos manuales</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN: STOCK E INVENTARIO */}
        <section
          className="ui-card space-y-4"
          hidden={!scopePreset.visibleSections.stock || (visibleTabs.length > 1 && activeTab !== "stock")}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Package className="text-blue-600 dark:text-blue-400" size={20} />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Stock e Inventario</h2>
                <p className="text-xs text-slate-500">Alertas de stock mínimo y reglas de ajuste de mercadería</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" className="ui-btn-ghost" onClick={() => { void resetSection("stock"); }} disabled={!canWriteConfiguracion || savingSection.stock}>Restablecer</button>
              <button type="button" className="ui-btn-primary" onClick={() => { void handleSaveSection("stock"); }} disabled={!canWriteConfiguracion || savingSection.stock}>{savingSection.stock ? "Guardando..." : "Guardar Stock"}</button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Umbral Global de Stock Bajo</label>
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

            <div className="md:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Parámetros de Control</span>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input type="checkbox" className="h-4 w-4 rounded text-blue-600" checked={draft.stock.use_min_max} onChange={(event) => updateSection("stock", { use_min_max: event.target.checked })} disabled={!canWriteConfiguracion} />
                  <span>Usar stock mín/máx por producto</span>
                </label>

                <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input type="checkbox" className="h-4 w-4 rounded text-blue-600" checked={draft.stock.alerts_active} onChange={(event) => updateSection("stock", { alerts_active: event.target.checked })} disabled={!canWriteConfiguracion} />
                  <span>Activar alertas de stock en Topbar</span>
                </label>

                <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input type="checkbox" className="h-4 w-4 rounded text-blue-600" checked={draft.stock.allow_manual_adjustments} onChange={(event) => updateSection("stock", { allow_manual_adjustments: event.target.checked })} disabled={!canWriteConfiguracion} />
                  <span>Permitir ajustes manuales</span>
                </label>

                <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input type="checkbox" className="h-4 w-4 rounded text-blue-600" checked={draft.stock.allow_negative_stock} onChange={(event) => updateSection("stock", { allow_negative_stock: event.target.checked })} disabled={!canWriteConfiguracion} />
                  <span>Permitir stock bajo cero</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN: FACTURACIÓN & ARCA */}
        <section
          className="ui-card space-y-4"
          hidden={!scopePreset.visibleSections.facturacion || (visibleTabs.length > 1 && activeTab !== "facturacion")}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="text-blue-600 dark:text-blue-400" size={20} />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Facturación y ARCA (AFIP)</h2>
                <p className="text-xs text-slate-500">Configuración de facturación electrónica, datos fiscales del emisor y correlatividad</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" className="ui-btn-ghost" onClick={() => { void resetSection("facturacion"); }} disabled={!canWriteConfiguracion || savingSection.facturacion}>Restablecer</button>
              <button type="button" className="ui-btn-primary" onClick={() => { void handleSaveSection("facturacion"); }} disabled={!canWriteConfiguracion || savingSection.facturacion}>{savingSection.facturacion ? "Guardando..." : "Guardar Facturación"}</button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Tipo de Comprobante por Defecto</label>
              <select className="ui-input" value={draft.facturacion.default_document_type} onChange={(event) => updateSection("facturacion", { default_document_type: event.target.value as FacturacionSettings["default_document_type"] })} disabled={!canWriteConfiguracion}>
                <option value="A">Factura A</option>
                <option value="B">Factura B</option>
                <option value="C">Factura C</option>
                <option value="PRESUPUESTO">Presupuesto Interno</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Razón Social Emisor ARCA</label>
              <input className="ui-input" value={draft.facturacion.issuer_tax_name} onChange={(event) => updateSection("facturacion", { issuer_tax_name: event.target.value })} placeholder="Razón social fiscal" disabled={!canWriteConfiguracion} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">CUIT Emisor Fiscal</label>
              <input className="ui-input" value={draft.facturacion.issuer_cuit} onChange={(event) => updateSection("facturacion", { issuer_cuit: event.target.value })} placeholder="CUIT de emisión" disabled={!canWriteConfiguracion} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Condición Fiscal Emisor</label>
              <input className="ui-input" value={draft.facturacion.issuer_fiscal_condition} onChange={(event) => updateSection("facturacion", { issuer_fiscal_condition: event.target.value })} placeholder="Responsable Inscripto / Monotributo" disabled={!canWriteConfiguracion} />
            </div>

            {/* PANEL ARCA */}
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-3 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Parámetros de Integración ARCA</h3>
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
                    Modo {draft.facturacion.arca.mode.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded text-blue-600"
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
                  Habilitar Facturación Electrónica ARCA
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
                  <option value="mock">Modo Mock (Pruebas Locales)</option>
                  <option value="sandbox">Modo Sandbox (Homologación AFIP)</option>
                  <option value="real">Modo Real (Producción AFIP)</option>
                </select>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Punto de Venta Fiscal</label>
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
                    placeholder="1"
                    disabled={!canWriteConfiguracion}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Alias Certificado Digital</label>
                  <input
                    className="ui-input"
                    value={draft.facturacion.arca.certificado_alias}
                    onChange={(event) =>
                      updateSection("facturacion", {
                        arca: {
                          ...draft.facturacion.arca,
                          certificado_alias: event.target.value.trim(),
                        },
                      })
                    }
                    placeholder="Alias certificado AFIP"
                    disabled={!canWriteConfiguracion}
                  />
                </div>
              </div>
            </div>

            {/* CORRELATIVIDAD DE SECUENCIAS */}
            <div className="md:col-span-2 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Próximos Números de Secuencia</span>
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Factura A</label>
                  <input className="ui-input" type="number" min="1" value={draft.facturacion.document_sequences.A} onChange={(event) => updateDocumentSequence("A", Math.max(1, Math.floor(toNumber(event.target.value, draft.facturacion.document_sequences.A))))} disabled={!canWriteConfiguracion} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Factura B</label>
                  <input className="ui-input" type="number" min="1" value={draft.facturacion.document_sequences.B} onChange={(event) => updateDocumentSequence("B", Math.max(1, Math.floor(toNumber(event.target.value, draft.facturacion.document_sequences.B))))} disabled={!canWriteConfiguracion} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Factura C</label>
                  <input className="ui-input" type="number" min="1" value={draft.facturacion.document_sequences.C} onChange={(event) => updateDocumentSequence("C", Math.max(1, Math.floor(toNumber(event.target.value, draft.facturacion.document_sequences.C))))} disabled={!canWriteConfiguracion} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Presupuesto</label>
                  <input className="ui-input" type="number" min="1" value={draft.facturacion.document_sequences.PRESUPUESTO} onChange={(event) => updateDocumentSequence("PRESUPUESTO", Math.max(1, Math.floor(toNumber(event.target.value, draft.facturacion.document_sequences.PRESUPUESTO))))} disabled={!canWriteConfiguracion} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN: BANCOS Y COBROS */}
        <section
          className="ui-card space-y-4"
          hidden={!scopePreset.visibleSections.contableCatalogos || (visibleTabs.length > 1 && activeTab !== "contableCatalogos")}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Building2 className="text-blue-600 dark:text-blue-400" size={20} />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Bancos, Cuentas y Planes de Cuotas</h2>
                <p className="text-xs text-slate-500">Catálogos de cuentas de depósito y financiación con tarjeta en POS</p>
              </div>
            </div>
            {isAccountingLoading ? <span className="text-xs text-slate-500">Cargando datos contables...</span> : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* CUENTAS BANCARIAS */}
            <article className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Cuentas Bancarias</h3>

              <div className="space-y-2">
                <input className="ui-input" value={bankAccountForm.bank_name} onChange={(event) => setBankAccountForm((current) => ({ ...current, bank_name: event.target.value }))} placeholder="Nombre del Banco" disabled={!canWriteConfiguracion} />
                <select className="ui-input" value={bankAccountForm.account_type} onChange={(event) => setBankAccountForm((current) => ({ ...current, account_type: event.target.value as BankAccount["account_type"] }))} disabled={!canWriteConfiguracion}>
                  {bankAccountTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <input className="ui-input" value={bankAccountForm.holder_name} onChange={(event) => setBankAccountForm((current) => ({ ...current, holder_name: event.target.value }))} placeholder="Titular de la Cuenta" disabled={!canWriteConfiguracion} />
                <input className="ui-input" value={bankAccountForm.cbu} onChange={(event) => setBankAccountForm((current) => ({ ...current, cbu: event.target.value }))} placeholder="CBU / CVU (22 dígitos)" disabled={!canWriteConfiguracion} />
                <input className="ui-input" value={bankAccountForm.alias} onChange={(event) => setBankAccountForm((current) => ({ ...current, alias: event.target.value }))} placeholder="Alias CBU" disabled={!canWriteConfiguracion} />
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
                  Agregar Cuenta
                </button>
              </div>

              <div className="max-h-48 space-y-2 overflow-auto pr-1">
                {bankAccounts.map((account) => (
                  <div key={account.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{account.bank_name}</p>
                    <p className="text-xs text-slate-500">{account.holder_name} · {account.currency_code}</p>
                    <p className="text-xs font-mono text-slate-500">{account.alias || "Sin alias"} · {account.cbu || "Sin CBU"}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className={account.is_active ? "ui-badge ui-badge--success" : "ui-badge ui-badge--warn"}>
                        {account.is_active ? "Activa" : "Inactiva"}
                      </span>
                      <button type="button" className="ui-btn-ghost px-2 py-1 text-xs" onClick={() => { void toggleBankAccount(account.id); }} disabled={!canWriteConfiguracion}>
                        {account.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            {/* BANCOS DE ORIGEN */}
            <article className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Bancos Emisores</h3>

              <div className="space-y-2">
                <input className="ui-input" value={originBankForm.name} onChange={(event) => setOriginBankForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre de Banco" disabled={!canWriteConfiguracion} />
                <input className="ui-input" value={originBankForm.code} onChange={(event) => setOriginBankForm((current) => ({ ...current, code: event.target.value }))} placeholder="Código BCRA (Opcional)" disabled={!canWriteConfiguracion} />
                <button
                  type="button"
                  className="ui-btn-primary w-full"
                  disabled={!canWriteConfiguracion}
                  onClick={() => {
                    void upsertOriginBank(originBankForm).then((saved) => {
                      if (!saved) return;
                      setOriginBankForm({ code: "", name: "", is_active: true });
                    });
                  }}
                >
                  Agregar Banco
                </button>
              </div>

              <div className="max-h-48 space-y-2 overflow-auto pr-1">
                {originBanks.map((bank) => (
                  <div key={bank.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{bank.name}</p>
                    <p className="text-xs text-slate-500">{bank.code || "Sin código"}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className={bank.is_active ? "ui-badge ui-badge--success" : "ui-badge ui-badge--warn"}>
                        {bank.is_active ? "Activo" : "Inactivo"}
                      </span>
                      <button type="button" className="ui-btn-ghost px-2 py-1 text-xs" onClick={() => { void toggleOriginBank(bank.id); }} disabled={!canWriteConfiguracion}>
                        {bank.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            {/* PLANES DE CUOTAS */}
            <article className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Planes de Cuotas</h3>

              <div className="space-y-2">
                <input className="ui-input" value={installmentPlanForm.name} onChange={(event) => setInstallmentPlanForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej: 3 Cuotas sin interés" disabled={!canWriteConfiguracion} />
                <div className="grid gap-2 grid-cols-2">
                  <input className="ui-input" type="number" min="1" value={installmentPlanForm.installments} onChange={(event) => setInstallmentPlanForm((current) => ({ ...current, installments: Math.max(1, Math.floor(toNumber(event.target.value, 1))) }))} placeholder="Cant. Cuotas" disabled={!canWriteConfiguracion} />
                  <input className="ui-input" type="number" min="0" step="0.01" value={installmentPlanForm.interest_percent} onChange={(event) => setInstallmentPlanForm((current) => ({ ...current, interest_percent: Math.max(0, toNumber(event.target.value, 0)) }))} placeholder="Recargo %" disabled={!canWriteConfiguracion} />
                </div>
                <button
                  type="button"
                  className="ui-btn-primary w-full"
                  disabled={!canWriteConfiguracion}
                  onClick={() => {
                    void upsertInstallmentPlan({
                      ...installmentPlanForm,
                      code: installmentPlanForm.code || `plan_${installmentPlanForm.installments}_${Math.round(installmentPlanForm.interest_percent)}`,
                      card_brand: installmentPlanForm.card_brand || null,
                      notes: installmentPlanForm.notes || null,
                    }).then((saved) => {
                      if (!saved) return;
                      setInstallmentPlanForm({ code: "", name: "", installments: 1, interest_percent: 0, card_brand: "", notes: "", is_active: true });
                    });
                  }}
                >
                  Agregar Plan
                </button>
              </div>

              <div className="max-h-48 space-y-2 overflow-auto pr-1">
                {installmentPlans.map((plan) => (
                  <div key={plan.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{plan.name}</p>
                    <p className="text-xs text-slate-500">{plan.installments} cuotas · Recargo: {plan.interest_percent.toFixed(2)}%</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className={plan.is_active ? "ui-badge ui-badge--success" : "ui-badge ui-badge--warn"}>
                        {plan.is_active ? "Activo" : "Inactivo"}
                      </span>
                      <button type="button" className="ui-btn-ghost px-2 py-1 text-xs" onClick={() => { void toggleInstallmentPlan(plan.id); }} disabled={!canWriteConfiguracion}>
                        {plan.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        {/* SECCIÓN: BALANZA Y CÓDIGOS */}
        <section
          className="ui-card space-y-4"
          hidden={!scopePreset.visibleSections.codigos_balanza || (visibleTabs.length > 1 && activeTab !== "codigos_balanza")}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Scale className="text-blue-600 dark:text-blue-400" size={20} />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Lectura de Balanza y Códigos EAN13</h2>
                <p className="text-xs text-slate-500">Definición de posiciones de PLU, peso o importe en etiquetas de balanzas pesables</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" className="ui-btn-ghost" onClick={() => { void resetSection("codigos_balanza"); }} disabled={!canWriteConfiguracion || savingSection.codigos_balanza}>Restablecer</button>
              <button type="button" className="ui-btn-primary" onClick={() => { void handleSaveSection("codigos_balanza"); }} disabled={!canWriteConfiguracion || savingSection.codigos_balanza}>{savingSection.codigos_balanza ? "Guardando..." : "Guardar Balanza"}</button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                <input type="checkbox" className="h-4 w-4 rounded text-blue-600" checked={draft.codigos_balanza.scale_parser_enabled} onChange={(event) => updateSection("codigos_balanza", { scale_parser_enabled: event.target.checked })} disabled={!canWriteConfiguracion} />
                Activar Parser de Balanzas Comercial
              </label>

              <label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                <input type="checkbox" className="h-4 w-4 rounded text-blue-600" checked={draft.codigos_balanza.ean13_enabled} onChange={(event) => updateSection("codigos_balanza", { ean13_enabled: event.target.checked })} disabled={!canWriteConfiguracion} />
                Compatibilidad EAN-13 Estándar
              </label>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Modo de Lectura de Balanza</label>
              <select className="ui-input" value={draft.codigos_balanza.scale_mode} onChange={(event) => updateSection("codigos_balanza", { scale_mode: event.target.value as BarcodeScaleMode })} disabled={!canWriteConfiguracion}>
                <option value="total_price">El código incluye IMPORTE TOTAL en pesos</option>
                <option value="weight">El código incluye PESO en Kilogramos</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Prefijo de Balanza (Ej: 20)</label>
              <input className="ui-input" value={draft.codigos_balanza.scale_prefix} onChange={(event) => updateSection("codigos_balanza", { scale_prefix: event.target.value })} placeholder="20" disabled={!canWriteConfiguracion} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Inicio de Posición PLU</label>
              <input className="ui-input" type="number" min="1" value={draft.codigos_balanza.plu_start} onChange={(event) => updateSection("codigos_balanza", { plu_start: Math.max(1, Math.floor(toNumber(event.target.value, draft.codigos_balanza.plu_start))) })} placeholder="3" disabled={!canWriteConfiguracion} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Largo del Código PLU</label>
              <input className="ui-input" type="number" min="1" value={draft.codigos_balanza.plu_length} onChange={(event) => updateSection("codigos_balanza", { plu_length: Math.max(1, Math.floor(toNumber(event.target.value, draft.codigos_balanza.plu_length))) })} placeholder="4" disabled={!canWriteConfiguracion} />
            </div>
          </div>
        </section>

        {/* SECCIÓN: INTEGRACIONES Y SISTEMA */}
        <section
          className="ui-card space-y-4"
          hidden={!scopePreset.visibleSections.sistema || (visibleTabs.length > 1 && activeTab !== "sistema")}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Settings className="text-blue-600 dark:text-blue-400" size={20} />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Integraciones y Sistema</h2>
                <p className="text-xs text-slate-500">MercadoPago, proveedor de datos de base y estado de plataforma</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" className="ui-btn-ghost" onClick={() => { void resetSection("sistema"); }} disabled={!canWriteConfiguracion || savingSection.sistema}>Restablecer</button>
              <button type="button" className="ui-btn-primary" onClick={() => { void handleSaveSection("sistema"); }} disabled={!canWriteConfiguracion || savingSection.sistema}>{savingSection.sistema ? "Guardando..." : "Guardar Sistema"}</button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="ui-input font-medium">
              Proveedor de Datos Activo: <span className="font-bold text-blue-600">{draft.sistema.data_provider.toUpperCase()}</span>
            </div>

            <div className="ui-input font-medium">
              Versión del Sistema: <span className="font-bold text-slate-900 dark:text-slate-100">{draft.sistema.version}</span>
            </div>

            {/* MERCADOPAGO */}
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-3 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Integración con Mercado Pago (QR / Cobro)</h3>
                <div className="flex items-center gap-2">
                  <span className="ui-badge ui-badge--info">
                    Modo {mercadoPagoModeLabel[mercadoPagoConfig.mode]}
                  </span>
                  <span className={mercadoPagoConfigured ? "ui-badge ui-badge--success" : "ui-badge ui-badge--danger"}>
                    {mercadoPagoConfigured ? "Configurado" : "Sin Configurar"}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <input type="checkbox" className="h-4 w-4 rounded text-blue-600" checked={mercadoPagoConfig.enabled} onChange={(event) => updateMercadoPagoSettings({ enabled: event.target.checked })} disabled={!canWriteConfiguracion} />
                  Habilitar Cobro por Mercado Pago
                </label>

                <select className="ui-input" value={mercadoPagoConfig.mode} onChange={(event) => updateMercadoPagoSettings({ mode: event.target.value as MercadoPagoMode })} disabled={!canWriteConfiguracion}>
                  <option value="mock">Modo Mock (Simulación)</option>
                  <option value="sandbox">Modo Sandbox (Pruebas)</option>
                  <option value="real">Modo Real (Producción)</option>
                </select>

                <input className="ui-input md:col-span-2" value={mercadoPagoConfig.public_key} onChange={(event) => updateMercadoPagoSettings({ public_key: event.target.value.trim() })} placeholder="Public Key de Mercado Pago (APP_USR-...)" disabled={!canWriteConfiguracion} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </PagePlaceholder>
  );
};
