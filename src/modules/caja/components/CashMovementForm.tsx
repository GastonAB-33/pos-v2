import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Check,
  CreditCard,
  Landmark,
  Receipt,
  Smartphone,
  X,
  AlertCircle,
} from "lucide-react";
import {
  cashMovementSchema,
  type CashMovementValues,
} from "@/modules/caja/schemas/cash.schemas";
import { normalizePaymentMethodCode } from "@/services/payment-methods.service";
import type { BankAccount, PaymentMethod } from "@/types/entities";

interface CashMovementFormProps {
  mode: "income" | "expense";
  paymentMethods?: PaymentMethod[];
  bankAccounts?: BankAccount[];
  disabled?: boolean;
  canWrite: boolean;
  onSubmit: (values: CashMovementValues) => Promise<void>;
  onSuccess?: () => void;
  onCancel?: () => void;
  onToggleMode?: (nextMode: "income" | "expense") => void;
}

interface MovementPaymentOption {
  id: string;
  name: string;
  subtitle?: string;
  code: string;
  paymentType: "cash" | "transfer";
  bankAccountId?: string;
  paymentMethodId?: string;
  isBankTransfer?: boolean;
}

const getMethodIcon = (code: string) => {
  switch (code) {
    case "cash":
      return Banknote;
    case "transfer":
      return Landmark;
    case "card_debit":
    case "card_credit":
      return CreditCard;
    case "cheque":
      return Receipt;
    case "mercado_pago":
      return Smartphone;
    default:
      return Landmark;
  }
};

export const CashMovementForm = ({
  mode,
  paymentMethods = [],
  bankAccounts = [],
  disabled,
  canWrite,
  onSubmit,
  onSuccess,
  onCancel,
  onToggleMode,
}: CashMovementFormProps) => {
  const isIncome = mode === "income";

  const activeBankAccounts = useMemo(
    () => bankAccounts.filter((b) => b.is_active),
    [bankAccounts]
  );

  const cashMethod = useMemo(
    () =>
      paymentMethods.find(
        (m) => normalizePaymentMethodCode(m.code) === "cash" && m.is_active
      ),
    [paymentMethods]
  );

  const transferMethod = useMemo(
    () =>
      paymentMethods.find(
        (m) => normalizePaymentMethodCode(m.code) === "transfer" && m.is_active
      ),
    [paymentMethods]
  );

  // Lista unificada de opciones de pago/movimiento
  const paymentOptions = useMemo<MovementPaymentOption[]>(() => {
    const options: MovementPaymentOption[] = [];

    // 1. Efectivo
    options.push({
      id: "cash",
      name: "Efectivo",
      subtitle: isIncome
        ? "Ingreso directo al cajón de caja física"
        : "Retiro de efectivo del cajón físico",
      code: "cash",
      paymentType: "cash",
      paymentMethodId: cashMethod?.id,
    });

    // 2. Transferencias bancarias según cuentas de banco propias activas
    if (activeBankAccounts.length > 0) {
      for (const account of activeBankAccounts) {
        const holderPart = account.holder_name ? ` (${account.holder_name})` : "";
        const details = [
          account.alias ? `Alias: ${account.alias}` : null,
          account.cbu ? `CBU: ...${account.cbu.slice(-6)}` : null,
        ]
          .filter(Boolean)
          .join(" • ");

        options.push({
          id: `bank-${account.id}`,
          name: `Transferencia ${account.bank_name}${holderPart}`,
          subtitle: details || account.account_type?.replace("_", " ") || "Cuenta bancaria propia",
          code: "transfer",
          paymentType: "transfer",
          bankAccountId: account.id,
          paymentMethodId: transferMethod?.id,
          isBankTransfer: true,
        });
      }
    } else {
      // Fallback si no hay cuentas bancarias activas
      options.push({
        id: "transfer-generic",
        name: "Transferencia Bancaria",
        subtitle: "Sin cuentas registradas en módulo Bancos",
        code: "transfer",
        paymentType: "transfer",
        paymentMethodId: transferMethod?.id,
        isBankTransfer: true,
      });
    }

    // 3. En caso de ingreso, incluir otros medios de pago habilitados (Débito, Crédito, etc.)
    if (isIncome) {
      const otherMethods = paymentMethods.filter((m) => {
        if (!m.is_active) return false;
        const norm = normalizePaymentMethodCode(m.code);
        return (
          norm !== "cash" &&
          norm !== "transfer" &&
          norm !== "current_account"
        );
      });

      for (const m of otherMethods) {
        const norm = normalizePaymentMethodCode(m.code);
        let subtitle = "Cobro electrónico";
        if (norm === "card_debit") subtitle = "Terminal o Posnet Débito";
        else if (norm === "card_credit") subtitle = "Terminal o Posnet Crédito";
        else if (norm === "mercado_pago") subtitle = "Cobro con QR / App";
        else if (norm === "cheque") subtitle = "Cheque físico / eCheq";

        options.push({
          id: `method-${m.id}`,
          name: m.name || toTitle(norm),
          subtitle,
          code: norm,
          paymentType: "cash",
          paymentMethodId: m.id,
        });
      }
    }

    return options;
  }, [activeBankAccounts, cashMethod, isIncome, paymentMethods, transferMethod]);

  const [selectedOptionId, setSelectedOptionId] = useState<string>("cash");
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [lockedOptionIds, setLockedOptionIds] = useState<Record<string, boolean>>({});
  const [isReadyToSubmit, setIsReadyToSubmit] = useState(false);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const voucherRef = useRef<HTMLInputElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CashMovementValues>({
    resolver: zodResolver(cashMovementSchema),
    defaultValues: {
      amount: 0,
      paymentMethodId: cashMethod?.id ?? "",
      paymentType: "cash",
      bankAccountId: "",
      voucherNumber: "",
      notes: "",
    },
  });

  const currentAmount = watch("amount") || 0;

  // Sincronizar selección inicial
  useEffect(() => {
    if (paymentOptions.length > 0 && !paymentOptions.some((o) => o.id === selectedOptionId)) {
      setSelectedOptionId(paymentOptions[0].id);
    }
  }, [paymentOptions, selectedOptionId]);

  // Autofocus inmediato on mount: enfocar la primera opción (Efectivo) con selección ágil
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const firstId = paymentOptions[0]?.id || "cash";
      const input = inputRefs.current[firstId];
      if (input) {
        input.focus();
        input.select();
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, []);

  // Hotkeys globales: Escape para cerrar modal y F2 para alternar entre Ingreso y Egreso
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel?.();
      } else if (e.key === "F2") {
        e.preventDefault();
        onToggleMode?.(isIncome ? "expense" : "income");
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isIncome, onCancel, onToggleMode]);

  const activeOption = useMemo(
    () => paymentOptions.find((o) => o.id === selectedOptionId) || paymentOptions[0],
    [paymentOptions, selectedOptionId]
  );

  // Manejar selección de opción y transferencia de monto si ya se escribió
  const handleSelectOption = useCallback(
    (option: MovementPaymentOption) => {
      setSelectedOptionId(option.id);
      setIsReadyToSubmit(false);

      // Sincronizar campos de formulario
      setValue("paymentType", option.paymentType, { shouldValidate: true, shouldDirty: true });
      setValue("bankAccountId", option.bankAccountId || "", { shouldValidate: true, shouldDirty: true });
      setValue("paymentMethodId", option.paymentMethodId || "", { shouldValidate: true, shouldDirty: true });

      // Si hay un monto activo, trasladarlo al nuevo método seleccionado
      if (currentAmount > 0) {
        setAmountInputs({ [option.id]: currentAmount.toString() });
        setLockedOptionIds({});
      }

      // Enfocar input numérico con selección inmediata
      setTimeout(() => {
        const input = inputRefs.current[option.id];
        if (input) {
          input.focus();
          input.select();
        }
      }, 30);
    },
    [currentAmount, setValue]
  );

  // Cambiar monto en input de la fila
  const handleAmountChange = useCallback(
    (optionId: string, rawValue: string) => {
      setIsReadyToSubmit(false);
      // Al editar se desbloquea el estado confirmado hasta presionar OK o Enter
      setLockedOptionIds((prev) => {
        if (!prev[optionId]) return prev;
        const next = { ...prev };
        delete next[optionId];
        return next;
      });

      setAmountInputs((prev) => ({ ...prev, [optionId]: rawValue }));

      const clean = rawValue.replace(",", ".");
      const numeric = parseFloat(clean);
      const targetOption = paymentOptions.find((o) => o.id === optionId);

      if (!isNaN(numeric) && numeric > 0) {
        setValue("amount", Number(numeric.toFixed(2)), { shouldValidate: true, shouldDirty: true });
        if (targetOption) {
          setValue("paymentType", targetOption.paymentType, { shouldValidate: true, shouldDirty: true });
          setValue("bankAccountId", targetOption.bankAccountId || "", { shouldValidate: true, shouldDirty: true });
          setValue("paymentMethodId", targetOption.paymentMethodId || "", { shouldValidate: true, shouldDirty: true });
        }
      } else {
        setValue("amount", 0, { shouldValidate: true, shouldDirty: true });
      }
    },
    [paymentOptions, setValue]
  );

  // Confirmar monto de la opción (pasa a verde)
  const handleConfirmOption = useCallback(
    (optionId: string) => {
      const raw = amountInputs[optionId] ?? "";
      const clean = raw.replace(",", ".");
      const numeric = parseFloat(clean);

      if (!isNaN(numeric) && numeric > 0) {
        const fixed = Number(numeric.toFixed(2));
        setLockedOptionIds({ [optionId]: true });
        setAmountInputs({ [optionId]: fixed.toFixed(2) });
        setValue("amount", fixed, { shouldValidate: true, shouldDirty: true });
        setIsReadyToSubmit(true);

        const targetOption = paymentOptions.find((o) => o.id === optionId);
        if (targetOption) {
          setValue("paymentType", targetOption.paymentType, { shouldValidate: true, shouldDirty: true });
          setValue("bankAccountId", targetOption.bankAccountId || "", { shouldValidate: true, shouldDirty: true });
          setValue("paymentMethodId", targetOption.paymentMethodId || "", { shouldValidate: true, shouldDirty: true });
        }
      }
    },
    [amountInputs, paymentOptions, setValue]
  );

  // Limpiar monto de la opción
  const handleClearOption = useCallback(
    (optionId: string) => {
      setIsReadyToSubmit(false);
      setLockedOptionIds((prev) => {
        const next = { ...prev };
        delete next[optionId];
        return next;
      });
      setAmountInputs((prev) => {
        const next = { ...prev };
        delete next[optionId];
        return next;
      });
      setValue("amount", 0, { shouldValidate: true, shouldDirty: true });
    },
    [setValue]
  );

  // Manejo de teclado ágil para las opciones: Flechas Arriba/Abajo, Enter y Escape
  const handleKeyDownOnOption = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentIndex: number,
    option: MovementPaymentOption
  ) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = currentIndex + 1;
      if (nextIndex < paymentOptions.length) {
        const nextOpt = paymentOptions[nextIndex];
        handleSelectOption(nextOpt);
      } else {
        // Al final de la lista de medios de pago, saltar a comprobante o notas
        if (activeOption?.isBankTransfer && voucherRef.current) {
          voucherRef.current.focus();
          voucherRef.current.select();
        } else if (notesRef.current) {
          notesRef.current.focus();
        }
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex - 1;
      if (prevIndex >= 0) {
        const prevOpt = paymentOptions[prevIndex];
        handleSelectOption(prevOpt);
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const raw = amountInputs[option.id] ?? "";
      const clean = raw.replace(",", ".");
      const numeric = parseFloat(clean);
      if (!isNaN(numeric) && numeric > 0) {
        handleConfirmOption(option.id);
        setIsReadyToSubmit(true);
        // Al confirmar monto con Enter: pasa a comprobante (si es transf) o a motivo
        if (option.isBankTransfer) {
          window.setTimeout(() => {
            voucherRef.current?.focus();
            voucherRef.current?.select();
          }, 30);
        } else {
          window.setTimeout(() => {
            notesRef.current?.focus();
          }, 30);
        }
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      onCancel?.();
      return;
    }
  };

  const handleKeyDownOnVoucher = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      // Enter en comprobante pasa a motivo
      notesRef.current?.focus();
      return;
    }
    if (e.key === "Escape" || e.key === "ArrowUp") {
      e.preventDefault();
      // Esc retrocede al selector de método de pago y monto
      const targetOpt = activeOption ?? paymentOptions[0];
      if (targetOpt) {
        const input = inputRefs.current[targetOpt.id];
        input?.focus();
        input?.select();
      }
      return;
    }
  };

  const handleKeyDownOnNotes = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Enter en motivo guarda el movimiento directamente
      if (currentAmount > 0) {
        void handleSubmit(submit)();
      }
      return;
    }
    if (e.key === "Escape" || (e.key === "ArrowUp" && e.currentTarget.selectionStart === 0)) {
      e.preventDefault();
      // Esc retrocede a comprobante (si es transf) o al método de pago
      if (activeOption?.isBankTransfer && voucherRef.current) {
        voucherRef.current.focus();
        voucherRef.current.select();
      } else {
        const targetOpt = activeOption ?? paymentOptions[0];
        if (targetOpt) {
          const input = inputRefs.current[targetOpt.id];
          input?.focus();
          input?.select();
        }
      }
      return;
    }
  };

  const submit = async (values: CashMovementValues) => {
    if (!values.amount || values.amount <= 0) {
      return;
    }
    await onSubmit(values);
    reset({
      amount: 0,
      paymentMethodId: cashMethod?.id ?? "",
      paymentType: "cash",
      bankAccountId: "",
      voucherNumber: "",
      notes: "",
    });
    setAmountInputs({});
    setLockedOptionIds({});
    setIsReadyToSubmit(false);
    onSuccess?.();
  };

  return (
    <form
      className="flex flex-col h-full justify-between"
      onSubmit={handleSubmit(submit)}
      autoComplete="off"
    >
      <div className="space-y-2.5 flex-1 min-h-0 flex flex-col">
        {/* Encabezado de columnas: Medio de Pago / Cuenta vs Importe Asignado ($) */}
        <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">
          <span>Medio de Pago / Cuenta</span>
          <span>Importe Asignado ($)</span>
        </div>

        {/* Lista Unificada de Opciones (Idéntica a PosCheckoutPanel) */}
        <div className="space-y-1">
          {paymentOptions.map((option, index) => {
            const isHighlighted = selectedOptionId === option.id;
            const isConfirmed = Boolean(lockedOptionIds[option.id] && currentAmount > 0);
            const rawAmount = amountInputs[option.id] ?? "";
            const hasAmount = Boolean(rawAmount && parseFloat(rawAmount.replace(",", ".")) > 0);
            const Icon = getMethodIcon(option.code);

            return (
              <div
                key={option.id}
                onClick={() => handleSelectOption(option)}
                className={`group flex items-center justify-between gap-2.5 py-1 px-3 rounded-xl border transition cursor-pointer ${
                  isConfirmed
                    ? "border-emerald-500 dark:border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 ring-2 ring-emerald-500/60 shadow-xs"
                    : isHighlighted
                    ? "border-amber-400 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-500/20 ring-2 ring-amber-400 dark:ring-amber-400/90 shadow-sm"
                    : hasAmount
                    ? "border-slate-300 dark:border-slate-600 bg-slate-100/70 dark:bg-slate-800/80 hover:border-slate-400 dark:hover:border-slate-500"
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                }`}
              >
                {/* Lado izquierdo: Icono y Nombre */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition ${
                      isConfirmed
                        ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-xs"
                        : isHighlighted
                        ? "bg-amber-400 dark:bg-amber-400 text-slate-950 font-black shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <Icon size={13} />
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
                          <span className="flex h-3 w-3 items-center justify-center rounded-full bg-emerald-600 text-white">
                            <Check size={8} strokeWidth={3} />
                          </span>
                          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/90 px-1 py-0 rounded border border-emerald-300 dark:border-emerald-700">
                            Confirmado
                          </span>
                        </div>
                      )}
                    </div>
                    {option.subtitle && (
                      <p className="text-[9.5px] text-slate-500 dark:text-slate-400 truncate leading-tight">
                        {option.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Lado derecho: Casilla de Importe ($) y Botones */}
                <div
                  className="flex items-center gap-1.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="relative w-28">
                    <span
                      className={`absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-black pointer-events-none transition ${
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
                      onChange={(e) => handleAmountChange(option.id, e.target.value)}
                      onFocus={(e) => {
                        e.target.select();
                        setSelectedOptionId(option.id);
                        handleSelectOption(option);
                      }}
                      onClick={(e) => {
                        (e.target as HTMLInputElement).select();
                      }}
                      onKeyDown={(e) => handleKeyDownOnOption(e, index, option)}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      disabled={disabled || !canWrite}
                      className={`w-full rounded-lg border py-0.5 pl-4 pr-1.5 text-right font-mono text-xs outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
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

                  {/* Botón Confirmar Monto si está resaltado con monto y aún no confirmado */}
                  {!isConfirmed && hasAmount && isHighlighted && (
                    <button
                      type="button"
                      onClick={() => handleConfirmOption(option.id)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-400 hover:bg-amber-500 dark:bg-amber-400 dark:hover:bg-amber-300 text-slate-950 font-bold text-[11px] shadow-xs transition cursor-pointer"
                      title="Confirmar monto asignado (Enter)"
                    >
                      <Check size={11} strokeWidth={3} />
                      <span className="inline">OK</span>
                    </button>
                  )}

                  {/* Botón Limpiar Monto */}
                  {hasAmount && (
                    <button
                      type="button"
                      onClick={() => handleClearOption(option.id)}
                      className="rounded-lg p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                      title="Limpiar monto"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {errors.amount && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium px-1 shrink-0">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errors.amount.message}</span>
          </div>
        )}

        {/* Si se selecciona una transferencia bancaria: Campo N° Comprobante */}
        {activeOption?.isBankTransfer && (
          <div className="p-2.5 rounded-xl border border-blue-200/90 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-1 shrink-0 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                N° de Comprobante / Referencia de transferencia{" "}
                <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
              </label>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                Banco destino/origen
              </span>
            </div>
            {(() => {
              const { ref: formVoucherRef, ...voucherFieldProps } = register("voucherNumber");
              return (
                <input
                  type="text"
                  placeholder="Ej: Transf. 984321 / Código de operación..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  {...voucherFieldProps}
                  ref={(el) => {
                    formVoucherRef(el);
                    voucherRef.current = el;
                  }}
                  onKeyDown={handleKeyDownOnVoucher}
                  className="h-8 w-full px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-400 transition-colors"
                  disabled={disabled || !canWrite}
                />
              );
            })()}
          </div>
        )}

        {/* Concepto / Motivo */}
        <div className="shrink-0">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
            Concepto / Motivo
          </label>
          {(() => {
            const { ref: formNotesRef, ...notesFieldProps } = register("notes");
            return (
              <textarea
                rows={2}
                placeholder={
                  isIncome
                    ? "Ej: Aporte inicial adicional, cobro particular..."
                    : "Ej: Pago de flete, compras menores, viáticos..."
                }
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                {...notesFieldProps}
                ref={(el) => {
                  formNotesRef(el);
                  notesRef.current = el;
                }}
                onKeyDown={handleKeyDownOnNotes}
                className="w-full p-2 text-xs bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-400 transition-colors"
                disabled={disabled || !canWrite}
              />
            );
          })()}
          {errors.notes && (
            <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{errors.notes.message}</p>
          )}
        </div>
      </div>

      {/* Botón de Acción Principal */}
      <div className="pt-2 shrink-0">
        <button
          type="submit"
          disabled={disabled || !canWrite || currentAmount <= 0}
          className={`h-9.5 w-full inline-flex items-center justify-center gap-1.5 px-4 text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
            isIncome
              ? "text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-emerald-600/20"
              : "text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 shadow-rose-600/20"
          } ${
            isReadyToSubmit && currentAmount > 0
              ? isIncome
                ? "ring-2 ring-emerald-400 dark:ring-emerald-400 shadow-md animate-pulse"
                : "ring-2 ring-rose-400 dark:ring-rose-400 shadow-md animate-pulse"
              : ""
          }`}
        >
          {isIncome ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
          <span>
            {isIncome
              ? currentAmount > 0
                ? `Guardar ingreso por $${currentAmount.toLocaleString("es-AR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : "Guardar ingreso"
              : currentAmount > 0
              ? `Guardar egreso por $${currentAmount.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : "Guardar egreso"}
          </span>
          <kbd className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-black/20 text-white/90">
            Enter ↵
          </kbd>
        </button>
      </div>
    </form>
  );
};

function toTitle(str: string): string {
  return str
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
