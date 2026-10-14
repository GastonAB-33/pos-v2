import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Check,
  CreditCard,
  FileText,
  Landmark,
  QrCode,
  Receipt,
  UserCheck,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import type {
  MercadoPagoOperationalStatus,
  MercadoPagoPaymentIntent,
} from "@/services/mercadopago/mercadopago-payments.service";
import type {
  BankAccount,
  Customer,
  InstallmentPlan,
  MercadoPagoSettings,
  OriginBank,
  PaymentMethod,
} from "@/types/entities";
import { formatCustomerDocument } from "@/modules/configuracion/hooks/useEntityRequirements";
import { normalizePaymentMethodCode } from "@/services/payment-methods.service";
import type {
  PosCheckoutValues,
  PosPaymentSplitItem,
} from "@/modules/pos/schemas/pos-checkout.schema";
import { PosCustomerSelectModal } from "./PosCustomerSelectModal";

interface PosCheckoutPanelProps {
  panelId?: string;
  formId?: string;
  layout?: "panel" | "modal";
  customers: Customer[];
  paymentMethods: PaymentMethod[];
  bankAccounts: BankAccount[];
  originBanks: OriginBank[];
  installmentPlans: InstallmentPlan[];
  selectedCustomerId: string;
  selectedPaymentMethodId: string;
  isOnline: boolean;
  checkoutTotal: number;
  rawCheckoutTotal?: number;
  roundingAdjustment?: number;
  mercadoPagoIntent: MercadoPagoPaymentIntent | null;
  mercadoPagoSettings: MercadoPagoSettings;
  mercadoPagoStatus: MercadoPagoOperationalStatus;
  isMercadoPagoLoading: boolean;
  canWrite: boolean;
  canManageCustomers: boolean;
  currentAccountSnapshot: {
    enabled: boolean;
    limit: number | null;
    debt: number;
    available: number | null;
  } | null;
  hasDebtPaymentInCart?: boolean;
  disabled?: boolean;
  onCustomerChange: (customerId: string) => void;
  onPaymentMethodChange: (paymentMethodId: string) => void;
  onCreateOriginBank: (name: string) => Promise<OriginBank | null>;
  onOpenCustomerModal: (customer: Customer | null) => void;
  onStartMercadoPago: () => void;
  onRefreshMercadoPago: () => void;
  onApproveMercadoPago: () => void;
  onRejectMercadoPago: () => void;
  onCancelMercadoPago: () => void;
  onClose?: () => void;
  onSubmit: (values: PosCheckoutValues) => Promise<void>;
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
    case "current_account":
      return UserCheck;
    case "cheque":
      return Receipt;
    default:
      return Wallet;
  }
};

interface PosPaymentOption {
  id: string; // ID único para control de asignación
  paymentMethodId: string;
  code: string;
  name: string;
  subtitle: string;
  bankAccountId?: string;
  bankName?: string;
  isCurrentAccount?: boolean;
  isBankTransfer?: boolean;
}

export const PosCheckoutPanel = ({
  formId,
  customers,
  paymentMethods,
  bankAccounts,
  selectedCustomerId,
  selectedPaymentMethodId,
  isOnline,
  checkoutTotal,
  rawCheckoutTotal,
  roundingAdjustment = 0,
  mercadoPagoIntent,
  mercadoPagoSettings,
  mercadoPagoStatus,
  isMercadoPagoLoading,
  canWrite,
  currentAccountSnapshot,
  hasDebtPaymentInCart: _hasDebtPaymentInCart = false,
  disabled,
  onCustomerChange,
  onPaymentMethodChange,
  onOpenCustomerModal,
  onStartMercadoPago,
  onRefreshMercadoPago,
  onApproveMercadoPago,
  onRejectMercadoPago,
  onCancelMercadoPago,
  onClose,
  onSubmit,
}: PosCheckoutPanelProps) => {
  const [issueInvoice, setIssueInvoice] = useState(false);
  const [notes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Modal para selección ágil de cliente
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Cuentas bancarias configuradas y habilitadas para POS
  const posBankAccounts = useMemo(() => {
    return bankAccounts.filter((b) => b.is_active && b.is_pos_available !== false);
  }, [bankAccounts]);

  // Lista unificada de opciones de pago (desglosando bancos habilitados si corresponde)
  const paymentOptions = useMemo<PosPaymentOption[]>(() => {
    const options: PosPaymentOption[] = [];

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
        subtitle: "Cobro inmediato en caja física",
      });
    }

    // 2. Transferencias Bancarias (Desglose por bancos del tenant si existen)
    const transferMethod = paymentMethods.find(
      (m) => normalizePaymentMethodCode(m.code) === "transfer"
    );

    if (transferMethod) {
      if (posBankAccounts.length > 0) {
        // Desglosar cada cuenta bancaria activa habilitada en POS (ej: Patricia, Octavio)
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
            isBankTransfer: true,
          });
        }
      } else {
        // Fallback genérico si no hay cuentas configuradas en módulo bancos
        options.push({
          id: `method-${transferMethod.id}`,
          paymentMethodId: transferMethod.id,
          code: "transfer",
          name: transferMethod.name || "Transferencia Bancaria",
          subtitle: "Comprobante / acreditación bancaria",
          isBankTransfer: true,
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
        subtitle: "Cobro posnet / terminal débito",
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
        subtitle: "Financiación / cuotas",
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
        subtitle: mercadoPagoSettings.enabled
          ? "Terminal Point QR / Dinámico"
          : "Transferencia / QR Estático",
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

    // 7. Cuenta Corriente
    const ccMethod = paymentMethods.find(
      (m) => normalizePaymentMethodCode(m.code) === "current_account"
    );
    if (ccMethod) {
      options.push({
        id: `method-${ccMethod.id}`,
        paymentMethodId: ccMethod.id,
        code: "current_account",
        name: ccMethod.name || "Cuenta Corriente",
        subtitle: "A crédito / saldo fiado al cliente",
        isCurrentAccount: true,
      });
    }

    return options;
  }, [paymentMethods, posBankAccounts, mercadoPagoSettings.enabled]);

  // Montos asignados a cada opción de pago { [optionId]: number }
  const [allocatedAmounts, setAllocatedAmounts] = useState<Record<string, number>>({});
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Inicializar con el medio de pago predeterminado o efectivo
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (paymentOptions.length === 0) return;

    if (!isInitializedRef.current) {
      isInitializedRef.current = true;

      // Buscar si coincide con selectedPaymentMethodId
      const targetIndex = paymentOptions.findIndex(
        (opt) => opt.paymentMethodId === selectedPaymentMethodId
      );
      const chosenIndex = targetIndex >= 0 ? targetIndex : 0;
      const initialOption = paymentOptions[chosenIndex];

      setHighlightedIndex(chosenIndex);
      setAllocatedAmounts({
        [initialOption.id]: checkoutTotal,
      });
      setAmountInputs({
        [initialOption.id]: checkoutTotal.toFixed(2),
      });

      onPaymentMethodChange(initialOption.paymentMethodId);
    }
  }, [checkoutTotal, onPaymentMethodChange, paymentOptions, selectedPaymentMethodId]);

  // Cálculos de asignación total y pendiente
  const totalAssigned = useMemo(() => {
    const sum = Object.values(allocatedAmounts).reduce((acc, val) => acc + (val || 0), 0);
    return Number(sum.toFixed(2));
  }, [allocatedAmounts]);

  const totalPending = useMemo(() => {
    const diff = Number((checkoutTotal - totalAssigned).toFixed(2));
    return Math.max(0, diff);
  }, [checkoutTotal, totalAssigned]);

  const isFullyAssigned = Math.abs(totalAssigned - checkoutTotal) <= 0.01 && totalAssigned > 0;
  const isOverpaid = totalAssigned > checkoutTotal + 0.01;

  // Cliente seleccionado actual
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const isCurrentAccountUsed = useMemo(() => {
    const ccOption = paymentOptions.find((opt) => opt.isCurrentAccount);
    if (!ccOption) return false;
    return (allocatedAmounts[ccOption.id] || 0) > 0;
  }, [allocatedAmounts, paymentOptions]);

  // Actualizar el monto de un método
  const updateOptionAmount = useCallback(
    (optionId: string, rawValue: string) => {
      setSubmitError(null);
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
    },
    []
  );

  // Asignar el total pendiente al método seleccionado
  const assignPendingToOption = useCallback(
    (optionId: string) => {
      setSubmitError(null);
      const currentVal = allocatedAmounts[optionId] || 0;
      const otherTotals = totalAssigned - currentVal;
      const availableToAssign = Number(Math.max(0, checkoutTotal - otherTotals).toFixed(2));

      if (availableToAssign <= 0) return;

      setAllocatedAmounts((prev) => ({
        ...prev,
        [optionId]: availableToAssign,
      }));
      setAmountInputs((prev) => ({
        ...prev,
        [optionId]: availableToAssign.toFixed(2),
      }));
    },
    [allocatedAmounts, checkoutTotal, totalAssigned]
  );

  // Manejo de envío final de la venta
  const handleFinalSubmit = useCallback(async () => {
    setSubmitError(null);

    if (!canWrite) {
      setSubmitError("No tenés permisos para registrar ventas.");
      return;
    }

    if (!isFullyAssigned) {
      if (totalPending > 0) {
        setSubmitError(`Resta asignar ${currency.format(totalPending)} para completar el total.`);
      } else if (isOverpaid) {
        setSubmitError(
          `El total asignado supera el monto a pagar por ${currency.format(
            totalAssigned - checkoutTotal
          )}.`
        );
      }
      return;
    }

    // Validar si cuenta corriente está usada y requiere cliente
    if (isCurrentAccountUsed && !selectedCustomer) {
      setSubmitError("Debes seleccionar un cliente para cobrar con cuenta corriente.");
      setIsCustomerModalOpen(true);
      return;
    }

    // Obtener los métodos con monto asignado
    const activeEntries = Object.entries(allocatedAmounts).filter(
      ([, amount]) => typeof amount === "number" && amount > 0
    );

    if (activeEntries.length === 0) {
      setSubmitError("Debes asignar el monto a al menos un medio de pago.");
      return;
    }

    // Preparar lista de pagos para el backend
    const splitPaymentsList: PosPaymentSplitItem[] = activeEntries.map(([optId, amount]) => {
      const option = paymentOptions.find((o) => o.id === optId)!;
      let paymentDetails: Record<string, unknown> | null = null;

      if (option.bankAccountId) {
        paymentDetails = {
          kind: "transfer",
          destination_account_id: option.bankAccountId,
          destination_account_bank: option.bankName,
          captured_at: new Date().toISOString(),
        };
      }

      return {
        id: `split-${option.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        paymentMethodId: option.paymentMethodId,
        amount: Number(amount.toFixed(2)),
        paymentDetails,
      };
    });

    const isSplit = splitPaymentsList.length > 1;
    const primaryOption = paymentOptions.find((o) => o.id === activeEntries[0][0])!;

    let primaryDetails: Record<string, unknown> | null = null;
    if (primaryOption.bankAccountId) {
      primaryDetails = {
        kind: "transfer",
        destination_account_id: primaryOption.bankAccountId,
        destination_account_bank: primaryOption.bankName,
        captured_at: new Date().toISOString(),
      };
    }

    const payload: PosCheckoutValues = {
      customerId: selectedCustomerId || undefined,
      paymentMethodId: primaryOption.paymentMethodId,
      issueInvoice,
      notes: notes.trim(),
      isSplitPayment: isSplit,
      payments: isSplit ? splitPaymentsList : undefined,
      paymentDetails: isSplit ? null : primaryDetails,
    };

    await onSubmit(payload);
  }, [
    allocatedAmounts,
    canWrite,
    checkoutTotal,
    isCurrentAccountUsed,
    isFullyAssigned,
    isOverpaid,
    issueInvoice,
    notes,
    onSubmit,
    paymentOptions,
    selectedCustomerId,
    selectedCustomer,
    totalAssigned,
    totalPending,
  ]);

  // Manejo de teclado general en el panel
  const handlePanelKeyDown = (e: React.KeyboardEvent) => {
    // Si el modal de búsqueda de clientes está abierto, ignorar teclado global
    if (isCustomerModalOpen) return;

    if (e.key === "ArrowDown") {
      // Si la tecla se presiona en un input, evitar que altere números si se navega
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % paymentOptions.length);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + paymentOptions.length) % paymentOptions.length);
      return;
    }

    if (e.key === "Enter") {
      const activeOption = paymentOptions[highlightedIndex];
      const activeAmount = allocatedAmounts[activeOption.id] || 0;

      // Si el monto total está 100% asignado, Enter confirma la venta
      if (isFullyAssigned) {
        e.preventDefault();
        void handleFinalSubmit();
        return;
      }

      // Si falta asignar y el método activo no tiene el restante, asignárselo
      if (totalPending > 0 && activeAmount < checkoutTotal) {
        e.preventDefault();
        assignPendingToOption(activeOption.id);
        return;
      }
    }

    if (e.key === "Escape" && onClose) {
      e.preventDefault();
      onClose();
    }
  };

  const isMpHighlighted = paymentOptions[highlightedIndex]?.code === "mercado_pago";

  return (
    <section
      id={formId}
      className="flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-300 dark:border-slate-700 outline-none"
      onKeyDown={handlePanelKeyDown}
      tabIndex={0}
    >
      {/* Línea de acento superior estilo fintech */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-blue-500 to-indigo-600" />

      {/* Top Meta Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 px-5 py-2.5 text-[11px]">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-semibold">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="uppercase tracking-wider">Modo Ágil POS</span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="rounded-md bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:text-slate-300">
            PAGO DIRECTO & COMBINADO
          </span>
        </div>

        {onClose && (
          <button
            type="button"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition"
            onClick={onClose}
            title="Cerrar ventana (Esc)"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Banner de integración Mercado Pago si está seleccionado */}
      {isMpHighlighted && mercadoPagoSettings.enabled && (
        <div className="mx-4 mt-3 rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-bold text-sky-900 dark:text-sky-200 block">Terminal Mercado Pago Point</span>
            <span className="text-[11px] text-sky-700 dark:text-sky-300">
              {mercadoPagoIntent ? `Estado: ${mercadoPagoIntent.status}` : "Listo para iniciar cobro en terminal"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onStartMercadoPago}
              disabled={isMercadoPagoLoading || !mercadoPagoStatus.can_start_payment}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-50"
            >
              {isMercadoPagoLoading ? "Iniciando..." : "Cobrar en Terminal"}
            </button>
            {mercadoPagoIntent && (
              <>
                <button type="button" onClick={onRefreshMercadoPago} className="px-2 py-1 bg-sky-100 text-sky-800 rounded-lg text-xs font-semibold">Actualizar</button>
                <button type="button" onClick={onCancelMercadoPago} className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cancelar</button>
              </>
            )}
            {mercadoPagoStatus.mode === "mock" && (
              <>
                <button type="button" onClick={onApproveMercadoPago} className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">Aprobar mock</button>
                <button type="button" onClick={onRejectMercadoPago} className="px-2 py-1 bg-rose-100 text-rose-800 rounded-lg text-xs font-bold">Rechazar mock</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2 PANELES SUPERIORES PARA SEGUIMIENTO RÁPIDO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90">
        {/* PANEL 1: TOTAL A PAGAR */}
        <div className="flex items-center justify-between rounded-xl bg-white dark:bg-slate-950 p-4 border border-slate-300 dark:border-slate-700 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total a Pagar
              </span>
              <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
                ARS
              </span>
              {roundingAdjustment !== 0 && (
                <span
                  className="rounded bg-blue-100 dark:bg-blue-950/80 px-1.5 py-0.2 font-mono text-[9px] font-bold text-blue-800 dark:text-blue-300"
                  title={`Subtotal original: ${currency.format(rawCheckoutTotal ?? (checkoutTotal - roundingAdjustment))}`}
                >
                  Redondeo {roundingAdjustment > 0 ? `+${currency.format(roundingAdjustment)}` : currency.format(roundingAdjustment)}
                </span>
              )}
            </div>
            <span className="block mt-1 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
              {currency.format(checkoutTotal)}
            </span>
          </div>

          <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <Receipt size={20} />
          </div>
        </div>

        {/* PANEL 2: TOTAL PENDIENTE / RESTA CUBRIR */}
        <div
          className={`flex items-center justify-between rounded-xl p-4 border shadow-xs transition ${
            isFullyAssigned
              ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200"
              : isOverpaid
              ? "bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200"
              : "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200"
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider">
                {isFullyAssigned
                  ? "Cobro Cubierto al 100%"
                  : isOverpaid
                  ? "Monto Excedido"
                  : "Total Pendiente (Resta Cubrir)"}
              </span>
              {isFullyAssigned && <Check size={14} className="stroke-[3] text-emerald-600" />}
            </div>
            <span className="block mt-1 text-2xl sm:text-3xl font-black tracking-tight font-mono">
              {currency.format(totalPending)}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-bold block">
              Asignado: {currency.format(totalAssigned)}
            </span>
            <span className="text-[10px] opacity-80 font-mono">
              {isFullyAssigned
                ? "Listo para cerrar ↵"
                : `Faltan ${currency.format(totalPending)}`}
            </span>
          </div>
        </div>
      </div>

      {/* LISTA DE MEDIOS DE PAGO EN MODO ÁGIL */}
      <div className="p-4 flex-1 overflow-y-auto max-h-[50vh] space-y-2">
        <div className="flex items-center justify-between text-xs px-1 text-slate-500 dark:text-slate-400 font-semibold mb-1">
          <span>Medio de Pago / Cuenta</span>
          <span className="font-mono">Importe Asignado ($)</span>
        </div>

        {paymentOptions.map((option, idx) => {
          const isHighlighted = idx === highlightedIndex;
          const assignedVal = allocatedAmounts[option.id] || 0;
          const hasAmount = assignedVal > 0;
          const Icon = getMethodIcon(option.code);

          return (
            <div
              key={option.id}
              onClick={() => {
                setHighlightedIndex(idx);
                onPaymentMethodChange(option.paymentMethodId);
              }}
              className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition cursor-pointer ${
                isHighlighted
                  ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40 ring-2 ring-indigo-500/40"
                  : hasAmount
                  ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/20"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 hover:border-slate-400 dark:hover:border-slate-600"
              }`}
            >
              {/* Lado izquierdo: Icono, Nombre y Subtítulo */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
                    hasAmount
                      ? "bg-emerald-600 text-white"
                      : isHighlighted
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <Icon size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {option.name}
                    </span>
                    {option.isBankTransfer && (
                      <span className="rounded bg-sky-100 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 px-1.5 py-0.2 text-[9px] font-bold text-sky-800 dark:text-sky-300">
                        BANCO
                      </span>
                    )}
                    {hasAmount && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {option.subtitle}
                  </p>
                </div>
              </div>

              {/* Lado derecho: Casillas de importe y acciones */}
              <div
                className="flex items-center gap-2 self-end sm:self-center shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Si es cuenta corriente: Mostrar casilla de selección de cliente */}
                {option.isCurrentAccount && (
                  <div className="flex items-center gap-1.5">
                    {selectedCustomer ? (
                      <button
                        type="button"
                        onClick={() => setIsCustomerModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                        title="Cambiar cliente asociado"
                      >
                        <UserCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="max-w-[130px] truncate">{selectedCustomer.full_name}</span>
                        {currentAccountSnapshot?.available != null && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                            (${Math.round(currentAccountSnapshot.available / 1000)}k)
                          </span>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsCustomerModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 transition animate-pulse"
                      >
                        <UserPlus size={13} />
                        Elegir Cliente (Enter)
                      </button>
                    )}
                  </div>
                )}

                {/* Casilla de Importe */}
                <div className="relative w-36">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amountInputs[option.id] ?? ""}
                    onChange={(e) => updateOptionAmount(option.id, e.target.value)}
                    onFocus={() => {
                      setHighlightedIndex(idx);
                      onPaymentMethodChange(option.paymentMethodId);
                    }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    className={`w-full rounded-lg border py-1.5 pl-6 pr-2 text-right font-mono text-sm font-bold outline-none transition ${
                      hasAmount
                        ? "border-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white ring-1 ring-emerald-500/30"
                        : "border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500"
                    }`}
                  />
                </div>

                {/* Botón rápido para asignar lo que resta */}
                {totalPending > 0 && assignedVal < checkoutTotal && (
                  <button
                    type="button"
                    onClick={() => assignPendingToOption(option.id)}
                    className="rounded-lg bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 p-1.5 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold transition"
                    title="Asignar el total pendiente restante a este método"
                  >
                    + Restante
                  </button>
                )}

                {hasAmount && (
                  <button
                    type="button"
                    onClick={() => updateOptionAmount(option.id, "")}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                    title="Limpiar monto"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* SECCIÓN FACTURA ELECTRÓNICA & CLIENTE GENERAL */}
      <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-3 bg-slate-50/60 dark:bg-slate-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        {/* Cliente actual de la venta */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600 dark:text-slate-300">Cliente venta:</span>
          {selectedCustomer ? (
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 dark:text-white">
                {selectedCustomer.full_name}
              </span>
              <span className="rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 text-[10px] font-mono text-slate-700 dark:text-slate-300">
                {formatCustomerDocument(selectedCustomer.document_type, selectedCustomer.document_number)}
              </span>
              <button
                type="button"
                onClick={() => onCustomerChange("")}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1"
                title="Quitar cliente (Consumidor Final)"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              Consumidor Final (Venta mostrador)
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsCustomerModalOpen(true)}
            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline ml-2"
          >
            {selectedCustomer ? "Cambiar" : "Asignar"}
          </button>
        </div>

        {/* Factura AFIP switch */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <FileText size={15} className="text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-slate-800 dark:text-slate-200">Factura AFIP:</span>
          </div>
          <label className="pos-switch relative inline-flex shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={issueInvoice}
              onChange={(e) => setIssueInvoice(e.target.checked)}
              className="peer sr-only"
              disabled={disabled || !canWrite || !isOnline}
            />
            <span className="pos-switch-track">
              <span className="pos-switch-thumb" />
            </span>
          </label>
        </div>
      </div>

      {submitError && (
        <div className="mx-5 mb-2 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 p-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
          <AlertCircle size={15} className="shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* FOOTER: Atajos de teclado y botón Confirmar Venta */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1">
            <kbd className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 font-mono font-bold">
              ↓ ↑
            </kbd>
            <span>Mover</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 font-mono font-bold">
              Enter
            </kbd>
            <span>Asignar / Cerrar</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 font-mono font-bold">
              Esc
            </kbd>
            <span>Volver</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleFinalSubmit()}
          disabled={disabled || !canWrite || !isFullyAssigned}
          className="w-full sm:w-auto min-w-[280px] inline-flex items-center justify-between gap-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-5 shadow-lg shadow-emerald-600/20 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
              <Check size={13} className="stroke-[3]" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider">
              {isFullyAssigned ? "Confirmar Venta" : "Asignar Monto Total"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-black">
              {currency.format(checkoutTotal)}
            </span>
            <kbd className="hidden sm:inline-block rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-white/90">
              Enter ↵
            </kbd>
          </div>
        </button>
      </div>

      {/* Modal Ágil de Búsqueda y Selección de Cliente */}
      <PosCustomerSelectModal
        isOpen={isCustomerModalOpen}
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelect={(cust) => {
          onCustomerChange(cust.id);
          setIsCustomerModalOpen(false);
        }}
        onOpenCreateCustomer={() => {
          setIsCustomerModalOpen(false);
          onOpenCustomerModal(null);
        }}
      />
    </section>
  );
};
