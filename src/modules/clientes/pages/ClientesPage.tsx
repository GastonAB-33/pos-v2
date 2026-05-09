import { useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { CustomerCurrentAccountPanel } from "@/modules/clientes/components/CustomerCurrentAccountPanel";
import { CustomerForm } from "@/modules/clientes/components/CustomerForm";
import { CustomersTable } from "@/modules/clientes/components/CustomersTable";
import { CustomersToolbar } from "@/modules/clientes/components/CustomersToolbar";
import { useCustomersCrud } from "@/modules/clientes/hooks/useCustomersCrud";
import { PosCustomerModal, type PosCustomerModalValues } from "@/modules/pos/components/PosCustomerModal";
import { posCustomerProfilesService } from "@/services/pos-customer-profiles.service";
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
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadClientes = canRead("clientes");
  const canWriteClientes = canWrite("clientes");

  const {
    customers,
    priceLists,
    search,
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

    const confirmed = window.confirm(`Eliminar cliente ${customer.full_name}?`);
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
      documentNumber: fiscalCuit || values.documentNumber.trim(),
      fiscalBusinessName: values.fiscalBusinessName,
      fiscalAddress: values.fiscalAddress,
      fiscalCondition: values.fiscalCondition,
      priceListId: "",
      phone: values.phone,
      email: values.email,
      address: values.address,
      observations: "",
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

  const refreshAfterMovement = async () => {
    await reload();
  };

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="Clientes"
        description="No hay tenant activo para operar el modulo"
      />
    );
  }

  if (!canReadClientes) {
    return (
      <PagePlaceholder
        title="Clientes"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder title="Clientes" description="CRUD funcional con base de cuenta corriente">
      <div className="space-y-4">
        <CustomersToolbar
          canWrite={canWriteClientes}
          loading={isLoading || isSubmitting}
          search={search}
          onSearchChange={setSearch}
          onCreate={handleCreateClick}
          onReload={() => void reload()}
        />

        {feedback ? <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>{feedback.message}</div> : null}

        {isLoading ? (
          <div className="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
            Cargando clientes...
          </div>
        ) : (
          <CustomersTable
            customers={customers}
            priceListNameById={priceListNameById}
            canWrite={canWriteClientes}
            onViewCurrentAccount={handleOpenCurrentAccount}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onToggleActive={handleToggleClick}
          />
        )}

        {currentAccountCustomer ? (
          <CustomerCurrentAccountPanel
            tenantId={tenantId}
            userId={user?.id ?? null}
            customer={currentAccountCustomer}
            canWrite={canWriteClientes}
            onClose={() => setCurrentAccountCustomer(null)}
            onBalanceUpdated={() => {
              void refreshAfterMovement();
            }}
          />
        ) : null}

        {formOpen ? (
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-4 text-base font-semibold text-slate-900">
              {formMode === "create" ? "Crear cliente" : "Editar cliente"}
            </h3>
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
          </section>
        ) : null}

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
      </div>
    </PagePlaceholder>
  );
};
