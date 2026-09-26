import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Banknote,
  Check,
  CreditCard,
  FileText,
  Landmark,
  Layers,
  Lock,
  Pencil,
  Plus,
  QrCode,
  Receipt,
  Search,
  Trash2,
  UserCheck,
  Wallet,
  X,
  Zap,
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
import {
  getPaymentMethodPosConfig,
  normalizePaymentMethodCode,
  type PaymentMethodPosConfig,
} from "@/services/payment-methods.service";
import {
  posCheckoutSchema,
  type PosCheckoutValues,
  type PosPaymentSplitItem,
} from "@/modules/pos/schemas/pos-checkout.schema";

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

const paymentMethodPriority = (method: PaymentMethod): number => {
  const code = normalizePaymentMethodCode(method.code);
  if (code === "cash") return 0;
  if (code === "card_debit") return 1;
  if (code === "card_credit") return 2;
  if (code === "transfer") return 3;
  if (code === "mercado_pago") return 4;
  if (code === "cheque") return 5;
  if (code === "current_account") return 6;
  return 7;
};

const getMethodIcon = (code: string) => {
  const normalized = normalizePaymentMethodCode(code);
  switch (normalized) {
    case "cash":
      return Banknote;
    case "card_debit":
      return CreditCard;
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

interface CardDebitDetails {
  couponNumber: string;
  authorizationNumber: string;
  destinationBankAccountId: string;
}

interface CardCreditDetails extends CardDebitDetails {
  cardBrand: string;
  installmentPlanId: string;
}

interface TransferDetails {
  originBankId: string;
  newOriginBankName: string;
  voucherNumber: string;
  originAccountHolder: string;
  destinationBankAccountId: string;
}

interface MercadoPagoManualDetails {
  operationId: string;
  destinationBankAccountId: string;
}

interface ChequeDetails {
  chequeNumber: string;
  approvalNumber: string;
  dueDate: string;
  originBankId: string;
  newOriginBankName: string;
  originAccountHolder: string;
  destinationBankAccountId: string;
}

export const PosCheckoutPanel = ({
  formId,
  customers,
  paymentMethods,
  bankAccounts,
  originBanks,
  installmentPlans,
  selectedCustomerId,
  selectedPaymentMethodId,
  isOnline,
  checkoutTotal,
  mercadoPagoIntent,
  mercadoPagoSettings,
  mercadoPagoStatus,
  isMercadoPagoLoading,
  canWrite,
  canManageCustomers,
  currentAccountSnapshot,
  disabled,
  onCustomerChange,
  onPaymentMethodChange,
  onCreateOriginBank,
  onOpenCustomerModal,
  onStartMercadoPago,
  onRefreshMercadoPago,
  onApproveMercadoPago,
  onRejectMercadoPago,
  onCancelMercadoPago,
  onClose,
  onSubmit,
}: PosCheckoutPanelProps) => {
  const [customerQuery, setCustomerQuery] = useState("");
  const [isCustomerMenuOpen, setIsCustomerMenuOpen] = useState(false);
  const [isEditingCustomerSearch, setIsEditingCustomerSearch] = useState(false);
  const [paymentDetailError, setPaymentDetailError] = useState<string | null>(null);
  const [isCreatingOriginBank, setIsCreatingOriginBank] = useState(false);

  // Modo de pago: "single" (por defecto, 1-clic rápido) vs "split" (combinado)
  const [paymentMode, setPaymentMode] = useState<"single" | "split">("single");
  const [splitPayments, setSplitPayments] = useState<PosPaymentSplitItem[]>([]);
  const [splitAmountInput, setSplitAmountInput] = useState<string>(() => checkoutTotal.toFixed(2));
  const [splitError, setSplitError] = useState<string | null>(null);

  const [cardDebitDetails, setCardDebitDetails] = useState<CardDebitDetails>({
    couponNumber: "",
    authorizationNumber: "",
    destinationBankAccountId: "",
  });
  const [cardCreditDetails, setCardCreditDetails] = useState<CardCreditDetails>({
    couponNumber: "",
    authorizationNumber: "",
    destinationBankAccountId: "",
    cardBrand: "",
    installmentPlanId: "",
  });
  const [transferDetails, setTransferDetails] = useState<TransferDetails>({
    originBankId: "",
    newOriginBankName: "",
    voucherNumber: "",
    originAccountHolder: "",
    destinationBankAccountId: "",
  });
  const [mercadoPagoManualDetails, setMercadoPagoManualDetails] =
    useState<MercadoPagoManualDetails>({
      operationId: "",
      destinationBankAccountId: "",
    });
  const [chequeDetails, setChequeDetails] = useState<ChequeDetails>({
    chequeNumber: "",
    approvalNumber: "",
    dueDate: "",
    originBankId: "",
    newOriginBankName: "",
    originAccountHolder: "",
    destinationBankAccountId: "",
  });
  const customerLookupRef = useRef<HTMLDivElement | null>(null);

  const splitPaidTotal = useMemo(
    () => Number(splitPayments.reduce((acc, p) => acc + p.amount, 0).toFixed(2)),
    [splitPayments]
  );
  const splitRemainingTotal = useMemo(
    () => Number(Math.max(0, checkoutTotal - splitPaidTotal).toFixed(2)),
    [checkoutTotal, splitPaidTotal]
  );
  const isSplitFullyCovered = Math.abs(splitPaidTotal - checkoutTotal) <= 0.01;

  useEffect(() => {
    if (splitPayments.length === 0) {
      setSplitAmountInput(checkoutTotal.toFixed(2));
    }
  }, [checkoutTotal, splitPayments.length]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
  } = useForm<PosCheckoutValues>({
    resolver: zodResolver(posCheckoutSchema),
    defaultValues: {
      customerId: selectedCustomerId,
      paymentMethodId: selectedPaymentMethodId,
      issueInvoice: false,
      notes: "",
      paymentDetails: null,
    },
  });

  useEffect(() => {
    setValue("customerId", selectedCustomerId, { shouldValidate: true });
  }, [selectedCustomerId, setValue]);

  useEffect(() => {
    setValue("paymentMethodId", selectedPaymentMethodId, { shouldValidate: true });
  }, [selectedPaymentMethodId, setValue]);

  const watchedCustomerId = watch("customerId");
  const watchedPaymentMethodId = watch("paymentMethodId");
  const watchedIssueInvoice = watch("issueInvoice");

  useEffect(() => {
    onCustomerChange(watchedCustomerId?.trim() ?? "");
  }, [onCustomerChange, watchedCustomerId]);

  useEffect(() => {
    if (!watchedPaymentMethodId) return;
    onPaymentMethodChange(watchedPaymentMethodId);
  }, [onPaymentMethodChange, watchedPaymentMethodId]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === watchedCustomerId) ?? null,
    [customers, watchedCustomerId]
  );

  const customerInitials = useMemo(() => {
    if (!selectedCustomer) return "CF";
    const parts = selectedCustomer.full_name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0]?.slice(0, 2) || "CL").toUpperCase();
  }, [selectedCustomer]);

  const selectedMethod = useMemo(
    () => paymentMethods.find((method) => method.id === watchedPaymentMethodId) ?? null,
    [paymentMethods, watchedPaymentMethodId]
  );

  const selectedMethodConfig = useMemo<PaymentMethodPosConfig | null>(
    () => (selectedMethod ? getPaymentMethodPosConfig(selectedMethod) : null),
    [selectedMethod]
  );

  const selectedMethodCode = normalizePaymentMethodCode(selectedMethod?.code);
  const isCreditCardMethod = selectedMethodCode === "card_credit";
  const isDebitCardMethod = selectedMethodCode === "card_debit";
  const isTransferMethod = selectedMethodCode === "transfer";
  const isChequeMethod = selectedMethodCode === "cheque";
  const isMercadoPagoMethod = selectedMethodCode === "mercado_pago";
  const isMercadoPagoManual = isMercadoPagoMethod && !mercadoPagoSettings.enabled;
  const isCurrentAccountMethod = selectedMethodCode === "current_account";

  const requiresPaymentDetails = Boolean(
    isCreditCardMethod ||
      isDebitCardMethod ||
      isTransferMethod ||
      isMercadoPagoManual ||
      isChequeMethod
  );

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return customers.slice(0, 8);
    return customers
      .filter((customer) => {
        const nameMatch = customer.full_name.toLowerCase().includes(query);
        const docMatch = customer.document_number.toLowerCase().includes(query);
        return nameMatch || docMatch;
      })
      .slice(0, 8);
  }, [customerQuery, customers]);

  useEffect(() => {
    if (!isCustomerMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-customer-lookup='true']")) return;
      setIsCustomerMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [isCustomerMenuOpen]);

  const selectCustomer = useCallback(
    (customer: Customer | null) => {
      if (!customer) {
        setValue("customerId", "", { shouldDirty: true, shouldValidate: true });
        setCustomerQuery("");
        setIsCustomerMenuOpen(false);
        setIsEditingCustomerSearch(false);
        return;
      }
      setValue("customerId", customer.id, { shouldDirty: true, shouldValidate: true });
      setCustomerQuery(`${customer.full_name} (${customer.document_number})`);
      setIsCustomerMenuOpen(false);
      setIsEditingCustomerSearch(false);
    },
    [setValue]
  );

  const paymentMethodsOrdered = useMemo(
    () =>
      paymentMethods
        .filter((method) => normalizePaymentMethodCode(method.code) !== "mercado_pago")
        .sort((a, b) => {
          const priorityDiff = paymentMethodPriority(a) - paymentMethodPriority(b);
          if (priorityDiff !== 0) return priorityDiff;
          return a.name.localeCompare(b.name);
        }),
    [paymentMethods]
  );

  const destinationBankAccounts = useMemo(() => {
    if (!selectedMethodConfig?.ask_destination_bank) return bankAccounts;
    if (!selectedMethodConfig.destination_bank_account_ids.length) return bankAccounts;
    const allowedIds = new Set(selectedMethodConfig.destination_bank_account_ids);
    const filtered = bankAccounts.filter((account) => allowedIds.has(account.id));
    return filtered.length ? filtered : bankAccounts;
  }, [bankAccounts, selectedMethodConfig]);

  const selectedCreditDestination = useMemo(
    () =>
      destinationBankAccounts.find(
        (account) => account.id === cardCreditDetails.destinationBankAccountId
      ) ?? null,
    [cardCreditDetails.destinationBankAccountId, destinationBankAccounts]
  );

  const selectedDebitDestination = useMemo(
    () =>
      destinationBankAccounts.find(
        (account) => account.id === cardDebitDetails.destinationBankAccountId
      ) ?? null,
    [cardDebitDetails.destinationBankAccountId, destinationBankAccounts]
  );

  const selectedTransferDestination = useMemo(
    () =>
      destinationBankAccounts.find(
        (account) => account.id === transferDetails.destinationBankAccountId
      ) ?? null,
    [destinationBankAccounts, transferDetails.destinationBankAccountId]
  );

  const selectedManualMpDestination = useMemo(
    () =>
      destinationBankAccounts.find(
        (account) => account.id === mercadoPagoManualDetails.destinationBankAccountId
      ) ?? null,
    [destinationBankAccounts, mercadoPagoManualDetails.destinationBankAccountId]
  );

  const selectedChequeDestination = useMemo(
    () =>
      destinationBankAccounts.find(
        (account) => account.id === chequeDetails.destinationBankAccountId
      ) ?? null,
    [chequeDetails.destinationBankAccountId, destinationBankAccounts]
  );

  const availableInstallmentPlans = useMemo(() => {
    const normalizedBrand = cardCreditDetails.cardBrand.trim().toLowerCase();
    return installmentPlans
      .filter((plan) => {
        if (!plan.is_active) return false;
        if (!normalizedBrand) return true;
        if (!plan.card_brand) return true;
        return plan.card_brand.trim().toLowerCase() === normalizedBrand;
      })
      .sort((a, b) => {
        if (a.installments !== b.installments) return a.installments - b.installments;
        return a.name.localeCompare(b.name);
      });
  }, [cardCreditDetails.cardBrand, installmentPlans]);

  const selectedInstallmentPlan = useMemo(
    () =>
      availableInstallmentPlans.find((plan) => plan.id === cardCreditDetails.installmentPlanId) ??
      null,
    [availableInstallmentPlans, cardCreditDetails.installmentPlanId]
  );

  const canUseCurrentAccount = Boolean(watchedCustomerId?.trim());
  const isCurrentAccountEnabled = Boolean(currentAccountSnapshot?.enabled);
  const isCurrentAccountNoFunds = Boolean(
    currentAccountSnapshot?.enabled &&
      currentAccountSnapshot.available != null &&
      currentAccountSnapshot.available <= 0
  );
  const canUseCurrentAccountMethod =
    canUseCurrentAccount && isCurrentAccountEnabled && !isCurrentAccountNoFunds;

  useEffect(() => {
    if (!selectedMethod) return;
    if (normalizePaymentMethodCode(selectedMethod.code) !== "current_account") return;
    if (canUseCurrentAccountMethod) return;
    const fallback = paymentMethodsOrdered.find(
      (method) => normalizePaymentMethodCode(method.code) !== "current_account"
    );
    if (!fallback) return;
    setValue("paymentMethodId", fallback.id, { shouldDirty: true, shouldValidate: true });
  }, [canUseCurrentAccountMethod, paymentMethodsOrdered, selectedMethod, setValue]);

  const isMercadoPagoApproved = mercadoPagoIntent?.status === "approved";
  const canStartMercadoPago =
    canWrite &&
    !disabled &&
    !isMercadoPagoLoading &&
    isMercadoPagoMethod &&
    !isMercadoPagoManual &&
    mercadoPagoStatus.can_start_payment &&
    checkoutTotal > 0 &&
    (!mercadoPagoIntent ||
      mercadoPagoIntent.status === "rejected" ||
      mercadoPagoIntent.status === "cancelled" ||
      mercadoPagoIntent.status === "expired");

  const arePaymentDetailsReady = useMemo(() => {
    // En el POS todos los datos adicionales (cupones, autorizaciones, cuentas bancarias)
    // son opcionales y nunca deben bloquear la finalización inmediata de la venta.
    return true;
  }, []);

  const buildPaymentDetailsPayload = useCallback(async () => {
    if (!requiresPaymentDetails || !selectedMethod || !selectedMethodConfig) {
      return { ok: true as const, payload: null as Record<string, unknown> | null };
    }
    const capturedAt = new Date().toISOString();

    if (isCreditCardMethod) {
      return {
        ok: true as const,
        payload: {
          kind: "card_credit",
          captured_at: capturedAt,
          coupon_number: cardCreditDetails.couponNumber.trim() || null,
          authorization_number: cardCreditDetails.authorizationNumber.trim() || null,
          card_brand: cardCreditDetails.cardBrand.trim() || null,
          installment_plan_id: selectedInstallmentPlan?.id ?? null,
          destination_account_id: selectedCreditDestination?.id ?? null,
          destination_account_bank: selectedCreditDestination?.bank_name ?? null,
        },
      };
    }

    if (isDebitCardMethod) {
      return {
        ok: true as const,
        payload: {
          kind: "card_debit",
          captured_at: capturedAt,
          coupon_number: cardDebitDetails.couponNumber.trim() || null,
          authorization_number: cardDebitDetails.authorizationNumber.trim() || null,
          destination_account_id: selectedDebitDestination?.id ?? null,
          destination_account_bank: selectedDebitDestination?.bank_name ?? null,
        },
      };
    }

    if (isTransferMethod) {
      let selectedOriginBank =
        originBanks.find((bank) => bank.id === transferDetails.originBankId) ?? null;
      if (selectedMethodConfig.ask_origin_bank && transferDetails.originBankId === "__new__") {
        const newName = transferDetails.newOriginBankName.trim();
        if (newName) {
          setIsCreatingOriginBank(true);
          try {
            const created = await onCreateOriginBank(newName);
            if (created) selectedOriginBank = created;
          } finally {
            setIsCreatingOriginBank(false);
          }
        }
      }

      return {
        ok: true as const,
        payload: {
          kind: "transfer",
          captured_at: capturedAt,
          origin_bank_id: selectedOriginBank?.id ?? null,
          origin_bank_name: selectedOriginBank?.name ?? null,
          voucher_number: transferDetails.voucherNumber.trim() || null,
          destination_account_id: selectedTransferDestination?.id ?? null,
          destination_account_bank: selectedTransferDestination?.bank_name ?? null,
        },
      };
    }

    if (isChequeMethod) {
      return {
        ok: true as const,
        payload: {
          kind: "cheque",
          captured_at: capturedAt,
          cheque_number: chequeDetails.chequeNumber.trim() || null,
          due_date: chequeDetails.dueDate.trim() || null,
          approval_number: chequeDetails.approvalNumber.trim() || null,
          destination_account_id: selectedChequeDestination?.id ?? null,
          destination_account_bank: selectedChequeDestination?.bank_name ?? null,
        },
      };
    }

    if (isMercadoPagoManual) {
      return {
        ok: true as const,
        payload: {
          kind: "mercado_pago_manual",
          captured_at: capturedAt,
          operation_id: mercadoPagoManualDetails.operationId.trim() || null,
          destination_account_id: selectedManualMpDestination?.id ?? null,
          destination_account_bank: selectedManualMpDestination?.bank_name ?? null,
        },
      };
    }

    return { ok: true as const, payload: null as Record<string, unknown> | null };
  }, [
    cardCreditDetails.authorizationNumber,
    cardCreditDetails.cardBrand,
    cardCreditDetails.couponNumber,
    cardDebitDetails.authorizationNumber,
    cardDebitDetails.couponNumber,
    chequeDetails.approvalNumber,
    chequeDetails.chequeNumber,
    chequeDetails.dueDate,
    isCreditCardMethod,
    isDebitCardMethod,
    isChequeMethod,
    isMercadoPagoManual,
    isTransferMethod,
    mercadoPagoManualDetails.operationId,
    onCreateOriginBank,
    originBanks,
    requiresPaymentDetails,
    selectedChequeDestination,
    selectedCreditDestination,
    selectedDebitDestination,
    selectedInstallmentPlan,
    selectedManualMpDestination,
    selectedMethod,
    selectedMethodConfig,
    selectedTransferDestination,
    transferDetails.newOriginBankName,
    transferDetails.originBankId,
    transferDetails.voucherNumber,
  ]);

  const handleAddSplitPayment = async () => {
    setSplitError(null);
    const parsed = parseFloat(splitAmountInput.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) {
      setSplitError("Ingresá un monto válido mayor a 0.");
      return;
    }

    if (parsed > splitRemainingTotal + 0.01) {
      setSplitError(
        `El monto ($${parsed.toFixed(2)}) supera el saldo restante ($${splitRemainingTotal.toFixed(2)}).`
      );
      return;
    }

    if (
      isCurrentAccountMethod &&
      (!canUseCurrentAccount || !isCurrentAccountEnabled || isCurrentAccountNoFunds)
    ) {
      setSplitError("No se puede abonar con cuenta corriente para este cliente.");
      return;
    }

    let paymentDetailsPayload: Record<string, unknown> | null = null;
    if (requiresPaymentDetails) {
      const built = await buildPaymentDetailsPayload();
      paymentDetailsPayload = built.payload;
    }

    const newItem: PosPaymentSplitItem = {
      id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      paymentMethodId: watchedPaymentMethodId,
      amount: Number(parsed.toFixed(2)),
      paymentDetails: paymentDetailsPayload,
    };

    const nextPayments = [...splitPayments, newItem];
    setSplitPayments(nextPayments);

    const nextPaid = Number(nextPayments.reduce((acc, p) => acc + p.amount, 0).toFixed(2));
    const nextRemaining = Number(Math.max(0, checkoutTotal - nextPaid).toFixed(2));
    setSplitAmountInput(nextRemaining > 0 ? nextRemaining.toFixed(2) : "");
  };

  const handleRemoveSplitPayment = (id: string) => {
    const nextPayments = splitPayments.filter((p) => p.id !== id);
    setSplitPayments(nextPayments);
    const nextPaid = Number(nextPayments.reduce((acc, p) => acc + p.amount, 0).toFixed(2));
    const nextRemaining = Number(Math.max(0, checkoutTotal - nextPaid).toFixed(2));
    setSplitAmountInput(nextRemaining.toFixed(2));
    setSplitError(null);
  };

  const submit = async (values: PosCheckoutValues) => {
    setPaymentDetailError(null);

    if (paymentMode === "split") {
      if (splitPayments.length === 0) {
        setPaymentDetailError("Debes agregar al menos un pago en el detalle de pago.");
        return;
      }
      if (!isSplitFullyCovered) {
        setPaymentDetailError(
          `Resta cobrar $${splitRemainingTotal.toFixed(2)} para completar el total de la venta.`
        );
        return;
      }

      await onSubmit({
        ...values,
        isSplitPayment: true,
        payments: splitPayments,
        paymentMethodId: splitPayments[0]?.paymentMethodId || values.paymentMethodId,
        paymentDetails: null,
      });

      reset({
        customerId: "",
        paymentMethodId: values.paymentMethodId,
        issueInvoice: false,
        notes: "",
        paymentDetails: null,
      });
      setSplitPayments([]);
      setSplitAmountInput("");
      setCustomerQuery("");
      setIsCustomerMenuOpen(false);
      return;
    }

    let paymentDetailsPayload: Record<string, unknown> | null = null;
    if (requiresPaymentDetails) {
      const built = await buildPaymentDetailsPayload();
      paymentDetailsPayload = built.payload;
    }

    await onSubmit({
      ...values,
      isSplitPayment: false,
      paymentDetails: paymentDetailsPayload,
    });

    reset({
      customerId: "",
      paymentMethodId: values.paymentMethodId,
      issueInvoice: false,
      notes: "",
      paymentDetails: null,
    });
    setCustomerQuery("");
    setIsCustomerMenuOpen(false);
  };

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
      {/* Línea de acento superior moderna estilo fintech */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-blue-500 to-indigo-600" />

      {/* Top Meta Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[11px] dark:bg-slate-800/80 dark:border-slate-800">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-semibold">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="uppercase tracking-wider">Terminal Caja</span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            TICKET MOSTRADOR
          </span>
        </div>

        {onClose && (
          <button
            type="button"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition dark:hover:bg-slate-800 dark:hover:text-slate-200"
            onClick={onClose}
            title="Cerrar ventana (Esc)"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Header Principal: Título + Pestañas + Hero Amount */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 p-5 bg-white dark:bg-slate-900 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Finalizar Venta</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Elegí cliente, medio de pago y datos de cobro
          </p>

          {/* Selector de modo: Pestañas segmentadas */}
          <div className="mt-3 inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setPaymentMode("single")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                paymentMode === "single"
                  ? "bg-white text-blue-700 shadow-xs dark:bg-slate-700 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Pago Único (Rápido)
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentMode("split");
                if (splitPayments.length === 0) {
                  setSplitAmountInput(checkoutTotal.toFixed(2));
                }
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                paymentMode === "split"
                  ? "bg-white text-blue-700 shadow-xs dark:bg-slate-700 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              Pago Combinado
              {splitPayments.length > 0 && (
                <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] font-black text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {splitPayments.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Hero Amount Box */}
        <div className="flex flex-col items-start sm:items-end justify-center rounded-xl bg-slate-50 p-3 sm:p-4 border border-slate-200/80 dark:bg-slate-800/70 dark:border-slate-700">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-300">
              Importe Total
            </span>
            <span className="rounded bg-emerald-100 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              ARS
            </span>
          </div>
          <span className="mt-0.5 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
            {currency.format(checkoutTotal)}
          </span>
        </div>
      </div>

      <form id={formId} className="flex-1 overflow-y-auto p-5 space-y-6" onSubmit={handleSubmit(submit)}>
        <input type="hidden" {...register("customerId")} />
        <input type="hidden" {...register("paymentMethodId")} />

        {/* PASO 1: CLIENTE ASOCIADO */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white shadow-xs">
                1
              </span>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Cliente Asociado
              </h3>
            </div>

            {selectedCustomer && isCurrentAccountEnabled && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" /> Cuenta al día
              </span>
            )}
          </div>

          {/* Tarjeta del cliente (o buscador si se quiere cambiar) */}
          {!isEditingCustomerSearch ? (
            <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 transition hover:bg-slate-100/50 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 font-black text-xs">
                  {customerInitials}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-slate-900 text-xs truncate dark:text-white">
                      {selectedCustomer?.full_name ?? "Consumidor Final"}
                    </span>
                    {selectedCustomer ? (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {selectedCustomer.document_type.toUpperCase()} {selectedCustomer.document_number}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        Venta mostrador
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-300 truncate mt-0.5">
                    {selectedCustomer
                      ? `IVA: ${selectedCustomer.fiscal_condition || "Consumidor Final"}`
                      : "Sin cuenta corriente asociada"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingCustomerSearch(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Pencil className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                  Cambiar
                </button>
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => selectCustomer(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    title="Quitar cliente y volver a Consumidor Final"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="relative" ref={customerLookupRef} data-customer-lookup="true">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="search"
                    autoFocus
                    value={customerQuery}
                    onChange={(event) => {
                      setCustomerQuery(event.target.value);
                      setIsCustomerMenuOpen(true);
                    }}
                    onFocus={() => setIsCustomerMenuOpen(true)}
                    placeholder="Escribí nombre o DNI del cliente..."
                    className="w-full rounded-xl border border-blue-500 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 outline-none ring-2 ring-blue-100"
                  />
                </div>
                <button
                  type="button"
                  title="Dar de alta nuevo cliente"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition"
                  disabled={disabled || !canWrite || !canManageCustomers}
                  onClick={() => onOpenCustomerModal(selectedCustomer ?? null)}
                >
                  <Plus size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingCustomerSearch(false)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
              </div>

              {isCustomerMenuOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  <button
                    type="button"
                    className="ui-btn-ghost w-full justify-start px-2.5 py-1.5 text-xs text-slate-700"
                    onClick={() => selectCustomer(null)}
                  >
                    Consumidor final (sin cliente)
                  </button>
                  {filteredCustomers.length ? (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className="ui-btn-ghost w-full justify-start px-2.5 py-1.5 text-xs"
                        onClick={() => selectCustomer(customer)}
                      >
                        <span className="truncate font-semibold text-slate-800">
                          {customer.full_name}
                        </span>
                        <span className="ml-auto font-mono text-[11px] text-slate-500">
                          {customer.document_number}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-2.5 py-1.5 text-xs text-slate-400">Sin coincidencias</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* PASO 2: MEDIOS DE PAGO SELECCIONADOS */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white shadow-xs">
                2
              </span>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Medios de Pago Seleccionados
              </h3>
            </div>

            {paymentMode === "split" ? (
              isSplitFullyCovered ? (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> MONTO ASIGNADO AL 100%
                </span>
              ) : (
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                  RESTA ASIGNAR {currency.format(splitRemainingTotal)}
                </span>
              )
            ) : (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" /> MONTO ASIGNADO AL 100%
              </span>
            )}
          </div>

          {/* Cuadrícula de tarjetas de Medios de Pago reales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {paymentMethodsOrdered.map((method) => {
              const code = normalizePaymentMethodCode(method.code);
              const Icon = getMethodIcon(code);

              // Lógica de asignación y selección
              let isAssigned = false;
              let assignedDisplay = "Sin asignar";

              if (paymentMode === "split") {
                const totalInMethod = splitPayments
                  .filter((p) => p.paymentMethodId === method.id)
                  .reduce((acc, p) => acc + p.amount, 0);
                if (totalInMethod > 0) {
                  isAssigned = true;
                  assignedDisplay = currency.format(totalInMethod);
                } else if (watchedPaymentMethodId === method.id) {
                  assignedDisplay = "Seleccionado";
                }
              } else {
                if (watchedPaymentMethodId === method.id) {
                  isAssigned = true;
                  assignedDisplay = currency.format(checkoutTotal);
                }
              }

              const isCurrentAccount = code === "current_account";
              const isMethodDisabled =
                disabled ||
                !canWrite ||
                (isCurrentAccount &&
                  (!canUseCurrentAccount || !isCurrentAccountEnabled || isCurrentAccountNoFunds));

              const isCardSelected = watchedPaymentMethodId === method.id;

              return (
                <button
                  key={method.id}
                  type="button"
                  disabled={isMethodDisabled}
                  onClick={() => {
                    setValue("paymentMethodId", method.id, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    if (paymentMode === "split" && splitRemainingTotal > 0) {
                      setSplitAmountInput(splitRemainingTotal.toFixed(2));
                    }
                  }}
                  className={`relative flex flex-col justify-between rounded-xl border p-3 text-left transition ${
                    isAssigned || isCardSelected
                      ? "border-emerald-500 bg-emerald-50/20 shadow-xs ring-1 ring-emerald-500/30 dark:bg-emerald-950/50 dark:border-emerald-500"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-slate-600"
                  } ${isMethodDisabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        isAssigned || isCardSelected
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    {isAssigned && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}

                    {isCurrentAccount && currentAccountSnapshot?.available != null && (
                      <span className="rounded bg-indigo-100 px-1 py-0.2 text-[9px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        DISP ${(currentAccountSnapshot.available / 1000).toFixed(0)}K
                      </span>
                    )}
                  </div>

                  <div>
                    <span
                      className={`block text-xs font-bold truncate ${
                        isAssigned || isCardSelected ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {method.name}
                    </span>
                    <span
                      className={`block text-[11px] font-mono mt-0.5 truncate ${
                        isAssigned
                          ? "font-bold text-emerald-700 dark:text-emerald-400"
                          : isCardSelected
                          ? "text-blue-700 dark:text-blue-400 font-semibold"
                          : "text-slate-400 dark:text-slate-300"
                      }`}
                    >
                      {assignedDisplay}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Barra de métricas (KPIs de Cobro) */}
          <div className="grid grid-cols-3 gap-2 mt-3.5 rounded-xl border border-slate-200/90 bg-slate-50/70 p-2.5 text-center text-xs dark:border-slate-700 dark:bg-slate-800/60">
            <div className="rounded-lg bg-white p-2 border border-slate-100 shadow-2xs dark:bg-slate-800 dark:border-slate-700">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-300">
                Monto Total
              </span>
              <span className="font-bold text-slate-800 text-sm font-mono dark:text-slate-100">
                {currency.format(checkoutTotal)}
              </span>
            </div>

            <div className="rounded-lg bg-emerald-100/70 border border-emerald-200/80 p-2 shadow-2xs dark:bg-emerald-950/60 dark:border-emerald-800">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Cobrado
              </span>
              <span className="font-black text-emerald-800 text-sm font-mono dark:text-emerald-300">
                {currency.format(paymentMode === "split" ? splitPaidTotal : checkoutTotal)}
              </span>
            </div>

            <div className="rounded-lg bg-white p-2 border border-slate-100 shadow-2xs dark:bg-slate-800 dark:border-slate-700">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-300">
                Resta Cubrir
              </span>
              <span
                className={`font-black text-sm font-mono ${
                  paymentMode === "split" && !isSplitFullyCovered
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {paymentMode === "split"
                  ? isSplitFullyCovered
                    ? "$0,00"
                    : currency.format(splitRemainingTotal)
                  : "$0,00"}
              </span>
            </div>
          </div>

          {/* En Modo Combinado: Detalle de pagos agregados */}
          {paymentMode === "split" && (
            <div className="mt-3.5 space-y-3">
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {splitPayments.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Todavía no agregaste pagos parciales. Asigná el monto y medio a continuación.
                  </div>
                ) : (
                  splitPayments.map((item, idx) => {
                    const method = paymentMethods.find((m) => m.id === item.paymentMethodId);
                    const Icon = getMethodIcon(method?.code || "");
                    const bank =
                      item.paymentDetails && typeof item.paymentDetails === "object"
                        ? (item.paymentDetails.destination_account_bank as string)
                        : null;
                    const voucher =
                      item.paymentDetails && typeof item.paymentDetails === "object"
                        ? (item.paymentDetails.voucher_number as string)
                        : null;

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 text-xs hover:bg-slate-50/70 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">
                              {method?.name || "Medio de pago"}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {bank ? `Banco: ${bank}` : ""}
                              {voucher ? ` • Ref: ${voucher}` : ""}
                              {!bank && !voucher ? `Pago parcial #${idx + 1}` : ""}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-black text-slate-900 text-sm font-mono">
                            {currency.format(item.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSplitPayment(item.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Quitar este pago"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Subformulario para agregar el siguiente método */}
              {!isSplitFullyCovered && (
                <div className="rounded-xl border border-blue-200/80 bg-blue-50/30 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900">
                      + Asignar monto a: <strong>{selectedMethod?.name || "Medio elegido"}</strong>
                    </span>
                    <span className="text-[11px] text-blue-700">
                      Resta cubrir: <strong>{currency.format(splitRemainingTotal)}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={splitRemainingTotal}
                        value={splitAmountInput}
                        onChange={(e) => setSplitAmountInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-7 pr-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddSplitPayment}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-xs"
                    >
                      <Plus size={14} />
                      Agregar pago
                    </button>
                  </div>

                  {splitError && (
                    <p className="text-[11px] font-semibold text-rose-600">{splitError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Datos condicionales simplificados del método elegido */}
          {isTransferMethod && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-2">
              <span className="font-bold text-slate-800 block">Datos de Transferencia:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                    Cuenta bancaria donde ingresa:
                  </label>
                  <select
                    value={transferDetails.destinationBankAccountId}
                    onChange={(e) =>
                      setTransferDetails((curr) => ({
                        ...curr,
                        destinationBankAccountId: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                  >
                    <option value="">Seleccionar cuenta destino (opcional)</option>
                    {destinationBankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} - {b.account_type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                    Nº de Comprobante / Ref:
                  </label>
                  <input
                    type="text"
                    value={transferDetails.voucherNumber}
                    onChange={(e) =>
                      setTransferDetails((curr) => ({ ...curr, voucherNumber: e.target.value }))
                    }
                    placeholder="Ej: 9842"
                    className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>
            </div>
          )}

          {isCreditCardMethod && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-2">
              <span className="font-bold text-slate-800 block">Datos Tarjeta de Crédito:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                    Plan de cuotas:
                  </label>
                  <select
                    value={cardCreditDetails.installmentPlanId}
                    onChange={(e) =>
                      setCardCreditDetails((curr) => ({ ...curr, installmentPlanId: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                  >
                    <option value="">1 cuota sin interés</option>
                    {availableInstallmentPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} ({plan.installments} cuotas)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                    Nº de cupón:
                  </label>
                  <input
                    type="text"
                    value={cardCreditDetails.couponNumber}
                    onChange={(e) =>
                      setCardCreditDetails((curr) => ({ ...curr, couponNumber: e.target.value }))
                    }
                    placeholder="Nº cupón (opcional)"
                    className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                    Cuenta destino:
                  </label>
                  <select
                    value={cardCreditDetails.destinationBankAccountId}
                    onChange={(e) =>
                      setCardCreditDetails((curr) => ({
                        ...curr,
                        destinationBankAccountId: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                  >
                    <option value="">Cuenta destino (opcional)</option>
                    {destinationBankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} - {b.account_type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {isDebitCardMethod && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-2">
              <span className="font-bold text-slate-800 block">Datos Tarjeta de Débito:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                    Nº de cupón:
                  </label>
                  <input
                    type="text"
                    value={cardDebitDetails.couponNumber}
                    onChange={(e) =>
                      setCardDebitDetails((curr) => ({ ...curr, couponNumber: e.target.value }))
                    }
                    placeholder="Nº cupón (opcional)"
                    className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                    Nº de autorización:
                  </label>
                  <input
                    type="text"
                    value={cardDebitDetails.authorizationNumber}
                    onChange={(e) =>
                      setCardDebitDetails((curr) => ({ ...curr, authorizationNumber: e.target.value }))
                    }
                    placeholder="Nº autorización (opcional)"
                    className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                    Cuenta destino:
                  </label>
                  <select
                    value={cardDebitDetails.destinationBankAccountId}
                    onChange={(e) =>
                      setCardDebitDetails((curr) => ({
                        ...curr,
                        destinationBankAccountId: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                  >
                    <option value="">Cuenta destino (opcional)</option>
                    {destinationBankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} - {b.account_type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {isMercadoPagoManual && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-2">
              <span className="font-bold text-slate-800 block">Mercado Pago (Transferencia / Manual):</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={mercadoPagoManualDetails.operationId}
                  onChange={(e) =>
                    setMercadoPagoManualDetails((curr) => ({ ...curr, operationId: e.target.value }))
                  }
                  placeholder="ID de Operación MP (opcional)"
                  className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                />
                <select
                  value={mercadoPagoManualDetails.destinationBankAccountId}
                  onChange={(e) =>
                    setMercadoPagoManualDetails((curr) => ({
                      ...curr,
                      destinationBankAccountId: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                >
                  <option value="">Cuenta destino (opcional)</option>
                  {destinationBankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} - {b.account_type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {isChequeMethod && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-2">
              <span className="font-bold text-slate-800 block">Datos del Cheque:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={chequeDetails.chequeNumber}
                  onChange={(e) =>
                    setChequeDetails((curr) => ({ ...curr, chequeNumber: e.target.value }))
                  }
                  placeholder="Nº de cheque"
                  className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                />
                <input
                  type="date"
                  value={chequeDetails.dueDate}
                  onChange={(e) =>
                    setChequeDetails((curr) => ({ ...curr, dueDate: e.target.value }))
                  }
                  placeholder="Fecha vencimiento"
                  className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                />
                <input
                  type="text"
                  value={chequeDetails.approvalNumber}
                  onChange={(e) =>
                    setChequeDetails((curr) => ({ ...curr, approvalNumber: e.target.value }))
                  }
                  placeholder="Nº aprobación (opcional)"
                  className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                />
              </div>
            </div>
          )}

          {isCurrentAccountMethod && (
            <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold text-indigo-900">
                <span>Cuenta Corriente del Cliente</span>
                <span>
                  {currentAccountSnapshot?.available != null
                    ? `Disponible: ${currency.format(currentAccountSnapshot.available)}`
                    : "Sin límite"}
                </span>
              </div>
              <p className="text-[11px] text-indigo-700">
                Al confirmar, el monto se registrará como saldo deudor en la cuenta de{" "}
                <strong>{selectedCustomer?.full_name}</strong>.
              </p>
            </div>
          )}

          {isMercadoPagoMethod && !isMercadoPagoManual && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Terminal Mercado Pago:</span>
                <span className="text-[11px] font-semibold text-slate-600">
                  {mercadoPagoIntent ? `Estado: ${mercadoPagoIntent.status}` : "Listo para iniciar"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onStartMercadoPago}
                  disabled={!canStartMercadoPago}
                  className="ui-btn-primary text-xs py-1.5 px-3"
                >
                  {isMercadoPagoLoading ? "Procesando..." : "Iniciar cobro en terminal"}
                </button>
                {mercadoPagoIntent && (
                  <>
                    <button
                      type="button"
                      onClick={onRefreshMercadoPago}
                      className="ui-btn-ghost text-xs py-1.5 px-2.5"
                    >
                      Actualizar
                    </button>
                    <button
                      type="button"
                      onClick={onCancelMercadoPago}
                      className="ui-btn-ghost text-xs py-1.5 px-2.5"
                    >
                      Cancelar
                    </button>
                  </>
                )}
                {mercadoPagoStatus.mode === "mock" && (
                  <>
                    <button
                      type="button"
                      onClick={onApproveMercadoPago}
                      className="ui-btn-ghost text-xs py-1.5 px-2.5"
                    >
                      Aprobar mock
                    </button>
                    <button
                      type="button"
                      onClick={onRejectMercadoPago}
                      className="ui-btn-ghost text-xs py-1.5 px-2.5"
                    >
                      Rechazar mock
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PASO 3: CIERRE FISCAL & FACTURACIÓN */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white shadow-xs">
              3
            </span>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Cierre Fiscal & Facturación
            </h3>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 transition hover:bg-slate-100/70">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <FileText size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">
                    Emitir Factura Electrónica (AFIP)
                  </span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-800">
                    CAE ONLINE
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Sincronización directa con WebServices AFIP / ARCA
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 hidden sm:inline-block">
                {watchedIssueInvoice
                  ? selectedCustomer?.fiscal_condition === "responsable_inscripto"
                    ? "Factura A"
                    : "Factura B Consumidor Final"
                  : "Comprobante X"}
              </span>

              <label className="pos-switch relative inline-flex shrink-0 cursor-pointer items-center">
                <input
                  type="checkbox"
                  {...register("issueInvoice")}
                  className="peer sr-only"
                  disabled={disabled || !canWrite || !isOnline}
                />
                <span className="pos-switch-track">
                  <span className="pos-switch-thumb" />
                </span>
              </label>
            </div>
          </div>
        </div>

        {paymentDetailError && (
          <p className="text-xs font-semibold text-rose-600">{paymentDetailError}</p>
        )}

        {/* FOOTER: Confirmación destacada */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Lock size={12} className="text-emerald-600" />
            <span>Transacción Segura POS Ready</span>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto min-w-[280px] inline-flex items-center justify-between gap-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-5 shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              disabled ||
              !canWrite ||
              !paymentMethods.length ||
              (paymentMode === "split"
                ? !isSplitFullyCovered || splitPayments.length === 0
                : (isCurrentAccountMethod && !canUseCurrentAccountMethod) ||
                  (isMercadoPagoMethod && !isMercadoPagoManual && !isMercadoPagoApproved) ||
                  (requiresPaymentDetails && !arePaymentDetailsReady) ||
                  isCreatingOriginBank)
            }
          >
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                <Check size={13} className="stroke-[3]" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider">
                {paymentMode === "split" ? "Confirmar Venta Combinada" : "Confirmar Venta"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black">
                {currency.format(checkoutTotal)}
              </span>
              <kbd className="hidden sm:inline-block rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-white/80">
                ↵
              </kbd>
            </div>
          </button>
        </div>
      </form>
    </section>
  );
};
