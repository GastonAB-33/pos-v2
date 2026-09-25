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
    <form className="space-y-3" onSubmit={handleSubmit(submit)}>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Monto esperado según sistema
          </span>
          <p className="mt-1 text-lg font-bold tracking-tight text-slate-900">
            {currency.format(expectedBalance)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Apertura + Cobros e ingresos - Egresos
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Diferencia de arqueo
            </span>
            {difference === 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                <CheckCircle2 className="h-3 w-3" /> Exacto
              </span>
            ) : difference > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                + Sobrante
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
                <AlertCircle className="h-3 w-3" /> Faltante
              </span>
            )}
          </div>
          <p
            className={`mt-1 text-lg font-bold tracking-tight ${
              difference === 0
                ? "text-slate-800"
                : difference > 0
                  ? "text-emerald-700"
                  : "text-rose-700"
            }`}
          >
            {difference > 0 ? `+${currency.format(difference)}` : currency.format(difference)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Real recontado vs. Teórico esperado
          </p>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-600 mb-1">
          Efectivo recontado en cajón (Monto real)
        </label>
        <div className="relative">
          <span className="absolute left-2.5 top-2 text-xs font-semibold text-slate-400 select-none">
            $
          </span>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
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
            className="h-8 w-full pl-6 pr-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
            disabled={disabled || !canWrite}
          />
        </div>
        {errors.realAmount ? (
          <p className="mt-1 text-[11px] text-rose-600">{errors.realAmount.message}</p>
        ) : null}
      </div>

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-600 mb-1">
          Observaciones de cierre <span className="normal-case font-normal text-slate-400">(opcional)</span>
        </label>
        <textarea
          rows={2}
          placeholder="Motivo de diferencias, retiro a caja fuerte o comentarios..."
          {...register("notes")}
          className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
          disabled={disabled || !canWrite}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="h-8 px-3 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors shadow-xs disabled:opacity-50"
          disabled={disabled || !canWrite}
        >
          <Lock className="h-3.5 w-3.5" />
          Confirmar y cerrar caja
        </button>
      </div>
    </form>
  );
};
