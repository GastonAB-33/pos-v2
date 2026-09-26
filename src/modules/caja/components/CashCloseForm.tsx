import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Lock, AlertCircle, CheckCircle2, ShieldCheck, Banknote, Edit3, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import {
  closeCashSchema,
  type CloseCashValues,
} from "@/modules/caja/schemas/cash.schemas";
import { CashDenominationCounter } from "./CashDenominationCounter";
import { handleNumericInputFocus, handleNumericInputBlur, parseNumericField } from "@/utils/input-helpers";

interface CashCloseFormProps {
  disabled?: boolean;
  canWrite: boolean;
  expectedBalance: number;
  isBlindMode?: boolean;
  denominationBreakdownEnabled?: boolean;
  declareOtherPaymentsEnabled?: boolean;
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
  isBlindMode = false,
  denominationBreakdownEnabled = true,
  declareOtherPaymentsEnabled = false,
  onSubmit,
  onCancel,
}: CashCloseFormProps) => {
  const [inputMode, setInputMode] = useState<"counter" | "manual">(
    denominationBreakdownEnabled ? "counter" : "manual"
  );
  const [denominations, setDenominations] = useState<Record<string, number>>({});
  const [coinsAmount, setCoinsAmount] = useState<number>(0);

  // Otros medios de pago
  const [isOtherPaymentsOpen, setIsOtherPaymentsOpen] = useState(false);
  const [cardCouponsAmount, setCardCouponsAmount] = useState<number>(0);
  const [transfersAmount, setTransfersAmount] = useState<number>(0);

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
      realAmount: isBlindMode ? 0 : expectedBalance,
      notes: "",
    },
  });

  const realAmount = watch("realAmount") ?? (isBlindMode ? 0 : expectedBalance);
  const difference = Number((realAmount - expectedBalance).toFixed(2));

  const handleDenominationChange = (
    nextDenoms: Record<string, number>,
    nextCoins: number,
    total: number
  ) => {
    setDenominations(nextDenoms);
    setCoinsAmount(nextCoins);
    setValue("realAmount", total, { shouldValidate: true });
  };

  const submit = async (values: CloseCashValues) => {
    const declaredOtherPayments: Record<string, number> = {};
    if (cardCouponsAmount > 0) declaredOtherPayments.card_coupons = cardCouponsAmount;
    if (transfersAmount > 0) declaredOtherPayments.transfers = transfersAmount;

    await onSubmit({
      ...values,
      isBlindClose: isBlindMode,
      countedDenominations: inputMode === "counter" ? denominations : undefined,
      declaredOtherPayments: Object.keys(declaredOtherPayments).length > 0 ? declaredOtherPayments : undefined,
    });
    reset({ realAmount: isBlindMode ? 0 : expectedBalance, notes: "" });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(submit)}>
      {/* MODO NO CIEGO (SUPERVISOR / DUEÑO) -> Muestra esperado y diferencia */}
      {!isBlindMode ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 dark:border-slate-800 dark:bg-slate-800/40">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Monto esperado según sistema
            </span>
            <p className="mt-1 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {currency.format(expectedBalance)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Apertura + Cobros e ingresos - Egresos
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Diferencia de arqueo
              </span>
              {difference === 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" /> Exacto
                </span>
              ) : difference > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                  + Sobrante
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertCircle className="h-3 w-3" /> Faltante
                </span>
              )}
            </div>
            <p
              className={`mt-1 text-lg font-bold tracking-tight ${
                difference === 0
                  ? "text-slate-800 dark:text-slate-200"
                  : difference > 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-700 dark:text-rose-400"
              }`}
            >
              {difference > 0 ? `+${currency.format(difference)}` : currency.format(difference)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Real recontado vs. Teórico esperado
            </p>
          </div>
        </div>
      ) : (
        /* MODO CIEGO (CAJERO) -> Aviso de seguridad y saldos ocultos */
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 flex items-start gap-3 dark:border-blue-900/60 dark:bg-blue-950/20">
          <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5 shrink-0 dark:text-blue-400" />
          <div className="text-xs">
            <h4 className="font-bold text-blue-900 dark:text-blue-200">
              Cierre de Caja Ciego
            </h4>
            <p className="text-blue-700 dark:text-blue-300 mt-0.5">
              Por protocolo de seguridad y auditoría, declare el total de efectivo físico presente en el cajón. Los saldos del sistema se conciliarán al entregar el turno.
            </p>
          </div>
        </div>
      )}

      {/* Selector de modo de conteo (Billetes vs Monto Directo) */}
      {denominationBreakdownEnabled ? (
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Método de Conteo de Efectivo:
          </span>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setInputMode("counter")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                inputMode === "counter"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              <Banknote className="h-3.5 w-3.5 text-emerald-600" /> Por Billetes
            </button>
            <button
              type="button"
              onClick={() => setInputMode("manual")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                inputMode === "manual"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              <Edit3 className="h-3.5 w-3.5 text-blue-600" /> Monto Directo
            </button>
          </div>
        </div>
      ) : null}

      {/* Formulario de Conteo por Billetes */}
      {inputMode === "counter" && denominationBreakdownEnabled ? (
        <CashDenominationCounter
          denominations={denominations}
          coinsAmount={coinsAmount}
          onChange={handleDenominationChange}
          disabled={disabled || !canWrite}
        />
      ) : (
        /* Formulario de Monto Directo */
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-600 mb-1 dark:text-slate-400">
            Efectivo total en cajón (Monto real) *
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-2 text-xs font-semibold text-slate-400 select-none">
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register("realAmount", {
                setValueAs: parseNumericField,
              })}
              onFocus={(e) =>
                handleNumericInputFocus(e, {
                  isNew: isBlindMode || expectedBalance === 0,
                  onClear: () => setValue("realAmount", "" as any),
                })
              }
              onBlur={(e) => {
                handleNumericInputBlur(e, String(isBlindMode ? 0 : expectedBalance), (val) => {
                  setValue("realAmount", Number(val) || 0);
                });
              }}
              className="h-9 w-full pl-6 pr-2.5 text-sm font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-colors"
              disabled={disabled || !canWrite}
              autoFocus={isBlindMode}
            />
          </div>
          {errors.realAmount ? (
            <p className="mt-1 text-[11px] text-rose-600">{errors.realAmount.message}</p>
          ) : null}
        </div>
      )}

      {/* SECCIÓN OPCIONAL: Declaración de Otros Medios de Pago */}
      {declareOtherPaymentsEnabled ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden dark:border-slate-800 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={() => setIsOtherPaymentsOpen(!isOtherPaymentsOpen)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-100/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Declarar Otros Comprobantes Físicos (Opcional)
                </span>
                <span className="text-[10px] text-slate-400">
                  Cupones de tarjeta, vouchers de POSNET o transferencias
                </span>
              </div>
            </div>
            {isOtherPaymentsOpen ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {isOtherPaymentsOpen ? (
            <div className="p-3 border-t border-slate-200 space-y-3 dark:border-slate-800">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Total en Cupones de Tarjeta / POSNET ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={cardCouponsAmount === 0 ? "" : cardCouponsAmount}
                  onChange={(e) => setCardCouponsAmount(parseFloat(e.target.value) || 0)}
                  className="h-8 w-full px-2.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Total Transferencias / Comprobantes anotados ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={transfersAmount === 0 ? "" : transfersAmount}
                  onChange={(e) => setTransfersAmount(parseFloat(e.target.value) || 0)}
                  className="h-8 w-full px-2.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Observaciones */}
      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-600 mb-1 dark:text-slate-400">
          Observaciones de cierre <span className="normal-case font-normal text-slate-400">(opcional)</span>
        </label>
        <textarea
          rows={2}
          placeholder="Comentarios sobre el turno, incidencias o retiro a caja fuerte..."
          {...register("notes")}
          className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-colors"
          disabled={disabled || !canWrite}
        />
      </div>

      {/* Botones de acción */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="h-8 px-3 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors shadow-xs disabled:opacity-50 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          disabled={disabled || !canWrite}
        >
          <Lock className="h-3.5 w-3.5" />
          Confirmar y cerrar caja
        </button>
      </div>
    </form>
  );
};
