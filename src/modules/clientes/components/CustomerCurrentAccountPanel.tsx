import { useCurrentAccount } from "@/modules/clientes/hooks/useCurrentAccount";
import { CurrentAccountMovementForm } from "@/modules/clientes/components/CurrentAccountMovementForm";
import { CurrentAccountMovementsTable } from "@/modules/clientes/components/CurrentAccountMovementsTable";
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
  const {
    movements,
    balance,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    registerPayment,
    registerAdjustment,
  } = useCurrentAccount(tenantId, customer, userId);

  const submitPayment = async (values: { amount: number; notes?: string }) => {
    await registerPayment(values);
    onBalanceUpdated();
  };

  const submitAdjustment = async (values: { amount: number; notes?: string }) => {
    await registerAdjustment(values);
    onBalanceUpdated();
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Cuenta corriente</h3>
          <p className="text-sm text-slate-600">{customer.full_name}</p>
          <p className="text-sm font-medium text-slate-900">Saldo actual: {currency.format(balance)}</p>
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

      {feedback ? (
        <div
          className={[
            "rounded-lg border px-3 py-2 text-sm",
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700",
          ].join(" ")}
        >
          {feedback.message}
        </div>
      ) : null}

      {canWrite ? (
        <div className="grid gap-3 md:grid-cols-2">
          <CurrentAccountMovementForm
            mode="payment"
            disabled={isSubmitting}
            onSubmit={submitPayment}
          />
          <CurrentAccountMovementForm
            mode="adjustment"
            disabled={isSubmitting}
            onSubmit={submitAdjustment}
          />
        </div>
      ) : (
        <p className="text-sm text-slate-500">Sin permisos de escritura para registrar movimientos.</p>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-600">
          Cargando movimientos...
        </div>
      ) : (
        <CurrentAccountMovementsTable movements={movements} />
      )}
    </section>
  );
};
