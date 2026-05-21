import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { PaymentMethodSelector } from "@/components/payments/PaymentMethodSelector";
import {
  cashMovementSchema,
  type CashMovementValues,
} from "@/modules/caja/schemas/cash.schemas";
import { normalizePaymentMethodCode } from "@/services/payment-methods.service";
import type { PaymentMethod } from "@/types/entities";

interface CashMovementFormProps {
  mode: "income" | "expense";
  paymentMethods?: PaymentMethod[];
  disabled?: boolean;
  canWrite: boolean;
  onSubmit: (values: CashMovementValues) => Promise<void>;
}

export const CashMovementForm = ({
  mode,
  paymentMethods = [],
  disabled,
  canWrite,
  onSubmit,
}: CashMovementFormProps) => {
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
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <h2 className="text-sm font-semibold text-slate-900">
        {mode === "income" ? "Registrar ingreso" : "Registrar egreso"}
      </h2>
      <form className="grid gap-3" onSubmit={handleSubmit(submit)}>
        {mode === "income" ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Medio de pago</p>
            <PaymentMethodSelector
              paymentMethods={incomePaymentMethods}
              selectedPaymentMethodId={selectedPaymentMethodId}
              disabled={disabled || !canWrite}
              columns={2}
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
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Monto</label>
          <input
            type="number"
            step="0.01"
            {...register("amount")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled || !canWrite}
          />
          {errors.amount ? <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p> : null}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Observacion</label>
          <textarea
            rows={2}
            {...register("notes")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled || !canWrite}
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={disabled || !canWrite}
        >
          Guardar
        </button>
      </form>
    </section>
  );
};

