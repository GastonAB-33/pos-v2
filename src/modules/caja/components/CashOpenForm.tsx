import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  openCashSchema,
  type OpenCashValues,
} from "@/modules/caja/schemas/cash.schemas";

interface CashOpenFormProps {
  disabled?: boolean;
  canWrite: boolean;
  defaultOpeningAmount?: number;
  onSubmit: (values: OpenCashValues) => Promise<void>;
}

export const CashOpenForm = ({ disabled, canWrite, defaultOpeningAmount = 0, onSubmit }: CashOpenFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<OpenCashValues>({
    resolver: zodResolver(openCashSchema),
    defaultValues: {
      openingAmount: defaultOpeningAmount,
      notes: "",
    },
  });

  useEffect(() => {
    setValue("openingAmount", defaultOpeningAmount);
  }, [defaultOpeningAmount, setValue]);

  const submit = async (values: OpenCashValues) => {
    await onSubmit(values);
    reset({ openingAmount: defaultOpeningAmount, notes: "" });
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <h2 className="text-base font-semibold text-slate-900">Abrir caja</h2>
      <form className="grid gap-3" onSubmit={handleSubmit(submit)}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Monto inicial</label>
          <input
            type="number"
            step="0.01"
            {...register("openingAmount")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled || !canWrite}
          />
          {errors.openingAmount ? (
            <p className="mt-1 text-xs text-red-600">{errors.openingAmount.message}</p>
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
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={disabled || !canWrite}
        >
          Abrir
        </button>
      </form>
    </section>
  );
};
