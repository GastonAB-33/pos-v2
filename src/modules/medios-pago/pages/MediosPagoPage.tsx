import { useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { PaymentMethodForm } from "@/modules/medios-pago/components/PaymentMethodForm";
import { PaymentMethodsTable } from "@/modules/medios-pago/components/PaymentMethodsTable";
import { PaymentMethodsToolbar } from "@/modules/medios-pago/components/PaymentMethodsToolbar";
import { usePaymentMethodsCrud } from "@/modules/medios-pago/hooks/usePaymentMethodsCrud";
import type { PaymentMethod } from "@/types/entities";
import type { PaymentMethodFormValues } from "@/modules/medios-pago/schemas/payment-method-form.schema";

export const MediosPagoPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadPaymentMethods = canRead("medios_pago");
  const canWritePaymentMethods = canWrite("medios_pago");

  const {
    paymentMethods,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    togglePaymentMethod,
  } = usePaymentMethodsCrud(tenantId, user?.id ?? null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | undefined>(
    undefined
  );

  const handleCreateClick = () => {
    if (!canWritePaymentMethods) return;
    clearFeedback();
    setFormMode("create");
    setSelectedPaymentMethod(undefined);
    setFormOpen(true);
  };

  const handleEditClick = (paymentMethod: PaymentMethod) => {
    if (!canWritePaymentMethods) return;
    clearFeedback();
    setFormMode("edit");
    setSelectedPaymentMethod(paymentMethod);
    setFormOpen(true);
  };

  const handleDeleteClick = async (paymentMethod: PaymentMethod) => {
    if (!canWritePaymentMethods) return;

    const confirmed = window.confirm(`Eliminar medio de pago ${paymentMethod.name}?`);
    if (!confirmed) return;

    await deletePaymentMethod(paymentMethod.id);
  };

  const handleToggleClick = async (paymentMethod: PaymentMethod) => {
    if (!canWritePaymentMethods) return;
    await togglePaymentMethod(paymentMethod.id);
  };

  const handleSubmitForm = async (values: PaymentMethodFormValues) => {
    if (formMode === "create") {
      await createPaymentMethod(values);
    } else if (selectedPaymentMethod) {
      await updatePaymentMethod(selectedPaymentMethod.id, values);
    }

    setFormOpen(false);
    setSelectedPaymentMethod(undefined);
  };

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="Medios de pago"
        description="No hay tenant activo para operar el modulo"
      />
    );
  }

  if (!canReadPaymentMethods) {
    return (
      <PagePlaceholder
        title="Medios de pago"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder title="Medios de pago" description="CRUD tenant-scoped para POS y caja">
      <div className="space-y-4">
        <PaymentMethodsToolbar
          canWrite={canWritePaymentMethods}
          loading={isLoading || isSubmitting}
          search={search}
          onSearchChange={setSearch}
          onCreate={handleCreateClick}
          onReload={() => void reload()}
        />

        {feedback ? (
          <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>
            {feedback.message}
          </div>
        ) : null}

        {isLoading ? (
          <div className="ui-loading">Cargando medios de pago...</div>
        ) : (
          <PaymentMethodsTable
            paymentMethods={paymentMethods}
            canWrite={canWritePaymentMethods}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onToggleActive={handleToggleClick}
          />
        )}

        {formOpen ? (
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-4 text-base font-semibold text-slate-900">
              {formMode === "create" ? "Crear medio de pago" : "Editar medio de pago"}
            </h3>

            <PaymentMethodForm
              mode={formMode}
              paymentMethod={selectedPaymentMethod}
              disabled={isSubmitting}
              onCancel={() => {
                setFormOpen(false);
                setSelectedPaymentMethod(undefined);
              }}
              onSubmit={handleSubmitForm}
            />
          </section>
        ) : null}
      </div>
    </PagePlaceholder>
  );
};
