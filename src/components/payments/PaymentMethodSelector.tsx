import {
  ArrowLeftRight,
  Banknote,
  CheckCircle2,
  CreditCard,
  FileCheck,
  Smartphone,
  UserCheck,
  Wallet,
} from "lucide-react";
import {
  getPaymentMethodTypeLabel,
  normalizePaymentMethodCode,
} from "@/services/payment-methods.service";
import type { PaymentMethod } from "@/types/entities";
import { cn } from "@/utils/cn";

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

const getPaymentMethodIcon = (code: string) => {
  const normalized = normalizePaymentMethodCode(code);
  switch (normalized) {
    case "cash":
      return Banknote;
    case "card_debit":
    case "card_credit":
      return CreditCard;
    case "transfer":
      return ArrowLeftRight;
    case "mercado_pago":
      return Smartphone;
    case "cheque":
      return FileCheck;
    case "current_account":
      return UserCheck;
    default:
      return Wallet;
  }
};

const getPaymentMethodLabel = (paymentMethod: PaymentMethod): string => {
  const code = normalizePaymentMethodCode(paymentMethod.code);
  if (code === "cash") return "Efectivo";
  if (code === "card_debit") return "Tarjeta de débito";
  if (code === "card_credit") return "Tarjeta de crédito";
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
  if (columns === 2) return "grid gap-2.5 sm:grid-cols-2";
  if (columns === 3) return "grid gap-2.5 sm:grid-cols-3";
  return "grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3";
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
        const IconComponent = getPaymentMethodIcon(method.code);

        return (
          <button
            key={method.id}
            type="button"
            disabled={methodDisabled}
            onClick={() => {
              if (methodDisabled) return;
              onChange(method.id);
            }}
            className={cn(
              "flex flex-col justify-between rounded-xl border text-left transition relative select-none",
              compact ? "p-3" : "p-3.5",
              selected
                ? "border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-500/30 dark:border-blue-500 dark:bg-blue-950/40"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900",
              methodDisabled ? "cursor-not-allowed opacity-50 bg-slate-50/40 dark:bg-slate-900/40" : ""
            )}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition",
                    selected
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  )}
                >
                  <IconComponent size={15} />
                </div>
                <p
                  className={cn(
                    "truncate text-xs font-bold leading-tight",
                    selected
                      ? "text-blue-950 dark:text-blue-100"
                      : "text-slate-800 dark:text-slate-200"
                  )}
                >
                  {method.name}
                </p>
              </div>

              {selected ? (
                <CheckCircle2 size={16} className="text-blue-600 shrink-0 dark:text-blue-400" />
              ) : null}
            </div>

            <div className="mt-1.5 flex min-h-4 flex-wrap items-center gap-1">
              {secondaryLabel ? (
                <span className="text-[10px] text-slate-500 truncate">{secondaryLabel}</span>
              ) : null}
              {method.surcharge_percent > 0 ? (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  +{method.surcharge_percent}%
                </span>
              ) : null}
              {method.discount_percent > 0 ? (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  -{method.discount_percent}%
                </span>
              ) : null}
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                >
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
