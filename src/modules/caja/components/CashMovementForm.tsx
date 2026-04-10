import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  cashMovementSchema,
  type CashMovementValues,
} from "@/modules/caja/schemas/cash.schemas";

interface CashMovementFormProps {
  mode: "income" | "expense";
  disabled?: boolean;
  canWrite: boolean;
  onSubmit: (values: CashMovementValues) => Promise<void>;
}

export const CashMovementForm = ({
  mode,
  disabled,
  canWrite,
  onSubmit,
}: CashMovementFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CashMovementValues>({
    resolver: zodResolver(cashMovementSchema),
    defaultValues: {
      amount: 0,
      notes: "",
    },
  });

  const submit = async (values: CashMovementValues) => {
    await onSubmit(values);
    reset({ amount: 0, notes: "" });
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <h2 className="text-base font-semibold text-slate-900">
        {mode === "income" ? "Registrar ingreso" : "Registrar egreso"}
      </h2>
      <form className="grid gap-3" onSubmit={handleSubmit(submit)}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Monto</label>
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
          <label className="mb-1 block text-sm font-medium text-slate-700">Observacion</label>
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

