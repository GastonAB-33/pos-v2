import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { LoadingState } from "@/components/ui/UiStates";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/useToast";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { CustomerCurrentAccountPanel } from "@/modules/clientes/components/CustomerCurrentAccountPanel";
import { useCurrentAccountsPage } from "@/modules/cuentas-corrientes/hooks/useCurrentAccountsPage";
import { PosCustomerModal, type PosCustomerModalValues } from "@/modules/pos/components/PosCustomerModal";
import { customersService } from "@/services/customers.service";
import { auditService } from "@/services/audit.service";
import { posCustomerProfilesService } from "@/services/pos-customer-profiles.service";
import {
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowRight,
  UserCheck,
  UserPlus,
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
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  const initialCustomerId = searchParams.get("customerId") ?? searchParams.get("clienteId");

  const {
    customers,
    filteredCustomers,
    selectedCustomer,
    setSelectedCustomerId,
    search,
    setSearch,
    filterMode,
    setFilterMode,
    totalDebt,
    customersWithDebtCount,
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

  const handleCreateCustomerSubmit = async (values: PosCustomerModalValues) => {
    if (!tenantId) return;
    setIsSubmittingCustomer(true);
    try {
      const normalizeNamePart = (part: string) => part.trim();
      const firstName = normalizeNamePart(values.firstName);
      const lastName = normalizeNamePart(values.lastName);
      const fullName = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
      const fiscalCuit = (values.fiscalCuit ?? "").trim();
      const parsedLimit = Number(values.currentAccountLimit ?? "");
      const currentAccountLimit =
        (values.currentAccountLimit ?? "").trim() &&
        Number.isFinite(parsedLimit) &&
        parsedLimit >= 0
          ? Number(parsedLimit.toFixed(2))
          : null;

      const created = await customersService.create(tenantId, {
        code: buildCustomerCode(fullName),
        full_name: fullName,
        document_type: fiscalCuit ? "cuit" : values.documentType,
        document_number: fiscalCuit || values.documentNumber.trim(),
        fiscal_business_name: values.fiscalBusinessName?.trim() || null,
        fiscal_address: values.fiscalAddress?.trim() || null,
        fiscal_condition: values.fiscalCondition?.trim() || null,
        price_list_id: null,
        phone: values.phone?.trim() || null,
        email: values.email?.trim() || null,
        address: values.address?.trim() || null,
        observations: null,
        current_account_enabled: values.currentAccountEnabled,
        current_account_limit: currentAccountLimit,
        current_balance: 0,
        is_active: true,
      });

      if (created) {
        await auditService.createSafe(tenantId, {
          user_id: user?.id ?? null,
          module: "clientes",
          action: "create",
          entity_type: "customer",
          entity_id: created.id,
          description: `Cliente creado desde Cuentas Corrientes: ${created.full_name}`,
          metadata: { full_name: created.full_name },
        });

        posCustomerProfilesService.saveProfile(tenantId, created.id, {
          enabled: values.currentAccountEnabled,
          limit: currentAccountLimit,
        });

        toast.success(`Cliente "${created.full_name}" creado con éxito`);
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
    return (
      <PagePlaceholder
        title="Cuentas Corrientes Clientes"
        description="No hay un comercio activo"
      />
    );
  }

  if (!canReadCurrentAccounts) {
    return (
      <PagePlaceholder
        title="Cuentas Corrientes Clientes"
        description="No tenés permisos de lectura para este módulo"
      />
    );
  }

  return (
    <PagePlaceholder
      title="Cuentas Corrientes Clientes"
      description="Control de saldos, deudas y cobranzas de clientes"
    >
      <div className="cuentas-corrientes-clientes-workspace space-y-4">
        {/* 3 Paneles KPI Superiores: solo visibles en el listado general de clientes */}
        {!selectedCustomer && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <article className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                  Deuda Total de Clientes
                </span>
                <Users className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-rose-900 dark:text-rose-100">
                {currency.format(totalDebt)}
              </p>
              <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
                Saldo acumulado a cobrar
              </p>
            </article>

            <article className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Clientes con Saldo Pendiente
                </span>
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-amber-900 dark:text-amber-100">
                {customersWithDebtCount}
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                De {customers.length} clientes activos
              </p>
            </article>

            <article className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Clientes al Día
                </span>
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-900 dark:text-emerald-100">
                {customersUpToDateCount}
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                Sin saldo deudor pendiente
              </p>
            </article>
          </div>
        )}

        {/* Flujo: Si hay un cliente seleccionado, se muestra el detalle con sus movimientos y acciones */}
        {selectedCustomer ? (
          <CustomerCurrentAccountPanel
            tenantId={tenantId}
            userId={user?.id ?? null}
            customer={selectedCustomer}
            canWrite={canWriteCurrentAccounts}
            onClose={() => setSelectedCustomerId(null)}
            onBalanceUpdated={() => {
              void reload();
            }}
          />
        ) : (
          /* Si no hay cliente seleccionado, se muestra la lista completa de clientes a ancho completo */
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            {/* Toolbar con Buscador, Filtros y Recargar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar cliente por nombre, documento, email o teléfono..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      filterMode === "all"
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Todos ({customers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("debt")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      filterMode === "debt"
                        ? "bg-rose-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Con deuda ({customersWithDebtCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("zero")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      filterMode === "zero"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Al día ({customersUpToDateCount})
                  </button>
                </div>

                {canCreateCustomer && (
                  <button
                    type="button"
                    onClick={() => setIsCreateCustomerModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  >
                    <UserPlus size={14} />
                    <span>Nuevo cliente</span>
                  </button>
                )}

                <IconButton
                  icon={RefreshCw}
                  label="Recargar clientes"
                  onClick={() => {
                    clearFeedback();
                    void reload();
                  }}
                  loading={isLoading}
                />
              </div>
            </div>

            {/* Tabla Completa de Clientes */}
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-12">
                  <LoadingState message="Cargando cuentas de clientes..." />
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <UserCheck className="h-10 w-10 text-slate-300 mx-auto mb-2 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    No se encontraron clientes
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Prueba cambiando el término de búsqueda o el filtro seleccionado.
                  </p>
                  {canCreateCustomer && (
                    <button
                      type="button"
                      onClick={() => setIsCreateCustomerModalOpen(true)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                    >
                      <UserPlus size={14} />
                      <span>Crear nuevo cliente</span>
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Contacto</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Saldo Actual</th>
                      <th className="py-3 px-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCustomers.map((cust) => {
                      const balance = cust.current_balance ?? 0;
                      const hasDebt = balance > 0;

                      return (
                        <tr
                          key={cust.id}
                          onClick={() => setSelectedCustomerId(cust.id)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer dark:hover:bg-slate-800/50"
                        >
                          <td className="py-3 px-4">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {cust.full_name}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {cust.document_type?.toUpperCase()} {cust.document_number}
                            </p>
                          </td>

                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            <p>{cust.phone || "-"}</p>
                            {cust.email ? (
                              <p className="text-[11px] text-slate-400">{cust.email}</p>
                            ) : null}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                hasDebt
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                  : balance < 0
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              }`}
                            >
                              {hasDebt ? "Con deuda" : balance < 0 ? "A favor" : "Al día"}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span
                              className={`text-sm font-bold ${
                                hasDebt
                                  ? "text-rose-600 dark:text-rose-400"
                                  : balance < 0
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {currency.format(balance)}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomerId(cust.id);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              <span>Ingresar</span>
                              <ArrowRight size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
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
      </div>
    </PagePlaceholder>
  );
};
