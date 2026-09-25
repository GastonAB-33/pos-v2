import { useEffect } from "react";
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
import {
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowRight,
  UserCheck,
} from "lucide-react";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const CuentasCorrientesPage = () => {
  const [searchParams] = useSearchParams();
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const toast = useToast();
  const canReadCurrentAccounts = canRead("cuentas_corrientes");
  const canWriteCurrentAccounts = canWrite("cuentas_corrientes");

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
        {/* 3 Paneles KPI Superiores (mismo estilo que Proveedores) */}
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
      </div>
    </PagePlaceholder>
  );
};
