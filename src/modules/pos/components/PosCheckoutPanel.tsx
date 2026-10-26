import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Check,
  Copy,
  CreditCard,
  Edit2,
  FileText,
  Landmark,
  Loader2,
  QrCode,
  Receipt,
  UserCheck,
  Users,
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
  Employee,
  InstallmentPlan,
  MercadoPagoSettings,
  OriginBank,
  PaymentMethod,
  PaymentMethodInvoiceRules,
} from "@/types/entities";
import { formatCustomerDocument } from "@/modules/configuracion/hooks/useEntityRequirements";
import { normalizePaymentMethodCode } from "@/services/payment-methods.service";
import type { PosCheckoutSummary } from "@/modules/pos/hooks/usePosSale";
import type {
  PosCheckoutValues,
  PosPaymentSplitItem,
} from "@/modules/pos/schemas/pos-checkout.schema";
import { PosCustomerSelectModal } from "./PosCustomerSelectModal";
import { cn } from "@/utils/cn";
import { useUiStore } from "@/store/ui.store";

interface PosCheckoutPanelProps {
  panelId?: string;
  formId?: string;
  layout?: "panel" | "modal";
  customers: Customer[];
  employees?: Employee[];
  paymentMethods: PaymentMethod[];
  bankAccounts: BankAccount[];
  originBanks: OriginBank[];
  installmentPlans: InstallmentPlan[];
  selectedCustomerId: string;
  selectedEmployeeId?: string | null;
  selectedPaymentMethodId: string;
  defaultPaymentMethodId?: string;
  isOnline: boolean;
  checkoutTotal: number;
  rawCheckoutTotal?: number;
  roundingAdjustment?: number;
  getCheckoutSummary?: (paymentMethodId: string | null | undefined) => PosCheckoutSummary;
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
  hasOwedReturnables?: boolean;
  owedReturnablesCount?: number;
  disabled?: boolean;
  onCustomerChange: (customerId: string) => void;
  onSelectEmployee?: (employee: Employee | null) => void;
  employeeDiscountPercent?: number;
  onPaymentMethodChange: (paymentMethodId: string) => void;
  onCreateOriginBank: (name: string) => Promise<OriginBank | null>;
  onOpenCustomerModal: (customer: Customer | null, defaultTab?: "personal" | "fiscal" | "account") => void;
  onStartMercadoPago: () => void;
  onRefreshMercadoPago: () => void;
  onApproveMercadoPago: () => void;
  onRejectMercadoPago: () => void;
  onCancelMercadoPago: () => void;
  onClose?: () => void;
  onSubmit: (values: PosCheckoutValues) => Promise<void>;
  arcaEnabled?: boolean;
  arcaMode?: string;
  defaultDocumentType?: string;
  paymentMethodInvoiceRules?: PaymentMethodInvoiceRules | null;
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
  layout = "modal",
  customers,
  employees = [],
  paymentMethods,
  bankAccounts,
  selectedCustomerId,
  selectedEmployeeId,
  selectedPaymentMethodId,
  defaultPaymentMethodId,
  isOnline,
  checkoutTotal,
  rawCheckoutTotal,
  roundingAdjustment = 0,
  getCheckoutSummary,
  mercadoPagoIntent: _mercadoPagoIntent,
  mercadoPagoSettings: _mercadoPagoSettings,
  mercadoPagoStatus: _mercadoPagoStatus,
  isMercadoPagoLoading: _isMercadoPagoLoading,
  canWrite,
  currentAccountSnapshot,
  hasDebtPaymentInCart: _hasDebtPaymentInCart = false,
  hasOwedReturnables = false,
  owedReturnablesCount = 0,
  disabled,
  onCustomerChange,
  onSelectEmployee,
  employeeDiscountPercent = 10,
  onPaymentMethodChange,
  onOpenCustomerModal,
  onStartMercadoPago: _onStartMercadoPago,
  onRefreshMercadoPago: _onRefreshMercadoPago,
  onApproveMercadoPago: _onApproveMercadoPago,
  onRejectMercadoPago: _onRejectMercadoPago,
  onCancelMercadoPago: _onCancelMercadoPago,
  onClose,
  onSubmit,
  arcaEnabled,
  arcaMode,
  defaultDocumentType,
  paymentMethodInvoiceRules,
}: PosCheckoutPanelProps) => {
  const [issueInvoice, setIssueInvoice] = useState(false);

  // Evalúa si una opción de pago exige emisión fiscal obligatoria
  const isOptionInvoiceMandatory = useCallback((option: PosPaymentOption): boolean => {
    if (!paymentMethodInvoiceRules?.mandatory_methods?.length) return false;
    const list = paymentMethodInvoiceRules.mandatory_methods;
    if (option.bankAccountId && list.includes(`bank_account:${option.bankAccountId}`)) return true;
    if (option.code && list.includes(option.code)) return true;
    return false;
  }, [paymentMethodInvoiceRules]);

  // Evalúa si una opción de pago tiene la facturación deshabilitada completamente
  const isOptionInvoiceDisabled = useCallback((option: PosPaymentOption): boolean => {
    if (!paymentMethodInvoiceRules?.disabled_methods?.length) return false;
    const list = paymentMethodInvoiceRules.disabled_methods;
    if (option.bankAccountId && list.includes(`bank_account:${option.bankAccountId}`)) return true;
    if (option.code && list.includes(option.code)) return true;
    return false;
  }, [paymentMethodInvoiceRules]);

  const [notes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isSubmittingLocalRef = useRef(false);
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);

  // Modal para selección ágil de cliente
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const hasPromptedCustomerForReturnablesRef = useRef(false);

  useEffect(() => {
    if (layout === "modal" && hasOwedReturnables && !selectedCustomerId && !hasPromptedCustomerForReturnablesRef.current) {
      hasPromptedCustomerForReturnablesRef.current = true;
      setIsCustomerModalOpen(true);
    }
  }, [layout, hasOwedReturnables, selectedCustomerId]);

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

    // 5. Cheque
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
      const isEmp = Boolean(selectedEmployeeId);
      const emp = isEmp ? employees.find((e) => e.id === selectedEmployeeId) : null;
      options.push({
        id: `method-${ccMethod.id}`,
        paymentMethodId: ccMethod.id,
        code: "current_account",
        name: emp ? "Cuenta Corriente Empleado" : ccMethod.name || "Cuenta Corriente",
        subtitle: emp
          ? `A crédito de empleado (${emp.full_name})`
          : "A crédito / saldo fiado al cliente",
        isCurrentAccount: true,
      });
    }

    return options;
  }, [paymentMethods, posBankAccounts, selectedEmployeeId, employees]);

  // Montos asignados a cada opción de pago { [optionId]: number }
  const [allocatedAmounts, setAllocatedAmounts] = useState<Record<string, number>>({});
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  // Métodos de pago con monto confirmado/establecido { [optionId]: boolean }
  const [lockedMethodIds, setLockedMethodIds] = useState<Record<string, boolean>>({});
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isReadyToSubmit, setIsReadyToSubmit] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const blockFinalSubmitUntilRef = useRef<number>(0);

  const posCashChangeEnabled = useUiStore((state) => state.posCashChangeEnabled);
  const [cashGivenAmount, setCashGivenAmount] = useState<string>("");
  const cashGivenInputRef = useRef<HTMLInputElement | null>(null);

  // Política fiscal activa calculada a partir de los métodos con importe asignado o del método seleccionado
  const activeInvoiceRule = useMemo<{
    status: "mandatory" | "disabled" | "normal";
    reason?: string;
  }>(() => {
    if (!paymentMethodInvoiceRules) return { status: "normal" };

    const allocatedOptions = paymentOptions.filter(
      (opt) => (allocatedAmounts[opt.id] || 0) > 0
    );

    const targetOptions =
      allocatedOptions.length > 0
        ? allocatedOptions
        : paymentOptions[highlightedIndex]
        ? [paymentOptions[highlightedIndex]]
        : [];

    if (targetOptions.length === 0) return { status: "normal" };

    // 1. Si alguna de las opciones activas es OBLIGATORIA
    const mandatoryMatch = targetOptions.find((opt) => isOptionInvoiceMandatory(opt));
    if (mandatoryMatch) {
      return {
        status: "mandatory",
        reason: `Facturación obligatoria para ${mandatoryMatch.name}`,
      };
    }

    // 2. Si TODAS las opciones activas están DESHABILITADAS
    const allDisabled =
      targetOptions.length > 0 &&
      targetOptions.every((opt) => isOptionInvoiceDisabled(opt));
    if (allDisabled) {
      return {
        status: "disabled",
        reason: `Facturación deshabilitada para ${targetOptions.map((o) => o.name).join(", ")}`,
      };
    }

    return { status: "normal" };
  }, [paymentMethodInvoiceRules, paymentOptions, allocatedAmounts, highlightedIndex, isOptionInvoiceMandatory, isOptionInvoiceDisabled]);

  // Activa o desactiva automáticamente el switch de facturación fiscal según la regla del medio de pago
  useEffect(() => {
    if (activeInvoiceRule.status === "mandatory") {
      setIssueInvoice(true);
    } else if (activeInvoiceRule.status === "disabled") {
      setIssueInvoice(false);
    }
  }, [activeInvoiceRule.status]);

  // Inicializar con el medio de pago predeterminado o efectivo
  const isInitializedRef = useRef(false);
  const initialOptionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (paymentOptions.length === 0) return;

    if (!isInitializedRef.current) {
      isInitializedRef.current = true;

      const isRefund = checkoutTotal < 0;
      const cashIndex = paymentOptions.findIndex(
        (opt) => normalizePaymentMethodCode(opt.code) === "cash"
      );
      // Buscar si coincide con defaultPaymentMethodId o selectedPaymentMethodId
      const targetMethodId = defaultPaymentMethodId || selectedPaymentMethodId;
      const targetIndex = paymentOptions.findIndex(
        (opt) => opt.paymentMethodId === targetMethodId
      );
      const chosenIndex = isRefund && cashIndex >= 0
        ? cashIndex
        : targetIndex >= 0
        ? targetIndex
        : 0;
      const initialOption = paymentOptions[chosenIndex];
      initialOptionIdRef.current = initialOption.id;

      setHighlightedIndex(chosenIndex);
      setIsReadyToSubmit(false);
      const initialTotal = getCheckoutSummary
        ? getCheckoutSummary(initialOption.paymentMethodId).total
        : checkoutTotal;
      setAllocatedAmounts({
        [initialOption.id]: initialTotal,
      });
      setAmountInputs({
        [initialOption.id]: initialTotal.toFixed(2),
      });

      onPaymentMethodChange(initialOption.paymentMethodId);
    }
  }, [
    checkoutTotal,
    defaultPaymentMethodId,
    getCheckoutSummary,
    onPaymentMethodChange,
    paymentOptions,
    selectedPaymentMethodId,
  ]);

  // Cálculos de asignación total y pendiente
  const totalAssigned = useMemo(() => {
    const sum = Object.values(allocatedAmounts).reduce((acc, val) => acc + (val || 0), 0);
    return Number(sum.toFixed(2));
  }, [allocatedAmounts]);

  const isRefundMode = checkoutTotal < 0;

  const totalPending = useMemo(() => {
    if (isRefundMode) return 0;
    const diff = Number((checkoutTotal - totalAssigned).toFixed(2));
    return Math.max(0, diff);
  }, [checkoutTotal, isRefundMode, totalAssigned]);

  const isFullyAssigned = isRefundMode
    ? Math.abs(totalAssigned - checkoutTotal) <= 0.01 || Math.abs(Math.abs(totalAssigned) - Math.abs(checkoutTotal)) <= 0.01
    : Math.abs(totalAssigned - checkoutTotal) <= 0.01 && totalAssigned > 0;
  const isOverpaid = !isRefundMode && totalAssigned > checkoutTotal + 0.01;

  // Opción de Efectivo y cálculo de vuelto en tiempo real
  const cashOption = useMemo(
    () => paymentOptions.find((opt) => normalizePaymentMethodCode(opt.code) === "cash"),
    [paymentOptions]
  );
  const cashAllocated = cashOption ? (allocatedAmounts[cashOption.id] || 0) : 0;
  const isCashUsed = cashAllocated > 0;

  const effectiveCashGiven = useMemo(() => {
    if (!cashGivenAmount || cashGivenAmount.trim() === "") {
      return cashAllocated;
    }
    const clean = cashGivenAmount.replace(",", ".");
    const num = parseFloat(clean);
    return isNaN(num) ? cashAllocated : num;
  }, [cashAllocated, cashGivenAmount]);

  const cashChange = useMemo(() => {
    if (!isCashUsed || effectiveCashGiven <= cashAllocated) return 0;
    return Number((effectiveCashGiven - cashAllocated).toFixed(2));
  }, [effectiveCashGiven, isCashUsed, cashAllocated]);

  // Cliente seleccionado actual
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  // Empleado seleccionado actual
  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId]
  );

  const isCurrentAccountUsed = useMemo(() => {
    const ccOption = paymentOptions.find((opt) => opt.isCurrentAccount);
    if (!ccOption) return false;
    return (allocatedAmounts[ccOption.id] || 0) > 0;
  }, [allocatedAmounts, paymentOptions]);

  // Actualizar el monto de un método cuando el usuario escribe
  const updateOptionAmount = useCallback(
    (optionId: string, rawValue: string) => {
      setSubmitError(null);
      setIsReadyToSubmit(false);

      // Si el usuario edita el monto, se desmarca como establecido hasta presionar Enter
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
    },
    []
  );

  // Limpiar el monto asignado a un método
  const clearOptionAmount = useCallback((optionId: string) => {
    setSubmitError(null);
    setIsReadyToSubmit(false);
    setLockedMethodIds((prev) => {
      const next = { ...prev };
      delete next[optionId];
      return next;
    });
    setAmountInputs((prev) => {
      const next = { ...prev };
      delete next[optionId];
      return next;
    });
    setAllocatedAmounts((prev) => {
      const next = { ...prev };
      delete next[optionId];
      return next;
    });
  }, []);

  // Confirmar y fijar el monto asignado a un método (pasa a verde)
  const confirmOptionAmount = useCallback(
    (optionId: string) => {
      setSubmitError(null);
      const targetOption = paymentOptions.find((o) => o.id === optionId);
      if (!targetOption) return;

      if (targetOption.isCurrentAccount && !selectedCustomer && !selectedEmployee) {
        setIsCustomerModalOpen(true);
        return;
      }

      const inputVal = amountInputs[optionId] ?? "";
      const clean = String(inputVal).replace(",", ".");
      const numeric = parseFloat(clean);
      const currentMethodVal =
        !isNaN(numeric) && numeric > 0
          ? Number(numeric.toFixed(2))
          : allocatedAmounts[optionId] || 0;

      let nextAllocated: Record<string, number> = {};

      if (currentMethodVal > 0) {
        setLockedMethodIds((prev) => ({
          ...prev,
          [optionId]: true,
        }));
        nextAllocated = {
          ...allocatedAmounts,
          [optionId]: currentMethodVal,
        };
        setAllocatedAmounts(nextAllocated);
        setAmountInputs((prev) => ({
          ...prev,
          [optionId]: currentMethodVal.toFixed(2),
        }));
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

      const sum = Object.values(nextAllocated).reduce((acc, val) => acc + (val || 0), 0);
      const pending = Number(Math.max(0, checkoutTotal - sum).toFixed(2));

      blockFinalSubmitUntilRef.current = Date.now() + 400;

      if (pending === 0 && Math.abs(sum - checkoutTotal) <= 0.01 && sum > 0) {
        window.setTimeout(() => {
          setIsReadyToSubmit(true);
        }, 60);
      } else {
        setIsReadyToSubmit(false);
      }

      if (posCashChangeEnabled && normalizePaymentMethodCode(targetOption.code) === "cash") {
        window.setTimeout(() => {
          if (cashGivenInputRef.current) {
            cashGivenInputRef.current.focus();
            cashGivenInputRef.current.select();
          }
        }, 30);
      }

      const inputEl = inputRefs.current[optionId];
      if (inputEl) {
        inputEl.blur();
      }
      panelRef.current?.focus();
    },
    [allocatedAmounts, amountInputs, checkoutTotal, paymentOptions, selectedCustomer]
  );

  // Desplazar el resto pendiente dinámicamente al método objetivo (calculando recargos/intereses del método)
  const shiftRemainderToOption = useCallback(
    (targetOption: PosPaymentOption, explicitTotal?: number) => {
      const effectiveTotal =
        typeof explicitTotal === "number"
          ? explicitTotal
          : getCheckoutSummary
          ? getCheckoutSummary(targetOption.paymentMethodId).total
          : checkoutTotal;

      if (lockedMethodIds[targetOption.id]) {
        // Si el método ya está establecido, limpiamos los flotantes no bloqueados
        setAllocatedAmounts((prev) => {
          const next: Record<string, number> = {};
          for (const [id, val] of Object.entries(prev)) {
            if (lockedMethodIds[id]) {
              next[id] = val;
            }
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
          return next;
        });
        return;
      }

      // Calcular la suma de lo que ya está establecido
      const lockedSum = Object.entries(allocatedAmounts).reduce((acc, [id, val]) => {
        if (lockedMethodIds[id] && id !== targetOption.id) {
          return acc + (val || 0);
        }
        return acc;
      }, 0);
      const remainder = Number(Math.max(0, effectiveTotal - lockedSum).toFixed(2));

      setAllocatedAmounts((prev) => {
        const next: Record<string, number> = {};
        for (const [id, val] of Object.entries(prev)) {
          if (lockedMethodIds[id] && id !== targetOption.id) {
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
          if (lockedMethodIds[id] && id !== targetOption.id) {
            next[id] = val;
          }
        }
        if (remainder > 0) {
          next[targetOption.id] = remainder.toFixed(2);
        }
        return next;
      });
    },
    [allocatedAmounts, checkoutTotal, getCheckoutSummary, lockedMethodIds]
  );

  // Sincronizar el monto asignado dinámico cuando cambia checkoutTotal (por recargos, intereses o descuentos de medios de pago)
  const prevCheckoutTotalRef = useRef(checkoutTotal);
  useEffect(() => {
    if (prevCheckoutTotalRef.current === checkoutTotal) return;
    prevCheckoutTotalRef.current = checkoutTotal;

    const activeOption = paymentOptions[highlightedIndex];
    if (!activeOption || lockedMethodIds[activeOption.id]) return;

    setAllocatedAmounts((prev) => {
      const lockedSum = Object.entries(prev).reduce((acc, [id, val]) => {
        if (lockedMethodIds[id] && id !== activeOption.id) {
          return acc + (val || 0);
        }
        return acc;
      }, 0);
      const remainder = Number(Math.max(0, checkoutTotal - lockedSum).toFixed(2));

      const next: Record<string, number> = {};
      for (const [id, val] of Object.entries(prev)) {
        if (lockedMethodIds[id] && id !== activeOption.id) {
          next[id] = val;
        }
      }
      if (remainder > 0) {
        next[activeOption.id] = remainder;
      }
      return next;
    });

    setAmountInputs((prev) => {
      const lockedSum = Object.entries(allocatedAmounts).reduce((acc, [id, val]) => {
        if (lockedMethodIds[id] && id !== activeOption.id) {
          return acc + (val || 0);
        }
        return acc;
      }, 0);
      const remainder = Number(Math.max(0, checkoutTotal - lockedSum).toFixed(2));

      const next: Record<string, string> = {};
      for (const [id, val] of Object.entries(prev)) {
        if (lockedMethodIds[id] && id !== activeOption.id) {
          next[id] = val;
        }
      }
      if (remainder > 0) {
        next[activeOption.id] = remainder.toFixed(2);
      }
      return next;
    });
  }, [checkoutTotal, highlightedIndex, lockedMethodIds, paymentOptions, allocatedAmounts]);

  // Manejo de envío final de la venta
  const handleFinalSubmit = useCallback(async () => {
    if (disabled || isSubmittingLocalRef.current) return;
    isSubmittingLocalRef.current = true;
    setIsSubmittingLocal(true);
    setSubmitError(null);

    try {
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

      // Validar si hay envases adeudados que requieren asignación obligatoria de cliente
      if (isRefundMode) {
        const cashOption =
          paymentOptions.find((opt) => normalizePaymentMethodCode(opt.code) === "cash") ||
          paymentOptions[0];
        const payload: PosCheckoutValues = {
          customerId: selectedCustomerId || undefined,
          employeeId: selectedEmployeeId || undefined,
          paymentMethodId: cashOption.paymentMethodId,
          issueInvoice: false,
          notes: notes.trim(),
          isSplitPayment: false,
          payments: undefined,
          paymentDetails: null,
        };
        await onSubmit(payload);
        return;
      }

      if (hasOwedReturnables && !selectedCustomer) {
        setSubmitError(
          `Hay ${owedReturnablesCount > 1 ? `${owedReturnablesCount} envases` : "un envase"} para anotar. Debes seleccionar al cliente para registrar la deuda de envases antes de finalizar la venta.`
        );
        setIsCustomerModalOpen(true);
        return;
      }

      // Validar si cuenta corriente está usada y requiere cliente o empleado
      if (isCurrentAccountUsed && !selectedCustomer && !selectedEmployee) {
        setSubmitError("Debes seleccionar un cliente o empleado para cobrar con cuenta corriente.");
        setIsCustomerModalOpen(true);
        return;
      }

      if (isCurrentAccountUsed && selectedCustomer && !currentAccountSnapshot?.enabled) {
        setSubmitError(
          `La cuenta corriente no está habilitada para ${selectedCustomer.full_name}. Habilitala desde "Habilitar Cta. Cte." para poder confirmar la venta.`
        );
        return;
      }

      if (isCurrentAccountUsed && selectedEmployee && !selectedEmployee.current_account_enabled) {
        setSubmitError(
          `La cuenta corriente no está habilitada para el empleado ${selectedEmployee.full_name}.`
        );
        return;
      }

      if (isCurrentAccountUsed && selectedEmployee && selectedEmployee.current_account_limit != null && selectedEmployee.current_account_limit > 0) {
        const ccOption = paymentOptions.find((opt) => opt.isCurrentAccount);
        const debtPart = ccOption ? (allocatedAmounts[ccOption.id] || 0) : totalAssigned;
        const projected = (selectedEmployee.current_balance ?? 0) + debtPart;
        if (projected > selectedEmployee.current_account_limit) {
          const proceed = window.confirm(
            `Atención: El importe supera el límite de cuenta corriente del empleado (${currency.format(
              selectedEmployee.current_account_limit
            )}). Saldo proyectado: ${currency.format(projected)}. ¿Deseás confirmar igualmente?`
          );
          if (!proceed) return;
        }
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
        employeeId: selectedEmployeeId || undefined,
        paymentMethodId: primaryOption.paymentMethodId,
        issueInvoice,
        notes: notes.trim(),
        isSplitPayment: isSplit,
        payments: isSplit ? splitPaymentsList : undefined,
        paymentDetails: isSplit ? null : primaryDetails,
      };

      await onSubmit(payload);
    } finally {
      isSubmittingLocalRef.current = false;
      setIsSubmittingLocal(false);
    }
  }, [
    allocatedAmounts,
    canWrite,
    checkoutTotal,
    currentAccountSnapshot,
    disabled,
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

  const [copiedField, setCopiedField] = useState<"total" | "pending" | "change" | null>(null);

  const handleCopyAmount = useCallback((amount: number, field: "total" | "pending" | "change") => {
    const text = amount.toFixed(2);
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 1500);
  }, []);

  const panelRef = useRef<HTMLElement | null>(null);

  // Autofocus del panel al montarse para capturar teclas inmediatamente
  useEffect(() => {
    blockFinalSubmitUntilRef.current = Date.now() + 500;
    panelRef.current?.focus();
    const timer = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, []);

  // Seleccionar un método de pago y asignar el resto si se hace clic
  const selectOption = useCallback(
    (targetIndex: number) => {
      if (paymentOptions.length === 0) return;
      const clampedIndex = (targetIndex + paymentOptions.length) % paymentOptions.length;
      const targetOption = paymentOptions[clampedIndex];
      if (!targetOption) return;

      setHighlightedIndex(clampedIndex);
      onPaymentMethodChange(targetOption.paymentMethodId);
      setIsReadyToSubmit(false);
      blockFinalSubmitUntilRef.current = Date.now() + 400;

      const targetTotal = getCheckoutSummary
        ? getCheckoutSummary(targetOption.paymentMethodId).total
        : checkoutTotal;

      shiftRemainderToOption(targetOption, targetTotal);

      window.setTimeout(() => {
        const el = inputRefs.current[targetOption.id];
        if (el) {
          el.focus();
          el.select();
        }
      }, 20);
    },
    [checkoutTotal, getCheckoutSummary, onPaymentMethodChange, paymentOptions, shiftRemainderToOption]
  );

  // Listener global de teclado para navegación ágil y flujo de Enter en 3 pasos
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Prevenir repetición por tecla mantenida apretada
      if (e.repeat) {
        e.preventDefault();
        return;
      }

      // Si el modal está enviando o deshabilitado, bloquear acciones
      if (disabled || isSubmittingLocalRef.current) {
        if (e.key === "Enter" || e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      // Si el modal de búsqueda de clientes está abierto
      if (isCustomerModalOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setIsCustomerModalOpen(false);
        }
        return;
      }

      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const activeInputEl = targetTag === "input" ? (e.target as HTMLInputElement) : null;
      const isEditingCashGiven = activeInputEl === cashGivenInputRef.current;
      const isEditingAmount = Boolean(activeInputEl && activeInputEl.type === "number" && !isEditingCashGiven);

      // Flecha abajo: navega al siguiente método desplazando el monto pendiente dinámicamente
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (isEditingAmount) {
          activeInputEl?.blur();
        }
        setIsReadyToSubmit(false);
        if (paymentOptions.length === 0) return;
        const nextIndex = (highlightedIndex + 1) % paymentOptions.length;
        const nextOption = paymentOptions[nextIndex];
        setHighlightedIndex(nextIndex);
        if (nextOption) {
          onPaymentMethodChange(nextOption.paymentMethodId);
          const nextTotal = getCheckoutSummary
            ? getCheckoutSummary(nextOption.paymentMethodId).total
            : checkoutTotal;
          shiftRemainderToOption(nextOption, nextTotal);
        }
        return;
      }

      // Flecha arriba: navega al método anterior desplazando el monto pendiente dinámicamente
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (isEditingAmount) {
          activeInputEl?.blur();
        }
        setIsReadyToSubmit(false);
        if (paymentOptions.length === 0) return;
        const nextIndex = (highlightedIndex - 1 + paymentOptions.length) % paymentOptions.length;
        const nextOption = paymentOptions[nextIndex];
        setHighlightedIndex(nextIndex);
        if (nextOption) {
          onPaymentMethodChange(nextOption.paymentMethodId);
          const nextTotal = getCheckoutSummary
            ? getCheckoutSummary(nextOption.paymentMethodId).total
            : checkoutTotal;
          shiftRemainderToOption(nextOption, nextTotal);
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const activeOption = paymentOptions[highlightedIndex];
        if (!activeOption) return;

        // Si es cuenta corriente y falta cliente o empleado, abrir selector
        if (activeOption.isCurrentAccount && !selectedCustomer && !selectedEmployee) {
          setIsCustomerModalOpen(true);
          return;
        }

        // Si el foco está en el campo 'Paga con' de efectivo
        if (isEditingCashGiven) {
          if (Date.now() < blockFinalSubmitUntilRef.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (isFullyAssigned) {
            e.stopPropagation();
            void handleFinalSubmit();
            return;
          }
        }

        // PASO 2: El cursor está actualmente dentro de la casilla de monto (editando/confirmando el importe)
        if (isEditingAmount) {
          e.preventDefault();
          e.stopPropagation();
          activeInputEl?.blur();
          confirmOptionAmount(activeOption.id);
          return;
        }

        // PASO 3: Ya se confirmó el monto (isReadyToSubmit) y el total está 100% asignado
        if (isReadyToSubmit && isFullyAssigned) {
          if (Date.now() < blockFinalSubmitUntilRef.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          void handleFinalSubmit();
          return;
        }

        // PASO 1: El usuario seleccionó el método con Enter desde la lista de métodos
        onPaymentMethodChange(activeOption.paymentMethodId);

        // Si no está bloqueado, asegurarse de asignar el restante disponible
        if (!lockedMethodIds[activeOption.id]) {
          const optTotal = getCheckoutSummary
            ? getCheckoutSummary(activeOption.paymentMethodId).total
            : checkoutTotal;
          shiftRemainderToOption(activeOption, optTotal);
        }

        setIsReadyToSubmit(false);
        blockFinalSubmitUntilRef.current = Date.now() + 400;

        // Pone el cursor en el monto con el texto seleccionado por si hay que editarlo
        window.setTimeout(() => {
          const el = inputRefs.current[activeOption.id];
          if (el) {
            el.focus();
            el.select();
          }
        }, 20);
        return;
      }

      // Escape: Volver un paso atrás si hay pasos previos; si no hay paso atrás, cerrar la ventana
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // 1. Si el foco está dentro de un input (editando monto o texto), desenfocarlo y volver a la navegación
        if (isEditingAmount || activeInputEl) {
          activeInputEl?.blur();
          panelRef.current?.focus();
          return;
        }

        // 2. Si estaba en estado "listo para confirmar venta" (botón verde con pulsación), cancelar estado de confirmación
        if (isReadyToSubmit) {
          setIsReadyToSubmit(false);
          const currentOption = paymentOptions[highlightedIndex];
          if (currentOption && lockedMethodIds[currentOption.id]) {
            setLockedMethodIds((prev) => {
              const next = { ...prev };
              delete next[currentOption.id];
              return next;
            });
          }
          return;
        }

        const currentOption = paymentOptions[highlightedIndex];
        const lockedKeys = Object.keys(lockedMethodIds);
        const allocatedKeys = Object.keys(allocatedAmounts);

        // 3. Si el método actual tiene un monto asignado flotante (no confirmado)
        // y hay otros métodos con importe asignado o confirmados, desasignar este método
        if (
          currentOption &&
          !lockedMethodIds[currentOption.id] &&
          (allocatedAmounts[currentOption.id] || 0) > 0 &&
          (lockedKeys.length > 0 || allocatedKeys.length > 1)
        ) {
          clearOptionAmount(currentOption.id);
          return;
        }

        // 4. Si hay métodos confirmados (bloqueados en verde), desbloquear el actual o el último
        if (lockedKeys.length > 0) {
          if (currentOption && lockedMethodIds[currentOption.id]) {
            setLockedMethodIds((prev) => {
              const next = { ...prev };
              delete next[currentOption.id];
              return next;
            });
            setIsReadyToSubmit(false);
            return;
          }
          const lastLockedKey = lockedKeys[lockedKeys.length - 1];
          setLockedMethodIds((prev) => {
            const next = { ...prev };
            delete next[lastLockedKey];
            return next;
          });
          setIsReadyToSubmit(false);
          return;
        }

        // 5. Determinar la opción inicial por defecto (según configuración o Efectivo)
        const targetMethodId = defaultPaymentMethodId || selectedPaymentMethodId;
        const defaultIndex = paymentOptions.findIndex(
          (opt) =>
            opt.id === initialOptionIdRef.current ||
            (targetMethodId && opt.paymentMethodId === targetMethodId)
        );
        const fallbackIndex = defaultIndex >= 0 ? defaultIndex : 0;
        const defaultOption = paymentOptions[fallbackIndex];

        // Comprobar si ya estamos exactamente en el estado inicial limpio
        const isDefaultOptionHighlighted = highlightedIndex === fallbackIndex;
        const isOnlyDefaultAllocated =
          allocatedKeys.length === 1 &&
          defaultOption &&
          allocatedAmounts[defaultOption.id] === checkoutTotal &&
          amountInputs[defaultOption.id] === checkoutTotal.toFixed(2);

        // Si no estamos en el estado inicial limpio (ej: se navegó a otro medio como en la captura,
        // o se cambió el monto del default, o hay mensaje de error), volver al estado inicial por defecto
        if (!isDefaultOptionHighlighted || !isOnlyDefaultAllocated || submitError) {
          setSubmitError(null);
          if (defaultOption) {
            setHighlightedIndex(fallbackIndex);
            onPaymentMethodChange(defaultOption.paymentMethodId);
            setAllocatedAmounts({
              [defaultOption.id]: checkoutTotal,
            });
            setAmountInputs({
              [defaultOption.id]: checkoutTotal.toFixed(2),
            });
            setLockedMethodIds({});
            setIsReadyToSubmit(false);
          }
          return;
        }

        // 6. Si ya no hay ningún paso atrás disponible (estado inicial limpio), cerrar el modal de cobro
        if (onClose) {
          onClose();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown, { capture: true });
    };
  }, [
    allocatedAmounts,
    amountInputs,
    checkoutTotal,
    clearOptionAmount,
    confirmOptionAmount,
    defaultPaymentMethodId,
    getCheckoutSummary,
    handleFinalSubmit,
    highlightedIndex,
    isCustomerModalOpen,
    isFullyAssigned,
    isReadyToSubmit,
    lockedMethodIds,
    onClose,
    onPaymentMethodChange,
    paymentOptions,
    selectedCustomer,
    selectedPaymentMethodId,
    shiftRemainderToOption,
    submitError,
  ]);

  return (
    <section
      ref={panelRef}
      id={formId}
      className="flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-300 dark:border-slate-700 outline-none p-4 sm:p-5 gap-3 max-h-[92vh] overflow-y-auto"
      tabIndex={-1}
    >
      {/* Cabecera minimalista con título y botón cerrar */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {isRefundMode ? "Reintegro al Cliente (Efectivo)" : "Cobro de Venta"}
          </h3>
          <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 font-mono">
            ARS
          </span>
          {roundingAdjustment !== 0 && (
            <span
              className="rounded bg-blue-100 dark:bg-blue-950/80 px-1.5 py-0.5 font-mono text-[9px] font-bold text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              title={`Subtotal original: ${currency.format(rawCheckoutTotal ?? (checkoutTotal - roundingAdjustment))}`}
            >
              Redondeo {roundingAdjustment > 0 ? `+${currency.format(roundingAdjustment)}` : currency.format(roundingAdjustment)}
            </span>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition"
            onClick={onClose}
            title="Cerrar ventana"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* PANELES SUPERIORES (CLIC PARA COPIAR MONTO) */}
      <div className={posCashChangeEnabled ? "grid grid-cols-1 sm:grid-cols-3 gap-2.5" : "grid grid-cols-2 gap-3"}>
        {/* PANEL 1: TOTAL A PAGAR */}
        <div
          onClick={() => handleCopyAmount(checkoutTotal, "total")}
          title="Clic para copiar monto a pagar"
          className="group relative flex flex-col justify-between rounded-xl p-3 border border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer transition active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isRefundMode ? "Monto a Devolver" : "Total a Pagar"}
            </span>
            {copiedField === "total" ? (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                ¡Copiado!
              </span>
            ) : (
              <Copy size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition" />
            )}
          </div>
          <span className="block mt-1 text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
            {currency.format(checkoutTotal)}
          </span>
        </div>

        {/* PANEL 2: TOTAL PENDIENTE / RESTA CUBRIR */}
        <div
          onClick={() => handleCopyAmount(totalPending, "pending")}
          title="Clic para copiar monto pendiente"
          className={`group relative flex flex-col justify-between rounded-xl p-3 border cursor-pointer transition active:scale-[0.99] ${
            isFullyAssigned
              ? "border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
              : isOverpaid
              ? "border-rose-300 dark:border-rose-700/80 bg-rose-50/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200"
              : "border-amber-300 dark:border-amber-700/80 bg-amber-50/50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider">
              {isRefundMode
                ? "Egreso de Caja"
                : isFullyAssigned
                ? "Cubierto al 100%"
                : isOverpaid
                ? "Monto Excedido"
                : "Total Pendiente"}
            </span>
            {copiedField === "pending" ? (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                ¡Copiado!
              </span>
            ) : (
              <Copy size={12} className="opacity-0 group-hover:opacity-100 transition" />
            )}
          </div>
          <span className="block mt-1 text-2xl font-black tracking-tight font-mono">
            {isRefundMode ? currency.format(Math.abs(checkoutTotal)) : currency.format(totalPending)}
          </span>
        </div>

        {/* PANEL 3: VUELTO A ENTREGAR */}
        {posCashChangeEnabled && (
          <div
            onClick={() => handleCopyAmount(cashChange, "change")}
            title="Clic para copiar monto de vuelto"
            className={`group relative flex flex-col justify-between rounded-xl p-3 border cursor-pointer transition active:scale-[0.99] ${
              cashChange > 0
                ? "border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/20 shadow-xs"
                : "border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider">
                {cashChange > 0 ? "💵 Vuelto a Entregar" : "💵 Vuelto"}
              </span>
              {copiedField === "change" ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                  ¡Copiado!
                </span>
              ) : (
                <Copy size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition" />
              )}
            </div>
            <span className="block mt-1 text-2xl font-black tracking-tight font-mono">
              {currency.format(cashChange)}
            </span>
          </div>
        )}
      </div>

      {/* AVISO DESTACADO DE ENVASES ADEUDADOS / PARA ANOTAR */}
      {hasOwedReturnables && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-medium shadow-2xs",
            selectedCustomer
              ? "bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700/80 text-purple-950 dark:text-purple-200"
              : "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">{selectedCustomer ? "📦" : "⚠️"}</span>
            <div className="min-w-0">
              <span className="font-bold">
                {selectedCustomer ? "Envases adeudados:" : "Atención (Envases adeudados):"}
              </span>{" "}
              <span>
                {selectedCustomer
                  ? `Se registrarán ${owedReturnablesCount > 1 ? `${owedReturnablesCount} envases` : "1 envase"} adeudados en la cuenta corriente de ${selectedCustomer.full_name}.`
                  : `Hay ${owedReturnablesCount > 1 ? `${owedReturnablesCount} envases` : "1 envase"} para anotar. Debes seleccionar al cliente antes de finalizar.`}
              </span>
            </div>
          </div>
          {!selectedCustomer ? (
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs transition"
            >
              ¿Quién es el cliente?
            </button>
          ) : null}
        </div>
      )}

      {/* PANEL UNIFICADO DE CLIENTE Y FACTURA AFIP (COMPACTO Y MISMO TAMAÑO ASIGNADO O NO) */}
      <div className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 min-h-[42px]">
        <div className="flex items-center gap-1.5 text-xs min-w-0 flex-1">
          {selectedEmployee ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">Empleado:</span>
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-600 rounded-lg px-2 py-0.5 shadow-2xs min-w-0">
                <span className="font-bold text-indigo-900 dark:text-indigo-100 truncate max-w-[130px] sm:max-w-[170px]" title={selectedEmployee.full_name}>
                  {selectedEmployee.full_name}
                </span>
                <span className="rounded bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-700 px-1 py-0.2 text-[10px] font-bold text-indigo-800 dark:text-indigo-200 shrink-0">
                  {selectedEmployee.discount_percent ?? employeeDiscountPercent}% OFF
                </span>
                {selectedEmployee.code && (
                  <span className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.2 text-[10px] font-mono text-slate-700 dark:text-slate-200 shrink-0 hidden md:inline-block">
                    {selectedEmployee.code}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer shadow-2xs"
                  title="Cambiar empleado o cliente"
                  aria-label="Cambiar cliente o empleado"
                >
                  <Users size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectEmployee?.(null)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/80 transition cursor-pointer shadow-2xs"
                  title="Quitar empleado seleccionado"
                  aria-label="Quitar empleado"
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ) : selectedCustomer ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">Cliente:</span>
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 shadow-2xs min-w-0">
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[130px] sm:max-w-[170px]" title={selectedCustomer.full_name}>
                  {selectedCustomer.full_name}
                </span>
                {selectedCustomer.document_number && (
                  <span className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.2 text-[10px] font-mono text-slate-700 dark:text-slate-300 shrink-0 hidden md:inline-block">
                    {formatCustomerDocument(selectedCustomer.document_type, selectedCustomer.document_number)}
                  </span>
                )}
              </div>

              {/* Botones de acción agrupados: Quitar junto a Editar y Cambiar (solo iconos con tooltips) */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenCustomerModal(selectedCustomer, "account")}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs"
                  title="Editar cliente para asignarle una cuenta corriente"
                  aria-label="Editar cliente"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer shadow-2xs"
                  title="Cambiar cliente"
                  aria-label="Cambiar cliente"
                >
                  <Users size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onCustomerChange("")}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/80 transition cursor-pointer shadow-2xs"
                  title="Quitar cliente asignado (volver a Consumidor Final)"
                  aria-label="Quitar cliente"
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">Cliente / Empleado:</span>
              <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                Consumidor Final (Venta mostrador)
              </span>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer shrink-0 shadow-2xs"
              >
                Asignar
              </button>
            </div>
          )}
        </div>

        {/* Factura ARCA switch */}
        <div className="flex items-center gap-2 shrink-0 pl-2.5 border-l border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-1.5 text-xs">
            <FileText size={13} className="text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
              Factura {arcaEnabled ? "ARCA" : "Fiscal"}:
            </span>
            {issueInvoice && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                  arcaMode === "mock"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                }`}
              >
                {defaultDocumentType || "B"} {arcaEnabled ? `(${arcaMode === "mock" ? "MOCK" : "OFICIAL"})` : ""}
              </span>
            )}
            {activeInvoiceRule.status === "mandatory" && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800 shadow-2xs"
                title={activeInvoiceRule.reason}
              >
                Obligatoria
              </span>
            )}
            {activeInvoiceRule.status === "disabled" && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-2xs"
                title={activeInvoiceRule.reason}
              >
                Deshabilitada
              </span>
            )}
          </div>
          <label
            className={`pos-switch relative inline-flex shrink-0 items-center ${
              activeInvoiceRule.status === "disabled"
                ? "opacity-40 cursor-not-allowed"
                : "cursor-pointer"
            }`}
            title={activeInvoiceRule.reason || "Emitir comprobante fiscal con CAE y código QR oficial"}
          >
            <input
              type="checkbox"
              checked={issueInvoice}
              onChange={(e) => {
                if (activeInvoiceRule.status === "disabled") return;
                setIssueInvoice(e.target.checked);
              }}
              className="peer sr-only"
              disabled={disabled || !canWrite || !isOnline || activeInvoiceRule.status === "disabled"}
            />
            <span className="pos-switch-track">
              <span className="pos-switch-thumb" />
            </span>
          </label>
        </div>
      </div>

      {/* LISTA DE MEDIOS DE PAGO */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs px-1 text-slate-500 dark:text-slate-400 font-semibold mb-0.5">
          <span>Medio de Pago / Cuenta</span>
          <span className="font-mono">Importe Asignado ($)</span>
        </div>

        {paymentOptions.map((option, idx) => {
          const isHighlighted = idx === highlightedIndex;
          const assignedVal = allocatedAmounts[option.id] || 0;
          const hasAmount = assignedVal > 0;
          const isEstablished = Boolean(lockedMethodIds[option.id] && hasAmount);
          const Icon = getMethodIcon(option.code);

          return (
            <div
              key={option.id}
              onClick={() => selectOption(idx)}
              className={`group flex items-center justify-between gap-3 py-1.5 px-3 rounded-xl border transition cursor-pointer ${
                isEstablished
                  ? "border-emerald-500 dark:border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 ring-2 ring-emerald-500/60 shadow-xs"
                  : isHighlighted
                  ? "border-amber-400 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-500/20 ring-2 ring-amber-400 dark:ring-amber-400/90 shadow-sm"
                  : hasAmount
                  ? "border-slate-300 dark:border-slate-600 bg-slate-100/70 dark:bg-slate-800/80 hover:border-slate-400 dark:hover:border-slate-500"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/70"
              }`}
            >
              {/* Lado izquierdo: Icono y Nombre */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
                    isEstablished
                      ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-xs"
                      : isHighlighted
                      ? "bg-amber-400 dark:bg-amber-400 text-slate-950 font-black shadow-xs"
                      : "bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/70"
                  }`}
                >
                  <Icon size={15} />
                </div>

                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <span
                    className={`font-bold text-sm truncate ${
                      isEstablished
                        ? "text-slate-900 dark:text-white"
                        : isHighlighted
                        ? "text-slate-950 dark:text-amber-100"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {option.name}
                  </span>
                  {isOptionInvoiceMandatory(option) && (
                    <span className="rounded bg-blue-50 dark:bg-blue-950/70 px-1.5 py-0.2 text-[9px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                      Factura obligatoria
                    </span>
                  )}
                  {isOptionInvoiceDisabled(option) && (
                    <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                      Sin factura
                    </span>
                  )}
                  {(() => {
                    const methodEntity = paymentMethods.find((m) => m.id === option.paymentMethodId);
                    const surchargePercent = methodEntity?.surcharge_percent ?? 0;
                    const discountPercent = methodEntity?.discount_percent ?? 0;
                    if (surchargePercent > 0) {
                      return (
                        <span className="rounded bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.2 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0">
                          +{surchargePercent}%
                        </span>
                      );
                    }
                    if (discountPercent > 0) {
                      return (
                        <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
                          -{discountPercent}%
                        </span>
                      );
                    }
                    return null;
                  })()}
                  {isEstablished && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <Check size={9} strokeWidth={3} />
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/90 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-700">
                        Confirmado
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lado derecho: Casilla de Importe y botones */}
              <div
                className="flex items-center gap-1.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Campo 'Paga con' para cálculo de vuelto ágil en efectivo */}
                {posCashChangeEnabled && normalizePaymentMethodCode(option.code) === "cash" && hasAmount && (
                  <div
                    className="relative flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/90 px-2 py-1 shadow-2xs"
                    title="Monto que entrega el cliente (Enter para calcular vuelto y confirmar)"
                  >
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                      Paga:
                    </span>
                    <span className="text-xs font-black text-slate-400 select-none">$</span>
                    <input
                      ref={cashGivenInputRef}
                      type="number"
                      step="any"
                      min="0"
                      placeholder={(allocatedAmounts[option.id] || 0).toFixed(2)}
                      value={cashGivenAmount}
                      onChange={(e) => setCashGivenAmount(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          if (Date.now() < blockFinalSubmitUntilRef.current) return;
                          if (isFullyAssigned) {
                            void handleFinalSubmit();
                          }
                        }
                      }}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      className="w-20 text-right font-mono text-sm font-bold bg-transparent outline-none text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                )}

                {/* Casilla de Importe con autoselección total al hacer clic / focus */}
                <div className="relative w-32">
                  <span
                    className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-black pointer-events-none transition ${
                      isEstablished
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
                      setHighlightedIndex(idx);
                      onPaymentMethodChange(option.paymentMethodId);
                      setIsReadyToSubmit(false);
                      const optTotal = getCheckoutSummary
                        ? getCheckoutSummary(option.paymentMethodId).total
                        : checkoutTotal;
                      shiftRemainderToOption(option, optTotal);
                    }}
                    onClick={(e) => {
                      (e.target as HTMLInputElement).select();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        confirmOptionAmount(option.id);
                      }
                    }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    className={`w-full rounded-lg border py-1 pl-5 pr-2 text-right font-mono text-sm outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      isEstablished
                        ? "border-emerald-500 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/90 text-emerald-950 dark:text-emerald-100 font-black ring-2 ring-emerald-500/50 shadow-xs"
                        : isHighlighted
                        ? "border-amber-400 dark:border-amber-400 bg-white dark:bg-slate-900 text-slate-950 dark:text-amber-100 font-bold ring-2 ring-amber-400/60 shadow-xs"
                        : hasAmount
                        ? "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                        : "border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-amber-400 dark:focus:border-amber-400"
                    }`}
                  />
                </div>

                {/* Botón Confirmar Monto si está seleccionado con monto y aún no confirmado */}
                {!isEstablished && hasAmount && isHighlighted && (
                  <button
                    type="button"
                    onClick={() => confirmOptionAmount(option.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-500 dark:bg-amber-400 dark:hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-xs transition cursor-pointer"
                    title="Confirmar monto asignado (Enter)"
                  >
                    <Check size={13} strokeWidth={3} />
                    <span className="hidden sm:inline">OK</span>
                  </button>
                )}

                {hasAmount && (
                  <button
                    type="button"
                    onClick={() => clearOptionAmount(option.id)}
                    className="rounded-lg p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
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

      {submitError && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 p-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
          <AlertCircle size={15} className="shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* FOOTER: Botones Cancelar y Confirmar Venta */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cancelar
          </button>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={() => {
            if (isFullyAssigned) {
              void handleFinalSubmit();
            } else {
              const activeOption = paymentOptions[highlightedIndex];
              if (activeOption) {
                const optTotal = getCheckoutSummary
                  ? getCheckoutSummary(activeOption.paymentMethodId).total
                  : checkoutTotal;
                shiftRemainderToOption(activeOption, optTotal);
              }
            }
          }}
          disabled={disabled || isSubmittingLocal || !canWrite || (!isFullyAssigned && totalPending <= 0)}
          className={`inline-flex items-center justify-center gap-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 shadow-md shadow-emerald-600/20 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
            !disabled && !isSubmittingLocal && isReadyToSubmit && isFullyAssigned
              ? "ring-2 ring-emerald-400 ring-offset-2 dark:ring-offset-slate-900 animate-pulse"
              : ""
          }`}
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
            {disabled || isSubmittingLocal ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Check size={13} className="stroke-[3]" />
            )}
          </div>
          <span className="text-xs font-black uppercase tracking-wider">
            {disabled || isSubmittingLocal
              ? isRefundMode ? "Registrando reintegro..." : "Registrando..."
              : isRefundMode
              ? isReadyToSubmit
                ? "Confirmar Reintegro en Efectivo (Enter)"
                : "Confirmar Reintegro en Efectivo"
              : isFullyAssigned
              ? isReadyToSubmit
                ? "Confirmar Venta (Enter)"
                : "Confirmar Venta"
              : "Asignar Monto Total"}
          </span>
          <span className="font-mono text-sm font-black ml-1">
            {isRefundMode ? currency.format(Math.abs(checkoutTotal)) : currency.format(checkoutTotal)}
          </span>
        </button>
      </div>

      {/* Modal Ágil de Búsqueda y Selección de Cliente / Empleado */}
      <PosCustomerSelectModal
        isOpen={isCustomerModalOpen}
        title={hasOwedReturnables && !selectedCustomer ? "¿Quién es el cliente?" : undefined}
        subtitle={
          hasOwedReturnables && !selectedCustomer
            ? "Hay envases para anotar que se registrarán en la cuenta corriente del cliente."
            : undefined
        }
        customers={customers}
        employees={employees}
        selectedCustomerId={selectedCustomerId}
        selectedEmployeeId={selectedEmployeeId}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelect={(cust) => {
          onSelectEmployee?.(null);
          onCustomerChange(cust.id);
          setIsCustomerModalOpen(false);
        }}
        onSelectEmployee={(emp) => {
          onCustomerChange("");
          onSelectEmployee?.(emp);
          setIsCustomerModalOpen(false);
        }}
        onOpenCreateCustomer={() => {
          setIsCustomerModalOpen(false);
          onOpenCustomerModal(null);
        }}
        onEditCustomer={(cust, defaultTab) => {
          setIsCustomerModalOpen(false);
          onOpenCustomerModal(cust, defaultTab ?? "account");
        }}
        employeeDiscountPercent={employeeDiscountPercent}
      />
    </section>
  );
};
