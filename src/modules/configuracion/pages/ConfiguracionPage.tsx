import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LoadingState } from "@/components/ui/UiStates";
import { useToast } from "@/components/ui/useToast";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  CreditCard,
  Download,
  FileText,
  Key,
  Landmark,
  Package,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { ArcaCertificateWizardModal } from "@/modules/configuracion/components/ArcaCertificateWizardModal";
import { ArcaAccountantGuideModal } from "@/modules/configuracion/components/ArcaAccountantGuideModal";
import { PaymentMethodConfigCard } from "@/modules/configuracion/components/PaymentMethodConfigCard";
import { EmployeeExcludedCategoriesSelector } from "@/modules/configuracion/components/EmployeeExcludedCategoriesSelector";
import { arcaService } from "@/services/arca.service";
import { productsService } from "@/services/products.service";
import { parseReturnableConfig, COMMON_RETURNABLE_PACKAGES } from "@/utils/returnable-packages";
import { broadcastEntityRequirementsChanged } from "@/modules/configuracion/hooks/useEntityRequirements";
import { parseScaleBarcode } from "@/services/barcode/scale-barcode.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useAccountingCatalogs } from "@/modules/configuracion/hooks/useAccountingCatalogs";
import { useConfiguracionModule } from "@/modules/configuracion/hooks/useConfiguracionModule";
import { useUiStore, type UiFontSize } from "@/store/ui.store";
import { cn } from "@/utils/cn";
import type { AppModule } from "@/types/modules";
import type {
  AppearanceSettings,
  BarcodeScaleMode,
  FacturacionSettings,
  PosRoundingMode,
  PosRoundingRule,
  PosRoundingTarget,
  TenantSettings,
  TenantSettingsSectionKey,
} from "@/types/entities";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const toNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const systemCurrencyOptions: Array<{
  code: string;
  label: string;
  description: string;
}> = [
  { code: "ARS", label: "ARS ($) — Peso Argentino", description: "Moneda de curso legal en Argentina (Predeterminada)" },
  { code: "USD", label: "USD (US$) — Dólar Estadounidense", description: "Divisa de referencia internacional" },
  { code: "EUR", label: "EUR (€) — Euro", description: "Moneda de la Unión Europea" },
  { code: "BRL", label: "BRL (R$) — Real Brasileño", description: "Moneda oficial de Brasil" },
  { code: "CLP", label: "CLP ($) — Peso Chileno", description: "Moneda oficial de Chile" },
  { code: "UYU", label: "UYU ($) — Peso Uruguayo", description: "Moneda oficial de Uruguay" },
  { code: "PYG", label: "PYG (₲) — Guaraní Paraguayo", description: "Moneda oficial de Paraguay" },
  { code: "BOB", label: "BOB (Bs) — Boliviano", description: "Moneda oficial de Bolivia" },
  { code: "COP", label: "COP ($) — Peso Colombiano", description: "Moneda oficial de Colombia" },
  { code: "PEN", label: "PEN (S/) — Sol Peruano", description: "Moneda oficial de Perú" },
  { code: "MXN", label: "MXN ($) — Peso Mexicano", description: "Moneda oficial de México" },
];

const systemTimezoneOptions: Array<{
  value: string;
  label: string;
  offset: string;
}> = [
  { value: "America/Argentina/Buenos_Aires", label: "Argentina — Buenos Aires, CABA, Rosario", offset: "UTC-3 (Predeterminado)" },
  { value: "America/Argentina/Cordoba", label: "Argentina — Córdoba, Santa Fe", offset: "UTC-3" },
  { value: "America/Argentina/Mendoza", label: "Argentina — Mendoza, Cuyo", offset: "UTC-3" },
  { value: "America/Argentina/Salta", label: "Argentina — Salta, Jujuy, NOA", offset: "UTC-3" },
  { value: "America/Argentina/Tucuman", label: "Argentina — Tucumán", offset: "UTC-3" },
  { value: "America/Argentina/Ushuaia", label: "Argentina — Ushuaia, Tierra del Fuego, Patagonia", offset: "UTC-3" },
  { value: "America/Montevideo", label: "Uruguay — Montevideo", offset: "UTC-3" },
  { value: "America/Santiago", label: "Chile — Santiago", offset: "UTC-3 / UTC-4" },
  { value: "America/Asuncion", label: "Paraguay — Asunción", offset: "UTC-3 / UTC-4" },
  { value: "America/Sao_Paulo", label: "Brasil — São Paulo, Río de Janeiro", offset: "UTC-3" },
  { value: "America/La_Paz", label: "Bolivia — La Paz, Santa Cruz", offset: "UTC-4" },
  { value: "America/Lima", label: "Perú — Lima", offset: "UTC-5" },
  { value: "America/Bogota", label: "Colombia — Bogotá, Medellín", offset: "UTC-5" },
  { value: "America/Mexico_City", label: "México — Ciudad de México", offset: "UTC-6" },
  { value: "America/Madrid", label: "España — Madrid, Barcelona", offset: "UTC+1 / UTC+2" },
  { value: "America/New_York", label: "Estados Unidos — Nueva York, Miami (Hora del Este)", offset: "UTC-5" },
];

export type ConfiguracionModuleScope =
  | "all"
  | "agenda"
  | "catalogo"
  | "analisis"
  | "sistema"
  | "contable";

interface ConfiguracionScopePreset {
  title: string;
  description: string;
  permissionModule: AppModule;
  allowSaveAll: boolean;
  visibleSections: Record<TenantSettingsSectionKey | "contableCatalogos" | "empleados", boolean>;
}

const configuracionScopePresets: Record<ConfiguracionModuleScope, ConfiguracionScopePreset> = {
  all: {
    title: "Configuración General",
    description: "Gestión unificada de parámetros operativos, comerciales y fiscales del comercio",
    permissionModule: "configuracion",
    allowSaveAll: true,
    visibleSections: {
      negocio: true,
      pos: true,
      empleados: true,
      apariencia: true,
      caja: true,
      stock: true,
      facturacion: true,
      contableCatalogos: true,
      codigos_balanza: true,
      sistema: true,
      tienda: true,
    },
  },
  agenda: {
    title: "Configuración de Agenda & Empleados",
    description: "Gestión unificada de parámetros de empleados y cuentas corrientes",
    permissionModule: "configuracion",
    allowSaveAll: false,
    visibleSections: {
      negocio: true,
      pos: true,
      empleados: true,
      apariencia: true,
      caja: true,
      stock: true,
      facturacion: true,
      contableCatalogos: true,
      codigos_balanza: true,
      sistema: true,
      tienda: true,
    },
  },
  catalogo: {
    title: "Configuración de Catálogo & Stock",
    description: "Configuraciones operativas para catálogo, inventario y códigos de balanza",
    permissionModule: "configuracion",
    allowSaveAll: false,
    visibleSections: {
      negocio: true,
      pos: true,
      empleados: true,
      apariencia: true,
      caja: true,
      stock: true,
      facturacion: true,
      contableCatalogos: true,
      codigos_balanza: true,
      sistema: true,
      tienda: true,
    },
  },
  analisis: {
    title: "Configuración del Sistema",
    description: "Centro de control general del comercio",
    permissionModule: "configuracion",
    allowSaveAll: false,
    visibleSections: {
      negocio: true,
      pos: true,
      empleados: true,
      apariencia: true,
      caja: true,
      stock: true,
      facturacion: true,
      contableCatalogos: true,
      codigos_balanza: true,
      sistema: true,
      tienda: true,
    },
  },
  sistema: {
    title: "Configuración del Sistema",
    description: "Parámetros comerciales, facturación ARCA, caja, stock, apariencia y terminales",
    permissionModule: "configuracion",
    allowSaveAll: true,
    visibleSections: {
      negocio: true,
      pos: true,
      empleados: true,
      apariencia: true,
      caja: true,
      stock: true,
      facturacion: true,
      contableCatalogos: true,
      codigos_balanza: true,
      sistema: true,
      tienda: true,
    },
  },
  contable: {
    title: "Configuración Fiscal y Facturación",
    description: "Configuraciones de ARCA AFIP, facturación electrónica y planes de cuotas",
    permissionModule: "configuracion",
    allowSaveAll: false,
    visibleSections: {
      negocio: true,
      pos: true,
      empleados: true,
      apariencia: true,
      caja: true,
      stock: true,
      facturacion: true,
      contableCatalogos: true,
      codigos_balanza: true,
      sistema: true,
      tienda: true,
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
  | "sistema"
  | "empleados";

interface ConfigTabDefinition {
  id: ConfigTabKey;
  label: string;
  icon: typeof Store;
  badge?: string;
  description: string;
}

const configTabs: ConfigTabDefinition[] = [
  { id: "negocio", label: "Negocio", icon: Store, description: "Datos comerciales y de contacto" },
  { id: "pos", label: "Punto de Venta", icon: ShoppingCart, description: "Comportamiento de cobro y redondeo" },
  { id: "empleados", label: "Empleados y Cta. Cte.", icon: Users, description: "Descuento en compras y categorías excluidas" },
  { id: "apariencia", label: "Apariencia y Letra", icon: Palette, description: "Tema y tamaño de letra/interfaz" },
  { id: "caja", label: "Caja y Tesorería", icon: Wallet, description: "Reglas de control y arqueo a ciegas" },
  { id: "stock", label: "Stock e Inventario", icon: Package, description: "Alertas, compras y envases retornables" },
  { id: "facturacion", label: "Facturación & ARCA", icon: FileText, description: "Emisión electrónica oficial y certificados" },
  { id: "contableCatalogos", label: "Medios de Pago", icon: CreditCard, description: "Cobros, recargos/descuentos y planes de cuotas" },
  { id: "codigos_balanza", label: "Balanza & Códigos", icon: Scale, description: "Formatos PLU y códigos de peso/monto" },
  { id: "sistema", label: "Integraciones & Sistema", icon: Settings, description: "Conectividad y plataforma" },
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
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadConfiguracion = canRead(scopePreset.permissionModule);
  const canWriteConfiguracion = canWrite(scopePreset.permissionModule);

  const setTheme = useUiStore((state) => state.setTheme);
  const setSidebarTheme = useUiStore((state) => state.setSidebarTheme);
  const setAccentColor = useUiStore((state) => state.setAccentColor);
  const setDensity = useUiStore((state) => state.setDensity);
  const fontSize = useUiStore((state) => state.fontSize);
  const setFontSize = useUiStore((state) => state.setFontSize);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as ConfigTabKey | null;

  const [activeTab, setActiveTab] = useState<ConfigTabKey>(() => {
    if (tabParam && configTabs.some((t) => t.id === tabParam)) {
      return tabParam;
    }
    if (scopePreset.visibleSections.negocio) return "negocio";
    const firstVisible = configTabs.find((tab) => scopePreset.visibleSections[tab.id]);
    return firstVisible ? firstVisible.id : "negocio";
  });

  const handleSelectTab = (tabId: ConfigTabKey) => {
    setActiveTab(tabId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tabId);
      return next;
    });
  };

  const {
    draft,
    setDraft,
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
    installmentPlans,
    paymentMethods: accountingPaymentMethods,
    isLoading: isAccountingLoading,
    feedback: accountingFeedback,
    clearFeedback: clearAccountingFeedback,
    upsertInstallmentPlan,
    toggleInstallmentPlan,
    deleteInstallmentPlan,
    togglePaymentMethod,
    updatePaymentMethod,
  } = useAccountingCatalogs(tenantId, user?.id ?? null, true);

  const [installmentPlanForm, setInstallmentPlanForm] = useState({
    code: "",
    name: "",
    installments: 1,
    interest_percent: 0,
    card_brand: "",
    notes: "",
    is_active: true,
  });

  const [scaleTesterBarcode, setScaleTesterBarcode] = useState("2000010012756");
  const scaleTesterResult = useMemo(() => {
    if (!draft?.codigos_balanza) return null;
    return parseScaleBarcode(scaleTesterBarcode, draft.codigos_balanza);
  }, [scaleTesterBarcode, draft?.codigos_balanza]);

  const [newPackageName, setNewPackageName] = useState("");
  const [newPackagePrice, setNewPackagePrice] = useState<number | "">("");

  const handleAddReturnablePackage = () => {
    const trimmed = newPackageName.trim();
    if (!trimmed || !draft) return;

    const currentList = draft.stock.returnable_packages || [];
    if (currentList.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`El envase "${trimmed}" ya está en la lista.`);
      return;
    }

    const priceNum = typeof newPackagePrice === "number" && !isNaN(newPackagePrice) && newPackagePrice >= 0
      ? newPackagePrice
      : undefined;

    const updated = [...currentList, { name: trimmed, suggestedPrice: priceNum }];
    updateSection("stock", { returnable_packages: updated });
    setNewPackageName("");
    setNewPackagePrice("");
    toast.success(`Envase "${trimmed}" agregado a la configuración.`);
  };

  const handleRemoveReturnablePackage = (nameToRemove: string) => {
    if (!draft) return;
    const currentList = draft.stock.returnable_packages || [];
    const updated = currentList.filter((p) => p.name.toLowerCase() !== nameToRemove.toLowerCase());
    updateSection("stock", { returnable_packages: updated });
    toast.info(`Envase "${nameToRemove}" eliminado de la lista.`);
  };

  const [isDetectingPackages, setIsDetectingPackages] = useState(false);

  const handleDetectPackagesFromProducts = async () => {
    if (!tenantId || !draft) return;
    setIsDetectingPackages(true);
    try {
      const products = await productsService.getAllByTenant(tenantId);
      const existingNames = new Set((draft.stock.returnable_packages || []).map((p) => p.name.toLowerCase()));
      const currentList = [...(draft.stock.returnable_packages || [])];
      let addedCount = 0;

      for (const prod of products) {
        const cfg = parseReturnableConfig(prod.description);
        if (cfg && cfg.enabled && cfg.packageName.trim()) {
          const lower = cfg.packageName.trim().toLowerCase();
          if (!existingNames.has(lower)) {
            existingNames.add(lower);
            currentList.push({
              name: cfg.packageName.trim(),
              suggestedPrice: cfg.packagePrice,
            });
            addedCount++;
          }
        }
      }

      if (addedCount > 0) {
        updateSection("stock", { returnable_packages: currentList });
        toast.success(`Se detectaron e importaron ${addedCount} tipos de envases desde el catálogo de productos`);
      } else {
        toast.info("No se encontraron nuevos tipos de envases configurados en tus productos");
      }
    } catch {
      toast.error("Error al inspeccionar productos para detectar envases");
    } finally {
      setIsDetectingPackages(false);
    }
  };

  const handleLoadCommonPackages = () => {
    if (!draft) return;
    const existingNames = new Set((draft.stock.returnable_packages || []).map((p) => p.name.toLowerCase()));
    const currentList = [...(draft.stock.returnable_packages || [])];
    let addedCount = 0;

    for (const pkg of COMMON_RETURNABLE_PACKAGES) {
      if (!existingNames.has(pkg.name.toLowerCase())) {
        existingNames.add(pkg.name.toLowerCase());
        currentList.push(pkg);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      updateSection("stock", { returnable_packages: currentList });
      toast.success(`Se agregaron ${addedCount} tipos de envases habituales`);
    } else {
      toast.info("Los envases habituales ya se encuentran en la lista");
    }
  };

  const [isArcaWizardOpen, setIsArcaWizardOpen] = useState(false);
  const [isArcaGuideOpen, setIsArcaGuideOpen] = useState(false);
  const [isTestingArcaConnection, setIsTestingArcaConnection] = useState(false);
  const [arcaTestFeedback, setArcaTestFeedback] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);

  const handleTestArcaConnection = async () => {
    if (!draft) return;
    setIsTestingArcaConnection(true);
    setArcaTestFeedback(null);
    try {
      const cuit = draft.facturacion.issuer_cuit || draft.facturacion.arca.cuit_emisor || draft.negocio.cuit || "";
      const puntoVenta = draft.facturacion.arca.punto_venta || 1;
      const result = await arcaService.testConnection(draft.facturacion.arca, cuit, puntoVenta);
      if (result.success) {
        setArcaTestFeedback({
          status: "success",
          message: result.message || "Conexión exitosa con los servidores de ARCA (AFIP).",
        });
      } else {
        setArcaTestFeedback({
          status: "error",
          message: result.message || "No se pudo autenticar con el servidor de AFIP/ARCA",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error inesperado de comunicación con ARCA";
      setArcaTestFeedback({
        status: "error",
        message,
      });
    } finally {
      setIsTestingArcaConnection(false);
    }
  };

  const isAdminUser = useMemo(() => {
    if (!user) return false;
    const role = (user.role || "").toLowerCase();
    const profileName = (user.permissionProfileName || "").toLowerCase();
    return (
      role === "admin" ||
      role === "owner" ||
      role === "superadmin" ||
      role === "platform_admin" ||
      profileName.includes("admin") ||
      profileName.includes("dueño") ||
      profileName.includes("propietario")
    );
  }, [user]);

  const canModifyEmployeeBenefits = canWriteConfiguracion && isAdminUser;

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    let isMounted = true;
    productsService
      .getAllByTenant(tenantId)
      .then((prods) => {
        if (!isMounted) return;
        const set = new Set<string>();
        (prods || []).forEach((p) => {
          if (p.category && p.category.trim()) {
            set.add(p.category.trim());
          }
        });
        setAvailableCategories(Array.from(set).sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  const visibleTabs = useMemo(
    () => configTabs.filter((tab) => scopePreset.visibleSections[tab.id]),
    [scopePreset]
  );

  const applyAppearance = useCallback(
    (apariencia: AppearanceSettings) => {
      setTheme(apariencia.default_theme);
      if (apariencia.sidebar_theme) {
        setSidebarTheme(apariencia.sidebar_theme);
      }
      setAccentColor(apariencia.accent_color);
      setDensity(apariencia.density);
      if (apariencia.font_size) {
        setFontSize(apariencia.font_size);
      }
    },
    [setTheme, setSidebarTheme, setAccentColor, setDensity, setFontSize]
  );

  useEffect(() => {
    if (draft) {
      applyAppearance(draft.apariencia);
    }
  }, [draft, applyAppearance]);

  const updateSection = <K extends TenantSettingsSectionKey>(
    section: K,
    patch: Partial<TenantSettings[K]>
  ) => {
    if (!draft) return;
    setDraft({
      ...draft,
      [section]: {
        ...draft[section],
        ...patch,
      },
    });
  };

  const updateFacturacionSettings = (patch: Partial<FacturacionSettings>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      facturacion: {
        ...draft.facturacion,
        ...patch,
      },
    });
  };

  const updateEntityRequirements = (
    entityType: "customer" | "supplier",
    field: string,
    value: boolean
  ) => {
    if (!draft) return;
    const currentReqs = draft.facturacion.entity_requirements ?? {
      customer: { document_number: true, phone: false, email: false, address: false },
      supplier: { tax_id: false, phone: false, email: false, address: false },
    };

    const updated = {
      ...currentReqs,
      [entityType]: {
        ...currentReqs[entityType],
        [field]: value,
      },
    };

    updateFacturacionSettings({ entity_requirements: updated });
    if (tenantId) broadcastEntityRequirementsChanged(tenantId, updated);
  };

  const handleCreateInstallmentPlan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWriteConfiguracion) return;

    const ok = await upsertInstallmentPlan({
      code: installmentPlanForm.code.trim() || `plan_${Date.now()}`,
      name: installmentPlanForm.name.trim(),
      installments: Math.max(1, Math.floor(installmentPlanForm.installments)),
      interest_percent: Math.max(0, installmentPlanForm.interest_percent),
      card_brand: installmentPlanForm.card_brand.trim() || null,
      notes: installmentPlanForm.notes.trim() || null,
      is_active: installmentPlanForm.is_active,
    });

    if (ok) {
      setInstallmentPlanForm({
        code: "",
        name: "",
        installments: 1,
        interest_percent: 0,
        card_brand: "",
        notes: "",
        is_active: true,
      });
      toast.success("Plan de cuotas guardado exitosamente");
    }
  };

  const handleSaveSection = async (section: TenantSettingsSectionKey) => {
    await saveSection(section);
  };

  const handleSaveAll = async () => {
    await saveAll();
  };

  if (!canReadConfiguracion) {
    return (
      <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-6 text-sm text-amber-900 dark:text-amber-200">
        <h2 className="text-base font-bold">Acceso restringido</h2>
        <p className="mt-1">No tienes permisos para consultar la configuración del sistema.</p>
      </div>
    );
  }

  if (isLoading || !draft) {
    return <LoadingState message="Cargando configuración general del sistema..." />;
  }

  const customerReqs = draft.facturacion.entity_requirements?.customer ?? {
    document_number: true,
    phone: false,
    email: false,
    address: false,
  };

  const supplierReqs = draft.facturacion.entity_requirements?.supplier ?? {
    tax_id: false,
    phone: false,
    email: false,
    address: false,
  };

  return (
    <div className="space-y-6">
      {/* HEADER FLOTANTE MODERNO */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <nav className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            SISTEMA › CONFIGURACIÓN
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            {scopePreset.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {scopePreset.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              clearFeedback();
              void reload();
            }}
            disabled={isLoading || isSavingAll}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>

          {scopePreset.allowSaveAll ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 transition hover:bg-blue-700 active:scale-95 disabled:opacity-50 cursor-pointer"
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
      </header>

      {/* TARJETA RESUMEN DEL COMERCIO */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <Store size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {draft.negocio.trade_name || "Configuración del comercio"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {draft.negocio.cuit ? `CUIT: ${draft.negocio.cuit} · ` : ""}
              {draft.negocio.email || "Configuración general del sistema"}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Comercio Activo · POS Inteligente</span>
        </div>
      </div>

      {/* FEEDBACKS Y ALERTAS */}
      {feedback ? (
        <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>
          {feedback.message}
        </div>
      ) : null}

      {scopePreset.visibleSections.contableCatalogos && accountingFeedback ? (
        <div className={accountingFeedback.type === "success" ? "ui-success-state" : "ui-error-state"}>
          <div className="flex items-center justify-between gap-2">
            <span>{accountingFeedback.message}</span>
            <button
              type="button"
              className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
              onClick={clearAccountingFeedback}
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      {/* NAVEGACIÓN POR PESTAÑAS: Modern Rounded Grid Simétrico 5x2 */}
      {visibleTabs.length > 1 ? (
        <nav
          aria-label="Categorías de configuración"
          className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-2 sm:gap-2.5">
            {visibleTabs.map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className={cn(
                    "group relative flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer select-none text-left min-h-[46px]",
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/20 active:scale-95"
                      : "border border-slate-200/90 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:text-slate-200 active:scale-95 shadow-2xs"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-xl shrink-0 transition-colors",
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 group-hover:scale-105"
                      )}
                    >
                      <IconComp size={15} />
                    </div>
                    <span className="truncate">{tab.label}</span>
                  </div>
                  
                </button>
              );
            })}
          </div>
        </nav>
      ) : null}

      {/* SECCIÓN 1: DATOS DEL NEGOCIO */}
      <section
        className="space-y-6"
        hidden={!scopePreset.visibleSections.negocio || (visibleTabs.length > 1 && activeTab !== "negocio")}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Store size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                CONFIGURACIÓN › NEGOCIO
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Datos del Negocio
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Información comercial, razón social y datos de contacto de tu comercio.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void resetSection("negocio"); }}
              disabled={!canWriteConfiguracion || savingSection.negocio}
            >
              <RefreshCw size={14} />
              <span>Restablecer</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void handleSaveSection("negocio"); }}
              disabled={!canWriteConfiguracion || savingSection.negocio}
            >
              <Save size={14} />
              <span>{savingSection.negocio ? "Guardando..." : "Guardar Negocio"}</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-6">
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

            {/* MONEDA DEL SISTEMA */}
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Coins size={14} className="text-amber-500" />
                  Moneda del Sistema
                </span>
                <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                  Principal para precios y cobros
                </span>
              </label>
              <div className="relative">
                <select
                  value={draft.negocio.currency_code || "ARS"}
                  onChange={(event) =>
                    updateSection("negocio", { currency_code: event.target.value.toUpperCase() })
                  }
                  disabled={!canWriteConfiguracion}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm font-medium text-slate-900 shadow-2xs transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400 cursor-pointer"
                >
                  {systemCurrencyOptions.map((opt) => (
                    <option key={opt.code} value={opt.code} className="dark:bg-slate-900 dark:text-slate-100 py-1">
                      {opt.label} ({opt.code})
                    </option>
                  ))}
                  {draft.negocio.currency_code &&
                  !systemCurrencyOptions.some((o) => o.code === draft.negocio.currency_code) ? (
                    <option value={draft.negocio.currency_code} className="dark:bg-slate-900 dark:text-slate-100 py-1">
                      {draft.negocio.currency_code} (Personalizada)
                    </option>
                  ) : null}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Moneda predeterminada para tickets, listas de precios, arqueos y reportes.
              </p>
            </div>

            {/* ZONA HORARIA */}
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-blue-500" />
                  Zona Horaria
                </span>
                <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                  Hora oficial de tickets y turnos
                </span>
              </label>
              <div className="relative">
                <select
                  value={draft.negocio.timezone || "America/Argentina/Buenos_Aires"}
                  onChange={(event) =>
                    updateSection("negocio", { timezone: event.target.value })
                  }
                  disabled={!canWriteConfiguracion}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm font-medium text-slate-900 shadow-2xs transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400 cursor-pointer"
                >
                  {systemTimezoneOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="dark:bg-slate-900 dark:text-slate-100 py-1">
                      {opt.label} — {opt.offset}
                    </option>
                  ))}
                  {draft.negocio.timezone &&
                  !systemTimezoneOptions.some((o) => o.value === draft.negocio.timezone) ? (
                    <option value={draft.negocio.timezone} className="dark:bg-slate-900 dark:text-slate-100 py-1">
                      {draft.negocio.timezone} (Personalizada)
                    </option>
                  ) : null}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Asegura que las ventas, turnos de caja y auditorías tengan la hora local exacta.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 2: EMPLEADOS Y CUENTA CORRIENTE */}
      <section
        className="space-y-6"
        hidden={!scopePreset.visibleSections.empleados || (visibleTabs.length > 1 && activeTab !== "empleados")}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Users size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  CONFIGURACIÓN › EMPLEADOS
                </span>
                <span className="rounded-full bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Cta. Cte. Personal
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Descuento y Beneficios para Empleados
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Porcentaje fijo de bonificación para retiros a cuenta corriente y exclusión de categorías.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void resetSection("pos"); }}
              disabled={!canModifyEmployeeBenefits || savingSection.pos}
            >
              <RefreshCw size={14} />
              <span>Restablecer</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-500/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void handleSaveSection("pos"); }}
              disabled={!canModifyEmployeeBenefits || savingSection.pos}
            >
              <Save size={14} />
              <span>{savingSection.pos ? "Guardando..." : "Guardar Beneficios"}</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-6">
          {!isAdminUser && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs text-amber-900 dark:text-amber-200">
              <ShieldAlert size={18} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-bold">Acceso en modo solo lectura</p>
                <p className="text-amber-800 dark:text-amber-300">
                  Solo los usuarios con rol Administrador o Propietario pueden modificar los beneficios y categorías excluidas de empleados.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Porcentaje de Bonificación / Descuento para Empleados (%)
              </label>
              <div className="relative">
                <input
                  className="ui-input pr-10 font-bold text-slate-900 dark:text-slate-100"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={draft.pos.employee_discount_percent ?? 0}
                  onChange={(event) =>
                    updateSection("pos", {
                      employee_discount_percent: Math.min(100, Math.max(0, toNumber(event.target.value, 0))),
                    })
                  }
                  placeholder="0"
                  disabled={!canModifyEmployeeBenefits}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  %
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Al cargar compras con cuenta corriente para un empleado en el POS, este descuento se aplicará automáticamente.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
            <EmployeeExcludedCategoriesSelector
              excludedCategories={draft.pos.employee_discount_excluded_categories ?? []}
              availableCategories={availableCategories}
              onChange={(nextList) => {
                updateSection("pos", {
                  employee_discount_excluded_categories: nextList,
                });
              }}
              disabled={!canModifyEmployeeBenefits}
            />
          </div>
        </div>
      </section>

      {/* SECCIÓN 3: PUNTO DE VENTA (POS) */}
      <section
        className="space-y-6"
        hidden={!scopePreset.visibleSections.pos || (visibleTabs.length > 1 && activeTab !== "pos")}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <ShoppingCart size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                CONFIGURACIÓN › PUNTO DE VENTA
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Punto de Venta (POS)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Parámetros operativos de cobro, redondeo comercial y comportamiento de la terminal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void resetSection("pos"); }}
              disabled={!canWriteConfiguracion || savingSection.pos}
            >
              <RefreshCw size={14} />
              <span>Restablecer</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void handleSaveSection("pos"); }}
              disabled={!canWriteConfiguracion || savingSection.pos}
            >
              <Save size={14} />
              <span>{savingSection.pos ? "Guardando..." : "Guardar POS"}</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
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
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Comportamiento del Carrito</label>
              <select className="ui-input" value={draft.pos.cart_behavior} onChange={(event) => updateSection("pos", { cart_behavior: event.target.value as TenantSettings["pos"]["cart_behavior"] })} disabled={!canWriteConfiguracion}>
                <option value="stack_or_increment">Incrementar cantidad si ya existe</option>
                <option value="stack_always">Agregar como nueva línea siempre</option>
              </select>
            </div>

            {/* SECCIÓN REDONDEO FINAL DE PRECIO / TICKET */}
            <div className="md:col-span-2 space-y-4 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                    <Coins size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Redondeo Comercial de Cambio y Monedas
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Ajuste automático para evitar centavos y billetes fraccionarios que ya no circulan
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {draft.pos.rounding_enabled ? "Activo en cobros" : "Desactivado"}
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={draft.pos.rounding_enabled ?? false}
                    onChange={(e) =>
                      updateSection("pos", {
                        rounding_enabled: e.target.checked,
                        rounding_rule: e.target.checked && (!draft.pos.rounding_rule || draft.pos.rounding_rule === "none") ? "10" : draft.pos.rounding_rule,
                      })
                    }
                    disabled={!canWriteConfiguracion}
                  />
                </label>
              </div>

              {draft.pos.rounding_enabled ? (
                <div className="grid gap-4 sm:grid-cols-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Monto a Redondear
                    </label>
                    <select
                      className="ui-input"
                      value={(draft.pos.rounding_rule as string) === "1" ? "integer" : (draft.pos.rounding_rule || "10")}
                      onChange={(e) =>
                        updateSection("pos", {
                          rounding_rule: e.target.value as PosRoundingRule,
                        })
                      }
                      disabled={!canWriteConfiguracion}
                    >
                      <option value="integer">Al entero ($1) — Sin centavos</option>
                      <option value="10">A decenas ($10) — Recomendado efectivo</option>
                      <option value="50">A múltiplos de $50</option>
                      <option value="100">A múltiplos de $100</option>
                      <option value="500">A múltiplos de $500</option>
                      <option value="1000">A múltiplos de $1000</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Criterio de Ajuste
                    </label>
                    <select
                      className="ui-input"
                      value={draft.pos.rounding_mode || "nearest"}
                      onChange={(e) =>
                        updateSection("pos", {
                          rounding_mode: e.target.value as PosRoundingMode,
                        })
                      }
                      disabled={!canWriteConfiguracion}
                    >
                      <option value="nearest">Al más cercano (Estándar matemático)</option>
                      <option value="up">Siempre hacia arriba (A favor del comercio)</option>
                      <option value="down">Siempre hacia abajo (A favor del cliente)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Aplicar en
                    </label>
                    <select
                      className="ui-input"
                      value={draft.pos.rounding_target === "cash_only" ? "cash_only" : "all_methods"}
                      onChange={(e) =>
                        updateSection("pos", {
                          rounding_target: e.target.value as PosRoundingTarget,
                        })
                      }
                      disabled={!canWriteConfiguracion}
                    >
                      <option value="all_methods">En todos los medios de pago</option>
                      <option value="cash_only">Solo en pagos en efectivo</option>
                    </select>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="md:col-span-2 pt-2">
              <label className="flex items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3.5 text-sm font-medium text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" checked={draft.pos.auto_print_receipt} onChange={(event) => updateSection("pos", { auto_print_receipt: event.target.checked })} disabled={!canWriteConfiguracion} />
                <span>Imprimir ticket automáticamente tras cobrar venta</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 4: APARIENCIA Y LETRA */}
      <section
        className="space-y-6"
        hidden={!scopePreset.visibleSections.apariencia || (visibleTabs.length > 1 && activeTab !== "apariencia")}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
              <Palette size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                CONFIGURACIÓN › APARIENCIA
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Apariencia y Accesibilidad
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tema visual, contraste y tamaño de letra/interfaz para pantallas POS.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void resetSection("apariencia"); }}
              disabled={!canWriteConfiguracion || savingSection.apariencia}
            >
              <RefreshCw size={14} />
              <span>Restablecer</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-purple-600 hover:bg-purple-700 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-purple-500/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void handleSaveSection("apariencia"); }}
              disabled={!canWriteConfiguracion || savingSection.apariencia}
            >
              <Save size={14} />
              <span>{savingSection.apariencia ? "Guardando..." : "Guardar Apariencia"}</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Tamaño de Letra e Interfaz (Accesibilidad)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ajusta la escala tipográfica global para mejorar la legibilidad en pantallas táctiles y mostradores.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {fontSizeOptions.map((opt) => {
                const isSelected = fontSize === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setFontSize(opt.id);
                      updateSection("apariencia", { font_size: opt.id });
                    }}
                    className={cn(
                      "flex flex-col justify-between p-4 rounded-2xl border text-left transition-all cursor-pointer relative",
                      isSelected
                        ? "border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 dark:border-blue-500 ring-2 ring-blue-500/20"
                        : "border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{opt.label}</span>
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {opt.description}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                      <span>Muestra de texto:</span>
                      <span style={{ fontSize: opt.pixelSize }}>Aa 123</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Tema Visual General</label>
              <select
                className="ui-input"
                value={draft.apariencia.default_theme}
                onChange={(event) =>
                  updateSection("apariencia", {
                    default_theme: event.target.value as TenantSettings["apariencia"]["default_theme"],
                  })
                }
                disabled={!canWriteConfiguracion}
              >
                <option value="light">Modo Claro (Fondo Blanco Limpio)</option>
                <option value="midnight">Modo Medianoche (Azul Oscuro Profundo / Contraste)</option>
                <option value="dark">Modo Oscuro Puro (Zinc / Grafito)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Tema del Menú Lateral (Sidebar)</label>
              <select
                className="ui-input"
                value={draft.apariencia.sidebar_theme ?? "auto"}
                onChange={(event) =>
                  updateSection("apariencia", {
                    sidebar_theme: event.target.value as TenantSettings["apariencia"]["sidebar_theme"],
                  })
                }
                disabled={!canWriteConfiguracion}
              >
                <option value="auto">Automático (Adaptable al tema general)</option>
                <option value="dark">Menú Oscuro Siempre</option>
                <option value="light">Menú Claro Siempre</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Color de Énfasis del Sistema</label>
              <div className="flex items-center gap-3">
                <input className="h-10 w-16 cursor-pointer rounded-xl border border-slate-200 p-1" type="color" value={draft.apariencia.accent_color} onChange={(event) => updateSection("apariencia", { accent_color: event.target.value })} disabled={!canWriteConfiguracion} />
                <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{draft.apariencia.accent_color}</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Nombre Visible del Comercio en Topbar</label>
              <input className="ui-input" value={draft.apariencia.display_name} onChange={(event) => updateSection("apariencia", { display_name: event.target.value })} placeholder="Ej: Sucursal Centro" disabled={!canWriteConfiguracion} />
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 5: CAJA Y TESORERÍA */}
      <section
        className="space-y-6"
        hidden={!scopePreset.visibleSections.caja || (visibleTabs.length > 1 && activeTab !== "caja")}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <Wallet size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                CONFIGURACIÓN › CAJA Y TESORERÍA
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Caja y Tesorería
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Reglas de arqueo, movimientos y cierre de caja en el punto de venta.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void resetSection("caja"); }}
              disabled={!canWriteConfiguracion || savingSection.caja}
            >
              <RefreshCw size={14} />
              <span>Restablecer</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-500/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void handleSaveSection("caja"); }}
              disabled={!canWriteConfiguracion || savingSection.caja}
            >
              <Save size={14} />
              <span>{savingSection.caja ? "Guardando..." : "Guardar Caja"}</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Reglas de Control de Caja
            </span>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Exigir motivo en movimientos manuales */}
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 text-sm font-medium text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition">
                <input
                  type="checkbox"
                  className="h-4 w-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={draft.caja.require_notes_on_manual_movements}
                  onChange={(event) =>
                    updateSection("caja", { require_notes_on_manual_movements: event.target.checked })
                  }
                  disabled={!canWriteConfiguracion}
                />
                <div className="flex-1">
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">
                    Exigir motivo en movimientos manuales
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Obliga al operador a ingresar un concepto explicativo al asentar retiros o ingresos extraordinarios de dinero en caja.
                  </p>
                </div>
              </label>

              {/* Cierre de caja a ciegas */}
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 text-sm font-medium text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition">
                <input
                  type="checkbox"
                  className="h-4 w-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={draft.caja.blind_cash_closing ?? false}
                  onChange={(event) =>
                    updateSection("caja", { blind_cash_closing: event.target.checked })
                  }
                  disabled={!canWriteConfiguracion}
                />
                <div className="flex-1">
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">
                    Cierre de caja a ciegas
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    El cajero no ve las ventas ni el efectivo esperado al cerrar. Debe contar billetes por denominación ($100 a $20.000) y los totales se revelan recién tras confirmar el cierre.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 6: STOCK E INVENTARIO */}
      <section
        className="space-y-6"
        hidden={!scopePreset.visibleSections.stock || (visibleTabs.length > 1 && activeTab !== "stock")}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Package size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                CONFIGURACIÓN › STOCK & INVENTARIO
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Stock e Inventario
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Alertas de stock mínimo, doble confirmación de compras y control de envases retornables.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void resetSection("stock"); }}
              disabled={!canWriteConfiguracion || savingSection.stock}
            >
              <RefreshCw size={14} />
              <span>Restablecer</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-600 hover:bg-amber-700 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-amber-500/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void handleSaveSection("stock"); }}
              disabled={!canWriteConfiguracion || savingSection.stock}
            >
              <Save size={14} />
              <span>{savingSection.stock ? "Guardando..." : "Guardar Stock"}</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Parámetros de Control
            </span>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3.5 text-sm font-medium text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition">
                <input type="checkbox" className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" checked={draft.stock.use_min_max} onChange={(event) => updateSection("stock", { use_min_max: event.target.checked })} disabled={!canWriteConfiguracion} />
                <span>Usar stock mín/máx por producto</span>
              </label>

              <label className="flex items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3.5 text-sm font-medium text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition">
                <input type="checkbox" className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" checked={draft.stock.alerts_active} onChange={(event) => updateSection("stock", { alerts_active: event.target.checked })} disabled={!canWriteConfiguracion} />
                <span>Activar alertas de stock en Topbar</span>
              </label>

              <label className="flex items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3.5 text-sm font-medium text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition">
                <input type="checkbox" className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" checked={draft.stock.allow_negative_stock} onChange={(event) => updateSection("stock", { allow_negative_stock: event.target.checked })} disabled={!canWriteConfiguracion} />
                <span>Permitir stock bajo cero</span>
              </label>
            </div>

            {/* MODALIDAD DE CONFIRMACIÓN DE COMPRAS */}
            {(() => {
              const isDoubleConfirmationActive = Boolean(
                draft.stock.purchase_double_confirmation_enabled
              );
              return (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <label className="flex items-start gap-3 cursor-pointer select-none flex-1">
                      <input
                        type="checkbox"
                        className="h-4 w-4 mt-1 rounded text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 cursor-pointer"
                        checked={isDoubleConfirmationActive}
                        onChange={(e) =>
                          updateSection("stock", {
                            purchase_double_confirmation_enabled: e.target.checked,
                          })
                        }
                        disabled={!canWriteConfiguracion}
                      />
                      <div>
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block">
                          Carga de compras con doble confirmación (Recepción por empleados + Fijación de precios por administrador)
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1 leading-relaxed">
                          Al activarse, la primera confirmación (empleado) ingresa el stock recibido y registra el egreso de dinero sin alterar los precios de venta. La compra queda en estado "Pendiente fijar precios" para que un administrador revise y apruebe las alícuotas de IVA y márgenes de venta. Si se desactiva, las compras confirman stock y precios directamente en un solo paso.
                        </span>
                      </div>
                    </label>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap self-start sm:self-auto shrink-0",
                        isDoubleConfirmationActive
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                      )}
                    >
                      {isDoubleConfirmationActive ? "Doble Confirmación Activa" : "Confirmación Directa Activa"}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* GESTIÓN DE ENVASES RETORNABLES */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    <Package className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Tipos de Envases Retornables
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Define los envases que utiliza tu comercio (ej. Envase de Coca, Garrafa, Sifón).
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDetectPackagesFromProducts}
                    disabled={!canWriteConfiguracion || isDetectingPackages}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isDetectingPackages && "animate-spin text-blue-500")} />
                    <span>{isDetectingPackages ? "Detectando..." : "Detectar desde productos"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLoadCommonPackages}
                    disabled={!canWriteConfiguracion}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Sugerencias habituales</span>
                  </button>
                </div>
              </div>

              {canWriteConfiguracion && (
                <div className="grid gap-3 sm:grid-cols-12 items-end bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 dark:bg-slate-800/40 dark:border-slate-800">
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Nombre del tipo de envase
                    </label>
                    <input
                      type="text"
                      value={newPackageName}
                      onChange={(e) => setNewPackageName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddReturnablePackage();
                        }
                      }}
                      placeholder="Ej. ENVASE DE COCA, Bidón 20L, Garrafa 10kg..."
                      className="ui-input text-xs"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Precio reposición ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newPackagePrice}
                      onChange={(e) =>
                        setNewPackagePrice(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddReturnablePackage();
                        }
                      }}
                      placeholder="0.00"
                      className="ui-input text-xs"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={handleAddReturnablePackage}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition active:scale-95 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Agregar Envase</span>
                    </button>
                  </div>
                </div>
              )}

              {draft.stock.returnable_packages?.length ? (
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {draft.stock.returnable_packages.map((pkg) => (
                    <div
                      key={pkg.name}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {pkg.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {pkg.suggestedPrice
                            ? `Precio reposición: ${currency.format(pkg.suggestedPrice)}`
                            : "Sin precio de reposición"}
                        </div>
                      </div>

                      {canWriteConfiguracion && (
                        <button
                          type="button"
                          onClick={() => handleRemoveReturnablePackage(pkg.name)}
                          title={`Eliminar ${pkg.name}`}
                          className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-slate-400 dark:border-slate-800">
                  <Package className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    No has registrado tipos de envases retornables aún.
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Agrega los envases que maneja tu comercio con el formulario de arriba o haz clic en "Detectar desde productos".
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 7: FACTURACIÓN & ARCA (AFIP) */}
      <section
        className="space-y-6"
        hidden={!scopePreset.visibleSections.facturacion || (visibleTabs.length > 1 && activeTab !== "facturacion")}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <FileText size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                CONFIGURACIÓN › FACTURACIÓN & ARCA
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Facturación y ARCA (AFIP)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configuración de facturación electrónica con ARCA, certificados digitales y reglas fiscales.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void resetSection("facturacion"); }}
              disabled={!canWriteConfiguracion || savingSection.facturacion}
            >
              <RefreshCw size={14} />
              <span>Restablecer</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void handleSaveSection("facturacion"); }}
              disabled={!canWriteConfiguracion || savingSection.facturacion}
            >
              <Save size={14} />
              <span>{savingSection.facturacion ? "Guardando..." : "Guardar Facturación"}</span>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* BLOQUE 1: DATOS FISCALES DEL COMERCIO */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  1. Datos Fiscales del Comercio Emisor
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Información tributaria oficial que se imprimirá en comprobantes y tickets.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  CUIT del Titular / Comercio
                </label>
                <input
                  className="ui-input font-mono"
                  value={draft.facturacion.issuer_cuit}
                  onChange={(event) =>
                    updateFacturacionSettings({
                      issuer_cuit: event.target.value,
                      arca: { ...draft.facturacion.arca, cuit_emisor: event.target.value },
                    })
                  }
                  placeholder="20-12345678-9"
                  disabled={!canWriteConfiguracion}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Razón Social / Titular Fiscal
                </label>
                <input
                  className="ui-input"
                  value={draft.facturacion.issuer_tax_name}
                  onChange={(event) => updateFacturacionSettings({ issuer_tax_name: event.target.value })}
                  placeholder="Comercio S.R.L. o Apellido y Nombre"
                  disabled={!canWriteConfiguracion}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Condición Fiscal ante el IVA *
                </label>
                <select
                  className="ui-input"
                  value={draft.facturacion.issuer_fiscal_condition || "Monotributo"}
                  onChange={(event) => {
                    const cond = event.target.value;
                    const suggestedDocType =
                      cond === "Monotributo" ? "C" : cond === "Responsable Inscripto" ? "B" : "B";
                    updateFacturacionSettings({
                      issuer_fiscal_condition: cond,
                      default_document_type: suggestedDocType as FacturacionSettings["default_document_type"],
                    });
                  }}
                  disabled={!canWriteConfiguracion}
                >
                  <option value="Monotributo">Monotributo (Emite Factura C)</option>
                  <option value="Responsable Inscripto">Responsable Inscripto (Facturas A y B)</option>
                  <option value="IVA Exento">IVA Exento</option>
                  <option value="Consumidor Final">Consumidor Final</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Punto de Venta Fiscal ARCA (1 a 99999)
                </label>
                <input
                  className="ui-input font-mono"
                  type="number"
                  min={1}
                  max={99999}
                  value={draft.facturacion.arca.punto_venta}
                  onChange={(event) =>
                    updateFacturacionSettings({
                      arca: {
                        ...draft.facturacion.arca,
                        punto_venta: Math.max(1, toNumber(event.target.value, 1)),
                      },
                    })
                  }
                  placeholder="1"
                  disabled={!canWriteConfiguracion}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Domicilio Fiscal Oficial
                </label>
                <input
                  className="ui-input"
                  value={draft.facturacion.issuer_address}
                  onChange={(event) => updateFacturacionSettings({ issuer_address: event.target.value })}
                  placeholder="Av. Belgrano 1234, CABA"
                  disabled={!canWriteConfiguracion}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Comprobante por Defecto en POS
                </label>
                <select
                  className="ui-input"
                  value={draft.facturacion.default_document_type}
                  onChange={(event) =>
                    updateFacturacionSettings({
                      default_document_type: event.target.value as FacturacionSettings["default_document_type"],
                    })
                  }
                  disabled={!canWriteConfiguracion}
                >
                  <option value="C">Factura C (Monotributo)</option>
                  <option value="B">Factura B (Consumidor Final)</option>
                  <option value="A">Factura A (Responsable Inscripto a Responsable Inscripto)</option>
                  <option value="PRESUPUESTO">Presupuesto / Ticket de Control Interno</option>
                </select>
              </div>
            </div>
          </div>

          {/* BLOQUE 2: MODO OPERATIVO Y AMBIENTE ARCA */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  2. Modo de Operación y Ambiente ARCA (AFIP)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecciona si operar en simulación local, entorno de homologación o facturación real en producción.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Modo Operativo de Facturación
                </label>
                <select
                  className="ui-input"
                  value={draft.facturacion.arca.mode || "mock"}
                  onChange={(event) =>
                    updateFacturacionSettings({
                      arca: {
                        ...draft.facturacion.arca,
                        mode: event.target.value as "mock" | "sandbox" | "real",
                      },
                    })
                  }
                  disabled={!canWriteConfiguracion}
                >
                  <option value="mock">Modo Mock (Simulación interna para capacitación / offline)</option>
                  <option value="sandbox">Modo Homologación / Sandbox (Pruebas oficiales con AFIP)</option>
                  <option value="real">Modo Producción Oficial (Emisión legal con CAE vinculante)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {draft.facturacion.arca.mode === "real"
                    ? "ATENCIÓN: Cada factura emitida generará CAE legal en servidores de ARCA."
                    : draft.facturacion.arca.mode === "sandbox"
                    ? "Permite emitir comprobantes de prueba en servidores de homologación de AFIP."
                    : "Emisión simulada para entrenamiento rápido sin conexión ni valor fiscal."}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ambiente Fiscal de Destino
                </label>
                <select
                  className="ui-input"
                  value={draft.facturacion.arca.fiscal_environment || "homologacion"}
                  onChange={(event) =>
                    updateFacturacionSettings({
                      arca: {
                        ...draft.facturacion.arca,
                        fiscal_environment: event.target.value as "homologacion" | "produccion",
                      },
                    })
                  }
                  disabled={!canWriteConfiguracion}
                >
                  <option value="homologacion">Homologación (wshomofacturacion)</option>
                  <option value="produccion">Producción (servicios1.afip.gov.ar)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Servidor WSAA/WSFE al que se envían las autorizaciones de comprobantes.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 text-sm font-medium text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition">
                <input
                  type="checkbox"
                  className="h-4 w-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={Boolean(draft.facturacion.arca.allow_internal_fallback)}
                  onChange={(e) =>
                    updateFacturacionSettings({
                      arca: {
                        ...draft.facturacion.arca,
                        allow_internal_fallback: e.target.checked,
                      },
                    })
                  }
                  disabled={!canWriteConfiguracion}
                />
                <div className="flex-1">
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">
                    Permitir comprobante interno de contingencia ante caídas de AFIP
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Si los servidores de ARCA sufren una interrupción temporal de servicio, el sistema emite ticket local de contingencia para no detener la caja del negocio.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* BLOQUE 3: CERTIFICADOS DIGITALES ARCA (AFIP) */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                  <Key className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    3. Certificados Digitales ARCA & Firma Electrónica
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Asistente guiado para generar pedido CSR, cargar CRT y autorizar computador fiscal.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
                  onClick={() => setIsArcaGuideOpen(true)}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Guía para Contador</span>
                </button>

                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 px-4.5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition active:scale-95 cursor-pointer"
                  onClick={() => setIsArcaWizardOpen(true)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Asistente de Certificado</span>
                </button>
              </div>
            </div>

            {/* Test de conexión ARCA */}
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-2.5 w-2.5 rounded-full",
                      draft.facturacion.arca.mode === "mock"
                        ? "bg-amber-500"
                        : draft.facturacion.arca.certificate_crt && draft.facturacion.arca.certificate_key
                        ? "bg-emerald-500"
                        : "bg-slate-400"
                    )}
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Diagnóstico de Comunicación en Tiempo Real con ARCA
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Verifica autenticación WSAA y habilitación de Facturación Electrónica WSFE
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestArcaConnection}
                  disabled={isTestingArcaConnection}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-700 shadow-xs hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isTestingArcaConnection && "animate-spin text-blue-600")} />
                  <span>{isTestingArcaConnection ? "Probando comunicación..." : "Probar Conexión con ARCA"}</span>
                </button>
              </div>

              {arcaTestFeedback && (
                <div
                  className={cn(
                    "rounded-xl p-3 text-xs font-medium border",
                    arcaTestFeedback.status === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                  )}
                >
                  {arcaTestFeedback.message}
                </div>
              )}
            </div>

            {/* Dos tarjetas modernas para CRT y KEY */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Tarjeta CRT */}
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 dark:border-slate-700/80 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-xl",
                        draft.facturacion.arca.certificate_crt
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-200/70 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      )}
                    >
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Certificado CRT (.crt / .pem)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Certificado público emitido por AFIP
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      draft.facturacion.arca.certificate_crt
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                    )}
                  >
                    {draft.facturacion.arca.certificate_crt ? "Cargado" : "Pendiente"}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {draft.facturacion.arca.certificate_crt
                    ? "Certificado oficial activo y vinculado para la emisión de facturas electrónicas."
                    : "No se ha cargado el certificado .crt aún. Utiliza el Asistente o sube el archivo descargado de AFIP."}
                </p>

                <div className="pt-1">
                  <input
                    type="file"
                    accept=".crt,.pem,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const content = event.target?.result as string;
                          updateFacturacionSettings({
                            arca: {
                              ...draft.facturacion.arca,
                              certificate_crt: content,
                            },
                          });
                          toast.success("Certificado CRT cargado correctamente");
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="hidden"
                    id="crt-file-input"
                    disabled={!canWriteConfiguracion}
                  />
                  <label
                    htmlFor="crt-file-input"
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer active:scale-95"
                  >
                    <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{draft.facturacion.arca.certificate_crt ? "Cambiar archivo .CRT" : "Cargar archivo .CRT"}</span>
                  </label>
                </div>
              </div>

              {/* Tarjeta KEY */}
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 dark:border-slate-700/80 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-xl",
                        draft.facturacion.arca.certificate_key
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                          : "bg-slate-200/70 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      )}
                    >
                      <Key size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Clave Privada Digital (.key)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Clave criptográfica privada para firma digital
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      draft.facturacion.arca.certificate_key
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                    )}
                  >
                    {draft.facturacion.arca.certificate_key ? "Vinculada" : "Pendiente"}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {draft.facturacion.arca.certificate_key
                    ? "Clave privada cargada y resguardada de forma segura para firmar requerimientos ante AFIP."
                    : "No se ha configurado la clave privada .key. El asistente de certificados la genera automáticamente."}
                </p>

                <div className="pt-1">
                  <input
                    type="file"
                    accept=".key,.pem,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const content = event.target?.result as string;
                          updateFacturacionSettings({
                            arca: {
                              ...draft.facturacion.arca,
                              certificate_key: content,
                            },
                          });
                          toast.success("Clave privada .key cargada correctamente");
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="hidden"
                    id="key-file-input"
                    disabled={!canWriteConfiguracion}
                  />
                  <label
                    htmlFor="key-file-input"
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer active:scale-95"
                  >
                    <Download className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    <span>{draft.facturacion.arca.certificate_key ? "Cambiar archivo .KEY" : "Cargar archivo .KEY"}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* BLOQUE 4: REQUISITOS OBLIGATORIOS AL CREAR ENTIDADES */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  4. Requisitos Obligatorios al Crear Clientes y Proveedores
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Establecé qué datos son mandatorios para registrar nuevas entidades en el sistema.
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                  Requisitos de Clientes
                </span>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-2xs dark:border-slate-700 dark:bg-slate-900 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition">
                    <input
                      type="checkbox"
                      className="h-4 w-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                      checked={customerReqs.phone}
                      onChange={(e) => updateEntityRequirements("customer", "phone", e.target.checked)}
                      disabled={!canWriteConfiguracion}
                    />
                    <div className="flex-1">
                      <span className="font-medium text-slate-800 dark:text-slate-200 block">
                        Teléfono / WhatsApp obligatorio
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                        Exigir número de teléfono de contacto para guardar el cliente.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-2xs dark:border-slate-700 dark:bg-slate-900 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition">
                    <input
                      type="checkbox"
                      className="h-4 w-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                      checked={customerReqs.email}
                      onChange={(e) => updateEntityRequirements("customer", "email", e.target.checked)}
                      disabled={!canWriteConfiguracion}
                    />
                    <div className="flex-1">
                      <span className="font-medium text-slate-800 dark:text-slate-200 block">
                        Email obligatorio
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                        Exigir correo electrónico válido al registrar el cliente.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-2xs dark:border-slate-700 dark:bg-slate-900 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition">
                    <input
                      type="checkbox"
                      className="h-4 w-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                      checked={customerReqs.address}
                      onChange={(e) => updateEntityRequirements("customer", "address", e.target.checked)}
                      disabled={!canWriteConfiguracion}
                    />
                    <div className="flex-1">
                      <span className="font-medium text-slate-800 dark:text-slate-200 block">
                        Domicilio obligatorio
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                        Exigir dirección de entrega o fiscal del cliente.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                  Requisitos de Proveedores
                </span>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-2xs dark:border-slate-700 dark:bg-slate-900 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition">
                    <input
                      type="checkbox"
                      className="h-4 w-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                      checked={supplierReqs.tax_id}
                      onChange={(e) => updateEntityRequirements("supplier", "tax_id", e.target.checked)}
                      disabled={!canWriteConfiguracion}
                    />
                    <div className="flex-1">
                      <span className="font-medium text-slate-800 dark:text-slate-200 block">
                        CUIT del Proveedor obligatorio
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                        Exigir CUIT válido para poder emitir compras o registrar cuenta corriente.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-2xs dark:border-slate-700 dark:bg-slate-900 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition">
                    <input
                      type="checkbox"
                      className="h-4 w-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                      checked={supplierReqs.phone}
                      onChange={(e) => updateEntityRequirements("supplier", "phone", e.target.checked)}
                      disabled={!canWriteConfiguracion}
                    />
                    <div className="flex-1">
                      <span className="font-medium text-slate-800 dark:text-slate-200 block">
                        Teléfono de Proveedor obligatorio
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                        Exigir teléfono de contacto para el proveedor.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-2xs dark:border-slate-700 dark:bg-slate-900 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition">
                    <input
                      type="checkbox"
                      className="h-4 w-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                      checked={supplierReqs.address}
                      onChange={(e) => updateEntityRequirements("supplier", "address", e.target.checked)}
                      disabled={!canWriteConfiguracion}
                    />
                    <div className="flex-1">
                      <span className="font-medium text-slate-800 dark:text-slate-200 block">
                        Domicilio del Proveedor obligatorio
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                        Exigir domicilio comercial o fiscal del proveedor.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 8: MEDIOS DE PAGO Y PLANES DE CUOTAS */}
      <section
        className="space-y-6"
        hidden={!scopePreset.visibleSections.contableCatalogos || (visibleTabs.length > 1 && activeTab !== "contableCatalogos")}
      >
        {/* Encabezado Principal Flotante Moderno */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <CreditCard size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                CONFIGURACIÓN › MEDIOS DE PAGO
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Medios de Pago y Financiación
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Habilita los medios de cobro para el Punto de Venta, ajusta recargos/descuentos comerciales y gestiona los planes de cuotas con tarjeta.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/bancos"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Landmark size={14} className="text-slate-500 dark:text-slate-400" />
              <span>Gestionar Cuentas Bancarias en Bancos</span>
            </a>
          </div>
        </div>

        {/* SUBSECCIÓN 1: CATÁLOGO DE MEDIOS DE COBRO EN POS */}
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Medios de Cobro Habilitados en Punto de Venta (POS)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Activa o desactiva qué opciones de cobro ven los cajeros en el modal inteligente y define recargos o descuentos comerciales.
              </p>
            </div>
            {isAccountingLoading ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">Sincronizando medios...</span>
            ) : null}
          </div>

          {accountingPaymentMethods.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Cargando catálogo de medios de pago...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {accountingPaymentMethods.map((method) => (
                <PaymentMethodConfigCard
                  key={method.id}
                  method={method}
                  disabled={!canWriteConfiguracion}
                  onToggle={togglePaymentMethod}
                  onUpdate={updatePaymentMethod}
                />
              ))}
            </div>
          )}
        </div>

        {/* SUBSECCIÓN 2: PLANES DE CUOTAS Y FINANCIACIÓN CON TARJETA */}
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Planes de Cuotas y Financiación con Tarjeta
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configuración de opciones de cuotas, coeficientes de recargo e intereses para cobros con tarjeta en POS.
            </p>
          </div>

          {canWriteConfiguracion && (
            <form onSubmit={handleCreateInstallmentPlan} className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-800/40 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                Agregar Nuevo Plan de Cuotas
              </span>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre del Plan *
                  </label>
                  <input
                    className="ui-input text-xs"
                    value={installmentPlanForm.name}
                    onChange={(event) =>
                      setInstallmentPlanForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Ej: 3 Cuotas sin interés"
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cantidad de Cuotas *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    className="ui-input text-xs font-mono"
                    value={installmentPlanForm.installments}
                    onChange={(event) =>
                      setInstallmentPlanForm((prev) => ({
                        ...prev,
                        installments: Math.max(1, Math.floor(toNumber(event.target.value, 1))),
                      }))
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Recargo / Interés (%) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="ui-input text-xs font-mono"
                    value={installmentPlanForm.interest_percent}
                    onChange={(event) =>
                      setInstallmentPlanForm((prev) => ({
                        ...prev,
                        interest_percent: Math.max(0, toNumber(event.target.value, 0)),
                      }))
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Marca / Tarjeta (Opcional)
                  </label>
                  <input
                    className="ui-input text-xs"
                    value={installmentPlanForm.card_brand}
                    onChange={(event) =>
                      setInstallmentPlanForm((prev) => ({ ...prev, card_brand: event.target.value }))
                    }
                    placeholder="Ej: Visa, Mastercard..."
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Agregar Plan</span>
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
              Planes Registrados ({installmentPlans.length})
            </span>

            {installmentPlans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
                <CreditCard className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                <p className="text-sm font-medium">No hay planes de cuotas configurados.</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Agrega planes de 1, 3, 6 o 12 cuotas para ofrecer financiación con tarjeta en POS.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {installmentPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {plan.name}
                        </h4>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            plan.is_active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                          )}
                        >
                          {plan.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                        <div>
                          <strong>{plan.installments}</strong> cuota{plan.installments > 1 ? "s" : ""} · Recargo:{" "}
                          <span className={plan.interest_percent > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-emerald-600 font-bold"}>
                            {plan.interest_percent}%
                          </span>
                        </div>
                        {plan.card_brand ? (
                          <div className="text-[11px] text-slate-500">
                            Tarjeta: {plan.card_brand}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {canWriteConfiguracion && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => void toggleInstallmentPlan(plan.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
                        >
                          <span>{plan.is_active ? "Desactivar" : "Activar"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Estás seguro de eliminar el plan "${plan.name}"?`)) {
                              void deleteInstallmentPlan(plan.id);
                            }
                          }}
                          className="rounded-xl p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title="Eliminar plan"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECCIÓN 9: BALANZA & CÓDIGOS */}
      <section
        className="space-y-6"
        hidden={!scopePreset.visibleSections.codigos_balanza || (visibleTabs.length > 1 && activeTab !== "codigos_balanza")}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
              <Scale size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                CONFIGURACIÓN › BALANZAS
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Balanza y Códigos de Barras Embebidos
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configuración del parser de tickets de balanza para fiambrería, carnicería y verdulería.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void resetSection("codigos_balanza"); }}
              disabled={!canWriteConfiguracion || savingSection.codigos_balanza}
            >
              <RefreshCw size={14} />
              <span>Restablecer</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-cyan-600 hover:bg-cyan-700 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-cyan-500/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => { void handleSaveSection("codigos_balanza"); }}
              disabled={!canWriteConfiguracion || savingSection.codigos_balanza}
            >
              <Save size={14} />
              <span>{savingSection.codigos_balanza ? "Guardando..." : "Guardar Balanza"}</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="flex items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3.5 text-sm font-medium text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  checked={draft.codigos_balanza.scale_parser_enabled}
                  onChange={(event) =>
                    updateSection("codigos_balanza", { scale_parser_enabled: event.target.checked })
                  }
                  disabled={!canWriteConfiguracion}
                />
                <span className="font-bold">Activar Parser de Balanzas Comercial</span>
              </label>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Modalidad de la Balanza
              </label>
              <select
                className="ui-input"
                value={draft.codigos_balanza.scale_mode}
                onChange={(event) =>
                  updateSection("codigos_balanza", {
                    scale_mode: event.target.value as BarcodeScaleMode,
                  })
                }
                disabled={!canWriteConfiguracion}
              >
                <option value="weight">Por Peso (Etiqueta incluye Kilos / Gramos)</option>
                <option value="total_price">Por Importe Total (Etiqueta incluye Pesos $)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Prefijo Identificador de Balanza
              </label>
              <input
                className="ui-input font-mono"
                value={draft.codigos_balanza.scale_prefix}
                onChange={(event) =>
                  updateSection("codigos_balanza", { scale_prefix: event.target.value.trim() })
                }
                placeholder="20"
                disabled={!canWriteConfiguracion}
              />
              <span className="text-[11px] text-slate-500">Normalmente 20 o 2</span>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Posición Inicial del Código PLU
              </label>
              <input
                className="ui-input"
                type="number"
                min="1"
                max="13"
                value={draft.codigos_balanza.plu_start}
                onChange={(event) =>
                  updateSection("codigos_balanza", {
                    plu_start: Math.max(1, Math.floor(toNumber(event.target.value, 2))),
                  })
                }
                placeholder="2"
                disabled={!canWriteConfiguracion}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Largo del Código PLU (Dígitos)
              </label>
              <input
                className="ui-input"
                type="number"
                min="1"
                max="8"
                value={draft.codigos_balanza.plu_length}
                onChange={(event) =>
                  updateSection("codigos_balanza", {
                    plu_length: Math.max(1, Math.floor(toNumber(event.target.value, 4))),
                  })
                }
                placeholder="4"
                disabled={!canWriteConfiguracion}
              />
            </div>

            {/* SIMULADOR EN TIEMPO REAL */}
            <div className="md:col-span-2 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/20 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Scale size={18} className="text-blue-600 dark:text-blue-400" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Simulador / Probador de Código en Tiempo Real
                  </h4>
                </div>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400 font-medium cursor-pointer"
                  onClick={() => setScaleTesterBarcode("2000010012756")}
                >
                  Cargar código de prueba (2000010012756)
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 items-end">
                <div className="sm:col-span-1">
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Escanear o tipear código de etiqueta:
                  </label>
                  <input
                    type="text"
                    className="ui-input bg-white font-mono font-bold tracking-wider dark:bg-slate-900"
                    value={scaleTesterBarcode}
                    onChange={(e) => setScaleTesterBarcode(e.target.value)}
                    placeholder="Ej: 2000010012756"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-wrap gap-2 items-center">
                  {scaleTesterResult ? (
                    <>
                      <div className="flex flex-col rounded-xl bg-white px-3 py-2 shadow-xs border border-emerald-200 dark:bg-slate-900 dark:border-emerald-800/60">
                        <span className="text-[10px] uppercase font-bold text-slate-500">PLU Extraído</span>
                        <span className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                          {scaleTesterResult.productCode}{" "}
                          <span className="text-xs font-medium text-slate-500">
                            (PLU: {scaleTesterResult.productCode.replace(/^0+/, "") || "0"})
                          </span>
                        </span>
                      </div>

                      {scaleTesterResult.mode === "weight" && scaleTesterResult.weight != null && (
                        <div className="flex flex-col rounded-xl bg-white px-3 py-2 shadow-xs border border-emerald-200 dark:bg-slate-900 dark:border-emerald-800/60">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Peso Extraído</span>
                          <span className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                            {scaleTesterResult.weight.toLocaleString("es-AR", { minimumFractionDigits: 3 })} kg{" "}
                            <span className="text-xs font-medium text-slate-500">
                              ({Math.round(scaleTesterResult.weight * 1000)} g / {Math.round(scaleTesterResult.weight * 1000)} u.)
                            </span>
                          </span>
                        </div>
                      )}

                      {scaleTesterResult.mode === "total_price" && scaleTesterResult.totalPrice != null && (
                        <div className="flex flex-col rounded-xl bg-white px-3 py-2 shadow-xs border border-emerald-200 dark:bg-slate-900 dark:border-emerald-800/60">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Importe Extraído</span>
                          <span className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                            $ {scaleTesterResult.totalPrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold dark:text-emerald-400">
                        <CheckCircle2 size={16} />
                        <span>¡Código válido e interpretado con éxito!</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50 dark:text-amber-300">
                      <AlertTriangle size={16} className="shrink-0" />
                      <span>
                        {!draft.codigos_balanza.scale_parser_enabled
                          ? "Activá 'Activar Parser de Balanzas Comercial' para procesar códigos."
                          : "El código no coincide con las posiciones, prefijo o largo configurados."}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 10: INTEGRACIONES Y SISTEMA */}
      <section
        className="space-y-6"
        hidden={!scopePreset.visibleSections.sistema || (visibleTabs.length > 1 && activeTab !== "sistema")}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400">
              <Settings size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                CONFIGURACIÓN › INTEGRACIONES
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Integraciones y Sistema
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Estado general de la plataforma y servicios conectados.
              </p>
            </div>
          </div>
        </div>

        {/* PANEL VACÍO MODERN ROUNDED */}
        <div className="rounded-2xl sm:rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 mb-4">
            <Settings size={26} />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Sin configuraciones activas para este módulo
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
            De momento no hay parámetros ni integraciones que requieran configuración manual en esta sección. Las funciones del sistema operan con sus valores predeterminados.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Plataforma conectada y operativa</span>
          </div>
        </div>
      </section>

      {/* MODAL ASISTENTE DE CERTIFICADOS ARCA */}
      <ArcaCertificateWizardModal
        isOpen={isArcaWizardOpen}
        onClose={() => setIsArcaWizardOpen(false)}
        cuit={draft?.facturacion?.arca?.cuit_emisor || draft?.facturacion?.issuer_cuit || draft?.negocio?.cuit || ""}
        businessName={draft?.facturacion?.issuer_tax_name || draft?.negocio?.legal_name || draft?.negocio?.trade_name || ""}
        alias={draft?.facturacion?.arca?.certificado_alias || "pos-v2"}
        currentCrt={draft?.facturacion?.arca?.certificate_crt}
        currentKey={draft?.facturacion?.arca?.certificate_key}
        onSaveCredentials={async (credentials) => {
          if (!draft) return;
          const updatedArca = {
            ...draft.facturacion.arca,
            cuit_emisor: draft?.facturacion?.arca?.cuit_emisor || draft?.facturacion?.issuer_cuit || draft?.negocio?.cuit || "",
            certificado_alias: credentials.certificado_alias || draft.facturacion.arca.certificado_alias || "pos-v2",
            certificate_crt: credentials.certificate_crt,
            certificate_key: credentials.certificate_key,
          };
          updateFacturacionSettings({ arca: updatedArca });
          await saveSection("facturacion");
          toast.success("Credenciales de ARCA guardadas y activadas con éxito");
          setIsArcaWizardOpen(false);
        }}
      />

      {/* MODAL GUÍA DE CERTIFICADOS PARA EL CONTADOR */}
      <ArcaAccountantGuideModal
        isOpen={isArcaGuideOpen}
        onClose={() => setIsArcaGuideOpen(false)}
        cuit={draft?.facturacion?.arca?.cuit_emisor || draft?.facturacion?.issuer_cuit || draft?.negocio?.cuit || ""}
        businessName={draft?.facturacion?.issuer_tax_name || draft?.negocio?.legal_name || draft?.negocio?.trade_name || ""}
        alias={draft?.facturacion?.arca?.certificado_alias || "pos-v2"}
      />
    </div>
  );
};
