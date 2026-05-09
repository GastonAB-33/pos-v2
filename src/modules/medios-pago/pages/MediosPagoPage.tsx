import { useEffect, useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { PaymentMethodForm } from "@/modules/medios-pago/components/PaymentMethodForm";
import { PaymentMethodsTable } from "@/modules/medios-pago/components/PaymentMethodsTable";
import { PaymentMethodsToolbar } from "@/modules/medios-pago/components/PaymentMethodsToolbar";
import { usePaymentMethodsCrud } from "@/modules/medios-pago/hooks/usePaymentMethodsCrud";
import {
  getPaymentMethodPosConfig,
  getPaymentMethodTypeLabel,
} from "@/services/payment-methods.service";
import type { PaymentMethod } from "@/types/entities";
import type { PaymentMethodFormValues } from "@/modules/medios-pago/schemas/payment-method-form.schema";

const getPosRequestedFields = (paymentMethod: PaymentMethod): string[] => {
  const config = getPaymentMethodPosConfig(paymentMethod);
  const labels: string[] = [];

  if (config.ask_destination_bank) labels.push("Cuenta destino");
  if (config.ask_coupon_number) labels.push("Cupon");
  if (config.ask_approval_number) labels.push("Aprobacion");
  if (config.ask_operation_number) labels.push("Operacion");
  if (config.ask_voucher_number) labels.push("Comprobante");
  if (config.ask_origin_bank) labels.push("Banco origen");
  if (config.ask_origin_account_holder) labels.push("Titular origen");
  if (config.ask_card_brand) labels.push("Marca tarjeta");
  if (config.ask_installment_plan) labels.push("Plan cuotas");
  if (config.ask_cheque_number) labels.push("Nro cheque");
  if (config.ask_cheque_due_date) labels.push("Vencimiento cheque");

  return labels;
};

const buildDestinationBankMessage = (paymentMethod: PaymentMethod): string => {
  const config = getPaymentMethodPosConfig(paymentMethod);
  if (!config.ask_destination_bank) return "Este medio no solicita cuenta bancaria destino en el POS.";
  if (!config.destination_bank_account_ids.length)
    return "Se puede elegir cualquier cuenta bancaria activa al cobrar.";
  return `Solo se podran elegir ${config.destination_bank_account_ids.length} cuenta(s) destino configurada(s).`;
};

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
  const selectedPosFields = useMemo(
    () => (selectedPaymentMethod ? getPosRequestedFields(selectedPaymentMethod) : []),
    [selectedPaymentMethod]
  );
  const selectedDestinationBankMessage = useMemo(
    () => (selectedPaymentMethod ? buildDestinationBankMessage(selectedPaymentMethod) : ""),
    [selectedPaymentMethod]
  );
  const selectedCommercialSummary = useMemo(() => {
    if (!selectedPaymentMethod) return "Sin ajustes comerciales configurados.";

    const surcharge = Number(selectedPaymentMethod.surcharge_percent ?? 0);
    const discount = Number(selectedPaymentMethod.discount_percent ?? 0);

    if (!surcharge && !discount) return "Sin recargo ni descuento.";
    if (surcharge && !discount) return `Recargo del ${surcharge.toLocaleString("es-AR")}%.`;
    if (!surcharge && discount) return `Descuento del ${discount.toLocaleString("es-AR")}%.`;
    return `Recargo ${surcharge.toLocaleString("es-AR")}% y descuento ${discount.toLocaleString("es-AR")}%.`;
  }, [selectedPaymentMethod]);

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
    <PagePlaceholder
      title="Medios de pago"
      description="Catalogo fijo del sistema con configuracion por medio"
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
                <p className="payment-method-panel__eyebrow">Medio seleccionado</p>
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

            <div className="payment-method-panel__info-grid">
              <article className="payment-method-panel__info-card">
                <p className="payment-method-panel__info-title">Datos a pedir en el POS</p>
                {selectedPosFields.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPosFields.map((field) => (
                      <span key={field} className="payment-method-chip payment-method-chip--accent">
                        {field}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    Este medio puede usarse en caja sin pedir datos adicionales.
                  </p>
                )}
              </article>

              <article className="payment-method-panel__info-card">
                <p className="payment-method-panel__info-title">Cuentas destino</p>
                <p className="text-sm text-slate-700">{selectedDestinationBankMessage}</p>
              </article>

              <article className="payment-method-panel__info-card">
                <p className="payment-method-panel__info-title">Ajustes comerciales</p>
                <p className="text-sm text-slate-700">{selectedCommercialSummary}</p>
              </article>
            </div>

            <div className="payment-method-panel__form-wrap">
              <p className="payment-method-panel__info-title">Configuracion editable</p>
              <p className="mb-3 text-xs text-slate-500">
                Defini que datos queres solicitar a tu equipo en el POS cuando cobren con este
                medio.
              </p>
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
