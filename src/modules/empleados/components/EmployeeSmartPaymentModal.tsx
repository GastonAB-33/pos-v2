import { useEffect, useMemo, useRef, useState } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { employeeCurrentAccountsService } from "@/services/employee-current-accounts.service";
import { cashService } from "@/services/cash.service";
import { bankAccountMovementsService } from "@/services/bank-account-movements.service";
import { normalizePaymentMethodCode } from "@/services/payment-methods.service";
import type { Employee, PaymentMethod, BankAccount } from "@/types/entities";
import {
  DollarSign,
  Banknote,
  Landmark,
  CreditCard,
  QrCode,
  Receipt,
  Wallet,
  Check,
  Copy,
  TrendingDown,
} from "lucide-react";

interface EmployeeSmartPaymentModalProps {
  open: boolean;
  tenantId: string;
  userId: string | null;
  employee: Employee;
  paymentMethods: PaymentMethod[];
  bankAccounts: BankAccount[];
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

interface PaymentOption {
  id: string;
  paymentMethodId: string;
  code: string;
  name: string;
  subtitle: string;
  bankAccountId?: string;
  bankName?: string;
  alias?: string | null;
  cbu?: string | null;
}

const getMethodIcon = (code: string) => {
  const normalized = normalizePaymentMethodCode(code);
  switch (normalized) {
    case "cash":
      return Banknote;
    case "transfer":
      return Landmark;
    case "card_debit":
    case "card_credit":
      return CreditCard;
    case "mercado_pago":
      return QrCode;
    case "cheque":
      return Receipt;
    default:
      return Wallet;
  }
};

export const EmployeeSmartPaymentModal = ({
  open,
  tenantId,
  userId,
  employee,
  paymentMethods,
  bankAccounts,
  onClose,
  onSuccess,
}: EmployeeSmartPaymentModalProps) => {
  useBodyScrollLock(open);
  const toast = useToast();

  const currentDebt = Math.max(0, Number(employee.current_balance ?? 0));

  // Generar opciones de pago inteligentes basadas en métodos y cuentas bancarias del comercio
  const paymentOptions = useMemo<PaymentOption[]>(() => {
    const options: PaymentOption[] = [];

    // 1. Efectivo
    const cashMethod = paymentMethods.find((m) => normalizePaymentMethodCode(m.code) === "cash");
    if (cashMethod) {
      options.push({
        id: `method-${cashMethod.id}`,
        paymentMethodId: cashMethod.id,
        code: "cash",
        name: cashMethod.name || "Efectivo",
        subtitle: "Cobro directo en caja",
      });
    }

    // 2. Transferencias Bancarias (desglosadas por cuenta bancaria activa)
    const transferMethod = paymentMethods.find((m) => normalizePaymentMethodCode(m.code) === "transfer");
    if (transferMethod) {
      const activeBanks = bankAccounts.filter((b) => b.is_active);
      if (activeBanks.length > 0) {
        for (const account of activeBanks) {
          options.push({
            id: `bank-acc-${account.id}`,
            paymentMethodId: transferMethod.id,
            code: "transfer",
            name: `Transferencia ${account.bank_name}`,
            subtitle: account.alias ? `Alias: ${account.alias}` : account.cbu ? `CBU: ${account.cbu}` : "Cuenta Bancaria",
            bankAccountId: account.id,
            bankName: account.bank_name,
            alias: account.alias,
            cbu: account.cbu,
          });
        }
      } else {
        options.push({
          id: `method-${transferMethod.id}`,
          paymentMethodId: transferMethod.id,
          code: "transfer",
          name: transferMethod.name || "Transferencia Bancaria",
          subtitle: "Impacta en movimientos bancarios",
        });
      }
    }

    // 3. Tarjeta de Débito
    const debitMethod = paymentMethods.find((m) => normalizePaymentMethodCode(m.code) === "card_debit");
    if (debitMethod) {
      options.push({
        id: `method-${debitMethod.id}`,
        paymentMethodId: debitMethod.id,
        code: "card_debit",
        name: debitMethod.name || "Tarjeta de Débito",
        subtitle: "Terminal de cobro electrónico",
      });
    }

    // 4. Tarjeta de Crédito
    const creditMethod = paymentMethods.find((m) => normalizePaymentMethodCode(m.code) === "card_credit");
    if (creditMethod) {
      options.push({
        id: `method-${creditMethod.id}`,
        paymentMethodId: creditMethod.id,
        code: "card_credit",
        name: creditMethod.name || "Tarjeta de Crédito",
        subtitle: "Financiación / Posnet",
      });
    }

    // 5. Mercado Pago
    const mpMethod = paymentMethods.find((m) => normalizePaymentMethodCode(m.code) === "mercado_pago");
    if (mpMethod) {
      options.push({
        id: `method-${mpMethod.id}`,
        paymentMethodId: mpMethod.id,
        code: "mercado_pago",
        name: mpMethod.name || "Mercado Pago",
        subtitle: "Cobro QR digital / Transferencia MP",
      });
    }

    // Fallback a Efectivo genérico si no hay métodos cargados
    if (options.length === 0) {
      options.push({
        id: "default-cash",
        paymentMethodId: "cash-default",
        code: "cash",
        name: "Efectivo",
        subtitle: "Cobro directo en caja",
      });
    }

    return options;
  }, [paymentMethods, bankAccounts]);

  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [amountInput, setAmountInput] = useState<string>("");
  const [receivedInput, setReceivedInput] = useState<string>("");
  const [concept, setConcept] = useState<string>("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountRef = useRef<HTMLInputElement | null>(null);

  // Inicializar estado al abrir el modal
  useEffect(() => {
    if (!open) return;
    const defaultOption = paymentOptions[0]?.id || "";
    setSelectedOptionId(defaultOption);
    setAmountInput(currentDebt > 0 ? currentDebt.toString() : "");
    setReceivedInput("");
    setConcept("Cobro saldo de cuenta corriente");
    setIsSubmitting(false);

    const timer = window.setTimeout(() => {
      amountRef.current?.focus();
      amountRef.current?.select();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [open, currentDebt, paymentOptions]);

  if (!open) return null;

  const selectedOption = paymentOptions.find((o) => o.id === selectedOptionId) || paymentOptions[0];
  const isCash = selectedOption?.code === "cash";

  const numericAmount = useMemo(() => {
    const clean = amountInput.replace(",", ".");
    const val = parseFloat(clean);
    return !isNaN(val) && val > 0 ? Number(val.toFixed(2)) : 0;
  }, [amountInput]);

  const numericReceived = useMemo(() => {
    const clean = receivedInput.replace(",", ".");
    const val = parseFloat(clean);
    return !isNaN(val) && val > 0 ? Number(val.toFixed(2)) : 0;
  }, [receivedInput]);

  const changeAmount = useMemo(() => {
    if (!isCash || numericReceived <= numericAmount) return 0;
    return Number((numericReceived - numericAmount).toFixed(2));
  }, [isCash, numericReceived, numericAmount]);

  const remainingDebt = useMemo(() => {
    return Math.max(0, Number((currentDebt - numericAmount).toFixed(2)));
  }, [currentDebt, numericAmount]);

  const creditSurplus = useMemo(() => {
    return numericAmount > currentDebt ? Number((numericAmount - currentDebt).toFixed(2)) : 0;
  }, [currentDebt, numericAmount]);

  const canSubmit = numericAmount > 0 && !isSubmitting;

  const handleCopyText = async (text: string, fieldKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      toast.success("Copiado al portapapeles");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("No se pudo copiar automáticamente");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const notesComposed = [
        concept.trim(),
        `Medio: ${selectedOption.name}`,
        selectedOption.bankName ? `Banco: ${selectedOption.bankName}` : null,
      ]
        .filter(Boolean)
        .join(" • ");

      // 1. Asentar movimiento en la Cuenta Corriente del Empleado
      const movement = await employeeCurrentAccountsService.createMovement(tenantId, {
        employee_id: employee.id,
        type: "payment",
        amount: numericAmount,
        category: "cash_payment",
        notes: notesComposed,
        created_by: userId,
      });

      // 2. Impacto Contable en Caja Diaria o Cuenta Bancaria
      let cashImpacted = false;
      let bankImpacted = false;

      if (isCash) {
        // Buscar sesión de caja abierta activa
        const openSession =
          (userId ? await cashService.getOpenSessionByUser(tenantId, userId) : null) ??
          (await cashService.getOpenSession(tenantId));

        if (openSession) {
          await cashService.createMovement(tenantId, {
            cash_session_id: openSession.id,
            movement_type: "income",
            amount: numericAmount,
            currency_code: "ARS",
            reference_type: "cash",
            reference_id: movement.id,
            notes: `Cobro Cta. Cte. Empleado: ${employee.full_name}`,
            created_by: userId,
          });
          cashImpacted = true;
        }
      } else if (selectedOption.bankAccountId) {
        // Asentar ingreso en la cuenta bancaria del comercio
        try {
          await bankAccountMovementsService.createMovement(tenantId, {
            bank_account_id: selectedOption.bankAccountId,
            type: "income",
            origin_type: "customer_collection",
            concept: `Cobro Cta. Cte. Empleado: ${employee.full_name}`,
            amount: numericAmount,
            reference_id: movement.id,
            notes: notesComposed,
            created_by: userId,
          });
          bankImpacted = true;
        } catch (bankErr) {
          console.warn("No se pudo asentar el ingreso bancario automático:", bankErr);
        }
      }

      toast.success(
        `Pago de ${currency.format(numericAmount)} registrado correctamente.${
          cashImpacted
            ? " Se ingresó el dinero a la Caja Diaria."
            : bankImpacted
            ? ` Se acreditó en ${selectedOption.bankName}.`
            : ""
        }`
      );

      await onSuccess();
      onClose();
    } catch (err) {
      console.error("Error al registrar pago de empleado:", err);
      toast.error("Ocurrió un error al procesar el pago en cuenta corriente");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden dark:bg-slate-900 flex flex-col max-h-[92dvh] my-auto">
        {/* Encabezado Fijo */}
        <div className="flex items-center justify-between border-b border-slate-200/90 dark:border-slate-800 px-4 py-3 sm:px-6 sm:py-4 bg-emerald-50/60 dark:bg-emerald-950/30 shrink-0">
          <div>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 shrink-0">
                <DollarSign size={18} />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Registrar Pago en Cuenta Corriente
              </h3>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 ml-10 sm:ml-11">
              Empleado: <strong className="text-slate-700 dark:text-slate-200">{employee.full_name}</strong> • Saldo actual:{" "}
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{currency.format(currentDebt)}</span>
            </p>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={isSubmitting} />
        </div>

        {/* Formulario con Scroll Interno */}
        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* 1. Selección del Medio de Cobro Inteligente */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Medio de Pago / Cobro *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {paymentOptions.map((opt) => {
                  const Icon = getMethodIcon(opt.code);
                  const isSelected = selectedOptionId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedOptionId(opt.id)}
                      className={`flex items-start gap-2.5 p-3 rounded-xl sm:rounded-2xl border text-left transition cursor-pointer ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${
                          isSelected
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold block truncate">{opt.name}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                          {opt.subtitle}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Si es transferencia y tiene CBU / Alias, mostrar panel para copiar */}
              {selectedOption.code === "transfer" && (selectedOption.alias || selectedOption.cbu) && (
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/60 dark:bg-indigo-950/30 p-3 space-y-1.5 mt-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                    Datos bancarios para recibir la transferencia:
                  </span>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    {selectedOption.alias && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(selectedOption.alias!, "alias")}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-indigo-800 dark:text-indigo-200 font-mono text-[11px] font-bold hover:bg-indigo-50 cursor-pointer"
                      >
                        {copiedField === "alias" ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        <span>Alias: {selectedOption.alias}</span>
                      </button>
                    )}
                    {selectedOption.cbu && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(selectedOption.cbu!, "cbu")}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-indigo-800 dark:text-indigo-200 font-mono text-[11px] font-bold hover:bg-indigo-50 cursor-pointer"
                      >
                        {copiedField === "cbu" ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        <span>CBU: {selectedOption.cbu}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Importe a Abonar y Chips de atajo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Importe a Cobrar / Abonar ($) *
                </label>
                {currentDebt > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmountInput(currentDebt.toString())}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Saldar Total ({currency.format(currentDebt)})
                  </button>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400 font-mono">
                  $
                </span>
                <input
                  ref={amountRef}
                  type="number"
                  step="any"
                  min="0.01"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 pl-8 pr-4 text-xl font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              {/* Botones rápidos de porcentaje si hay deuda */}
              {currentDebt > 0 && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Atajos:
                  </span>
                  <button
                    type="button"
                    onClick={() => setAmountInput(currentDebt.toString())}
                    className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 transition cursor-pointer"
                  >
                    100% ({currency.format(currentDebt)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountInput((currentDebt / 2).toFixed(2))}
                    className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 transition cursor-pointer"
                  >
                    50% ({currency.format(currentDebt / 2)})
                  </button>
                </div>
              )}
            </div>

            {/* Si es efectivo: Monto Recibido y Vuelto */}
            {isCash && numericAmount > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Paga con ($ Efectivo)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={receivedInput}
                    onChange={(e) => setReceivedInput(e.target.value)}
                    placeholder={numericAmount.toString()}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Vuelto a Entregar
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {currency.format(changeAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* Concepto / Motivo */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Concepto / Observaciones
              </label>
              <input
                type="text"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Ej: Cobro en caja saldo quincena"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Resumen de Saldo Resultante */}
            {numericAmount > 0 && (
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Deuda previa:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{currency.format(currentDebt)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>- Pago a ingresar:</span>
                  <span className="font-mono font-bold">-{currency.format(numericAmount)}</span>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <TrendingDown size={13} className="text-emerald-500" />
                    Saldo adeudado restante:
                  </span>
                  <span
                    className={`text-base font-black font-mono ${
                      remainingDebt > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {currency.format(remainingDebt)}
                  </span>
                </div>
                {creditSurplus > 0 && (
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                    * El pago supera la deuda actual por {currency.format(creditSurplus)} (quedará como saldo a favor del empleado).
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer Fijo */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-200/90 dark:border-slate-800 p-3 sm:p-4 bg-slate-50/50 dark:bg-slate-900 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              {isSubmitting ? "Registrando..." : `Confirmar Pago (${currency.format(numericAmount)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
