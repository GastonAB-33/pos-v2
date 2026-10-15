import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { LockOpen } from "lucide-react";
import {
  openCashSchema,
  type OpenCashValues,
} from "@/modules/caja/schemas/cash.schemas";
import { handleNumericInputFocus, handleNumericInputBlur, parseNumericField } from "@/utils/input-helpers";

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
    <section className="bg-white dark:bg-[#0b1325] rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-3.5">
      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/80">
          <LockOpen className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">Apertura de turno de caja</h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-400">
            Ingresá el fondo inicial de efectivo para habilitar el cobro y los movimientos del turno
          </p>
        </div>
      </div>

      <form className="mt-3 grid gap-3 sm:grid-cols-12 sm:items-end" onSubmit={handleSubmit(submit)} autoComplete="off">
        <div className="sm:col-span-4">
          <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
            Monto inicial en caja
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-2 text-xs font-semibold text-slate-400 dark:text-slate-500 select-none">
              $
            </span>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              {...register("openingAmount", {
                setValueAs: parseNumericField,
              })}
              onFocus={(e) =>
                handleNumericInputFocus(e, {
                  isNew: defaultOpeningAmount === 0,
                  onClear: () => setValue("openingAmount", "" as any),
                })
              }
              onBlur={(e) => {
                handleNumericInputBlur(e, "0", () => {
                  setValue("openingAmount", 0);
                });
              }}
              className="h-8 w-full pl-6 pr-2.5 text-xs font-semibold bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-400 transition-colors"
              disabled={disabled || !canWrite}
            />
          </div>
          {errors.openingAmount ? (
            <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{errors.openingAmount.message}</p>
          ) : null}
        </div>

        <div className="sm:col-span-5">
          <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
            Observación <span className="normal-case font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
          </label>
          <input
            type="text"
            placeholder="Ej: Billetes para cambio..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            {...register("notes")}
            className="h-8 w-full px-2.5 text-xs bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-400 transition-colors"
            disabled={disabled || !canWrite}
          />
        </div>

        <div className="sm:col-span-3">
          <button
            type="submit"
            className="h-8 w-full inline-flex items-center justify-center gap-1.5 px-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            disabled={disabled || !canWrite}
          >
            <LockOpen className="h-3.5 w-3.5" />
            Abrir caja
          </button>
        </div>
      </form>
    </section>
  );
};
