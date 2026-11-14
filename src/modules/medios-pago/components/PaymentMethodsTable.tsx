import {
  normalizePaymentMethodCode,
} from "@/services/payment-methods.service";
import type { PaymentMethod } from "@/types/entities";
import { cn } from "@/utils/cn";

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
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No hay medios de pago para mostrar.
      </div>
    );
  }

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2 sm:p-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" role="tablist" aria-label="Medios de pago">
        {orderedMethods.map((method) => {
          const isSelected = selectedPaymentMethodId === method.id;
          return (
            <button
              key={method.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl sm:rounded-2xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                isSelected
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25 active:scale-95"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
              )}
              disabled={disabled}
              onClick={() => onSelect(method)}
            >
              <span>{method.name}</span>
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  method.is_active ? "bg-emerald-400" : "bg-slate-300 dark:bg-slate-600"
                )}
                title={method.is_active ? "Activo" : "Inactivo"}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};