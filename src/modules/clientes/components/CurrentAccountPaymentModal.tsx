import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Check,
  Copy,
  CreditCard,
  Landmark,
  Loader2,
  QrCode,
  Receipt,
  Wallet,
} from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { normalizePaymentMethodCode } from "@/services/payment-methods.service";
import type {
  BankAccount,
  Customer,
  InstallmentPlan,
  OriginBank,
  PaymentMethod,
} from "@/types/entities";
import type {
  CurrentAccountSummary,
  RegisterCurrentAccountPaymentValues,
} from "@/modules/clientes/hooks/useCurrentAccount";

interface CurrentAccountPaymentModalProps {
  open: boolean;
  customer?: Customer | null;
  paymentMethods: PaymentMethod[];
  bankAccounts: BankAccount[];
  originBanks?: OriginBank[];
  installmentPlans?: InstallmentPlan[];
  accountSummary: CurrentAccountSummary;
  disabled?: boolean;
  onClose: () => void;
  onSubmit: (values: RegisterCurrentAccountPaymentValues) => Promise<boolean>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const getMethodIcon = (code: string) => {
  const normalized = normalizePaymentMethodCode(code);
  switch (normalized) {
    case "cash":
      return Banknote;
    case "card_debit":
    case "card_credit":
      return CreditCard;
    case "transfer":
      return Landmark;
    case "mercado_pago":
      return QrCode;
    case "cheque":
      return Receipt;
    default:
      return Wallet;
  }
};

interface PaymentOption {
  id: string;
  paymentMethodId: string;
  code: string;
  name: string;
  subtitle: string;
  bankAccountId?: string;
  bankName?: string;
}

export const CurrentAccountPaymentModal = ({
  open,
  customer,
  paymentMethods,
  bankAccounts,
  accountSummary,
  disabled = false,
  onClose,
  onSubmit,
}: CurrentAccountPaymentModalProps) => {
  useBodyScrollLock(open);

  const panelRef = useRef<HTMLElement | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Cuentas bancarias activas
  const posBankAccounts = useMemo(() => {
    return bankAccounts.filter((b) => b.is_active && b.is_pos_available !== false);
  }, [bankAccounts]);

  // Lista unificada de opciones de pago (desglosando bancos habilitados si corresponde)
  const paymentOptions = useMemo<PaymentOption[]>(() => {
    const options: PaymentOption[] = [];

    // 1. Efectivo
    const cashMethod = paymentMethods.find(
      (m) => normalizePaymentMethodCode(m.code) === "cash"
    );
    if (cashMethod) {
      options.push({
        id: `method-${cashMethod.id}`,
        paymentMethodId: cashMethod.id,
        code: "cash",
        name: cashMethod.name || "Efectivo",
        subtitle: "Cobro inmediato en caja física abierta",
      });
    }

    // 2. Transferencias Bancarias (Desglose por bancos del comercio)
    const transferMethod = paymentMethods.find(
      (m) => normalizePaymentMethodCode(m.code) === "transfer"
    );

    if (transferMethod) {
      if (posBankAccounts.length > 0) {
        for (const account of posBankAccounts) {
          const holderPart = account.holder_name ? ` (${account.holder_name})` : "";
          options.push({
            id: `bank-acc-${account.id}`,
            paymentMethodId: transferMethod.id,
            code: "transfer",
            name: `Transferencia ${account.bank_name}${holderPart}`,
            subtitle: `${account.alias ? `Alias: ${account.alias}` : ""}${
              account.cbu ? ` • CBU: ...${account.cbu.slice(-6)}` : ""
            }`.trim() || account.account_type.replace("_", " "),
            bankAccountId: account.id,
            bankName: account.bank_name,
          });
        }
      } else {
        options.push({
          id: `method-${transferMethod.id}`,
          paymentMethodId: transferMethod.id,
          code: "transfer",
          name: transferMethod.name || "Transferencia Bancaria",
          subtitle: "Comprobante / acreditación bancaria",
        });
      }
    }

    // 3. Tarjeta de Débito
    const debitMethod = paymentMethods.find(
      (m) => normalizePaymentMethodCode(m.code) === "card_debit"
    );
    if (debitMethod) {
      options.push({
        id: `method-${debitMethod.id}`,
        paymentMethodId: debitMethod.id,
        code: "card_debit",
        name: debitMethod.name || "Tarjeta de Débito",
        subtitle: "Cobro terminal posnet / débito",
      });
    }

    // 4. Tarjeta de Crédito
    const creditMethod = paymentMethods.find(
      (m) => normalizePaymentMethodCode(m.code) === "card_credit"
    );
    if (creditMethod) {
      options.push({
        id: `method-${creditMethod.id}`,
        paymentMethodId: creditMethod.id,
        code: "card_credit",
        name: creditMethod.name || "Tarjeta de Crédito",
        subtitle: "Financiación / cuotas posnet",
      });
    }

    // 5. Mercado Pago
    const mpMethod = paymentMethods.find(
      (m) => normalizePaymentMethodCode(m.code) === "mercado_pago"
    );
    if (mpMethod) {
      options.push({
        id: `method-${mpMethod.id}`,
        paymentMethodId: mpMethod.id,
        code: "mercado_pago",
        name: mpMethod.name || "Mercado Pago",
        subtitle: "Cobro QR digital / transferencia MP",
      });
    }

    // 6. Cheque
    const chequeMethod = paymentMethods.find(
      (m) => normalizePaymentMethodCode(m.code) === "cheque"
    );
    if (chequeMethod) {
      options.push({
        id: `method-${chequeMethod.id}`,
        paymentMethodId: chequeMethod.id,
        code: "cheque",
        name: chequeMethod.name || "Cheque",
        subtitle: "Cheque físico / eCheq",
      });
    }

    // Otros métodos activos que no sean cta cte
    for (const m of paymentMethods) {
      const code = normalizePaymentMethodCode(m.code);
      if (
        code !== "cash" &&
        code !== "transfer" &&
        code !== "card_debit" &&
        code !== "card_credit" &&
        code !== "mercado_pago" &&
        code !== "cheque" &&
        code !== "current_account"
      ) {
        options.push({
          id: `method-${m.id}`,
          paymentMethodId: m.id,
          code: m.code,
          name: m.name,
          subtitle: "Otro medio de pago",
        });
      }
    }

    return options;
  }, [paymentMethods, posBankAccounts]);

  // Monto base adeudado (actualizado si corresponde o contable)
  const defaultTarget = useMemo(() => {
    const updated = Number(accountSummary?.updatedBalance ?? 0);
    const accounting = Number(accountSummary?.accountingBalance ?? 0);
    return Math.max(0, updated > 0 ? updated : accounting);
  }, [accountSummary]);

  const customerTotalDebt = defaultTarget;

  // Montos asignados a cada opción { [optionId]: number }
  const [allocatedAmounts, setAllocatedAmounts] = useState<Record<string, number>>({});
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [lockedMethodIds, setLockedMethodIds] = useState<Record<string, boolean>>({});
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
    setLockedMethodIds({});

    if (paymentOptions.length > 0) {
      const first = paymentOptions[0];
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
  }, [open, defaultTarget, paymentOptions]);

  // Cálculos de asignación total, parcial y saldos proyectados
  const totalAssigned = useMemo(() => {
    const sum = Object.values(allocatedAmounts).reduce((acc, val) => acc + (val || 0), 0);
    return Number(sum.toFixed(2));
  }, [allocatedAmounts]);

  const remainingDebt = useMemo(() => {
    return Math.max(0, Number((customerTotalDebt - totalAssigned).toFixed(2)));
  }, [customerTotalDebt, totalAssigned]);

  const creditSurplus = useMemo(() => {
    return totalAssigned > customerTotalDebt
      ? Number((totalAssigned - customerTotalDebt).toFixed(2))
      : 0;
  }, [customerTotalDebt, totalAssigned]);

  const isPartialPayment = totalAssigned > 0 && totalAssigned < customerTotalDebt - 0.01;
  const isTotalPayment = Math.abs(totalAssigned - customerTotalDebt) <= 0.01 && totalAssigned > 0;
  const hasCreditSurplus = totalAssigned > customerTotalDebt + 0.01;
  const canSubmit = totalAssigned > 0 && !disabled && !isSubmittingLocal;

  // Botón rápido para saldar la deuda total
  const handlePayFullDebt = useCallback(() => {
    if (paymentOptions.length === 0 || customerTotalDebt <= 0) return;
    const cur = paymentOptions[highlightedIndex] || paymentOptions[0];
    setLockedMethodIds({ [cur.id]: true });
    setAllocatedAmounts({ [cur.id]: customerTotalDebt });
    setAmountInputs({ [cur.id]: customerTotalDebt.toFixed(2) });
  }, [customerTotalDebt, highlightedIndex, paymentOptions]);

  // Actualizar el monto de un método cuando el usuario escribe
  const updateOptionAmount = useCallback((optionId: string, rawValue: string) => {
    setSubmitError(null);
    setLockedMethodIds((prev) => {
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

  // Confirmar y fijar el monto asignado a un método (pasa a verde)
  const confirmOptionAmount = useCallback(
    (optionId: string) => {
      setSubmitError(null);
      const inputVal = amountInputs[optionId] ?? "";
      const clean = String(inputVal).replace(",", ".");
      const numeric = parseFloat(clean);
      const currentMethodVal =
        !isNaN(numeric) && numeric > 0
          ? Number(numeric.toFixed(2))
          : allocatedAmounts[optionId] || 0;

      let nextAllocated: Record<string, number> = {};

      if (currentMethodVal > 0) {
        setLockedMethodIds((prev) => ({ ...prev, [optionId]: true }));
        nextAllocated = { ...allocatedAmounts, [optionId]: currentMethodVal };
        setAllocatedAmounts(nextAllocated);
        setAmountInputs((prev) => ({ ...prev, [optionId]: currentMethodVal.toFixed(2) }));
      } else {
        setLockedMethodIds((prev) => {
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

  // Desplazar el resto pendiente dinámicamente al método objetivo
  const shiftRemainderToOption = useCallback(
    (targetOption: PaymentOption) => {
      if (lockedMethodIds[targetOption.id]) return;

      const lockedSum = Object.entries(allocatedAmounts).reduce((acc, [id, val]) => {
        if (lockedMethodIds[id] && id !== targetOption.id) {
          return acc + (val || 0);
        }
        return acc;
      }, 0);
      const remainder = Number(Math.max(0, customerTotalDebt - lockedSum).toFixed(2));

      setAllocatedAmounts((prev) => {
        const next: Record<string, number> = {};
        for (const [id, val] of Object.entries(prev)) {
          if (lockedMethodIds[id]) {
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
          if (lockedMethodIds[id]) {
            next[id] = val;
          }
        }
        if (remainder > 0) {
          next[targetOption.id] = remainder.toFixed(2);
        }
        return next;
      });
    },
    [allocatedAmounts, lockedMethodIds, customerTotalDebt]
  );

  // Seleccionar opción
  const selectOption = useCallback(
    (targetIndex: number) => {
      if (paymentOptions.length === 0) return;
      const clampedIndex = (targetIndex + paymentOptions.length) % paymentOptions.length;
      const targetOption = paymentOptions[clampedIndex];
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
    [paymentOptions, shiftRemainderToOption]
  );

  // Envío final
  const handleFinalSubmit = useCallback(async () => {
    if (disabled || isSubmittingLocal) return;

    if (totalAssigned <= 0) {
      setSubmitError("Debes ingresar un importe mayor a $0 en al menos un medio de pago");
      return;
    }

    const assignedOptions = paymentOptions.filter(
      (opt) => (allocatedAmounts[opt.id] || 0) > 0
    );

    if (assignedOptions.length === 0) {
      setSubmitError("Debes asignar un monto a al menos un medio de pago");
      return;
    }

    setIsSubmittingLocal(true);
    setSubmitError(null);

    try {
      const isSplit = assignedOptions.length > 1;
      const primaryOption = assignedOptions[0];

      const splitPayments = assignedOptions.map((opt) => ({
        payment_method_id: opt.paymentMethodId,
        amount: allocatedAmounts[opt.id] || 0,
        bank_account_id: opt.bankAccountId ?? null,
        notes: opt.bankName ? `Banco: ${opt.bankName}` : undefined,
      }));

      const notesSummary = [
        notes.trim() || null,
        isSplit
          ? `Cobro combinado: ${assignedOptions
              .map((o) => `${o.name}: $${(allocatedAmounts[o.id] || 0).toFixed(2)}`)
              .join(" + ")}`
          : primaryOption.bankName
          ? `Transferencia ${primaryOption.bankName}`
          : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const success = await onSubmit({
        amount: totalAssigned,
        payment_method_id: primaryOption.paymentMethodId,
        bank_account_id: primaryOption.bankAccountId ?? null,
        notes: notesSummary || undefined,
        split_payments: isSplit ? splitPayments : undefined,
      });

      if (success) {
        onClose();
      }
    } catch (err) {
      console.error("Error al registrar cobro en cuenta corriente:", err);
      setSubmitError("Ocurrió un error al registrar el cobro");
    } finally {
      setIsSubmittingLocal(false);
    }
  }, [
    allocatedAmounts,
    disabled,
    isSubmittingLocal,
    notes,
    onClose,
    onSubmit,
    paymentOptions,
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
        if (paymentOptions.length === 0) return;
        const nextIndex = (highlightedIndex + 1) % paymentOptions.length;
        const nextOption = paymentOptions[nextIndex];
        setHighlightedIndex(nextIndex);
        if (nextOption) shiftRemainderToOption(nextOption);
        return;
      }

      // Flecha arriba
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (isEditingAmount) activeInputEl?.blur();
        if (paymentOptions.length === 0) return;
        const prevIndex = (highlightedIndex - 1 + paymentOptions.length) % paymentOptions.length;
        const prevOption = paymentOptions[prevIndex];
        setHighlightedIndex(prevIndex);
        if (prevOption) shiftRemainderToOption(prevOption);
        return;
      }

      // Enter
      if (e.key === "Enter") {
        e.preventDefault();
        const currentOption = paymentOptions[highlightedIndex];
        if (!currentOption) return;

        // Si el foco está en un input o la opción no está fijada, fijar
        if (isEditingAmount || !lockedMethodIds[currentOption.id]) {
          confirmOptionAmount(currentOption.id);
          return;
        }

        // Si hay un monto válido asignado, enviar el cobro
        if (canSubmit) {
          void handleFinalSubmit();
        }
        return;
      }

      // Escape
      if (e.key === "Escape") {
        e.preventDefault();
        const currentOption = paymentOptions[highlightedIndex];
        const lockedKeys = Object.keys(lockedMethodIds);

        if (lockedKeys.length > 0) {
          if (currentOption && lockedMethodIds[currentOption.id]) {
            setLockedMethodIds((prev) => {
              const next = { ...prev };
              delete next[currentOption.id];
              return next;
            });
            return;
          }
          const lastKey = lockedKeys[lockedKeys.length - 1];
          setLockedMethodIds((prev) => {
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
    handleFinalSubmit,
    highlightedIndex,
    isSubmittingLocal,
    lockedMethodIds,
    onClose,
    open,
    paymentOptions,
    shiftRemainderToOption,
  ]);

  const handleCopyAmount = (amount: number, field: "total" | "pending") => {
    void navigator.clipboard.writeText(amount.toFixed(2));
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 1500);
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
              Registrar Cobro en Cuenta Corriente
            </h3>
            <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 font-mono">
              ARS
            </span>
          </div>
          <ModalCloseButton label="Cerrar cobro" onClick={onClose} disabled={disabled || isSubmittingLocal} />
        </div>

        {/* Sub-tarjeta con información del cliente */}
        {customer && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{customer.full_name}</span>
              {customer.document_number && (
                <span className="font-mono text-slate-500 shrink-0">
                  ({customer.document_type ? `${customer.document_type.toUpperCase()} ` : ""}{customer.document_number})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-500">Deuda actual:</span>
              <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold">
                {currency.format(customerTotalDebt)}
              </strong>
            </div>
          </div>
        )}

        {/* 2 PANELES SUPERIORES (TOTAL A COBRAR vs SALDO RESTANTE DE DEUDA) */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {/* PANEL 1: TOTAL A COBRAR (PAGO) */}
          <div
            onClick={() => handleCopyAmount(totalAssigned, "total")}
            title="Clic para copiar monto a cobrar"
            className="group relative flex flex-col justify-between rounded-xl p-2.5 sm:p-3 border border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition active:scale-[0.99] min-w-0 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                Total a Cobrar
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
              {customerTotalDebt > 0 && Math.abs(totalAssigned - customerTotalDebt) > 0.01 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePayFullDebt();
                  }}
                  className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer shrink-0"
                >
                  Cobrar deuda total ({currency.format(customerTotalDebt)})
                </button>
              )}
            </div>
          </div>

          {/* PANEL 2: SALDO RESTANTE DE DEUDA */}
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
                {hasCreditSurplus ? "Saldo a Favor" : "Saldo Restante Deuda"}
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
                ? "Deuda 100% saldada"
                : hasCreditSurplus
                ? "Crédito a favor del cliente"
                : isPartialPayment
                ? `Deuda anterior: ${currency.format(customerTotalDebt)}`
                : `Deuda actual: ${currency.format(customerTotalDebt)}`}
            </p>
          </div>
        </div>

        {/* LISTA UNIFICADA DE OPCIONES DE PAGO */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Medio de Pago / Cuenta</span>
            <span>Importe Asignado ($)</span>
          </div>

          <div className="space-y-1">
            {paymentOptions.map((option, index) => {
              const isHighlighted = highlightedIndex === index;
              const isConfirmed = Boolean(lockedMethodIds[option.id] && (allocatedAmounts[option.id] || 0) > 0);
              const rawAmount = amountInputs[option.id] ?? "";
              const hasAmount = Boolean(rawAmount && parseFloat(rawAmount.replace(",", ".")) > 0);
              const Icon = getMethodIcon(option.code);

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
            Observaciones / N° de Comprobante o Recibo (Opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Pago en sucursal / Recibo N° 0001-00004523"
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
                <span>Confirmar Cobro Total ({currency.format(totalAssigned)}) (Enter)</span>
              </>
            ) : isPartialPayment ? (
              <>
                <Check size={14} strokeWidth={3} />
                <span>Confirmar Cobro Parcial ({currency.format(totalAssigned)}) (Enter)</span>
              </>
            ) : hasCreditSurplus ? (
              <>
                <Check size={14} strokeWidth={3} />
                <span>Confirmar Cobro ({currency.format(totalAssigned)}) (Enter)</span>
              </>
            ) : (
              <span>Ingresá un importe a cobrar</span>
            )}
          </button>
        </div>
      </article>
    </section>
  );
};
