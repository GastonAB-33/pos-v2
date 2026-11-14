import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Building2,
  Check,
  Copy,
  Landmark,
  Loader2,
  Receipt,
  Wallet,
} from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { BankAccount, Supplier } from "@/types/entities";

export interface SupplierPaymentAllocation {
  code: "daily_cash" | "general_cash" | "bank_transfer" | "cheque" | "other";
  bankAccountId?: string;
  bankName?: string;
  amount: number;
  name: string;
}

export interface SupplierPaymentSubmitPayload {
  totalAmount: number;
  notes: string;
  allocations: SupplierPaymentAllocation[];
}

interface SupplierPaymentModalProps {
  open: boolean;
  supplier: Supplier;
  bankAccounts: BankAccount[];
  disabled?: boolean;
  onClose: () => void;
  onSubmit: (data: SupplierPaymentSubmitPayload) => Promise<void>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

interface FundOption {
  id: string;
  code: "daily_cash" | "general_cash" | "bank_transfer" | "cheque" | "other";
  name: string;
  subtitle: string;
  bankAccountId?: string;
  bankName?: string;
}

export const SupplierPaymentModal = ({
  open,
  supplier,
  bankAccounts,
  disabled = false,
  onClose,
  onSubmit,
}: SupplierPaymentModalProps) => {
  useBodyScrollLock(open);

  const panelRef = useRef<HTMLElement | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Cuentas bancarias activas del comercio
  const activeBankAccounts = useMemo(() => {
    return bankAccounts.filter((b) => b.is_active);
  }, [bankAccounts]);

  // Lista unificada de opciones de fondos / medios de pago
  const fundOptions = useMemo<FundOption[]>(() => {
    const options: FundOption[] = [];

    // 1. Efectivo de Caja Diaria
    options.push({
      id: "fund-daily-cash",
      code: "daily_cash",
      name: "Efectivo de Caja Diaria",
      subtitle: "Egreso de efectivo de la sesión diaria actual",
    });

    // 2. Efectivo de Caja Fuerte / Caja General
    options.push({
      id: "fund-general-cash",
      code: "general_cash",
      name: "Efectivo de Caja Fuerte",
      subtitle: "Egreso de Caja General / Tesorería central",
    });

    // 3. Transferencias Bancarias (Desglose por cuentas bancarias del comercio)
    if (activeBankAccounts.length > 0) {
      for (const acc of activeBankAccounts) {
        const holderPart = acc.holder_name ? ` (${acc.holder_name})` : "";
        options.push({
          id: `fund-bank-${acc.id}`,
          code: "bank_transfer",
          name: `Transferencia ${acc.bank_name}${holderPart}`,
          subtitle: `${acc.alias ? `Alias: ${acc.alias}` : ""}${
            acc.cbu ? ` • CBU: ...${acc.cbu.slice(-6)}` : ""
          }`.trim() || acc.account_type.replace("_", " "),
          bankAccountId: acc.id,
          bankName: acc.bank_name,
        });
      }
    } else {
      options.push({
        id: "fund-bank-generic",
        code: "bank_transfer",
        name: "Transferencia Bancaria",
        subtitle: "Egreso vía transferencia bancaria",
      });
    }

    // 4. Cheque
    options.push({
      id: "fund-cheque",
      code: "cheque",
      name: "Cheque / eCheq",
      subtitle: "Cheque librado propio o endosado",
    });

    // 5. Otro medio
    options.push({
      id: "fund-other",
      code: "other",
      name: "Otro Medio / Convenio",
      subtitle: "Otro origen de fondos o acuerdo",
    });

    return options;
  }, [activeBankAccounts]);

  // Monto adeudado al proveedor
  const defaultTarget = useMemo(() => {
    return Math.max(0, Number(supplier?.current_balance ?? 0));
  }, [supplier]);

  const supplierTotalDebt = defaultTarget;

  const [allocatedAmounts, setAllocatedAmounts] = useState<Record<string, number>>({});
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [lockedOptionIds, setLockedOptionIds] = useState<Record<string, boolean>>({});
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
  const [copiedField, setCopiedField] = useState<"total" | "pending" | null>(null);

  // Inicialización al abrir
  useEffect(() => {
    if (!open) return;
    const initial = defaultTarget;
    setNotes("");
    setSubmitError(null);
    setLockedOptionIds({});

    if (fundOptions.length > 0) {
      const first = fundOptions[0];
      setHighlightedIndex(0);
      setAllocatedAmounts({ [first.id]: initial });
      setAmountInputs({ [first.id]: initial > 0 ? initial.toFixed(2) : "" });
    } else {
      setAllocatedAmounts({});
      setAmountInputs({});
    }

    const timer = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [open, defaultTarget, fundOptions]);

  // Cálculos de asignación total y saldos proyectados
  const totalAssigned = useMemo(() => {
    const sum = Object.values(allocatedAmounts).reduce((acc, val) => acc + (val || 0), 0);
    return Number(sum.toFixed(2));
  }, [allocatedAmounts]);

  const remainingDebt = useMemo(() => {
    return Math.max(0, Number((supplierTotalDebt - totalAssigned).toFixed(2)));
  }, [supplierTotalDebt, totalAssigned]);

  const creditSurplus = useMemo(() => {
    return totalAssigned > supplierTotalDebt
      ? Number((totalAssigned - supplierTotalDebt).toFixed(2))
      : 0;
  }, [supplierTotalDebt, totalAssigned]);

  const isPartialPayment = totalAssigned > 0 && totalAssigned < supplierTotalDebt - 0.01;
  const isTotalPayment = Math.abs(totalAssigned - supplierTotalDebt) <= 0.01 && totalAssigned > 0;
  const hasCreditSurplus = totalAssigned > supplierTotalDebt + 0.01;
  const canSubmit = totalAssigned > 0 && !disabled && !isSubmittingLocal;

  // Botón rápido para saldar deuda total
  const handlePayFullDebt = useCallback(() => {
    if (fundOptions.length === 0 || supplierTotalDebt <= 0) return;
    const cur = fundOptions[highlightedIndex] || fundOptions[0];
    setLockedOptionIds({ [cur.id]: true });
    setAllocatedAmounts({ [cur.id]: supplierTotalDebt });
    setAmountInputs({ [cur.id]: supplierTotalDebt.toFixed(2) });
  }, [fundOptions, highlightedIndex, supplierTotalDebt]);

  // Actualizar el monto de una opción
  const updateOptionAmount = useCallback((optionId: string, rawValue: string) => {
    setSubmitError(null);
    setLockedOptionIds((prev) => {
      if (!prev[optionId]) return prev;
      const next = { ...prev };
      delete next[optionId];
      return next;
    });

    setAmountInputs((prev) => ({ ...prev, [optionId]: rawValue }));

    const clean = rawValue.replace(",", ".");
    const numeric = parseFloat(clean);

    setAllocatedAmounts((prev) => {
      const next = { ...prev };
      if (isNaN(numeric) || numeric <= 0) {
        delete next[optionId];
      } else {
        next[optionId] = Number(numeric.toFixed(2));
      }
      return next;
    });
  }, []);

  // Confirmar y fijar monto de una opción (pasa a verde)
  const confirmOptionAmount = useCallback(
    (optionId: string) => {
      setSubmitError(null);
      const inputVal = amountInputs[optionId] ?? "";
      const clean = String(inputVal).replace(",", ".");
      const numeric = parseFloat(clean);
      const currentVal =
        !isNaN(numeric) && numeric > 0
          ? Number(numeric.toFixed(2))
          : allocatedAmounts[optionId] || 0;

      let nextAllocated: Record<string, number> = {};

      if (currentVal > 0) {
        setLockedOptionIds((prev) => ({ ...prev, [optionId]: true }));
        nextAllocated = { ...allocatedAmounts, [optionId]: currentVal };
        setAllocatedAmounts(nextAllocated);
        setAmountInputs((prev) => ({ ...prev, [optionId]: currentVal.toFixed(2) }));
      } else {
        setLockedOptionIds((prev) => {
          const next = { ...prev };
          delete next[optionId];
          return next;
        });
        nextAllocated = { ...allocatedAmounts };
        delete nextAllocated[optionId];
        setAllocatedAmounts(nextAllocated);
        setAmountInputs((prev) => {
          const next = { ...prev };
          delete next[optionId];
          return next;
        });
      }

      const inputEl = inputRefs.current[optionId];
      if (inputEl) inputEl.blur();
    },
    [allocatedAmounts, amountInputs]
  );

  // Desplazar resto dinámicamente
  const shiftRemainderToOption = useCallback(
    (targetOption: FundOption) => {
      if (lockedOptionIds[targetOption.id]) return;

      const lockedSum = Object.entries(allocatedAmounts).reduce((acc, [id, val]) => {
        if (lockedOptionIds[id] && id !== targetOption.id) {
          return acc + (val || 0);
        }
        return acc;
      }, 0);
      const remainder = Number(Math.max(0, supplierTotalDebt - lockedSum).toFixed(2));

      setAllocatedAmounts((prev) => {
        const next: Record<string, number> = {};
        for (const [id, val] of Object.entries(prev)) {
          if (lockedOptionIds[id]) {
            next[id] = val;
          }
        }
        if (remainder > 0) {
          next[targetOption.id] = remainder;
        }
        return next;
      });

      setAmountInputs((prev) => {
        const next: Record<string, string> = {};
        for (const [id, val] of Object.entries(prev)) {
          if (lockedOptionIds[id]) {
            next[id] = val;
          }
        }
        if (remainder > 0) {
          next[targetOption.id] = remainder.toFixed(2);
        }
        return next;
      });
    },
    [allocatedAmounts, lockedOptionIds, supplierTotalDebt]
  );

  // Seleccionar opción
  const selectOption = useCallback(
    (targetIndex: number) => {
      if (fundOptions.length === 0) return;
      const clampedIndex = (targetIndex + fundOptions.length) % fundOptions.length;
      const targetOption = fundOptions[clampedIndex];
      if (!targetOption) return;

      setHighlightedIndex(clampedIndex);
      shiftRemainderToOption(targetOption);

      window.setTimeout(() => {
        const el = inputRefs.current[targetOption.id];
        if (el) {
          el.focus();
          el.select();
        }
      }, 20);
    },
    [fundOptions, shiftRemainderToOption]
  );

  // Envío final
  const handleFinalSubmit = useCallback(async () => {
    if (disabled || isSubmittingLocal) return;

    if (totalAssigned <= 0) {
      setSubmitError("Debes ingresar un importe mayor a $0 en al menos un origen de fondos");
      return;
    }

    const assignedOptions = fundOptions.filter(
      (opt) => (allocatedAmounts[opt.id] || 0) > 0
    );

    if (assignedOptions.length === 0) {
      setSubmitError("Debes asignar un monto a al menos un origen de fondos");
      return;
    }

    setIsSubmittingLocal(true);
    setSubmitError(null);

    try {
      const allocations: SupplierPaymentAllocation[] = assignedOptions.map((opt) => ({
        code: opt.code,
        bankAccountId: opt.bankAccountId,
        bankName: opt.bankName,
        amount: allocatedAmounts[opt.id] || 0,
        name: opt.name,
      }));

      await onSubmit({
        totalAmount: totalAssigned,
        notes: notes.trim(),
        allocations,
      });

      onClose();
    } catch (err) {
      console.error("Error al registrar pago al proveedor:", err);
      setSubmitError("Ocurrió un error al registrar el pago");
    } finally {
      setIsSubmittingLocal(false);
    }
  }, [
    allocatedAmounts,
    disabled,
    fundOptions,
    isSubmittingLocal,
    notes,
    onClose,
    onSubmit,
    totalAssigned,
  ]);

  // Listener global de teclado
  useEffect(() => {
    if (!open) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) {
        e.preventDefault();
        return;
      }

      if (disabled || isSubmittingLocal) {
        if (e.key === "Enter" || e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const activeInputEl = targetTag === "input" ? (e.target as HTMLInputElement) : null;
      const isEditingAmount = Boolean(activeInputEl && activeInputEl.type === "number");

      // Flecha abajo
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (isEditingAmount) activeInputEl?.blur();
        if (fundOptions.length === 0) return;
        const nextIndex = (highlightedIndex + 1) % fundOptions.length;
        const nextOption = fundOptions[nextIndex];
        setHighlightedIndex(nextIndex);
        if (nextOption) shiftRemainderToOption(nextOption);
        return;
      }

      // Flecha arriba
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (isEditingAmount) activeInputEl?.blur();
        if (fundOptions.length === 0) return;
        const prevIndex = (highlightedIndex - 1 + fundOptions.length) % fundOptions.length;
        const prevOption = fundOptions[prevIndex];
        setHighlightedIndex(prevIndex);
        if (prevOption) shiftRemainderToOption(prevOption);
        return;
      }

      // Enter
      if (e.key === "Enter") {
        e.preventDefault();
        const currentOption = fundOptions[highlightedIndex];
        if (!currentOption) return;

        if (isEditingAmount || !lockedOptionIds[currentOption.id]) {
          confirmOptionAmount(currentOption.id);
          return;
        }

        if (canSubmit) {
          void handleFinalSubmit();
        }
        return;
      }

      // Escape
      if (e.key === "Escape") {
        e.preventDefault();
        const currentOption = fundOptions[highlightedIndex];
        const lockedKeys = Object.keys(lockedOptionIds);

        if (lockedKeys.length > 0) {
          if (currentOption && lockedOptionIds[currentOption.id]) {
            setLockedOptionIds((prev) => {
              const next = { ...prev };
              delete next[currentOption.id];
              return next;
            });
            return;
          }
          const lastKey = lockedKeys[lockedKeys.length - 1];
          setLockedOptionIds((prev) => {
            const next = { ...prev };
            delete next[lastKey];
            return next;
          });
          return;
        }

        onClose();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, { capture: true });
  }, [
    canSubmit,
    confirmOptionAmount,
    disabled,
    fundOptions,
    handleFinalSubmit,
    highlightedIndex,
    isSubmittingLocal,
    lockedOptionIds,
    onClose,
    open,
    shiftRemainderToOption,
  ]);

  const handleCopyAmount = (amount: number, field: "total" | "pending") => {
    void navigator.clipboard.writeText(amount.toFixed(2));
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 1500);
  };

  const getOptionIcon = (code: string) => {
    switch (code) {
      case "daily_cash":
        return Banknote;
      case "general_cash":
        return Wallet;
      case "bank_transfer":
        return Landmark;
      case "cheque":
        return Receipt;
      default:
        return Building2;
    }
  };

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <article
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-2xl rounded-2xl sm:rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4 sm:p-6 flex flex-col gap-3 max-h-[92vh] overflow-y-auto outline-none"
      >
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Registrar Pago a Proveedor
            </h3>
            <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 font-mono">
              ARS
            </span>
          </div>
          <ModalCloseButton label="Cerrar pago" onClick={onClose} disabled={disabled || isSubmittingLocal} />
        </div>

        {/* Sub-tarjeta con información del proveedor */}
        {supplier && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{supplier.name}</span>
              {supplier.code && (
                <span className="font-mono text-slate-500 shrink-0">
                  (Cód: {supplier.code})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-500">Saldo adeudado:</span>
              <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold">
                {currency.format(supplierTotalDebt)}
              </strong>
            </div>
          </div>
        )}

        {/* 2 PANELES SUPERIORES (TOTAL A PAGAR vs SALDO RESTANTE DE DEUDA) */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {/* PANEL 1: TOTAL A PAGAR */}
          <div
            onClick={() => handleCopyAmount(totalAssigned, "total")}
            title="Clic para copiar monto a pagar"
            className="group relative flex flex-col justify-between rounded-xl p-2.5 sm:p-3 border border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition active:scale-[0.99] min-w-0 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                Total a Pagar
              </span>
              {copiedField === "total" ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in shrink-0">
                  ¡Copiado!
                </span>
              ) : (
                <Copy size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-1">
              <span className="text-base sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono truncate" title={currency.format(totalAssigned)}>
                {currency.format(totalAssigned)}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  totalAssigned <= 0
                    ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                    : isPartialPayment
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    : isTotalPayment
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                }`}
              >
                {totalAssigned <= 0
                  ? "Sin monto"
                  : isPartialPayment
                  ? "Pago Parcial"
                  : isTotalPayment
                  ? "Cancelación Total"
                  : "Saldo a favor"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Suma asignada
              </span>
              {supplierTotalDebt > 0 && Math.abs(totalAssigned - supplierTotalDebt) > 0.01 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePayFullDebt();
                  }}
                  className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer shrink-0"
                >
                  Pagar deuda total ({currency.format(supplierTotalDebt)})
                </button>
              )}
            </div>
          </div>

          {/* PANEL 2: SALDO RESTANTE DE DEUDA PROVEEDOR */}
          <div
            onClick={() => handleCopyAmount(remainingDebt, "pending")}
            title="Clic para copiar saldo restante"
            className={`group relative flex flex-col justify-between rounded-xl p-2.5 sm:p-3 border cursor-pointer transition active:scale-[0.99] min-w-0 overflow-hidden ${
              isTotalPayment
                ? "border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
                : hasCreditSurplus
                ? "border-purple-300 dark:border-purple-700/80 bg-purple-50/50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200"
                : isPartialPayment
                ? "border-blue-300 dark:border-blue-700/80 bg-blue-50/40 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200"
                : "border-amber-300 dark:border-amber-700/80 bg-amber-50/50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider truncate">
                {hasCreditSurplus ? "Saldo a Favor" : "Saldo Restante Proveedor"}
              </span>
              {copiedField === "pending" ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in shrink-0">
                  ¡Copiado!
                </span>
              ) : (
                <Copy size={12} className="opacity-0 group-hover:opacity-100 transition shrink-0" />
              )}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-base sm:text-2xl font-black tracking-tight font-mono truncate">
                {hasCreditSurplus ? `+${currency.format(creditSurplus)}` : currency.format(remainingDebt)}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {isTotalPayment
                ? "Deuda con proveedor saldada"
                : hasCreditSurplus
                ? "Crédito a favor con el proveedor"
                : isPartialPayment
                ? `Deuda anterior: ${currency.format(supplierTotalDebt)}`
                : `Deuda actual: ${currency.format(supplierTotalDebt)}`}
            </p>
          </div>
        </div>

        {/* LISTA UNIFICADA DE OPCIONES DE ORIGEN DE FONDOS */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Origen de Fondos / Cuenta</span>
            <span>Importe Asignado ($)</span>
          </div>

          <div className="space-y-1">
            {fundOptions.map((option, index) => {
              const isHighlighted = highlightedIndex === index;
              const isConfirmed = Boolean(lockedOptionIds[option.id] && (allocatedAmounts[option.id] || 0) > 0);
              const rawAmount = amountInputs[option.id] ?? "";
              const hasAmount = Boolean(rawAmount && parseFloat(rawAmount.replace(",", ".")) > 0);
              const Icon = getOptionIcon(option.code);

              return (
                <div
                  key={option.id}
                  onClick={() => selectOption(index)}
                  className={`group flex items-center justify-between gap-2.5 py-1.5 px-3 rounded-xl border transition cursor-pointer ${
                    isConfirmed
                      ? "border-emerald-500 dark:border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 ring-2 ring-emerald-500/60 shadow-xs"
                      : isHighlighted
                      ? "border-amber-400 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-500/20 ring-2 ring-amber-400 dark:ring-amber-400/90 shadow-sm"
                      : hasAmount
                      ? "border-slate-300 dark:border-slate-600 bg-slate-100/70 dark:bg-slate-800/80 hover:border-slate-400 dark:hover:border-slate-500"
                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  }`}
                >
                  {/* Lado izquierdo: Ícono y Nombre */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
                        isConfirmed
                          ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-xs"
                          : isHighlighted
                          ? "bg-amber-400 dark:bg-amber-400 text-slate-950 font-black shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <Icon size={14} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold text-xs truncate ${
                            isConfirmed
                              ? "text-slate-900 dark:text-white"
                              : isHighlighted
                              ? "text-slate-950 dark:text-amber-100"
                              : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {option.name}
                        </span>
                        {isConfirmed && (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-white">
                              <Check size={9} strokeWidth={3} />
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/90 px-1 py-0 rounded border border-emerald-300 dark:border-emerald-700">
                              Confirmado
                            </span>
                          </div>
                        )}
                      </div>
                      {option.subtitle && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight">
                          {option.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Lado derecho: Casilla de Importe ($) */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="relative w-32">
                      <span
                        className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-black pointer-events-none transition ${
                          isConfirmed
                            ? "text-emerald-700 dark:text-emerald-300"
                            : isHighlighted
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        $
                      </span>
                      <input
                        ref={(el) => {
                          inputRefs.current[option.id] = el;
                        }}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={amountInputs[option.id] ?? ""}
                        onChange={(e) => updateOptionAmount(option.id, e.target.value)}
                        onFocus={(e) => {
                          e.target.select();
                          setHighlightedIndex(index);
                        }}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        disabled={disabled || isSubmittingLocal}
                        className={`w-full rounded-lg border py-1 pl-5 pr-2 text-right font-mono text-xs outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                          isConfirmed
                            ? "border-emerald-500 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/90 text-emerald-950 dark:text-emerald-100 font-black ring-2 ring-emerald-500/50 shadow-xs"
                            : isHighlighted
                            ? "border-amber-400 dark:border-amber-400 bg-white dark:bg-slate-900 text-slate-950 dark:text-amber-100 font-bold ring-2 ring-amber-400/60 shadow-xs"
                            : hasAmount
                            ? "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                            : "border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-amber-400 dark:focus:border-amber-400"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
            Observaciones / N° de Recibo o Transferencia (Opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Recibo proveedor N° 0001-00004523 / Transferencia bancaria"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            disabled={disabled || isSubmittingLocal}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Mensaje de error si hubiese */}
        {submitError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200">
            {submitError}
          </div>
        )}

        {/* Botones de acción inferiores */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={disabled || isSubmittingLocal}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            Cancelar (Esc)
          </button>
          <button
            type="button"
            onClick={handleFinalSubmit}
            disabled={!canSubmit}
            className={`px-6 py-2.5 text-xs font-bold rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
              !canSubmit
                ? "bg-slate-300 dark:bg-slate-800 text-slate-500"
                : isTotalPayment
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25"
                : hasCreditSurplus
                ? "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/25"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25"
            }`}
          >
            {isSubmittingLocal ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Registrando...</span>
              </>
            ) : isTotalPayment ? (
              <>
                <Check size={14} strokeWidth={3} />
                <span>Confirmar Pago Total ({currency.format(totalAssigned)}) (Enter)</span>
              </>
            ) : isPartialPayment ? (
              <>
                <Check size={14} strokeWidth={3} />
                <span>Confirmar Pago Parcial ({currency.format(totalAssigned)}) (Enter)</span>
              </>
            ) : hasCreditSurplus ? (
              <>
                <Check size={14} strokeWidth={3} />
                <span>Confirmar Pago ({currency.format(totalAssigned)}) (Enter)</span>
              </>
            ) : (
              <span>Ingresá un importe a pagar</span>
            )}
          </button>
        </div>
      </article>
    </section>
  );
};
