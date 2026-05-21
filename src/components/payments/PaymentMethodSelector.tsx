import {
  getPaymentMethodTypeLabel,
  normalizePaymentMethodCode,
} from "@/services/payment-methods.service";
import type { PaymentMethod } from "@/types/entities";

interface PaymentMethodSelectorProps {
  paymentMethods: PaymentMethod[];
  selectedPaymentMethodId: string;
  disabled?: boolean;
  compact?: boolean;
  columns?: "auto" | 2 | 3;
  isMethodDisabled?: (paymentMethod: PaymentMethod) => boolean;
  getMethodBadges?: (paymentMethod: PaymentMethod) => string[];
  onChange: (paymentMethodId: string) => void;
}

const getPaymentMethodLabel = (paymentMethod: PaymentMethod): string => {
  const code = normalizePaymentMethodCode(paymentMethod.code);
  if (code === "cash") return "Efectivo";
  if (code === "card_debit") return "Tarjeta de debito";
  if (code === "card_credit") return "Tarjeta de credito";
  if (code === "transfer") return "Transferencia bancaria";
  if (code === "mercado_pago") return "Mercado Pago";
  if (code === "cheque") return "Cheque";
  if (code === "current_account") return "Cuenta corriente";
  return getPaymentMethodTypeLabel(paymentMethod.type);
};

const getSecondaryLabel = (paymentMethod: PaymentMethod): string | null => {
  const label = getPaymentMethodLabel(paymentMethod);
  return label.toLowerCase() === paymentMethod.name.trim().toLowerCase() ? null : label;
};

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

const getGridClassName = (columns: PaymentMethodSelectorProps["columns"]): string => {
  if (columns === 2) return "grid gap-2 sm:grid-cols-2";
  if (columns === 3) return "grid gap-2 sm:grid-cols-3";
  return "grid gap-2 sm:grid-cols-2 xl:grid-cols-3";
};

export const PaymentMethodSelector = ({
  paymentMethods,
  selectedPaymentMethodId,
  disabled,
  compact = true,
  columns = "auto",
  isMethodDisabled,
  getMethodBadges,
  onChange,
}: PaymentMethodSelectorProps) => {
  const orderedMethods = [...paymentMethods].sort((a, b) => {
    const byPriority = paymentMethodPriority(a) - paymentMethodPriority(b);
    if (byPriority !== 0) return byPriority;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={getGridClassName(columns)}>
      {orderedMethods.map((method) => {
        const selected = method.id === selectedPaymentMethodId;
        const methodDisabled = Boolean(disabled || isMethodDisabled?.(method));
        const secondaryLabel = getSecondaryLabel(method);
        const badges = getMethodBadges?.(method) ?? [];

        return (
          <button
            key={method.id}
            type="button"
            disabled={methodDisabled}
            onClick={() => {
              if (methodDisabled) return;
              onChange(method.id);
            }}
            className={[
              selected
                ? "rounded-lg bg-brand-600/10 text-left shadow-sm ring-1 ring-brand-500/40"
                : "rounded-lg bg-slate-50 text-left hover:bg-slate-100",
              methodDisabled ? "cursor-not-allowed opacity-65" : "",
              compact ? "px-2.5 py-2" : "px-3 py-2.5",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <p className={selected ? "text-sm font-semibold text-slate-900" : "text-sm font-medium text-slate-800"}>
                {method.name}
              </p>
              {selected ? <span className="h-2 w-2 rounded-full bg-brand-600" title="Seleccionado" /> : null}
            </div>
            <div className="mt-1 flex min-h-4 flex-wrap items-center gap-1">
              {secondaryLabel ? <span className="text-[11px] text-slate-500">{secondaryLabel}</span> : null}
              {method.surcharge_percent > 0 ? (
                <span className="ui-badge ui-badge--warn">+{method.surcharge_percent}%</span>
              ) : null}
              {method.discount_percent > 0 ? (
                <span className="ui-badge ui-badge--success">-{method.discount_percent}%</span>
              ) : null}
              {badges.map((badge) => (
                <span key={badge} className="ui-badge ui-badge--warn">
                  {badge}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
};
