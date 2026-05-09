import {
  normalizePaymentMethodCode,
} from "@/services/payment-methods.service";
import type { PaymentMethod } from "@/types/entities";

interface PaymentMethodsTableProps {
  paymentMethods: PaymentMethod[];
  selectedPaymentMethodId: string | null;
  disabled?: boolean;
  onSelect: (paymentMethod: PaymentMethod) => void;
}

const paymentMethodPriority = (method: PaymentMethod): number => {
  const code = normalizePaymentMethodCode(method.code);
  if (code === "cash") return 0;
  if (code === "card_debit") return 1;
  if (code === "card_credit") return 2;
  if (code === "transfer") return 3;
  if (code === "mercado_pago") return 4;
  if (code === "cheque") return 5;
  if (code === "current_account") return 6;
  return 7;
};

export const PaymentMethodsTable = ({
  paymentMethods,
  selectedPaymentMethodId,
  disabled,
  onSelect,
}: PaymentMethodsTableProps) => {
  const orderedMethods = [...paymentMethods].sort((a, b) => {
    const byPriority = paymentMethodPriority(a) - paymentMethodPriority(b);
    if (byPriority !== 0) return byPriority;
    return a.name.localeCompare(b.name);
  });

  if (!paymentMethods.length) {
    return <div className="ui-empty-state">No hay medios de pago para mostrar.</div>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2">
      <div className="payment-methods-tabs" role="tablist" aria-label="Medios de pago">
        {orderedMethods.map((method) => {
          const isSelected = selectedPaymentMethodId === method.id;
          return (
            <button
              key={method.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={
                isSelected
                  ? "payment-methods-tab payment-methods-tab--active"
                  : "payment-methods-tab"
              }
              disabled={disabled}
              onClick={() => onSelect(method)}
            >
              {method.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};
