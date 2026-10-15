import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  closeCashSchema,
  type CloseCashValues,
} from "@/modules/caja/schemas/cash.schemas";
import { handleNumericInputFocus, handleNumericInputBlur, parseNumericField } from "@/utils/input-helpers";

interface CashCloseFormProps {
  disabled?: boolean;
  canWrite: boolean;
  expectedBalance: number;
  onSubmit: (values: CloseCashValues) => Promise<void>;
  onCancel?: () => void;
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
  onCancel,
}: CashCloseFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CloseCashValues>({
    resolver: zodResolver(closeCashSchema),
    defaultValues: {
      realAmount: expectedBalance,
      notes: "",
    },
  });

  const realAmount = watch("realAmount") ?? expectedBalance;
  const difference = Number((realAmount - expectedBalance).toFixed(2));

  const submit = async (values: CloseCashValues) => {
    await onSubmit(values);
    reset({ realAmount: expectedBalance, notes: "" });
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit(submit)} autoComplete="off">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Monto esperado según sistema
          </span>
          <p className="mt-1 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {currency.format(expectedBalance)}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Apertura + Cobros e ingresos - Egresos
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Diferencia de arqueo
            </span>
            {difference === 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/80">
                <CheckCircle2 className="h-3 w-3" /> Exacto
              </span>
            ) : difference > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/80">
                + Sobrante
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-200/60 dark:border-rose-800/80">
                <AlertCircle className="h-3 w-3" /> Faltante
              </span>
            )}
          </div>
          <p
            className={`mt-1 text-lg font-bold tracking-tight ${
              difference === 0
                ? "text-slate-800 dark:text-slate-100"
                : difference > 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400"
            }`}
          >
            {difference > 0 ? `+${currency.format(difference)}` : currency.format(difference)}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Real recontado vs. Teórico esperado
          </p>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
          Efectivo recontado en cajón (Monto real)
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
            {...register("realAmount", {
              setValueAs: parseNumericField,
            })}
            onFocus={(e) =>
              handleNumericInputFocus(e, {
                isNew: expectedBalance === 0,
                onClear: () => setValue("realAmount", "" as any),
              })
            }
            onBlur={(e) => {
              handleNumericInputBlur(e, String(expectedBalance), (val) => {
                setValue("realAmount", Number(val) || 0);
              });
            }}
            className="h-8 w-full pl-6 pr-2.5 text-xs font-semibold bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-400 transition-colors"
            disabled={disabled || !canWrite}
          />
        </div>
        {errors.realAmount ? (
          <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{errors.realAmount.message}</p>
        ) : null}
      </div>

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
          Observaciones de cierre <span className="normal-case font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
        </label>
        <textarea
          rows={2}
          placeholder="Motivo de diferencias, retiro a caja fuerte o comentarios..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          {...register("notes")}
          className="w-full p-2 text-xs bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-400 transition-colors"
          disabled={disabled || !canWrite}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="h-8 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 border border-rose-200/80 dark:border-rose-800/80 rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          disabled={disabled || !canWrite}
        >
          <Lock className="h-3.5 w-3.5" />
          Confirmar y cerrar caja
        </button>
      </div>
    </form>
  );
};
