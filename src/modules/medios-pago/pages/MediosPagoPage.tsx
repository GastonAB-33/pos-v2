import { useEffect, useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { PaymentMethodForm } from "@/modules/medios-pago/components/PaymentMethodForm";
import { PaymentMethodsTable } from "@/modules/medios-pago/components/PaymentMethodsTable";
import { PaymentMethodsToolbar } from "@/modules/medios-pago/components/PaymentMethodsToolbar";
import { usePaymentMethodsCrud } from "@/modules/medios-pago/hooks/usePaymentMethodsCrud";
import { getPaymentMethodTypeLabel } from "@/services/payment-methods.service";
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
    bankAccounts,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    updatePaymentMethod,
    togglePaymentMethod,
  } = usePaymentMethodsCrud(tenantId, user?.id ?? null);

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentMethods.length) {
      setSelectedPaymentMethodId(null);
      return;
    }

    setSelectedPaymentMethodId((current) => {
      if (current && paymentMethods.some((method) => method.id === current)) {
        return current;
      }

      return paymentMethods[0].id;
    });
  }, [paymentMethods]);

  const selectedPaymentMethod = useMemo(
    () => paymentMethods.find((method) => method.id === selectedPaymentMethodId),
    [paymentMethods, selectedPaymentMethodId]
  );
  const handleSelectClick = (paymentMethod: PaymentMethod) => {
    clearFeedback();
    setSelectedPaymentMethodId(paymentMethod.id);
  };

  const handleToggleClick = async (paymentMethod: PaymentMethod) => {
    if (!canWritePaymentMethods) return;
    await togglePaymentMethod(paymentMethod.id);
  };

  const handleSubmitForm = async (values: PaymentMethodFormValues) => {
    clearFeedback();
    if (!selectedPaymentMethod) return;

    const wasSuccessful = await updatePaymentMethod(selectedPaymentMethod.id, values);

    if (!wasSuccessful) return;
  };

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="Medios de pago"
        description="No hay un comercio activo"
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
    <PagePlaceholder
      title="Medios de pago"
      description="Activa, desactiva y configura como se cobran las ventas"
    >
      <div className="space-y-4">
        <PaymentMethodsToolbar
          loading={isLoading || isSubmitting}
          search={search}
          onSearchChange={setSearch}
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
            selectedPaymentMethodId={selectedPaymentMethodId}
            disabled={isSubmitting}
            onSelect={handleSelectClick}
          />
        )}

        {selectedPaymentMethod ? (
          <section className="payment-method-panel">
            <div className="payment-method-panel__hero">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-slate-900">{selectedPaymentMethod.name}</h3>
                <p className="text-xs text-slate-500">
                  Codigo <span className="font-mono">{selectedPaymentMethod.code}</span> |{" "}
                  {getPaymentMethodTypeLabel(selectedPaymentMethod.type)}
                </p>
              </div>

              <div className="payment-method-panel__chips">
                <span
                  className={
                    selectedPaymentMethod.is_active
                      ? "payment-method-chip payment-method-chip--success"
                      : "payment-method-chip payment-method-chip--danger"
                  }
                >
                  {selectedPaymentMethod.is_active ? "Activo" : "Inactivo"}
                </span>
                <span
                  className={
                    selectedPaymentMethod.affects_cash
                      ? "payment-method-chip payment-method-chip--accent"
                      : "payment-method-chip payment-method-chip--warn"
                  }
                >
                  {selectedPaymentMethod.affects_cash ? "Impacta caja" : "No impacta caja"}
                </span>
                <button
                  type="button"
                  className="ui-btn-ghost px-3 py-1.5 text-xs"
                  onClick={() => void handleToggleClick(selectedPaymentMethod)}
                  disabled={isSubmitting || !canWritePaymentMethods}
                >
                  {selectedPaymentMethod.is_active ? "Desactivar medio" : "Activar medio"}
                </button>
              </div>
            </div>

            <div className="payment-method-panel__form-wrap">
              <PaymentMethodForm
                paymentMethod={selectedPaymentMethod}
                bankAccounts={bankAccounts}
                disabled={isSubmitting || !canWritePaymentMethods}
                showHeader={false}
                onSubmit={handleSubmitForm}
              />
            </div>
          </section>
        ) : null}
      </div>
    </PagePlaceholder>
  );
};
