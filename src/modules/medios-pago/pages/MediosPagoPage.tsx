import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { LoadingState } from "@/components/ui/UiStates";
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
import { cn } from "@/utils/cn";

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

    await updatePaymentMethod(selectedPaymentMethod.id, values);
  };

  if (!tenantId) {
    return (
      <section className="ui-panel p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No hay un comercio activo.
      </section>
    );
  }

  if (!canReadPaymentMethods) {
    return (
      <section className="ui-panel p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No tienes permisos de lectura para este módulo.
      </section>
    );
  }

  return (
    <div className="ui-page operational-page medios-pago-page space-y-4 w-full min-w-0 max-w-full">
      {/* Encabezado Principal Flotante Moderno */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">SISTEMA</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">MEDIOS DE PAGO</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Medios de Pago
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Activa, desactiva y configura cómo se cobran las ventas, recargos y cuentas destino.
          </p>
        </div>

        {/* Fila de Botones Píldora */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => void reload()}
            disabled={isLoading || isSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <RefreshCw className={cn("h-4 w-4 text-slate-500 dark:text-slate-400", isLoading && "animate-spin")} />
            <span>Actualizar</span>
          </button>
        </div>
      </header>

      {/* Buscador Integrado */}
      <PaymentMethodsToolbar
        loading={isLoading || isSubmitting}
        search={search}
        onSearchChange={setSearch}
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
          message="Cargando medios de pago..."
          description="Sincronizando cuentas bancarias, pasarelas y métodos habilitados..."
        />
      ) : (
        <PaymentMethodsTable
          paymentMethods={paymentMethods}
          selectedPaymentMethodId={selectedPaymentMethodId}
          disabled={isSubmitting}
          onSelect={handleSelectClick}
        />
      )}

      {/* Panel de Configuración del Medio Seleccionado */}
      {selectedPaymentMethod ? (
        <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {selectedPaymentMethod.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Código: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{selectedPaymentMethod.code}</span> | Tipo:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">{getPaymentMethodTypeLabel(selectedPaymentMethod.type)}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold font-mono border",
                  selectedPaymentMethod.is_active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60"
                    : "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/60"
                )}
              >
                {selectedPaymentMethod.is_active ? "Activo" : "Inactivo"}
              </span>

              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border",
                  selectedPaymentMethod.affects_cash
                    ? "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60"
                    : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                )}
              >
                {selectedPaymentMethod.affects_cash ? "Impacta en caja diaria" : "No impacta en caja"}
              </span>

              <button
                type="button"
                onClick={() => void handleToggleClick(selectedPaymentMethod)}
                disabled={isSubmitting || !canWritePaymentMethods}
                className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                {selectedPaymentMethod.is_active ? "Desactivar medio" : "Activar medio"}
              </button>
            </div>
          </div>

          <div>
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
  );
};
