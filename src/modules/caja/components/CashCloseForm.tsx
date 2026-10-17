import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useMemo, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Lock,
  AlertCircle,
  CheckCircle2,
  Banknote,
  TrendingUp,
  Receipt,
  RotateCcw,
} from "lucide-react";
import {
  closeCashSchema,
  type CloseCashValues,
} from "@/modules/caja/schemas/cash.schemas";
import { parseCloseSnapshot, type CashCloseResult } from "@/modules/caja/hooks/useCashModule";
import {
  handleNumericInputFocus,
  handleNumericInputBlur,
  parseNumericField,
} from "@/utils/input-helpers";

interface CashCloseFormProps {
  disabled?: boolean;
  canWrite: boolean;
  expectedBalance: number;
  expectedCashBalance?: number;
  expectedFullBalance?: number;
  reconciliationMode?: "cash_only" | "full";
  blindMode?: boolean;
  initialNotes?: string | null;
  onUpdateNotes?: (sessionId: string, notes: string) => Promise<boolean>;
  onSubmit: (values: CloseCashValues) => Promise<CashCloseResult | null | void>;
  onCancel?: () => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const BILL_DENOMINATIONS = [20000, 10000, 2000, 1000, 500, 200, 100] as const;

export const CashCloseForm = ({
  disabled,
  canWrite,
  expectedBalance,
  expectedCashBalance,
  expectedFullBalance,
  reconciliationMode = "cash_only",
  blindMode = false,
  initialNotes,
  onUpdateNotes,
  onSubmit,
  onCancel,
}: CashCloseFormProps) => {
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
  const [activeTab, setActiveTab] = useState<"bills" | "direct">(
    blindMode ? "bills" : "direct"
  );
  const [closeResult, setCloseResult] = useState<CashCloseResult | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const defaultCleanNotes = useMemo(
    () => (initialNotes ? parseCloseSnapshot(initialNotes).cleanNotes : ""),
    [initialNotes]
  );
  const [postCloseNotes, setPostCloseNotes] = useState<string>(defaultCleanNotes);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSavedMessage, setNotesSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialNotes) {
      setPostCloseNotes(parseCloseSnapshot(initialNotes).cleanNotes);
    }
  }, [initialNotes]);

  // Array de refs para navegación ágil por teclado (ArrowUp / ArrowDown / Enter)
  // Indices 0..6: Denominaciones de billetes
  // Index 7: Monedas
  // Index 8: Observaciones
  const inputRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | null)[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CloseCashValues>({
    resolver: zodResolver(closeCashSchema),
    defaultValues: {
      realAmount: blindMode ? 0 : expectedBalance,
      notes: defaultCleanNotes,
    },
  });

  const realAmount = watch("realAmount") ?? (blindMode ? 0 : expectedBalance);
  const difference = Number((realAmount - expectedBalance).toFixed(2));

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
    if (blindMode || activeTab === "bills") {
      const timer = window.setTimeout(() => {
        const first = inputRefs.current[0];
        if (first) {
          first.focus();
          if ("select" in first) first.select();
        }
      }, 70);
      return () => window.clearTimeout(timer);
    }
  }, [blindMode, activeTab]);

  // ESC para volver un paso atrás / cancelar cierre (skill agile-keyboard-flow)
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
    setValue("realAmount", newTotal, { shouldValidate: true });
  };

  const handleCoinsChange = (amount: number) => {
    const validAmount = Math.max(0, Number(amount) || 0);
    setCoinsAmount(validAmount);

    const billsSum = BILL_DENOMINATIONS.reduce((acc, d) => {
      const c = billCounts[d] || 0;
      return acc + d * c;
    }, 0);
    const newTotal = Number((billsSum + validAmount).toFixed(2));
    setValue("realAmount", newTotal, { shouldValidate: true });
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
      // Si estamos en un textarea y apretó Enter, permitir salto normal a menos que sea ArrowDown
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

  const submit = async (values: CloseCashValues) => {
    const finalAmount = activeTab === "bills" ? calculatedBillsTotal : values.realAmount;
    setPostCloseNotes(values.notes?.trim() || "");
    const result = await onSubmit({
      ...values,
      realAmount: finalAmount,
      billCounts: activeTab === "bills" ? billCounts : undefined,
      coinsAmount: activeTab === "bills" ? coinsAmount : undefined,
    });

    if (result) {
      setCloseResult(result);
      if (result.userNotes !== undefined) {
        setPostCloseNotes(result.userNotes);
      }
    } else {
      setCloseResult({
        session: null,
        expectedAmount: expectedBalance,
        realAmount: finalAmount,
        difference: Number((finalAmount - expectedBalance).toFixed(2)),
        salePaymentsTotal: 0,
        cashSalesTotal: 0,
        totalIncomes: 0,
        userNotes: values.notes?.trim() || "",
      });
    }
  };

  const handleSavePostCloseNotes = async () => {
    if (!closeResult?.session?.id || !onUpdateNotes) return;
    setIsSavingNotes(true);
    try {
      const ok = await onUpdateNotes(closeResult.session.id, postCloseNotes);
      if (ok) {
        setNotesSavedMessage("Observación guardada correctamente");
        setTimeout(() => setNotesSavedMessage(null), 3000);
      }
    } finally {
      setIsSavingNotes(false);
    }
  };

  // PANTALLA POST-CIERRE: Revelación de métricas, reporte de arqueo y observaciones
  if (closeResult) {
    const diff = closeResult.difference;
    return (
      <div className="space-y-3.5 animate-in fade-in duration-200">
        {/* Banner Informativo Superior: Faltante / Sobrante / Exacto */}
        {diff < 0 ? (
          <div className="p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-700/80 text-center">
            <div className="inline-flex p-2.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 mb-2">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
              Cierre registrado con FALTANTE de caja
            </h3>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
              Faltó <span className="font-bold underline">{currency.format(Math.abs(diff))}</span> respecto al saldo teórico del sistema.
            </p>
          </div>
        ) : diff > 0 ? (
          <div className="p-4 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border-2 border-blue-300 dark:border-blue-700/80 text-center">
            <div className="inline-flex p-2.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 mb-2">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-blue-900 dark:text-blue-200">
              Cierre registrado con SOBRANTE de caja
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Sobró <span className="font-bold underline">+{currency.format(diff)}</span> de dinero a favor en el conteo físico.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-700/80 text-center">
            <div className="inline-flex p-2.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 mb-2">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
              ¡Cierre de caja EXACTO!
            </h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
              El conteo físico de billetes y monedas coincide exactamente con el sistema ($0,00 de diferencia).
            </p>
          </div>
        )}

        {/* Resumen Revelado: Ventas y Efectivo */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Resultados de la Jornada
          </h4>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5 text-blue-500" /> Total Ventas Realizadas
              </span>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                {currency.format(closeResult.salePaymentsTotal || closeResult.totalIncomes)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Cobrado en Efectivo
              </span>
              <p className="mt-1 text-base font-bold text-emerald-700 dark:text-emerald-400">
                {currency.format(closeResult.cashSalesTotal)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Efectivo esperado según sistema
              </span>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                {currency.format(closeResult.expectedAmount)}
              </p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Apertura + Cobros efectivo - Egresos
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Efectivo recontado (Arqueo)
              </span>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                {currency.format(closeResult.realAmount)}
              </p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Declarado en el conteo de billetes
              </span>
            </div>
          </div>

          {/* Tarjeta de Diferencia */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              diff === 0
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700"
                : diff > 0
                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700"
            }`}
          >
            <div>
              <span className="text-xs font-bold block text-slate-800 dark:text-slate-100">
                {diff === 0 ? "Balance: Cierre exacto" : diff > 0 ? "Balance: Sobrante en caja" : "Balance: Faltante en caja"}
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                {diff === 0
                  ? "El efectivo recontado coincide exactamente con el sistema."
                  : diff > 0
                    ? `Hay un excedente de ${currency.format(diff)} en el cajón físico.`
                    : `Hay un faltante de ${currency.format(Math.abs(diff))} respecto al teórico.`}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`text-lg font-black ${
                  diff === 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : diff > 0
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-rose-700 dark:text-rose-300"
                }`}
              >
                {diff > 0 ? `+${currency.format(diff)}` : currency.format(diff)}
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {diff === 0 ? "Exacto" : diff > 0 ? "Sobrante" : "Faltante"}
              </span>
            </div>
          </div>
        </div>

        {/* Observaciones o justificación de cierre / errores */}
        <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              Observaciones / Justificación de cierre
            </label>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              (por si hubo error, faltante o sobrante)
            </span>
          </div>
          <textarea
            value={postCloseNotes}
            onChange={(e) => {
              setPostCloseNotes(e.target.value);
              setNotesSavedMessage(null);
            }}
            rows={2}
            placeholder="Escribí aquí el motivo del error, faltante, sobrante o cualquier observación del cierre..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 p-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
            disabled={isSavingNotes}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {notesSavedMessage ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {notesSavedMessage}
                </span>
              ) : (
                "Podés modificar o asentar el motivo antes de finalizar."
              )}
            </span>
            <button
              type="button"
              onClick={handleSavePostCloseNotes}
              disabled={isSavingNotes || !closeResult.session?.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSavingNotes ? "Guardando..." : "Guardar observación"}
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={async () => {
              if (
                closeResult.session?.id &&
                onUpdateNotes &&
                postCloseNotes.trim() !== (closeResult.userNotes || "").trim()
              ) {
                await onUpdateNotes(closeResult.session.id, postCloseNotes.trim());
              }
              onCancel?.();
            }}
            className="h-10 px-6 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            Finalizar y volver a caja
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-2.5" onSubmit={handleSubmit(submit)} autoComplete="off">
      {/* Si NO es modo ciego, mostrar métricas previas y selector de pestaña */}
      {!blindMode && (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {reconciliationMode === "full"
                  ? "Total esperado (Arqueo completo)"
                  : "Efectivo esperado según sistema"}
              </span>
              <p className="mt-1 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {currency.format(expectedBalance)}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {reconciliationMode === "full" && expectedCashBalance !== undefined
                  ? `Efectivo físico: ${currency.format(expectedCashBalance)} · Total a rendir: ${currency.format(expectedFullBalance ?? expectedBalance)}`
                  : "Fondo apertura + Cobros efectivo - Egresos"}
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

          {/* Selector de modo si no es ciego */}
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
        </>
      )}

      {/* CONTADOR DE BILLETES: EN ORDEN VERTICAL UNO DEBAJO DE OTRO + DESPLAZAMIENTO ÁGIL */}
      {(blindMode || activeTab === "bills") && (
        <div className="space-y-1.5 p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-700">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Banknote className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Arqueo de billetes físicos
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
                setValue("realAmount", 0);
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
              Total Efectivo Arqueado:
            </span>
            <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
              {currency.format(calculatedBillsTotal)}
            </span>
          </div>
        </div>
      )}

      {/* INPUT DIRECTO (Solo si el usuario opta por ingresar monto total directo en modo normal) */}
      {!blindMode && activeTab === "direct" && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
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
            <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
              {errors.realAmount.message}
            </p>
          ) : null}
        </div>
      )}

      {/* OBSERVACIONES COMPACTO */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
          Observaciones de cierre <span className="normal-case font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
        </label>
        <input
          {...register("notes")}
          ref={(el) => {
            inputRefs.current[BILL_DENOMINATIONS.length + 1] = el;
            register("notes").ref(el);
          }}
          type="text"
          placeholder="Motivo de diferencias, retiro a caja fuerte o comentarios..."
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
            className="h-9 px-4 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="h-9 inline-flex items-center gap-1.5 px-5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          disabled={disabled || !canWrite}
        >
          <Lock className="h-3.5 w-3.5" />
          Confirmar y cerrar caja
        </button>
      </div>
    </form>
  );
};
