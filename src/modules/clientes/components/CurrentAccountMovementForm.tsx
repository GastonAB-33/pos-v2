import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  adjustmentMovementSchema,
  paymentMovementSchema,
  type AdjustmentMovementValues,
  type PaymentMovementValues,
} from "@/modules/clientes/schemas/current-account-movement.schema";

interface CurrentAccountMovementFormProps {
  mode: "payment" | "adjustment";
  disabled?: boolean;
  onSubmit: (values: PaymentMovementValues | AdjustmentMovementValues) => Promise<void>;
}

export const CurrentAccountMovementForm = ({
  mode,
  disabled,
  onSubmit,
}: CurrentAccountMovementFormProps) => {
  const isPayment = mode === "payment";
  const schema = isPayment ? paymentMovementSchema : adjustmentMovementSchema;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentMovementValues | AdjustmentMovementValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: 0,
      notes: "",
    },
  });

  const submit = async (values: PaymentMovementValues | AdjustmentMovementValues) => {
    await onSubmit(values);
    reset({ amount: 0, notes: "" });
  };

  return (
    <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3" onSubmit={handleSubmit(submit)}>
      <h4 className="text-sm font-semibold text-slate-900">
        {isPayment ? "Registrar pago" : "Registrar ajuste"}
      </h4>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Monto</label>
        <input
          type="number"
          step="0.01"
          {...register("amount")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        />
        {errors.amount ? <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p> : null}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Observacion</label>
        <textarea
          rows={2}
          {...register("notes")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        />
      </div>

      <button
        type="submit"
        className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        disabled={disabled}
      >
        Guardar
      </button>
    </form>
  );
};

