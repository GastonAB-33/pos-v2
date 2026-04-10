import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/UiStates";
import { useToast } from "@/components/ui/useToast";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { CustomerCurrentAccountPanel } from "@/modules/clientes/components/CustomerCurrentAccountPanel";
import { useCurrentAccountsPage } from "@/modules/cuentas-corrientes/hooks/useCurrentAccountsPage";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

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
    filteredCustomers,
    selectedCustomer,
    selectedCustomerId,
    setSelectedCustomerId,
    search,
    setSearch,
    isLoading,
    feedback,
    clearFeedback,
    reload,
  } = useCurrentAccountsPage(tenantId, initialCustomerId);

  useEffect(() => {
    if (!feedback) return;
    toast.error(feedback.message);
  }, [feedback, toast]);

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="Cuentas Corrientes"
        description="No hay tenant activo para operar el modulo"
      />
    );
  }

  if (!canReadCurrentAccounts) {
    return (
      <PagePlaceholder
        title="Cuentas Corrientes"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder
      title="Cuentas Corrientes"
      description="Vista operativa basica de saldos y movimientos por cliente"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar cliente por nombre, documento, email o telefono"
            className="min-w-72 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              clearFeedback();
              void reload();
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={isLoading}
          >
            Recargar
          </button>
        </div>

        {feedback ? (
          <ErrorState message={feedback.message} />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
            <header className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Clientes</h2>
              <span className="text-xs text-slate-500">{filteredCustomers.length} resultados</span>
            </header>

            {isLoading ? (
              <LoadingState message="Cargando clientes..." />
            ) : filteredCustomers.length ? (
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {filteredCustomers.map((customer) => {
                  const active = customer.id === selectedCustomerId;

                  return (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => setSelectedCustomerId(customer.id)}
                      className={[
                        "w-full rounded-lg border px-3 py-2 text-left transition",
                        active
                          ? "border-brand-200 bg-brand-50"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <p className="text-sm font-medium text-slate-900">{customer.full_name}</p>
                      <p className="text-xs text-slate-500">
                        {customer.document_type.toUpperCase()} {customer.document_number}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-700">
                        Saldo: {currency.format(customer.current_balance)}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState message="No hay clientes para mostrar." />
            )}
          </section>

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
            <EmptyState message="Selecciona un cliente para ver su cuenta corriente." />
          )}
        </div>
      </div>
    </PagePlaceholder>
  );
};
