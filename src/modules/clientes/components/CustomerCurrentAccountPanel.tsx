import { useCurrentAccount } from "@/modules/clientes/hooks/useCurrentAccount";
import { CurrentAccountAdjustmentModal } from "@/modules/clientes/components/CurrentAccountAdjustmentModal";
import { CurrentAccountMovementsTable } from "@/modules/clientes/components/CurrentAccountMovementsTable";
import { CurrentAccountPaymentModal } from "@/modules/clientes/components/CurrentAccountPaymentModal";
import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
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
    <section className="current-account-detail ui-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Cuenta corriente</h3>
          <p className="text-sm text-slate-600">{customer.full_name}</p>
        </div>

        <div className="flex items-center gap-2">
          <IconButton
            icon={RefreshCw}
            label="Recargar cuenta corriente"
            onClick={() => {
              clearFeedback();
              void reload();
            }}
            loading={isLoading}
            disabled={isSubmitting}
          />
          <IconButton icon={X} label="Cerrar cuenta corriente" onClick={onClose} />
        </div>
      </div>

      <div className="current-account-balance-grid">
        <article>
          <p>Deuda original</p>
          <strong>{currency.format(balance)}</strong>
        </article>
        <article className="current-account-balance-grid__updated">
          <p>Saldo actualizado</p>
          <strong>{currency.format(accountSummary.updatedBalance)}</strong>
          <span title="El recargo o actualizacion vigente reemplaza al anterior; no se suma varias veces.">
            Regla vigente
          </span>
        </article>
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
      ) : hasOpenCashSession ? (
        <p className="text-xs text-emerald-700">Caja abierta para registrar movimientos</p>
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
        <div className="ui-loading">
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
