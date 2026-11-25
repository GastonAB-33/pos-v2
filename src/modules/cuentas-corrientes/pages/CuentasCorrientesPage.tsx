import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LoadingState } from "@/components/ui/UiStates";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { CustomerCurrentAccountPanel } from "@/modules/clientes/components/CustomerCurrentAccountPanel";
import {
  useCurrentAccountsPage,
  type CustomerSortColumn,
  type CustomerSortDirection,
} from "@/modules/cuentas-corrientes/hooks/useCurrentAccountsPage";
import { PosCustomerModal, type PosCustomerModalValues } from "@/modules/pos/components/PosCustomerModal";
import { WhatsAppIcon } from "@/components/brand/WhatsAppIcon";
import { WhatsAppPhonePromptModal } from "@/components/ui/WhatsAppPhonePromptModal";
import { customersService } from "@/services/customers.service";
import { auditService } from "@/services/audit.service";
import { bankAccountsService } from "@/services/bank-accounts.service";
import { currentAccountsService } from "@/services/current-accounts.service";
import { settingsService } from "@/services/settings.service";
import { posCustomerProfilesService } from "@/services/pos-customer-profiles.service";
import { formatCustomerDocument } from "@/modules/configuracion/hooks/useEntityRequirements";
import type { Customer } from "@/types/entities";
import {
  cleanPhoneForWhatsApp,
  formatWhatsAppDebtStatement,
  openWhatsAppChat,
} from "@/utils/whatsapp-voucher.utils";
import { cn } from "@/utils/cn";
import {
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowRight,
  ArrowLeft,
  Pencil,
  UserCheck,
  UserPlus,
  Package,
  X,
  SlidersHorizontal,
  FilterX,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const defaultPosModalValues: PosCustomerModalValues = {
  firstName: "",
  lastName: "",
  documentType: "dni",
  documentNumber: "",
  phone: "",
  email: "",
  address: "",
  fiscalBusinessName: "",
  fiscalAddress: "",
  fiscalCondition: "",
  fiscalCuit: "",
  currentAccountEnabled: true,
  currentAccountLimit: "",
};

const buildCustomerCode = (name: string): string => {
  const normalized = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((part) => part.slice(0, 3))
    .join("");

  return `${normalized || "CLI"}-${Date.now().toString().slice(-6)}`;
};

export const CuentasCorrientesPage = () => {
  const [searchParams] = useSearchParams();
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const toast = useToast();
  const canReadCurrentAccounts = canRead("cuentas_corrientes");
  const canWriteCurrentAccounts = canWrite("cuentas_corrientes");
  const canWriteClientes = canWrite("clientes");
  const canCreateCustomer = canWriteClientes || canWriteCurrentAccounts;

  const [isCreateCustomerModalOpen, setIsCreateCustomerModalOpen] = useState(false);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [wspPromptState, setWspPromptState] = useState<{
    isOpen: boolean;
    phone: string;
    message: string;
    recipientName: string;
  }>({
    isOpen: false,
    phone: "",
    message: "",
    recipientName: "",
  });

  const initialCustomerId = searchParams.get("customerId") ?? searchParams.get("clienteId");

  const {
    customers,
    filteredCustomers,
    customerPackagesMap,
    selectedCustomer,
    setSelectedCustomerId,
    search,
    setSearch,
    filterMode,
    setFilterMode,
    sortColumn,
    setSortColumn,
    sortDirection,
    setSortDirection,
    handleSort,
    totalDebt,
    customersWithDebtCount,
    customersWithPackagesCount,
    totalPackagesOwedCount,
    customersWithBothCount,
    customersUpToDateCount,
    isLoading,
    feedback,
    clearFeedback,
    reload,
  } = useCurrentAccountsPage(tenantId, initialCustomerId);

  useEffect(() => {
    if (!feedback) return;
    toast.error(feedback.message);
    clearFeedback();
  }, [clearFeedback, feedback, toast]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    const appMain = document.querySelector(".app-main");
    if (appMain) appMain.scrollTop = 0;
  }, [selectedCustomer?.id]);

  const renderSortIcon = (column: CustomerSortColumn) => {
    if (sortColumn === column) {
      return sortDirection === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0 transition-transform" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0 transition-transform" />
      );
    }
    return (
      <ArrowUpDown className="h-3.5 w-3.5 text-slate-400/50 dark:text-slate-500/50 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 transition-colors" />
    );
  };

  const handleSendCustomerWhatsApp = async (customer: Customer) => {
    if (!tenantId) return;
    try {
      // 1. Obtener movimientos recientes de cuenta corriente
      let lastMovements: Array<{
        date: string;
        description: string;
        amount: number;
        type: string;
      }> = [];

      try {
        const movements = await currentAccountsService.getByCustomer(tenantId, customer.id);
        lastMovements = movements.slice(-5).reverse().map((m) => ({
          date: new Date(m.created_at).toLocaleDateString("es-AR"),
          description: m.notes || (m.type === "payment" ? "Pago recibido" : ""),
          amount: Math.abs(m.amount),
          type: m.type,
        }));
      } catch (movErr) {
        console.warn("No se pudieron cargar movimientos para WhatsApp:", movErr);
      }

      // 2. Obtener cuentas bancarias activas para informar datos de pago
      let bankAlias: string | null = null;
      let bankCbu: string | null = null;
      let bankName: string | null = null;
      try {
        const banks = await bankAccountsService.getActiveByTenant(tenantId);
        const preferredBank = banks.find((b) => b.alias || b.cbu) || banks[0];
        if (preferredBank) {
          bankAlias = preferredBank.alias ?? null;
          bankCbu = preferredBank.cbu ?? null;
          bankName = preferredBank.bank_name ?? null;
        }
      } catch (bankErr) {
        console.warn("No se pudieron cargar cuentas bancarias para WhatsApp:", bankErr);
      }

      // 3. Obtener datos de la empresa
      let businessName = "Comercio";
      try {
        const settings = await settingsService.getByTenant(tenantId);
        businessName = settings?.negocio?.trade_name || settings?.negocio?.legal_name || "Comercio";
      } catch {}

      const message = formatWhatsAppDebtStatement({
        customerName: customer.full_name,
        currentBalance: customer.current_balance ?? 0,
        creditLimit: customer.current_account_limit,
        lastMovements,
        businessName,
        bankAlias,
        bankCbu,
        bankName,
      });

      const clean = cleanPhoneForWhatsApp(customer.phone);
      if (clean && clean.length >= 8) {
        openWhatsAppChat(clean, message);
      } else {
        setWspPromptState({
          isOpen: true,
          phone: customer.phone || "",
          message,
          recipientName: customer.full_name,
        });
      }
    } catch (err) {
      console.error("Error al preparar mensaje de WhatsApp para cuenta corriente:", err);
      toast.error("No se pudo generar el mensaje para WhatsApp.");
    }
  };

  const handleCreateCustomerSubmit = async (values: PosCustomerModalValues) => {
    if (!tenantId) return;
    setIsSubmittingCustomer(true);
    try {
      const normalizeNamePart = (part: string) => part.trim();
      const firstName = normalizeNamePart(values.firstName);
      const lastName = normalizeNamePart(values.lastName);
      const fullName = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
      const parsedLimit = Number(values.currentAccountLimit ?? "");
      const currentAccountLimit =
        (values.currentAccountLimit ?? "").trim() &&
        Number.isFinite(parsedLimit) &&
        parsedLimit >= 0
          ? parsedLimit
          : null;

      const created = await customersService.create(tenantId, {
        code: buildCustomerCode(fullName),
        full_name: fullName,
        document_type: values.documentType,
        document_number: (values.documentNumber ?? "").trim(),
        fiscal_business_name: (values.fiscalBusinessName ?? "").trim() || fullName,
        fiscal_address: (values.fiscalAddress ?? "").trim() || (values.address ?? "").trim() || null,
        fiscal_condition: values.fiscalCondition || "consumidor_final",
                price_list_id: "base",
        email: (values.email ?? "").trim() || null,
        phone: (values.phone ?? "").trim() || null,
        address: (values.address ?? "").trim() || null,
        observations: null,
        current_balance: 0,
        current_account_enabled: values.currentAccountEnabled,
        current_account_limit: currentAccountLimit,
        is_active: true,
      });

      if (created) {
        posCustomerProfilesService.saveProfile(tenantId, created.id, {
          enabled: values.currentAccountEnabled,
          limit: currentAccountLimit,
        });

        await auditService.createSafe(tenantId, {
          user_id: user?.id ?? null,
          module: "clientes",
          action: "create",
          entity_type: "customer",
          entity_id: created.id,
          description: `Cliente creado desde Cuentas Corrientes: ${fullName}`,
          metadata: {
            current_account_enabled: values.currentAccountEnabled,
            current_account_limit: currentAccountLimit,
          },
        });

        toast.success(`Cliente "${fullName}" creado con éxito`);
        setIsCreateCustomerModalOpen(false);
        await reload();
        setSelectedCustomerId(created.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el cliente");
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  if (!tenantId) {
    return <section className="ui-panel">No hay un comercio activo.</section>;
  }

  if (!canReadCurrentAccounts) {
    return (
      <section className="ui-panel">No tenés permisos de lectura para este módulo.</section>
    );
  }

  return (
    <div className="ui-page operational-page cuentas-corrientes-clientes-page space-y-4 w-full min-w-0 max-w-full">
      {/* Encabezado Principal Flotante Moderno */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* Breadcrumbs en mayúsculas con jerarquía */}
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">CONTABLE</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">CTA. CTE. CLIENTES</span>
          </div>

          <h1 className="mt-0.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Cuentas Corrientes Clientes
          </h1>
        </div>

        {/* Fila de Botones Píldora */}
        {selectedCustomer ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCustomerId(null);
                void reload();
              }}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <ArrowLeft size={15} />
              <span>Volver</span>
            </button>

            {canWriteCurrentAccounts && (
              <button
                type="button"
                onClick={() => setIsEditCustomerModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <Pencil size={15} />
                <span>Editar</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleSendCustomerWhatsApp(selectedCustomer)}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs active:scale-95 transition-all cursor-pointer"
              title="Enviar resumen de cuenta por WhatsApp"
            >
              <WhatsAppIcon className="h-4 w-4 fill-current" />
              <span>Enviar por WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => {
                clearFeedback();
                void reload();
                setPanelRefreshKey((prev) => prev + 1);
              }}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 text-slate-500 dark:text-slate-400 ${isLoading ? "animate-spin" : ""}`} />
              <span>Actualizar</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => {
                clearFeedback();
                void reload();
              }}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 text-slate-500 dark:text-slate-400 ${isLoading ? "animate-spin" : ""}`} />
              <span>Actualizar</span>
            </button>

            {canCreateCustomer && (
              <button
                type="button"
                onClick={() => setIsCreateCustomerModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                <UserPlus size={16} strokeWidth={2.5} />
                <span>Nuevo cliente</span>
              </button>
            )}
          </div>
        )}
      </header>

      <div className="cuentas-corrientes-clientes-workspace space-y-4">
        {/* KPI Cards Redondeadas 2xl/3xl */}
        {!selectedCustomer && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <article className="rounded-2xl sm:rounded-3xl border border-rose-200/90 bg-white p-4 shadow-xs dark:border-rose-900/60 dark:bg-slate-900 hover:border-rose-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                  Deuda Total ($)
                </span>
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400">
                {currency.format(totalDebt)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Saldo acumulado a cobrar
              </p>
            </article>

            <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Con Deuda $
                </span>
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                {customersWithDebtCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                De {customers.length} clientes registrados
              </p>
            </article>

            <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Envases Prestados
                </span>
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                  <Package className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-purple-600 dark:text-purple-400">
                {totalPackagesOwedCount} {totalPackagesOwedCount === 1 ? "unidad" : "unidades"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {customersWithPackagesCount} {customersWithPackagesCount === 1 ? "cliente debe envases" : "clientes deben envases"}
              </p>
            </article>

            <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Clientes al Día
                </span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {customersUpToDateCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Sin saldo deudor ni envases
              </p>
            </article>
          </div>
        )}

        {/* Flujo: Si hay un cliente seleccionado, se muestra el detalle */}
        {selectedCustomer ? (
          <CustomerCurrentAccountPanel
            tenantId={tenantId}
            userId={user?.id ?? null}
            customer={selectedCustomer}
            canWrite={canWriteCurrentAccounts}
            onClose={() => {
              setSelectedCustomerId(null);
              void reload();
            }}
            onBalanceUpdated={() => {
              void reload();
            }}
            isEditModalOpen={isEditCustomerModalOpen}
            onEditModalOpenChange={setIsEditCustomerModalOpen}
            refreshKey={panelRefreshKey}
          />
        ) : (
          <div className="space-y-4">
            {/* Barra Unificada de Búsqueda y Filtros Redondeada 2xl/3xl */}
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
                {/* 1. Input de Búsqueda */}
                <div className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/40 dark:focus-within:bg-slate-900 transition-all">
                  <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, documento, email o teléfono..."
                    className="flex-1 min-w-0 border-0 bg-transparent px-1 py-0.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 rounded-full cursor-pointer"
                      title="Limpiar búsqueda"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* 2. Botón de Filtros Avanzados en Móvil (debajo en móvil, con encapsulación) */}
                <div className="flex sm:hidden items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setIsFiltersModalOpen(true)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 px-4 py-2 text-xs font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer",
                      filterMode !== "all" &&
                        "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold"
                    )}
                  >
                    <SlidersHorizontal size={15} className="text-blue-600 dark:text-blue-400" />
                    <span>Filtros avanzados</span>
                    {filterMode !== "all" && (
                      <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        1
                      </span>
                    )}
                  </button>

                  {(search || filterMode !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setFilterMode("all");
                      }}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors shrink-0 cursor-pointer"
                      title="Limpiar todos los filtros"
                      aria-label="Limpiar todos los filtros"
                    >
                      <FilterX size={16} />
                    </button>
                  )}
                </div>

                {/* 3. Filtros de Estado en Pastillas Redondeadas para Pantallas Sm y Superiores */}
                <div className="hidden sm:flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer",
                      filterMode === "all"
                        ? "bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    )}
                  >
                    Todos ({customers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("debt")}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer",
                      filterMode === "debt"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    )}
                  >
                    Con deuda ({customersWithDebtCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("packages")}
                    className={cn(
                      "inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer",
                      filterMode === "packages"
                        ? "bg-purple-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    )}
                  >
                    <Package size={13} />
                    <span>Con envases ({customersWithPackagesCount})</span>
                  </button>
                  {customersWithBothCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterMode("both")}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer",
                        filterMode === "both"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      )}
                    >
                      Deuda + Envases ({customersWithBothCount})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFilterMode("zero")}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer",
                      filterMode === "zero"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    )}
                  >
                    Al día ({customersUpToDateCount})
                  </button>

                  {(search || filterMode !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setFilterMode("all");
                      }}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors shrink-0 cursor-pointer"
                      title="Limpiar todos los filtros"
                    >
                      <FilterX size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Pastilla de filtro activo en móvil */}
              {filterMode !== "all" && (
                <div className="flex sm:hidden items-center gap-1.5 pt-0.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                    <span>
                      Filtro activo:{" "}
                      <strong>
                        {filterMode === "debt"
                          ? "Con deuda"
                          : filterMode === "packages"
                          ? "Con envases"
                          : filterMode === "both"
                          ? "Deuda + Envases"
                          : "Al día"}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFilterMode("all")}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 rounded-full cursor-pointer"
                      aria-label="Quitar filtro"
                    >
                      <X size={12} />
                    </button>
                  </span>
                </div>
              )}

              {/* Resumen de conteo */}
              <div className="flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {filteredCustomers.length !== customers.length ? (
                    <>
                      Mostrando <strong className="text-slate-800 dark:text-slate-200">{filteredCustomers.length}</strong> de {customers.length} cuentas
                    </>
                  ) : (
                    <>
                      Total de cuentas de clientes: <strong className="text-slate-800 dark:text-slate-200">{customers.length}</strong>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Estado de Carga o Vacío */}
            {isLoading ? (
              <LoadingState
                message="Cargando cuentas corrientes de clientes..."
                description="Consultando saldos deudores, cobranzas pendientes y envases retornables..."
              />
            ) : filteredCustomers.length === 0 ? (
              <div className="rounded-2xl sm:rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8 sm:p-12 text-center text-slate-400 bg-white dark:bg-slate-900 shadow-xs">
                <UserCheck className="h-10 w-10 text-slate-300 mx-auto mb-2 dark:text-slate-600" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No se encontraron clientes
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Probá cambiando el término de búsqueda o el filtro seleccionado.
                </p>
                {canCreateCustomer && (
                  <button
                    type="button"
                    onClick={() => setIsCreateCustomerModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 transition cursor-pointer"
                  >
                    <UserPlus size={14} />
                    <span>Crear nuevo cliente</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* ============================================================== */}
                {/* 1. DESKTOP VIEW: TABLA TRADICIONAL (hidden md:block)           */}
                {/* ============================================================== */}
                <div className="hidden md:block rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                  <header className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap justify-between items-center gap-2 bg-slate-50/90 dark:bg-slate-800/70">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                        Catálogo de Cuentas de Clientes
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {filteredCustomers.length} {filteredCustomers.length === 1 ? "cliente listado" : "clientes listados"}
                        <span>
                          {" "}• Orden:{" "}
                          <strong className="text-slate-700 dark:text-slate-300">
                            {sortColumn === "name" && (sortDirection === "asc" ? "Cliente (A-Z)" : "Cliente (Z-A)")}
                            {sortColumn === "balance" && (sortDirection === "desc" ? "Saldo (Mayor a menor)" : "Saldo (Menor a mayor)")}
                            {sortColumn === "contact" && (sortDirection === "asc" ? "Contacto (A-Z)" : "Contacto (Z-A)")}
                            {sortColumn === "status" && (sortDirection === "desc" ? "Envases / Deuda (Mayor a menor)" : "Envases / Deuda (Menor a mayor)")}
                          </strong>
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="hidden sm:inline text-[11px] font-medium">Ordenar:</span>
                        <select
                          value={`${sortColumn}_${sortDirection}`}
                          onChange={(e) => {
                            const [col, dir] = e.target.value.split("_") as [CustomerSortColumn, CustomerSortDirection];
                            setSortColumn(col);
                            setSortDirection(dir);
                          }}
                          className="px-2.5 py-1 text-xs rounded-xl border border-slate-200/90 bg-white dark:border-slate-700/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer"
                        >
                          <option value="name_asc">Cliente: A - Z</option>
                          <option value="name_desc">Cliente: Z - A</option>
                          <option value="balance_desc">Saldo: Mayor a menor ($$)</option>
                          <option value="balance_asc">Saldo: Menor a mayor ($)</option>
                          <option value="status_desc">Envases / Deuda: Mayor a menor</option>
                          <option value="status_asc">Envases / Deuda: Menor a mayor</option>
                          <option value="contact_asc">Contacto: A - Z</option>
                          <option value="contact_desc">Contacto: Z - A</option>
                        </select>
                      </div>
                    </div>
                  </header>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/90 dark:bg-slate-800/70 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200/80 dark:border-slate-800 select-none">
                        <tr>
                          <th
                            scope="col"
                            onClick={() => handleSort("name")}
                            className={cn(
                              "py-3 px-4 cursor-pointer transition-colors group",
                              sortColumn === "name"
                                ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-50/60 dark:bg-blue-950/30"
                                : "hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/60 dark:hover:bg-slate-800/60"
                            )}
                            title={
                              sortColumn === "name"
                                ? sortDirection === "asc"
                                  ? "Ordenado A-Z. Clic para ordenar Z-A"
                                  : "Ordenado Z-A. Clic para ordenar A-Z"
                                : "Clic para ordenar por Cliente (A-Z)"
                            }
                          >
                            <div className="inline-flex items-center gap-1.5">
                              <span>Cliente</span>
                              {renderSortIcon("name")}
                            </div>
                          </th>

                          <th
                            scope="col"
                            onClick={() => handleSort("contact")}
                            className={cn(
                              "py-3 px-4 cursor-pointer transition-colors group",
                              sortColumn === "contact"
                                ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-50/60 dark:bg-blue-950/30"
                                : "hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/60 dark:hover:bg-slate-800/60"
                            )}
                            title={
                              sortColumn === "contact"
                                ? sortDirection === "asc"
                                  ? "Ordenado A-Z. Clic para ordenar Z-A"
                                  : "Ordenado Z-A. Clic para ordenar A-Z"
                                : "Clic para ordenar por Contacto"
                            }
                          >
                            <div className="inline-flex items-center gap-1.5">
                              <span>Contacto</span>
                              {renderSortIcon("contact")}
                            </div>
                          </th>

                          <th
                            scope="col"
                            onClick={() => handleSort("status")}
                            className={cn(
                              "py-3 px-4 cursor-pointer transition-colors group",
                              sortColumn === "status"
                                ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-50/60 dark:bg-blue-950/30"
                                : "hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/60 dark:hover:bg-slate-800/60"
                            )}
                            title={
                              sortColumn === "status"
                                ? sortDirection === "desc"
                                  ? "Ordenado por mayores pendientes primero. Clic para invertir"
                                  : "Ordenado por menores pendientes primero. Clic para invertir"
                                : "Clic para ordenar por Estado y Envases"
                            }
                          >
                            <div className="inline-flex items-center gap-1.5">
                              <span>Estado y Envases</span>
                              {renderSortIcon("status")}
                            </div>
                          </th>

                          <th
                            scope="col"
                            onClick={() => handleSort("balance")}
                            className={cn(
                              "py-3 px-4 text-right cursor-pointer transition-colors group",
                              sortColumn === "balance"
                                ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-50/60 dark:bg-blue-950/30"
                                : "hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/60 dark:hover:bg-slate-800/60"
                            )}
                            title={
                              sortColumn === "balance"
                                ? sortDirection === "desc"
                                  ? "Ordenado de mayor a menor saldo. Clic para menor a mayor"
                                  : "Ordenado de menor a mayor saldo. Clic para mayor a menor"
                                : "Clic para ordenar por Saldo Actual (de mayor a menor)"
                            }
                          >
                            <div className="inline-flex items-center justify-end gap-1.5 w-full">
                              <span>Saldo Actual</span>
                              {renderSortIcon("balance")}
                            </div>
                          </th>

                          <th className="py-3 px-4 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {filteredCustomers.map((cust) => {
                          const balance = cust.current_balance ?? 0;
                          const hasDebt = balance > 0;
                          const pkgInfo = customerPackagesMap.get(cust.id);
                          const packageCount = pkgInfo?.count ?? 0;
                          const packageDebts = pkgInfo?.debts ?? {};

                          return (
                            <tr
                              key={cust.id}
                              onClick={() => setSelectedCustomerId(cust.id)}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                            >
                              <td className="py-3 px-4">
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {cust.full_name}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {formatCustomerDocument(cust.document_type, cust.document_number)}
                                </p>
                              </td>

                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                <p>{cust.phone || "-"}</p>
                                {cust.email ? (
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{cust.email}</p>
                                ) : null}
                              </td>

                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={cn(
                                      "inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold",
                                      hasDebt
                                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                        : balance < 0
                                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    )}
                                  >
                                    {hasDebt ? "Con deuda" : balance < 0 ? "A favor" : "Al día"}
                                  </span>

                                  {packageCount > 0 && (
                                    <span
                                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60"
                                      title={`Adeuda envases: ${Object.entries(packageDebts)
                                        .map(([k, v]) => `${v}x ${k}`)
                                        .join(", ")}`}
                                    >
                                      <Package className="h-3 w-3" />
                                      <span>{packageCount} {packageCount === 1 ? "envase" : "envases"}</span>
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <span
                                  className={cn(
                                    "text-sm font-bold font-mono",
                                    hasDebt
                                      ? "text-rose-600 dark:text-rose-400"
                                      : balance < 0
                                      ? "text-blue-600 dark:text-blue-400"
                                      : "text-emerald-600 dark:text-emerald-400"
                                  )}
                                >
                                  {currency.format(balance)}
                                </span>
                              </td>

                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5 justify-center">
                                  {cust.current_balance > 0 ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handleSendCustomerWhatsApp(cust);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/80 transition cursor-pointer"
                                      title="Enviar estado de cuenta por WhatsApp"
                                    >
                                      <WhatsAppIcon className="h-3.5 w-3.5 fill-current text-emerald-600 dark:text-emerald-400" />
                                      <span>Cobrar</span>
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCustomerId(cust.id);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200/90 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                                  >
                                    <span>Ver cuenta</span>
                                    <ArrowRight size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ============================================================== */}
                {/* 2. MOBILE VIEW: TARJETAS INDIVIDUALES (block md:hidden)        */}
                {/* ============================================================== */}
                <div className="block md:hidden space-y-3">
                  {filteredCustomers.map((cust) => {
                    const balance = cust.current_balance ?? 0;
                    const hasDebt = balance > 0;
                    const pkgInfo = customerPackagesMap.get(cust.id);
                    const packageCount = pkgInfo?.count ?? 0;
                    const packageDebts = pkgInfo?.debts ?? {};

                    return (
                      <article
                        key={cust.id}
                        onClick={() => setSelectedCustomerId(cust.id)}
                        className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5 transition-all hover:border-blue-400 dark:hover:border-blue-600 active:scale-[0.99] cursor-pointer"
                      >
                        {/* Zona 1: Metadata Pills & Quick Status Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono border border-slate-200/70 dark:border-slate-700/60 truncate max-w-[150px]">
                              {formatCustomerDocument(cust.document_type, cust.document_number)}
                            </span>
                            {cust.current_account_enabled ? (
                              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-medium text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60">
                                CC activa
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                Sin CC
                              </span>
                            )}
                          </div>

                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border shrink-0",
                              hasDebt
                                ? "bg-rose-50 border-rose-200/80 text-rose-700 dark:bg-rose-950/60 dark:border-rose-900/60 dark:text-rose-300"
                                : balance < 0
                                ? "bg-blue-50 border-blue-200/80 text-blue-700 dark:bg-blue-950/60 dark:border-blue-900/60 dark:text-blue-300"
                                : "bg-emerald-50 border-emerald-200/80 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800/60 dark:text-emerald-300"
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full shrink-0",
                                hasDebt
                                  ? "bg-rose-500"
                                  : balance < 0
                                  ? "bg-blue-500"
                                  : "bg-emerald-500"
                              )}
                            />
                            <span>{hasDebt ? "Con deuda" : balance < 0 ? "A favor" : "Al día"}</span>
                          </span>
                        </div>

                        {/* Zona 2: Primary Name / Title */}
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug line-clamp-2">
                            {cust.full_name}
                          </h3>
                          {cust.fiscal_business_name && cust.fiscal_business_name !== cust.full_name ? (
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                              {cust.fiscal_business_name}
                            </p>
                          ) : null}
                        </div>

                        {/* Zona 3: Main KPI & Circular Row Actions */}
                        <div className="flex items-end justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              SALDO ACTUAL ADEUDADO
                            </span>
                            <span
                              className={cn(
                                "text-xl font-black tracking-tight font-mono leading-tight",
                                hasDebt
                                  ? "text-rose-600 dark:text-rose-400"
                                  : balance < 0
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                              )}
                            >
                              {currency.format(balance)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {cust.current_balance > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleSendCustomerWhatsApp(cust);
                                }}
                                className="!rounded-full h-9 w-9 inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
                                title="Enviar cobranza por WhatsApp"
                                aria-label="Enviar cobranza por WhatsApp"
                              >
                                <WhatsAppIcon className="h-4 w-4 fill-current" />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomerId(cust.id);
                              }}
                              className="!rounded-full h-9 w-9 inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
                              title="Ver cuenta corriente"
                              aria-label="Ver cuenta corriente"
                            >
                              <ArrowRight size={16} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>

                        {/* Zona 4: Secondary Metrics Sub-panel (Contacto y Envases) */}
                        {(cust.phone || cust.email || packageCount > 0) && (
                          <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 p-2.5 grid grid-cols-2 text-center divide-x divide-slate-200/70 dark:bg-slate-800/40 dark:border-slate-700/60 dark:divide-slate-700/60 gap-1 text-xs">
                            <div className="px-1 text-left truncate">
                              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                                Contacto
                              </span>
                              <span
                                className="text-slate-700 dark:text-slate-300 font-medium truncate block text-xs"
                                title={cust.phone || cust.email || ""}
                              >
                                {cust.phone || cust.email || "-"}
                              </span>
                            </div>
                            <div className="px-1 text-left truncate pl-2.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                                Envases
                              </span>
                              {packageCount > 0 ? (
                                <span
                                  className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400 truncate"
                                  title={`Adeuda envases: ${Object.entries(packageDebts)
                                    .map(([k, v]) => `${v}x ${k}`)
                                    .join(", ")}`}
                                >
                                  <Package size={12} className="shrink-0" />
                                  <span className="truncate">
                                    {packageCount} {packageCount === 1 ? "envase" : "envases"}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-500 dark:text-slate-400">0 envases</span>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Modal de Filtros Avanzados para Móvil */}
        {isFiltersModalOpen && (
          <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                    <SlidersHorizontal size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Filtros de cuentas
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Filtrar cuentas corrientes de clientes
                    </p>
                  </div>
                </div>
                <ModalCloseButton label="Cerrar filtros" onClick={() => setIsFiltersModalOpen(false)} />
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {[
                  {
                    key: "all" as const,
                    label: "Todos los clientes",
                    description: "Muestra la totalidad de clientes registrados en el sistema",
                    count: customers.length,
                  },
                  {
                    key: "debt" as const,
                    label: "Con deuda ($)",
                    description: "Clientes con saldo deudor acumulado a cobrar",
                    count: customersWithDebtCount,
                    badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
                  },
                  {
                    key: "packages" as const,
                    label: "Con envases retornables",
                    description: "Clientes que adeudan envases o cajones",
                    count: customersWithPackagesCount,
                    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
                  },
                  ...(customersWithBothCount > 0
                    ? [
                        {
                          key: "both" as const,
                          label: "Deuda monetaria + Envases",
                          description: "Clientes con saldo deudor y retención de envases",
                          count: customersWithBothCount,
                          badgeClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
                        },
                      ]
                    : []),
                  {
                    key: "zero" as const,
                    label: "Al día (Sin pendientes)",
                    description: "Clientes sin deuda monetaria y sin envases adeudados",
                    count: customersUpToDateCount,
                    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
                  },
                ].map((opt) => {
                  const isSelected = filterMode === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setFilterMode(opt.key);
                        setIsFiltersModalOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer",
                        isSelected
                          ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500/30 shadow-xs"
                          : "border-slate-200/80 bg-slate-50/50 hover:bg-slate-100/70 text-slate-700 dark:border-slate-700/70 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800/80"
                      )}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full shrink-0",
                              isSelected ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
                            )}
                          />
                          <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {opt.label}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-4">
                          {opt.description}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0",
                          opt.badgeClass ||
                            "bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                        )}
                      >
                        {opt.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Criterio de ordenamiento
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { col: "balance" as const, dir: "desc" as const, label: "Saldo: Mayor a menor ($$)" },
                      { col: "balance" as const, dir: "asc" as const, label: "Saldo: Menor a mayor ($)" },
                      { col: "name" as const, dir: "asc" as const, label: "Cliente: A - Z" },
                      { col: "name" as const, dir: "desc" as const, label: "Cliente: Z - A" },
                      { col: "status" as const, dir: "desc" as const, label: "Envases: Mayor a menor" },
                      { col: "contact" as const, dir: "asc" as const, label: "Contacto: A - Z" },
                    ].map((s) => {
                      const isActive = sortColumn === s.col && sortDirection === s.dir;
                      return (
                        <button
                          key={`${s.col}_${s.dir}`}
                          type="button"
                          onClick={() => {
                            setSortColumn(s.col);
                            setSortDirection(s.dir);
                          }}
                          className={cn(
                            "p-2.5 rounded-xl border text-left font-medium transition cursor-pointer",
                            isActive
                              ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200 font-bold"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750"
                          )}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-200/80 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode("all");
                    setIsFiltersModalOpen(false);
                  }}
                  className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Limpiar filtros
                </button>
                <button
                  type="button"
                  onClick={() => setIsFiltersModalOpen(false)}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </section>
        )}

        {isCreateCustomerModalOpen && (
          <PosCustomerModal
            mode="create"
            initialValues={{
              ...defaultPosModalValues,
              currentAccountEnabled: true,
            }}
            currentBalance={0}
            disabled={isSubmittingCustomer}
            onCancel={() => setIsCreateCustomerModalOpen(false)}
            onSubmit={handleCreateCustomerSubmit}
          />
        )}

        <WhatsAppPhonePromptModal
          isOpen={wspPromptState.isOpen}
          onClose={() => setWspPromptState((prev) => ({ ...prev, isOpen: false }))}
          onConfirm={(phone) => {
            setWspPromptState((prev) => ({ ...prev, isOpen: false }));
            openWhatsAppChat(phone, wspPromptState.message);
          }}
          defaultPhone={wspPromptState.phone}
          recipientName={wspPromptState.recipientName}
        />
      </div>
    </div>
  );
};