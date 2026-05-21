import { useCurrentAccount } from "@/modules/clientes/hooks/useCurrentAccount";
import { CurrentAccountAdjustmentModal } from "@/modules/clientes/components/CurrentAccountAdjustmentModal";
import { CurrentAccountMovementsTable } from "@/modules/clientes/components/CurrentAccountMovementsTable";
import { CurrentAccountPaymentModal } from "@/modules/clientes/components/CurrentAccountPaymentModal";
import { useState } from "react";
import type { Customer } from "@/types/entities";

interface CustomerCurrentAccountPanelProps {
  tenantId: string;
  userId: string | null;
  customer: Customer;
  canWrite: boolean;
  onClose: () => void;
  onBalanceUpdated: () => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const CustomerCurrentAccountPanel = ({
  tenantId,
  userId,
  customer,
  canWrite,
  onClose,
  onBalanceUpdated,
}: CustomerCurrentAccountPanelProps) => {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);

  const {
    movements,
    balance,
    paymentMethods,
    bankAccounts,
    originBanks,
    installmentPlans,
    saleDetailsById,
    debtSales,
    accountSummary,
    isLoading,
    isSubmitting,
    hasOpenCashSession,
    openCashSessionId,
    feedback,
    clearFeedback,
    reload,
    registerPayment,
    registerAdjustment,
  } = useCurrentAccount(tenantId, customer, userId);

  const submitPayment = async (values: {
    amount: number;
    payment_method_id: string;
    notes?: string;
    payment_details?: Record<string, unknown> | null;
    pricing_rule?: {
      mode: "original" | "update_to_today_price" | "surcharge_percentage" | "surcharge_fixed";
      surcharge_percent?: number;
      surcharge_amount?: number;
      notes?: string;
    } | null;
  }) => {
    const success = await registerPayment(values);
    if (!success) return false;
    onBalanceUpdated();
    return true;
  };

  const submitAdjustment = async (values: {
    mode: "original" | "update_to_today_price" | "surcharge_percentage" | "surcharge_fixed";
    surcharge_percent?: number;
    surcharge_amount?: number;
    notes?: string;
  }) => {
    const success = await registerAdjustment(values);
    if (!success) return false;
    onBalanceUpdated();
    return true;
  };

  const canRegisterPayment = canWrite && Boolean(userId) && hasOpenCashSession;
  const canUpdatePricingRule = canWrite && Boolean(userId);

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Cuenta corriente</h3>
          <p className="text-sm text-slate-600">{customer.full_name}</p>
          <p className="text-sm font-medium text-slate-900">Saldo actual: {currency.format(balance)}</p>
          <p className="text-sm font-medium text-brand-700">
            Saldo actualizado: {currency.format(accountSummary.updatedBalance)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              clearFeedback();
              void reload();
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={isLoading || isSubmitting}
          >
            Recargar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>

      {feedback ? <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>{feedback.message}</div> : null}
      {canWrite && !userId ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No hay usuario activo en sesion. Inicia sesion nuevamente para registrar pagos o ajustes.
        </div>
      ) : canWrite && !hasOpenCashSession ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No hay caja abierta para el usuario actual. Puedes consultar movimientos y actualizar la regla de saldo,
          pero para registrar pagos debes abrir caja.
        </div>
      ) : openCashSessionId ? (
        <p className="text-xs text-slate-500">Caja activa para movimientos contables: {openCashSessionId}</p>
      ) : null}

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="ui-btn-primary"
            onClick={() => setIsPaymentModalOpen(true)}
            disabled={isSubmitting || !canRegisterPayment}
          >
            Registrar pago
          </button>
          <button
            type="button"
            className="ui-btn-ghost"
            onClick={() => setIsAdjustmentModalOpen(true)}
            disabled={isSubmitting || !canUpdatePricingRule}
          >
            Realizar ajuste
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Sin permisos de escritura para registrar movimientos.</p>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-600">
          Cargando movimientos...
        </div>
      ) : (
        <CurrentAccountMovementsTable
          movements={movements}
          saleDetailsById={saleDetailsById}
          accountSummary={accountSummary}
        />
      )}

      <CurrentAccountPaymentModal
        open={isPaymentModalOpen}
        paymentMethods={paymentMethods}
        bankAccounts={bankAccounts}
        originBanks={originBanks}
        installmentPlans={installmentPlans}
        accountSummary={accountSummary}
        disabled={isSubmitting}
        onClose={() => setIsPaymentModalOpen(false)}
        onSubmit={submitPayment}
      />

      <CurrentAccountAdjustmentModal
        open={isAdjustmentModalOpen}
        debtSales={debtSales}
        accountSummary={accountSummary}
        disabled={isSubmitting}
        onClose={() => setIsAdjustmentModalOpen(false)}
        onSubmit={submitAdjustment}
      />
    </section>
  );
};
