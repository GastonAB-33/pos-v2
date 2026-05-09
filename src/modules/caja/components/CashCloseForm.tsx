import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  closeCashSchema,
  type CloseCashValues,
} from "@/modules/caja/schemas/cash.schemas";

interface CashCloseFormProps {
  disabled?: boolean;
  canWrite: boolean;
  expectedBalance: number;
  onSubmit: (values: CloseCashValues) => Promise<void>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const CashCloseForm = ({
  disabled,
  canWrite,
  expectedBalance,
  onSubmit,
}: CashCloseFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CloseCashValues>({
    resolver: zodResolver(closeCashSchema),
    defaultValues: {
      realAmount: expectedBalance,
      notes: "",
    },
  });

  const submit = async (values: CloseCashValues) => {
    await onSubmit(values);
    reset({ realAmount: expectedBalance, notes: "" });
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <h2 className="text-base font-semibold text-slate-900">Cerrar caja</h2>
      <p className="text-sm text-slate-600">Monto esperado: {currency.format(expectedBalance)}</p>
      <form className="grid gap-3" onSubmit={handleSubmit(submit)}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Arqueo de caja (monto real)
          </label>
          <input
            type="number"
            step="0.01"
            {...register("realAmount")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled || !canWrite}
          />
          {errors.realAmount ? (
            <p className="mt-1 text-xs text-red-600">{errors.realAmount.message}</p>
          ) : null}
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
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={disabled || !canWrite}
        >
          Cerrar caja
        </button>
      </form>
    </section>
  );
};
