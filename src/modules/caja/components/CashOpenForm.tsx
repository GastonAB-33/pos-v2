import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useMemo, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  LockOpen,
  Banknote,
  RotateCcw,
} from "lucide-react";
import {
  openCashSchema,
  type OpenCashValues,
} from "@/modules/caja/schemas/cash.schemas";
import {
  handleNumericInputFocus,
  handleNumericInputBlur,
  parseNumericField,
} from "@/utils/input-helpers";

interface CashOpenFormProps {
  disabled?: boolean;
  canWrite: boolean;
  defaultOpeningAmount?: number;
  onSubmit: (values: OpenCashValues) => Promise<void>;
  onCancel?: () => void;
  isModal?: boolean;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const BILL_DENOMINATIONS = [20000, 10000, 2000, 1000, 500, 200, 100] as const;

export const CashOpenForm = ({
  disabled,
  canWrite,
  defaultOpeningAmount = 0,
  onSubmit,
  onCancel,
}: CashOpenFormProps) => {
  const [billCounts, setBillCounts] = useState<Record<number, number>>({
    20000: 0,
    10000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    200: 0,
    100: 0,
  });
  const [coinsAmount, setCoinsAmount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"bills" | "direct">("bills");
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  // Array de refs para navegación ágil por teclado (ArrowUp / ArrowDown / Enter)
  // Indices 0..6: Denominaciones de billetes
  // Index 7: Monedas
  // Index 8: Observaciones
  const inputRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | null)[]>([]);

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

  // Si cambia el fondo sugerido por configuración y está en modo directo, actualizarlo
  useEffect(() => {
    if (defaultOpeningAmount && activeTab === "direct") {
      setValue("openingAmount", defaultOpeningAmount);
    }
  }, [defaultOpeningAmount, activeTab, setValue]);

  // Cálculo total a partir de billetes
  const calculatedBillsTotal = useMemo(() => {
    const billsSum = BILL_DENOMINATIONS.reduce((acc, denom) => {
      const count = billCounts[denom] || 0;
      return acc + denom * count;
    }, 0);
    return Number((billsSum + (coinsAmount || 0)).toFixed(2));
  }, [billCounts, coinsAmount]);

  // Autofocus en el primer billete ($20.000) al abrir (skill agile-keyboard-flow)
  useEffect(() => {
    if (activeTab === "bills") {
      const timer = window.setTimeout(() => {
        const first = inputRefs.current[0];
        if (first) {
          first.focus();
          if ("select" in first) first.select();
        }
      }, 70);
      return () => window.clearTimeout(timer);
    }
  }, [activeTab]);

  // ESC para volver / cancelar apertura (skill agile-keyboard-flow)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const handleBillCountChange = (denom: number, count: number) => {
    const validCount = Math.max(0, Math.floor(count || 0));
    const nextCounts = { ...billCounts, [denom]: validCount };
    setBillCounts(nextCounts);

    const billsSum = BILL_DENOMINATIONS.reduce((acc, d) => {
      const c = d === denom ? validCount : nextCounts[d] || 0;
      return acc + d * c;
    }, 0);
    const newTotal = Number((billsSum + (coinsAmount || 0)).toFixed(2));
    setValue("openingAmount", newTotal, { shouldValidate: true });
  };

  const handleCoinsChange = (amount: number) => {
    const validAmount = Math.max(0, Number(amount) || 0);
    setCoinsAmount(validAmount);

    const billsSum = BILL_DENOMINATIONS.reduce((acc, d) => {
      const c = billCounts[d] || 0;
      return acc + d * c;
    }, 0);
    const newTotal = Number((billsSum + validAmount).toFixed(2));
    setValue("openingAmount", newTotal, { shouldValidate: true });
  };

  // Manejo de teclado ágil: ArrowDown, ArrowUp, Enter entre campos consecutivos y Escape para salir
  const handleKeyDownNav = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    currentIndex: number
  ) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel?.();
      return;
    }

    if (e.key === "ArrowDown" || e.key === "Enter") {
      if (e.currentTarget.tagName === "TEXTAREA" && e.key === "Enter") return;

      e.preventDefault();
      const nextIndex = currentIndex + 1;
      const target = inputRefs.current[nextIndex];
      if (target) {
        target.focus();
        if ("select" in target) target.select();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex - 1;
      const target = inputRefs.current[prevIndex];
      if (target) {
        target.focus();
        if ("select" in target) target.select();
      }
    }
  };

  const submit = async (values: OpenCashValues) => {
    const finalAmount = activeTab === "bills" ? calculatedBillsTotal : values.openingAmount;
    await onSubmit({
      ...values,
      openingAmount: finalAmount,
      billCounts: activeTab === "bills" ? billCounts : undefined,
      coinsAmount: activeTab === "bills" ? coinsAmount : undefined,
    });
    reset({ openingAmount: defaultOpeningAmount, notes: "" });
  };

  return (
    <form className="space-y-2.5" onSubmit={handleSubmit(submit)} autoComplete="off">
      {/* Banner Superior Informativo de Apertura */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-100/70 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 shrink-0">
            <LockOpen className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Fondo inicial de caja
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Contá el efectivo físico disponible en el cajón para cambio antes de comenzar a operar.
            </p>
          </div>
        </div>

        {defaultOpeningAmount > 0 && (
          <div className="text-right shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Sugerido
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {currency.format(defaultOpeningAmount)}
            </span>
          </div>
        )}
      </div>

      {/* Selector de modo de conteo */}
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Método de conteo:
        </span>
        <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab("bills")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === "bills"
                ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Por billetes ($)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("direct")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === "direct"
                ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Monto directo
          </button>
        </div>
      </div>

      {/* CONTADOR DE BILLETES: EN ORDEN VERTICAL UNO DEBAJO DE OTRO + DESPLAZAMIENTO ÁGIL */}
      {activeTab === "bills" && (
        <div className="space-y-1.5 p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-700">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Banknote className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Conteo de billetes físicos
            </span>
            <button
              type="button"
              onClick={() => {
                setBillCounts({
                  20000: 0,
                  10000: 0,
                  2000: 0,
                  1000: 0,
                  500: 0,
                  200: 0,
                  100: 0,
                });
                setCoinsAmount(0);
                setValue("openingAmount", 0);
                inputRefs.current[0]?.focus();
              }}
              className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="h-2.5 w-2.5" /> Limpiar
            </button>
          </div>

          {/* LISTA VERTICAL: Uno debajo de otro */}
          <div className="flex flex-col gap-1">
            {BILL_DENOMINATIONS.map((denom, index) => {
              const count = billCounts[denom] || 0;
              const subtotal = denom * count;
              const isCurrentFocused = focusedIndex === index;
              const hasValue = count > 0;

              return (
                <div
                  key={denom}
                  onClick={() => inputRefs.current[index]?.focus()}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg border transition-all cursor-text ${
                    isCurrentFocused
                      ? "ring-2 ring-blue-500/50 bg-blue-50/40 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500"
                      : hasValue
                        ? "bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-700/80"
                        : "bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="w-20 shrink-0">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      ${denom.toLocaleString("es-AR")}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-1 max-w-[130px]">
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 select-none">
                      ×
                    </span>
                    <input
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      value={count === 0 ? "" : count}
                      onFocus={(e) => {
                        setFocusedIndex(index);
                        e.target.select();
                      }}
                      onKeyDown={(e) => handleKeyDownNav(e, index)}
                      onChange={(e) =>
                        handleBillCountChange(denom, parseInt(e.target.value, 10) || 0)
                      }
                      className="h-6.5 w-full px-2 text-xs font-bold text-center bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      disabled={disabled || !canWrite}
                    />
                  </div>

                  <div className="w-24 text-right shrink-0">
                    <span
                      className={`text-xs font-bold ${
                        subtotal > 0
                          ? "text-slate-900 dark:text-slate-100"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {currency.format(subtotal)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Fila para Monedas / Otros ($) */}
            {(() => {
              const coinsIndex = BILL_DENOMINATIONS.length;
              const isCurrentFocused = focusedIndex === coinsIndex;
              const hasValue = coinsAmount > 0;

              return (
                <div
                  onClick={() => inputRefs.current[coinsIndex]?.focus()}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg border transition-all cursor-text ${
                    isCurrentFocused
                      ? "ring-2 ring-blue-500/50 bg-blue-50/40 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500"
                      : hasValue
                        ? "bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-700/80"
                        : "bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="w-20 shrink-0">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Monedas / Otros
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-1 max-w-[130px]">
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 select-none">
                      $
                    </span>
                    <input
                      ref={(el) => {
                        inputRefs.current[coinsIndex] = el;
                      }}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      value={coinsAmount === 0 ? "" : coinsAmount}
                      onFocus={(e) => {
                        setFocusedIndex(coinsIndex);
                        e.target.select();
                      }}
                      onKeyDown={(e) => handleKeyDownNav(e, coinsIndex)}
                      onChange={(e) => handleCoinsChange(parseFloat(e.target.value) || 0)}
                      className="h-6.5 w-full px-2 text-xs font-bold text-center bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      disabled={disabled || !canWrite}
                    />
                  </div>

                  <div className="w-24 text-right shrink-0">
                    <span
                      className={`text-xs font-bold ${
                        coinsAmount > 0
                          ? "text-slate-900 dark:text-slate-100"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {currency.format(coinsAmount || 0)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Subtotal Recontado */}
          <div className="pt-1.5 mt-0.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Total Efectivo Inicial:
            </span>
            <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
              {currency.format(calculatedBillsTotal)}
            </span>
          </div>
        </div>
      )}

      {/* INPUT DIRECTO (Solo si el usuario opta por ingresar monto total directo) */}
      {activeTab === "direct" && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
            Monto inicial en efectivo ($)
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
              autoFocus
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
              className="h-8.5 w-full pl-6 pr-2.5 text-xs font-bold bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-400 transition-colors"
              disabled={disabled || !canWrite}
            />
          </div>
          {errors.openingAmount ? (
            <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
              {errors.openingAmount.message}
            </p>
          ) : null}
        </div>
      )}

      {/* OBSERVACIONES COMPACTO */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
          Observaciones de apertura <span className="normal-case font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
        </label>
        <input
          {...register("notes")}
          ref={(el) => {
            inputRefs.current[BILL_DENOMINATIONS.length + 1] = el;
            register("notes").ref(el);
          }}
          type="text"
          placeholder="Ej: Billetes chicos para cambio, fondo inicial..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          onKeyDown={(e) => handleKeyDownNav(e, BILL_DENOMINATIONS.length + 1)}
          className="h-8 w-full px-3 text-xs bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-400 transition-colors"
          disabled={disabled || !canWrite}
        />
      </div>

      {/* BOTONES DE ABAJO */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="h-9 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="h-9 inline-flex items-center justify-center gap-1.5 px-5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          disabled={disabled || !canWrite}
        >
          <LockOpen className="h-3.5 w-3.5 shrink-0" />
          <span>Confirmar y abrir caja</span>
        </button>
      </div>
    </form>
  );
};
