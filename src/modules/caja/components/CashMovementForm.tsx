import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PaymentMethodSelector } from "@/components/payments/PaymentMethodSelector";
import {
  cashMovementSchema,
  type CashMovementValues,
} from "@/modules/caja/schemas/cash.schemas";
import { normalizePaymentMethodCode } from "@/services/payment-methods.service";
import type { PaymentMethod } from "@/types/entities";
import { handleNumericInputFocus, handleNumericInputBlur, parseNumericField } from "@/utils/input-helpers";

interface CashMovementFormProps {
  mode: "income" | "expense";
  paymentMethods?: PaymentMethod[];
  disabled?: boolean;
  canWrite: boolean;
  onSubmit: (values: CashMovementValues) => Promise<void>;
  onSuccess?: () => void;
}

export const CashMovementForm = ({
  mode,
  paymentMethods = [],
  disabled,
  canWrite,
  onSubmit,
  onSuccess,
}: CashMovementFormProps) => {
  const isIncome = mode === "income";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CashMovementValues>({
    resolver: zodResolver(cashMovementSchema),
    defaultValues: {
      amount: 0,
      paymentMethodId: "",
      notes: "",
    },
  });
  const selectedPaymentMethodId = watch("paymentMethodId") ?? "";
  const incomePaymentMethods = paymentMethods.filter(
    (method) => method.is_active && normalizePaymentMethodCode(method.code) !== "current_account"
  );

  useEffect(() => {
    if (mode !== "income" || selectedPaymentMethodId || !incomePaymentMethods.length) return;
    setValue("paymentMethodId", incomePaymentMethods[0].id, { shouldValidate: true });
  }, [incomePaymentMethods, mode, selectedPaymentMethodId, setValue]);

  const submit = async (values: CashMovementValues) => {
    await onSubmit(values);
    reset({ amount: 0, paymentMethodId: incomePaymentMethods[0]?.id ?? "", notes: "" });
    onSuccess?.();
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit(submit)}>
      {isIncome ? (
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1">
            Medio de pago
          </label>
          <PaymentMethodSelector
            paymentMethods={incomePaymentMethods}
            selectedPaymentMethodId={selectedPaymentMethodId}
            disabled={disabled || !canWrite}
            columns={2}
            compact={true}
            onChange={(methodId) => {
              setValue("paymentMethodId", methodId, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          />
        </div>
      ) : null}

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1">
          Monto del movimiento
        </label>
        <div className="relative">
          <span className="absolute left-2.5 top-2 text-xs font-semibold text-slate-400 select-none">
            $
          </span>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("amount", {
              setValueAs: parseNumericField,
            })}
            onFocus={(e) =>
              handleNumericInputFocus(e, {
                isNew: true,
                onClear: () => setValue("amount", "" as any),
              })
            }
            onBlur={(e) => {
              handleNumericInputBlur(e, "0", () => {
                setValue("amount", 0);
              });
            }}
            className="h-8 w-full pl-6 pr-2.5 text-xs font-medium bg-slate-50/70 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900 transition-colors"
            disabled={disabled || !canWrite}
          />
        </div>
        {errors.amount ? <p className="mt-1 text-[11px] text-rose-600">{errors.amount.message}</p> : null}
      </div>

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1">
          Concepto / Motivo
        </label>
        <textarea
          rows={2}
          placeholder={
            isIncome
              ? "Ej: Aporte inicial adicional, cobro particular..."
              : "Ej: Pago de flete, compras menores, viáticos..."
          }
          {...register("notes")}
          className="w-full p-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900 transition-colors"
          disabled={disabled || !canWrite}
        />
      </div>

      <button
        type="submit"
        className={`h-8 w-full inline-flex items-center justify-center gap-1.5 px-3 text-xs font-semibold rounded-lg transition-colors shadow-xs disabled:opacity-50 ${
          isIncome
            ? "text-white bg-emerald-600 hover:bg-emerald-700"
            : "text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80"
        }`}
        disabled={disabled || !canWrite}
      >
        {isIncome ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
        {isIncome ? "Guardar ingreso" : "Guardar egreso"}
      </button>
    </form>
  );
};
