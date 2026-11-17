import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WalletCards } from "lucide-react";
import { LoadingState } from "@/components/ui/UiStates";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { routePaths } from "@/config/routes";
import { CustomerForm } from "@/modules/clientes/components/CustomerForm";
import { CustomersTable } from "@/modules/clientes/components/CustomersTable";
import {
  CustomersToolbar,
  type CustomersFiltersState,
} from "@/modules/clientes/components/CustomersToolbar";
import { useCustomersCrud } from "@/modules/clientes/hooks/useCustomersCrud";
import { PosCustomerModal, type PosCustomerModalValues } from "@/modules/pos/components/PosCustomerModal";
import { posCustomerProfilesService } from "@/services/pos-customer-profiles.service";
import { cn } from "@/utils/cn";
import type { Customer } from "@/types/entities";
import type { CustomerFormValues } from "@/modules/clientes/schemas/customer-form.schema";

type FormMode = "create" | "edit";

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
  currentAccountEnabled: false,
  currentAccountLimit: "",
};

export const ClientesPage = () => {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadClientes = canRead("clientes");
  const canWriteClientes = canWrite("clientes");

  const {
    customers,
    totalCount,
    priceLists,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    toggleCustomerActive,
  } = useCustomersCrud(tenantId, user?.id ?? null);

  const [filters, setFilters] = useState<CustomersFiltersState>({
    search: "",
    status: "all",
    priceListId: "",
    account: "all",
  });

  const handleFiltersChange = (patch: Partial<CustomersFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    if (patch.search !== undefined) {
      setSearch(patch.search);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      priceListId: "",
      account: "all",
    });
    setSearch("");
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      if (filters.status === "active" && !customer.is_active) return false;
      if (filters.status === "inactive" && customer.is_active) return false;
      if (filters.priceListId && customer.price_list_id !== filters.priceListId) return false;
      if (filters.account === "enabled" && !customer.current_account_enabled) return false;
      if (filters.account === "with_debt" && (customer.current_balance ?? 0) <= 0) return false;
      return true;
    });
  }, [customers, filters.status, filters.priceListId, filters.account]);

  const resetPaginationKey = `${filters.search}-${filters.status}-${filters.priceListId}-${filters.account}`;
  const paginatedCustomers = usePagination(filteredCustomers, 10, resetPaginationKey);

  const priceListNameById = useMemo(
    () =>
      new Map(
        priceLists.map((priceList) => [
          priceList.id,
          `${priceList.name}${priceList.is_active ? "" : " (inactiva)"}`,
        ])
      ),
    [priceLists]
  );

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(undefined);
  const [currentAccountCustomer, setCurrentAccountCustomer] = useState<Customer | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const handleCreateClick = () => {
    if (!canWriteClientes) return;
    clearFeedback();
    setCreateModalOpen(true);
  };

  const handleEditClick = (customer: Customer) => {
    if (!canWriteClientes) return;
    clearFeedback();
    setFormMode("edit");
    setSelectedCustomer(customer);
    setFormOpen(true);
  };

  const handleDeleteClick = async (customer: Customer) => {
    if (!canWriteClientes) return;

    const confirmed = window.confirm(`¿Eliminar cliente ${customer.full_name}?`);
    if (!confirmed) return;

    await deleteCustomer(customer.id);
  };

  const handleToggleClick = async (customer: Customer) => {
    if (!canWriteClientes) return;
    await toggleCustomerActive(customer.id);
  };

  const handleSubmitForm = async (values: CustomerFormValues) => {
    if (formMode === "create") {
      await createCustomer(values);
    } else if (selectedCustomer) {
      await updateCustomer(selectedCustomer.id, values);
    }

    setFormOpen(false);
    setSelectedCustomer(undefined);
  };

  const handleCreateFromPosModal = async (values: PosCustomerModalValues) => {
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

    const created = await createCustomer({
      fullName,
      documentType: fiscalCuit ? "cuit" : values.documentType,
      documentNumber: fiscalCuit || (values.documentNumber ?? "").trim(),
      fiscalBusinessName: values.fiscalBusinessName,
      fiscalAddress: values.fiscalAddress,
      fiscalCondition: values.fiscalCondition,
      priceListId: "",
      phone: values.phone,
      email: values.email,
      address: values.address,
      observations: "",
      currentAccountEnabled: values.currentAccountEnabled,
      currentAccountLimit: values.currentAccountLimit,
    });

    if (!tenantId || !created) return;

    posCustomerProfilesService.saveProfile(tenantId, created.id, {
      enabled: values.currentAccountEnabled,
      limit: currentAccountLimit,
    });

    setCreateModalOpen(false);
  };

  const handleOpenCurrentAccount = (customer: Customer) => {
    setCurrentAccountCustomer(customer);
  };

  const goToCurrentAccountModule = (customer: Customer) => {
    const searchParams = new URLSearchParams({
      clienteId: customer.id,
      from: "clientes",
    });

    navigate(`${routePaths.cuentasCorrientes}?${searchParams.toString()}`);
  };

  if (!tenantId) {
    return (
      <section className="ui-panel operational-page p-4 sm:p-6">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No hay un comercio activo seleccionado.
        </div>
      </section>
    );
  }

  if (!canReadClientes) {
    return (
      <section className="ui-panel operational-page p-4 sm:p-6">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No tienes permisos de lectura para este módulo.
        </div>
      </section>
    );
  }

  return (
    <section className="ui-panel operational-page customers-page space-y-4 w-full min-w-0 max-w-full overflow-hidden">
      <CustomersToolbar
        canWrite={canWriteClientes}
        loading={isLoading || isSubmitting}
        totalCount={totalCount ?? customers.length}
        filteredCount={filteredCustomers.length}
        filters={filters}
        priceLists={priceLists}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        onCreate={handleCreateClick}
        onReload={() => void reload()}
      />

      {feedback ? (
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm font-medium",
            feedback.type === "success" ? "ui-success-state" : "ui-error-state"
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      {isLoading ? (
        <LoadingState
          message="Cargando listado de clientes..."
          description="Sincronizando clientes registrados, cuentas corrientes y datos de facturación..."
        />
      ) : (
        <>
          <CustomersTable
            customers={paginatedCustomers.pageItems}
            priceListNameById={priceListNameById}
            canWrite={canWriteClientes}
            onViewCurrentAccount={handleOpenCurrentAccount}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onToggleActive={handleToggleClick}
          />

          <PaginationControls
            currentPage={paginatedCustomers.currentPage}
            pageCount={paginatedCustomers.pageCount}
            startItem={paginatedCustomers.startItem}
            endItem={paginatedCustomers.endItem}
            totalItems={paginatedCustomers.totalItems}
            onPageChange={paginatedCustomers.setCurrentPage}
          />
        </>
      )}

      {/* Resumen flotante de cuenta corriente */}
      {currentAccountCustomer ? (
        <CustomerCurrentAccountSummary
          customer={currentAccountCustomer}
          onOpenModule={() => goToCurrentAccountModule(currentAccountCustomer)}
          onClose={() => setCurrentAccountCustomer(null)}
        />
      ) : null}

      {/* Modal de edición / creación con CustomerForm */}
      {formOpen ? (
        <section className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Cerrar formulario de cliente"
            onClick={() => {
              setFormOpen(false);
              setSelectedCustomer(undefined);
            }}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <span className="text-slate-400 dark:text-slate-500">CLIENTES</span>
                  <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    {formMode === "create" ? "NUEVO CLIENTE" : "EDITAR CLIENTE"}
                  </span>
                </div>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formMode === "create"
                    ? "Crear cliente"
                    : `Editar: ${selectedCustomer?.full_name ?? "Cliente"}`}
                </h3>
              </div>
              <ModalCloseButton
                label="Cerrar modal de cliente"
                onClick={() => {
                  setFormOpen(false);
                  setSelectedCustomer(undefined);
                }}
                disabled={isSubmitting}
              />
            </div>
            <CustomerForm
              mode={formMode}
              customer={selectedCustomer}
              priceLists={priceLists}
              disabled={isSubmitting}
              onCancel={() => {
                setFormOpen(false);
                setSelectedCustomer(undefined);
              }}
              onSubmit={handleSubmitForm}
            />
          </div>
        </section>
      ) : null}

      {/* Modal de creación ágil PosCustomerModal */}
      {createModalOpen ? (
        <PosCustomerModal
          mode="create"
          initialValues={defaultPosModalValues}
          currentBalance={0}
          disabled={isSubmitting}
          onCancel={() => setCreateModalOpen(false)}
          onSubmit={handleCreateFromPosModal}
        />
      ) : null}
    </section>
  );
};

interface CustomerCurrentAccountSummaryProps {
  customer: Customer;
  onOpenModule: () => void;
  onClose: () => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const CustomerCurrentAccountSummary = ({
  customer,
  onOpenModule,
  onClose,
}: CustomerCurrentAccountSummaryProps) => {
  const enabled = customer.current_account_enabled === true;
  const limit = customer.current_account_limit ?? null;
  const debt = Number((customer.current_balance ?? 0).toFixed(2));
  const available = enabled && limit != null ? Number((limit - debt).toFixed(2)) : null;

  return (
    <section className="space-y-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">CLIENTES</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">ESTADO DE CUENTA CORRIENTE</span>
          </div>
          <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
            {customer.full_name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Resumen de saldos, límites y acceso al historial de movimientos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenModule}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
          >
            <WalletCards size={14} />
            <span>Ver cuenta corriente</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Estado de cuenta</p>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
            {enabled ? (
              <span className="text-emerald-600 dark:text-emerald-400">Habilitada</span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">Deshabilitada</span>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total adeudado</p>
          <p
            className={cn(
              "mt-1 text-sm font-bold font-mono",
              debt > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"
            )}
          >
            {currency.format(debt)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Límite autorizado</p>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
            {enabled ? (limit == null ? "Sin límite" : currency.format(limit)) : "-"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Crédito disponible</p>
          <p
            className={cn(
              "mt-1 text-sm font-bold font-mono",
              available != null && available < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-600 dark:text-emerald-400"
            )}
          >
            {enabled ? (available == null ? "Sin tope" : currency.format(available)) : "-"}
          </p>
        </div>
      </div>
    </section>
  );
};

