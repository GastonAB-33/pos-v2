import { useCurrentAccount } from "@/modules/clientes/hooks/useCurrentAccount";
import { CurrentAccountAdjustmentModal } from "@/modules/clientes/components/CurrentAccountAdjustmentModal";
import { CurrentAccountMovementsTable } from "@/modules/clientes/components/CurrentAccountMovementsTable";
import { CurrentAccountPaymentModal } from "@/modules/clientes/components/CurrentAccountPaymentModal";
import { CustomerManualMovementModal } from "@/modules/cuentas-corrientes/components/CustomerManualMovementModal";
import { useState } from "react";
import { ArrowLeft, DollarSign, PlusCircle, RefreshCw } from "lucide-react";
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
  const [isManualDebtModalOpen, setIsManualDebtModalOpen] = useState(false);

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
      {/* Barra de navegación superior con botón Volver */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <ArrowLeft size={14} />
          <span>Volver al listado de clientes</span>
        </button>

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
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {customer.full_name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {customer.document_type?.toUpperCase()} {customer.document_number}
            {customer.phone ? ` • Tel: ${customer.phone}` : ""}
            {customer.email ? ` • Email: ${customer.email}` : ""}
          </p>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold">
            Saldo Adeudado
          </span>
          <span
            className={`text-2xl font-bold tracking-tight ${
              balance > 0
                ? "text-rose-600 dark:text-rose-400"
                : balance < 0
                ? "text-blue-600 dark:text-blue-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {currency.format(balance)}
          </span>
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
          No hay caja abierta para el usuario actual. Puedes consultar movimientos y registrar deudas manuales,
          pero para registrar pagos en efectivo/tarjeta debes abrir caja.
        </div>
      ) : hasOpenCashSession ? (
        <p className="text-xs text-emerald-700">Caja abierta para registrar cobros</p>
      ) : null}

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition dark:bg-slate-100 dark:text-slate-900"
            onClick={() => setIsPaymentModalOpen(true)}
            disabled={isSubmitting || !canRegisterPayment}
          >
            <DollarSign size={14} />
            <span>Registrar cobro</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl shadow-sm transition dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            onClick={() => setIsManualDebtModalOpen(true)}
            disabled={isSubmitting}
          >
            <PlusCircle size={14} />
            <span>Adeudar / Movimiento manual</span>
          </button>
          <button
            type="button"
            className="ui-btn-ghost text-xs py-2"
            onClick={() => setIsAdjustmentModalOpen(true)}
            disabled={isSubmitting || !canUpdatePricingRule}
          >
            Actualizar regla / Ajuste
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

      <CustomerManualMovementModal
        open={isManualDebtModalOpen}
        tenantId={tenantId}
        userId={userId}
        customer={customer}
        onClose={() => setIsManualDebtModalOpen(false)}
        onSuccess={() => {
          void reload();
          onBalanceUpdated();
        }}
      />
    </section>
  );
};
