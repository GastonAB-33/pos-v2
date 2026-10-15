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
  onOpenCustomerModal: (customer: Customer | null, defaultTab?: "personal" | "fiscal" | "account") => void;
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
  // Métodos de pago con monto confirmado/establecido { [optionId]: boolean }
  const [lockedMethodIds, setLockedMethodIds] = useState<Record<string, boolean>>({});
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isReadyToSubmit, setIsReadyToSubmit] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
      setIsReadyToSubmit(false);
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

      if (targetOption.isCurrentAccount && !selectedCustomer) {
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

      if (pending === 0 && Math.abs(sum - checkoutTotal) <= 0.01 && sum > 0) {
        setIsReadyToSubmit(true);
      } else {
        setIsReadyToSubmit(false);
      }

      const inputEl = inputRefs.current[optionId];
      if (inputEl) {
        inputEl.blur();
      }
    },
    [allocatedAmounts, amountInputs, checkoutTotal, paymentOptions, selectedCustomer]
  );

  // Desplazar el resto pendiente dinámicamente al método objetivo
  const shiftRemainderToOption = useCallback(
    (targetOption: PosPaymentOption) => {
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
      const remainder = Number(Math.max(0, checkoutTotal - lockedSum).toFixed(2));

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
    [allocatedAmounts, checkoutTotal, lockedMethodIds]
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

    if (isCurrentAccountUsed && selectedCustomer && !currentAccountSnapshot?.enabled) {
      setSubmitError(
        `La cuenta corriente no está habilitada para ${selectedCustomer.full_name}. Habilitala desde "Habilitar Cta. Cte." para poder confirmar la venta.`
      );
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

  const [copiedField, setCopiedField] = useState<"total" | "pending" | null>(null);

  const handleCopyAmount = useCallback((amount: number, field: "total" | "pending") => {
    const text = amount.toFixed(2);
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 1500);
  }, []);

  const panelRef = useRef<HTMLElement | null>(null);

  // Autofocus del panel al montarse para capturar teclas inmediatamente
  useEffect(() => {
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

      shiftRemainderToOption(targetOption);

      window.setTimeout(() => {
        const el = inputRefs.current[targetOption.id];
        if (el) {
          el.focus();
          el.select();
        }
      }, 20);
    },
    [onPaymentMethodChange, paymentOptions, shiftRemainderToOption]
  );

  // Listener global de teclado para navegación ágil y flujo de Enter en 3 pasos
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Si el modal de búsqueda de clientes está abierto, ignorar teclado global
      if (isCustomerModalOpen) return;

      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const activeInputEl = targetTag === "input" ? (e.target as HTMLInputElement) : null;
      const isEditingAmount = Boolean(activeInputEl && activeInputEl.type === "number");

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
          shiftRemainderToOption(nextOption);
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
          shiftRemainderToOption(nextOption);
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const activeOption = paymentOptions[highlightedIndex];
        if (!activeOption) return;

        // Si es cuenta corriente y falta cliente, abrir selector de cliente
        if (activeOption.isCurrentAccount && !selectedCustomer) {
          setIsCustomerModalOpen(true);
          return;
        }

        // PASO 2: El cursor está actualmente dentro de la casilla de monto (editando/confirmando el importe)
        if (isEditingAmount) {
          activeInputEl?.blur();
          confirmOptionAmount(activeOption.id);
          return;
        }

        // PASO 3: Ya se confirmó el monto (isReadyToSubmit) y el total está 100% asignado
        if (isReadyToSubmit && isFullyAssigned) {
          void handleFinalSubmit();
          return;
        }

        // PASO 1: El usuario seleccionó el método con Enter desde la lista de métodos
        onPaymentMethodChange(activeOption.paymentMethodId);

        // Si no está bloqueado, asegurarse de asignar el restante disponible
        if (!lockedMethodIds[activeOption.id]) {
          shiftRemainderToOption(activeOption);
        }

        setIsReadyToSubmit(false);

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

      if (e.key === "Escape" && onClose && !isEditingAmount) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [
    allocatedAmounts,
    checkoutTotal,
    confirmOptionAmount,
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
    shiftRemainderToOption,
  ]);

  const isMpHighlighted = paymentOptions[highlightedIndex]?.code === "mercado_pago";

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
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Cobro de Venta</h3>
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

      {/* Banner de integración Mercado Pago si está seleccionado */}
      {isMpHighlighted && mercadoPagoSettings.enabled && (
        <div className="rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 p-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
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

      {/* 2 PANELES SUPERIORES MINIMALISTAS (CLIC PARA COPIAR MONTO) */}
      <div className="grid grid-cols-2 gap-3">
        {/* PANEL 1: TOTAL A PAGAR */}
        <div
          onClick={() => handleCopyAmount(checkoutTotal, "total")}
          title="Clic para copiar monto a pagar"
          className="group relative flex flex-col justify-between rounded-xl p-3 border border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer transition active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total a Pagar
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
              {isFullyAssigned ? "Cubierto al 100%" : isOverpaid ? "Monto Excedido" : "Total Pendiente"}
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
            {currency.format(totalPending)}
          </span>
        </div>
      </div>

      {/* PANEL UNIFICADO DE CLIENTE Y FACTURA AFIP (COMPACTO Y MISMO TAMAÑO ASIGNADO O NO) */}
      <div className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 min-h-[42px]">
        <div className="flex items-center gap-1.5 text-xs min-w-0 flex-1">
          <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">Cliente:</span>
          {selectedCustomer ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
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
              <span className="text-slate-500 dark:text-slate-400 font-medium truncate">
                Consumidor Final (Venta mostrador)
              </span>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-md border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer shrink-0"
              >
                Asignar
              </button>
            </div>
          )}
        </div>

        {/* Factura AFIP switch */}
        <div className="flex items-center gap-2 shrink-0 pl-2.5 border-l border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-1 text-xs">
            <FileText size={13} className="text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">Factura AFIP:</span>
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
                  : "border-slate-300 dark:border-slate-600/90 bg-white dark:bg-slate-800/60 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/90"
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
                  {option.isBankTransfer && (
                    <span className="rounded bg-sky-100 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 px-1.5 py-0.2 text-[9px] font-bold text-sky-800 dark:text-sky-300">
                      BANCO
                    </span>
                  )}
                  {isEstablished ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <Check size={9} strokeWidth={3} />
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/90 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-700">
                        Confirmado
                      </span>
                    </div>
                  ) : isHighlighted ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 bg-amber-200/80 dark:bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-400/80 dark:border-amber-600/80 shrink-0">
                      Seleccionado
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Lado derecho: Casilla de Importe y botones */}
              <div
                className="flex items-center gap-1.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
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
                    }}
                    onClick={(e) => {
                      (e.target as HTMLInputElement).select();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
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
          onClick={() => void handleFinalSubmit()}
          disabled={disabled || !canWrite || !isFullyAssigned}
          className={`inline-flex items-center justify-center gap-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 shadow-md shadow-emerald-600/20 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
            isReadyToSubmit && isFullyAssigned
              ? "ring-2 ring-emerald-400 ring-offset-2 dark:ring-offset-slate-900 animate-pulse"
              : ""
          }`}
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
            <Check size={13} className="stroke-[3]" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider">
            {isFullyAssigned
              ? isReadyToSubmit
                ? "Confirmar Venta (Enter)"
                : "Confirmar Venta"
              : "Asignar Monto Total"}
          </span>
          <span className="font-mono text-sm font-black ml-1">
            {currency.format(checkoutTotal)}
          </span>
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
        onEditCustomer={(cust, defaultTab) => {
          setIsCustomerModalOpen(false);
          onOpenCustomerModal(cust, defaultTab ?? "account");
        }}
      />
    </section>
  );
};
