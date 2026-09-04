import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { FileText, Pencil, Plus, Search, X } from "lucide-react";
import type {
  MercadoPagoOperationalStatus,
  MercadoPagoPaymentIntent,
} from "@/services/mercadopago/mercadopago-payments.service";
import { PaymentMethodSelector } from "@/components/payments/PaymentMethodSelector";
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

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

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
  panelId,
  formId,
  layout = "panel",
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
  const [paymentDetailError, setPaymentDetailError] = useState<string | null>(null);
  const [isCreatingOriginBank, setIsCreatingOriginBank] = useState(false);
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

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
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

  useEffect(() => {
    onCustomerChange(watchedCustomerId?.trim() ?? "");
  }, [onCustomerChange, watchedCustomerId]);

  useEffect(() => {
    if (!watchedPaymentMethodId) return;
    onPaymentMethodChange(watchedPaymentMethodId);
  }, [onPaymentMethodChange, watchedPaymentMethodId]);

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
    selectedMethodConfig &&
      (isCreditCardMethod ||
        isDebitCardMethod ||
        isTransferMethod ||
        isMercadoPagoManual ||
        isChequeMethod) &&
      (selectedMethodConfig.ask_destination_bank ||
        selectedMethodConfig.ask_coupon_number ||
        selectedMethodConfig.ask_approval_number ||
        selectedMethodConfig.ask_operation_number ||
        selectedMethodConfig.ask_voucher_number ||
        selectedMethodConfig.ask_origin_bank ||
        selectedMethodConfig.ask_origin_account_holder ||
        selectedMethodConfig.ask_card_brand ||
        selectedMethodConfig.ask_installment_plan ||
        selectedMethodConfig.ask_cheque_number ||
        selectedMethodConfig.ask_cheque_due_date)
  );

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === watchedCustomerId) ?? null,
    [customers, watchedCustomerId]
  );

  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerQuery("");
      return;
    }

    setCustomerQuery(
      `${selectedCustomer.full_name} - ${selectedCustomer.document_type.toUpperCase()} ${
        selectedCustomer.document_number
      }`
    );
  }, [selectedCustomer]);

  const filteredCustomers = useMemo(() => {
    const term = normalizeSearchText(customerQuery);
    const ordered = [...customers].sort((a, b) => a.full_name.localeCompare(b.full_name));

    if (!term) return ordered.slice(0, 10);

    return ordered
      .filter((customer) => {
        const candidate = [
          customer.full_name,
          customer.document_number,
          customer.document_type,
          customer.email ?? "",
          customer.phone ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return candidate.includes(term);
      })
      .slice(0, 10);
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
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [isCustomerMenuOpen]);

  const selectCustomer = useCallback(
    (customer: Customer | null) => {
      if (!customer) {
        setValue("customerId", "", { shouldDirty: true, shouldValidate: true });
        setCustomerQuery("");
        setIsCustomerMenuOpen(false);
        return;
      }

      setValue("customerId", customer.id, { shouldDirty: true, shouldValidate: true });
      setCustomerQuery(
        `${customer.full_name} - ${customer.document_type.toUpperCase()} ${customer.document_number}`
      );
      setIsCustomerMenuOpen(false);
    },
    [setValue]
  );

  const paymentMethodsOrdered = useMemo(
    () =>
      [...paymentMethods].sort((a, b) => {
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
      destinationBankAccounts.find((account) => account.id === cardCreditDetails.destinationBankAccountId) ??
      null,
    [cardCreditDetails.destinationBankAccountId, destinationBankAccounts]
  );

  const selectedDebitDestination = useMemo(
    () =>
      destinationBankAccounts.find((account) => account.id === cardDebitDetails.destinationBankAccountId) ??
      null,
    [cardDebitDetails.destinationBankAccountId, destinationBankAccounts]
  );

  const selectedTransferDestination = useMemo(
    () =>
      destinationBankAccounts.find((account) => account.id === transferDetails.destinationBankAccountId) ??
      null,
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
      destinationBankAccounts.find((account) => account.id === chequeDetails.destinationBankAccountId) ??
      null,
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

  const creditTotalWithInterest = useMemo(() => {
    const interest = selectedInstallmentPlan?.interest_percent ?? 0;
    return Number((checkoutTotal + checkoutTotal * (interest / 100)).toFixed(2));
  }, [checkoutTotal, selectedInstallmentPlan?.interest_percent]);

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
    if (!requiresPaymentDetails || !selectedMethodConfig) return true;

    if (isCreditCardMethod) {
      const hasCoupon = !selectedMethodConfig.ask_coupon_number || Boolean(cardCreditDetails.couponNumber.trim());
      const hasApproval =
        !selectedMethodConfig.ask_approval_number || Boolean(cardCreditDetails.authorizationNumber.trim());
      const hasCardBrand = !selectedMethodConfig.ask_card_brand || Boolean(cardCreditDetails.cardBrand.trim());
      const hasInstallments = !selectedMethodConfig.ask_installment_plan || Boolean(selectedInstallmentPlan);
      const hasDestination = !selectedMethodConfig.ask_destination_bank || Boolean(selectedCreditDestination);
      return hasCoupon && hasApproval && hasCardBrand && hasInstallments && hasDestination;
    }

    if (isDebitCardMethod) {
      const hasCoupon = !selectedMethodConfig.ask_coupon_number || Boolean(cardDebitDetails.couponNumber.trim());
      const hasApproval =
        !selectedMethodConfig.ask_approval_number || Boolean(cardDebitDetails.authorizationNumber.trim());
      const hasDestination = !selectedMethodConfig.ask_destination_bank || Boolean(selectedDebitDestination);
      return hasCoupon && hasApproval && hasDestination;
    }

    if (isTransferMethod) {
      const hasOrigin = !selectedMethodConfig.ask_origin_bank
        ? true
        : transferDetails.originBankId === "__new__"
          ? selectedMethodConfig.allow_new_origin_bank && Boolean(transferDetails.newOriginBankName.trim())
          : Boolean(transferDetails.originBankId.trim());
      const hasVoucher =
        !selectedMethodConfig.ask_voucher_number || Boolean(transferDetails.voucherNumber.trim());
      const hasOriginHolder =
        !selectedMethodConfig.ask_origin_account_holder ||
        Boolean(transferDetails.originAccountHolder.trim());
      const hasDestination = !selectedMethodConfig.ask_destination_bank || Boolean(selectedTransferDestination);
      return hasOrigin && hasVoucher && hasOriginHolder && hasDestination;
    }

    if (isMercadoPagoManual) {
      const hasOperation =
        !selectedMethodConfig.ask_operation_number || Boolean(mercadoPagoManualDetails.operationId.trim());
      const hasDestination = !selectedMethodConfig.ask_destination_bank || Boolean(selectedManualMpDestination);
      return hasOperation && hasDestination;
    }

    if (isChequeMethod) {
      const hasOrigin = !selectedMethodConfig.ask_origin_bank
        ? true
        : chequeDetails.originBankId === "__new__"
          ? selectedMethodConfig.allow_new_origin_bank && Boolean(chequeDetails.newOriginBankName.trim())
          : Boolean(chequeDetails.originBankId.trim());
      const hasOriginHolder =
        !selectedMethodConfig.ask_origin_account_holder ||
        Boolean(chequeDetails.originAccountHolder.trim());
      const hasChequeNumber =
        !selectedMethodConfig.ask_cheque_number || Boolean(chequeDetails.chequeNumber.trim());
      const hasDueDate = !selectedMethodConfig.ask_cheque_due_date || Boolean(chequeDetails.dueDate.trim());
      const hasApproval =
        !selectedMethodConfig.ask_approval_number || Boolean(chequeDetails.approvalNumber.trim());
      const hasDestination = !selectedMethodConfig.ask_destination_bank || Boolean(selectedChequeDestination);
      return hasOrigin && hasOriginHolder && hasChequeNumber && hasDueDate && hasApproval && hasDestination;
    }

    return true;
  }, [
    chequeDetails.approvalNumber,
    chequeDetails.chequeNumber,
    chequeDetails.destinationBankAccountId,
    chequeDetails.dueDate,
    chequeDetails.newOriginBankName,
    chequeDetails.originAccountHolder,
    chequeDetails.originBankId,
    cardCreditDetails.authorizationNumber,
    cardCreditDetails.cardBrand,
    cardCreditDetails.couponNumber,
    cardDebitDetails.authorizationNumber,
    cardDebitDetails.couponNumber,
    isCreditCardMethod,
    isDebitCardMethod,
    isChequeMethod,
    isMercadoPagoManual,
    isTransferMethod,
    mercadoPagoManualDetails.operationId,
    requiresPaymentDetails,
    selectedMethodConfig,
    selectedChequeDestination,
    selectedCreditDestination,
    selectedDebitDestination,
    selectedInstallmentPlan,
    selectedManualMpDestination,
    selectedTransferDestination,
    transferDetails.newOriginBankName,
    transferDetails.originAccountHolder,
    transferDetails.originBankId,
    transferDetails.voucherNumber,
  ]);

  const buildPaymentDetailsPayload = useCallback(async () => {
    if (!requiresPaymentDetails || !selectedMethod || !selectedMethodConfig) {
      return { ok: true as const, payload: null as Record<string, unknown> | null };
    }

    const capturedAt = new Date().toISOString();

    if (isCreditCardMethod) {
      if (selectedMethodConfig.ask_installment_plan && !selectedInstallmentPlan) {
        return { ok: false as const, error: "Selecciona un plan de cuotas." };
      }
      if (selectedMethodConfig.ask_destination_bank && !selectedCreditDestination) {
        return { ok: false as const, error: "Selecciona una cuenta bancaria destino." };
      }
      if (selectedMethodConfig.ask_coupon_number && !cardCreditDetails.couponNumber.trim()) {
        return {
          ok: false as const,
          error: "Completa numero de cupon para tarjeta de credito.",
        };
      }
      if (selectedMethodConfig.ask_approval_number && !cardCreditDetails.authorizationNumber.trim()) {
        return {
          ok: false as const,
          error: "Completa numero de autorizacion para tarjeta de credito.",
        };
      }
      if (selectedMethodConfig.ask_card_brand && !cardCreditDetails.cardBrand.trim()) {
        return {
          ok: false as const,
          error: "Completa la marca de la tarjeta.",
        };
      }

      return {
        ok: true as const,
        payload: {
          kind: "card_credit",
          captured_at: capturedAt,
          coupon_number: cardCreditDetails.couponNumber.trim() || null,
          authorization_number: cardCreditDetails.authorizationNumber.trim() || null,
          card_brand: cardCreditDetails.cardBrand.trim() || null,
          installment_plan_id: selectedInstallmentPlan?.id ?? null,
          installment_plan_name: selectedInstallmentPlan?.name ?? null,
          installments: selectedInstallmentPlan?.installments ?? null,
          interest_percent: selectedInstallmentPlan?.interest_percent ?? null,
          base_amount: checkoutTotal,
          total_amount_with_interest: creditTotalWithInterest,
          destination_account_id: selectedCreditDestination?.id ?? null,
          destination_account_bank: selectedCreditDestination?.bank_name ?? null,
          destination_account_alias: selectedCreditDestination?.alias ?? null,
        } satisfies Record<string, unknown>,
      };
    }

    if (isDebitCardMethod) {
      if (selectedMethodConfig.ask_destination_bank && !selectedDebitDestination) {
        return { ok: false as const, error: "Selecciona una cuenta bancaria destino." };
      }
      if (selectedMethodConfig.ask_coupon_number && !cardDebitDetails.couponNumber.trim()) {
        return {
          ok: false as const,
          error: "Completa numero de cupon para tarjeta de debito.",
        };
      }
      if (selectedMethodConfig.ask_approval_number && !cardDebitDetails.authorizationNumber.trim()) {
        return {
          ok: false as const,
          error: "Completa numero de autorizacion para tarjeta de debito.",
        };
      }

      return {
        ok: true as const,
        payload: {
          kind: "card_debit",
          captured_at: capturedAt,
          coupon_number: cardDebitDetails.couponNumber.trim() || null,
          authorization_number: cardDebitDetails.authorizationNumber.trim() || null,
          destination_account_id: selectedDebitDestination?.id ?? null,
          destination_account_bank: selectedDebitDestination?.bank_name ?? null,
          destination_account_alias: selectedDebitDestination?.alias ?? null,
        } satisfies Record<string, unknown>,
      };
    }

    if (isTransferMethod) {
      if (selectedMethodConfig.ask_destination_bank && !selectedTransferDestination) {
        return { ok: false as const, error: "Selecciona una cuenta bancaria destino." };
      }

      let selectedOriginBank =
        originBanks.find((bank) => bank.id === transferDetails.originBankId) ?? null;

      if (selectedMethodConfig.ask_origin_bank && transferDetails.originBankId === "__new__") {
        if (!selectedMethodConfig.allow_new_origin_bank) {
          return { ok: false as const, error: "No esta habilitada la creacion de banco de origen." };
        }

        const newName = transferDetails.newOriginBankName.trim();
        if (!newName) {
          return { ok: false as const, error: "Ingresa el nombre del banco de origen nuevo." };
        }

        setIsCreatingOriginBank(true);
        try {
          const created = await onCreateOriginBank(newName);
          if (!created) {
            return { ok: false as const, error: "No se pudo crear el banco de origen." };
          }
          selectedOriginBank = created;
          setTransferDetails((current) => ({
            ...current,
            originBankId: created.id,
            newOriginBankName: "",
          }));
        } finally {
          setIsCreatingOriginBank(false);
        }
      }

      if (selectedMethodConfig.ask_origin_bank && !selectedOriginBank) {
        return { ok: false as const, error: "Selecciona banco de origen." };
      }
      if (selectedMethodConfig.ask_voucher_number && !transferDetails.voucherNumber.trim()) {
        return {
          ok: false as const,
          error: "Completa numero de comprobante.",
        };
      }
      if (
        selectedMethodConfig.ask_origin_account_holder &&
        !transferDetails.originAccountHolder.trim()
      ) {
        return {
          ok: false as const,
          error: "Completa titular de cuenta origen.",
        };
      }

      return {
        ok: true as const,
        payload: {
          kind: "transfer",
          captured_at: capturedAt,
          origin_bank_id: selectedOriginBank?.id ?? null,
          origin_bank_name: selectedOriginBank?.name ?? null,
          voucher_number: transferDetails.voucherNumber.trim() || null,
          origin_account_holder: transferDetails.originAccountHolder.trim() || null,
          destination_account_id: selectedTransferDestination?.id ?? null,
          destination_account_bank: selectedTransferDestination?.bank_name ?? null,
          destination_account_alias: selectedTransferDestination?.alias ?? null,
        } satisfies Record<string, unknown>,
      };
    }

    if (isChequeMethod) {
      if (selectedMethodConfig.ask_destination_bank && !selectedChequeDestination) {
        return { ok: false as const, error: "Selecciona una cuenta bancaria destino." };
      }

      let selectedOriginBank =
        originBanks.find((bank) => bank.id === chequeDetails.originBankId) ?? null;

      if (selectedMethodConfig.ask_origin_bank && chequeDetails.originBankId === "__new__") {
        if (!selectedMethodConfig.allow_new_origin_bank) {
          return { ok: false as const, error: "No esta habilitada la creacion de banco de origen." };
        }

        const newName = chequeDetails.newOriginBankName.trim();
        if (!newName) {
          return { ok: false as const, error: "Ingresa el nombre del banco de origen nuevo." };
        }

        setIsCreatingOriginBank(true);
        try {
          const created = await onCreateOriginBank(newName);
          if (!created) {
            return { ok: false as const, error: "No se pudo crear el banco de origen." };
          }
          selectedOriginBank = created;
          setChequeDetails((current) => ({
            ...current,
            originBankId: created.id,
            newOriginBankName: "",
          }));
        } finally {
          setIsCreatingOriginBank(false);
        }
      }

      if (selectedMethodConfig.ask_origin_bank && !selectedOriginBank) {
        return { ok: false as const, error: "Selecciona banco de origen del cheque." };
      }
      if (selectedMethodConfig.ask_cheque_number && !chequeDetails.chequeNumber.trim()) {
        return { ok: false as const, error: "Completa numero de cheque." };
      }
      if (selectedMethodConfig.ask_cheque_due_date && !chequeDetails.dueDate.trim()) {
        return { ok: false as const, error: "Completa fecha de vencimiento del cheque." };
      }
      if (
        selectedMethodConfig.ask_origin_account_holder &&
        !chequeDetails.originAccountHolder.trim()
      ) {
        return { ok: false as const, error: "Completa titular emisor del cheque." };
      }
      if (selectedMethodConfig.ask_approval_number && !chequeDetails.approvalNumber.trim()) {
        return { ok: false as const, error: "Completa numero de aprobacion del cheque." };
      }

      return {
        ok: true as const,
        payload: {
          kind: "cheque",
          captured_at: capturedAt,
          cheque_number: chequeDetails.chequeNumber.trim() || null,
          due_date: chequeDetails.dueDate.trim() || null,
          approval_number: chequeDetails.approvalNumber.trim() || null,
          origin_bank_id: selectedOriginBank?.id ?? null,
          origin_bank_name: selectedOriginBank?.name ?? null,
          origin_account_holder: chequeDetails.originAccountHolder.trim() || null,
          destination_account_id: selectedChequeDestination?.id ?? null,
          destination_account_bank: selectedChequeDestination?.bank_name ?? null,
          destination_account_alias: selectedChequeDestination?.alias ?? null,
        } satisfies Record<string, unknown>,
      };
    }

    if (isMercadoPagoManual) {
      if (selectedMethodConfig.ask_destination_bank && !selectedManualMpDestination) {
        return { ok: false as const, error: "Selecciona una cuenta bancaria destino." };
      }
      if (selectedMethodConfig.ask_operation_number && !mercadoPagoManualDetails.operationId.trim()) {
        return { ok: false as const, error: "Completa el ID de operacion de Mercado Pago." };
      }

      return {
        ok: true as const,
        payload: {
          kind: "mercado_pago_manual",
          captured_at: capturedAt,
          operation_id: mercadoPagoManualDetails.operationId.trim() || null,
          destination_account_id: selectedManualMpDestination?.id ?? null,
          destination_account_bank: selectedManualMpDestination?.bank_name ?? null,
          destination_account_alias: selectedManualMpDestination?.alias ?? null,
        } satisfies Record<string, unknown>,
      };
    }

    return { ok: true as const, payload: null as Record<string, unknown> | null };
  }, [
    chequeDetails.approvalNumber,
    chequeDetails.chequeNumber,
    chequeDetails.dueDate,
    chequeDetails.newOriginBankName,
    chequeDetails.originAccountHolder,
    chequeDetails.originBankId,
    cardCreditDetails.authorizationNumber,
    cardCreditDetails.cardBrand,
    cardCreditDetails.couponNumber,
    cardDebitDetails.authorizationNumber,
    cardDebitDetails.couponNumber,
    checkoutTotal,
    creditTotalWithInterest,
    isCreditCardMethod,
    isDebitCardMethod,
    isChequeMethod,
    isMercadoPagoManual,
    isTransferMethod,
    mercadoPagoManualDetails.operationId,
    onCreateOriginBank,
    originBanks,
    requiresPaymentDetails,
    selectedCreditDestination,
    selectedDebitDestination,
    selectedInstallmentPlan,
    selectedManualMpDestination,
    selectedMethod,
    selectedMethodConfig,
    selectedChequeDestination,
    selectedTransferDestination,
    transferDetails.newOriginBankName,
    transferDetails.originAccountHolder,
    transferDetails.originBankId,
    transferDetails.voucherNumber,
  ]);

  const submit = async (values: PosCheckoutValues) => {
    setPaymentDetailError(null);

    let paymentDetailsPayload: Record<string, unknown> | null = null;
    if (requiresPaymentDetails) {
      const built = await buildPaymentDetailsPayload();
      if (!built.ok) {
        setPaymentDetailError(built.error ?? "Faltan datos del medio de pago.");
        return;
      }
      paymentDetailsPayload = built.payload ?? null;
    }

    await onSubmit({
      ...values,
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

  const mercadoPagoBadgeClass = (status: MercadoPagoPaymentIntent["status"]) => {
    if (status === "approved") return "ui-badge ui-badge--success";
    if (status === "pending") return "ui-badge ui-badge--warn";
    return "ui-badge ui-badge--danger";
  };

  const mercadoPagoModeBadgeClass = useMemo(() => {
    if (mercadoPagoStatus.mode === "mock") return "ui-badge ui-badge--info";
    if (mercadoPagoStatus.mode === "sandbox") return "ui-badge ui-badge--warn";
    if (mercadoPagoStatus.mode === "real") return "ui-badge ui-badge--success";
    return "ui-badge ui-badge--danger";
  }, [mercadoPagoStatus.mode]);

  const mercadoPagoModeLabel = useMemo(() => {
    if (mercadoPagoStatus.mode === "mock") return "Mock";
    if (mercadoPagoStatus.mode === "sandbox") return "Sandbox";
    if (mercadoPagoStatus.mode === "real") return "Real";
    return "No configurado";
  }, [mercadoPagoStatus.mode]);

  const customerActionLabel = selectedCustomer ? "Editar cliente" : "Nuevo cliente";
  const isModalLayout = layout === "modal";

  const paymentDetailsSummary = useMemo(() => {
    if (!requiresPaymentDetails || !selectedMethodConfig) return null;

    if (isCreditCardMethod) {
      if (!arePaymentDetailsReady) {
        return "Completa los datos de tarjeta de credito.";
      }
      const details: string[] = [];
      if (selectedMethodConfig.ask_installment_plan && selectedInstallmentPlan) {
        details.push(
          `${selectedInstallmentPlan.installments} cuotas (${selectedInstallmentPlan.interest_percent.toFixed(2)}%)`
        );
      }
      if (selectedMethodConfig.ask_destination_bank && selectedCreditDestination) {
        details.push(selectedCreditDestination.bank_name);
      }
      return details.length ? details.join(" | ") : "Tarjeta de credito configurada";
    }

    if (isDebitCardMethod) {
      if (!arePaymentDetailsReady) {
        return "Completa los datos de tarjeta de debito.";
      }
      const details: string[] = [];
      if (selectedMethodConfig.ask_coupon_number) {
        details.push(`Cupon ${cardDebitDetails.couponNumber.trim()}`);
      }
      if (selectedMethodConfig.ask_destination_bank && selectedDebitDestination) {
        details.push(selectedDebitDestination.bank_name);
      }
      return details.length ? details.join(" | ") : "Tarjeta de debito configurada";
    }

    if (isTransferMethod) {
      if (!arePaymentDetailsReady) {
        return "Completa los datos de transferencia.";
      }
      const details: string[] = [];
      if (selectedMethodConfig.ask_voucher_number) {
        details.push(`Comprobante ${transferDetails.voucherNumber.trim()}`);
      }
      if (selectedMethodConfig.ask_destination_bank && selectedTransferDestination) {
        details.push(selectedTransferDestination.bank_name);
      }
      return details.length ? details.join(" | ") : "Transferencia configurada";
    }

    if (isChequeMethod) {
      if (!arePaymentDetailsReady) {
        return "Completa los datos del cheque.";
      }
      const details: string[] = [];
      if (selectedMethodConfig.ask_cheque_number) {
        details.push(`Cheque ${chequeDetails.chequeNumber.trim()}`);
      }
      if (selectedMethodConfig.ask_cheque_due_date) {
        details.push(`Vence ${chequeDetails.dueDate.trim()}`);
      }
      if (selectedMethodConfig.ask_destination_bank && selectedChequeDestination) {
        details.push(selectedChequeDestination.bank_name);
      }
      return details.length ? details.join(" | ") : "Cheque configurado";
    }



    if (isMercadoPagoManual) {
      if (!arePaymentDetailsReady) {
        return "Completa los datos manuales de Mercado Pago.";
      }
      const details: string[] = [];
      if (selectedMethodConfig.ask_operation_number) {
        details.push(`Operacion ${mercadoPagoManualDetails.operationId.trim()}`);
      }
      if (selectedMethodConfig.ask_destination_bank && selectedManualMpDestination) {
        details.push(selectedManualMpDestination.bank_name);
      }
      return details.length ? details.join(" | ") : "Mercado Pago manual configurado";
    }

    return null;
  }, [
    arePaymentDetailsReady,
    chequeDetails.chequeNumber,
    chequeDetails.dueDate,
    cardDebitDetails.couponNumber,
    isCreditCardMethod,
    isDebitCardMethod,
    isChequeMethod,
    isMercadoPagoManual,
    isTransferMethod,
    mercadoPagoManualDetails.operationId,
    requiresPaymentDetails,
    selectedMethodConfig,
    selectedChequeDestination,
    selectedCreditDestination,
    selectedDebitDestination,
    selectedInstallmentPlan,
    selectedManualMpDestination,
    selectedTransferDestination,
    transferDetails.voucherNumber,
  ]);

  return (
    <section id={panelId} className={isModalLayout ? "space-y-4" : "pos-surface space-y-4"}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {isModalLayout ? "Confirmar venta" : "Checkout"}
          </h2>
          {isModalLayout ? (
            <p className="text-xs text-slate-500">Elegí cliente, medio de pago y datos contables.</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-kpi text-2xl font-black text-blue-700 dark:text-blue-400">
            {new Intl.NumberFormat("es-AR", {
              style: "currency",
              currency: "ARS",
              maximumFractionDigits: 2,
            }).format(checkoutTotal)}
          </span>
          {onClose ? (
            <button
              type="button"
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:text-slate-300 transition"
              onClick={onClose}
              title="Cerrar ventana"
            >
              <X size={20} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60">
        <div className="min-w-0">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente</span>
          <span className="mt-0.5 block truncate font-semibold text-slate-800 dark:text-slate-200">
            {selectedCustomer?.full_name ?? "Consumidor final"}
          </span>
        </div>
        <div className="min-w-0">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Medio de pago</span>
          <span className="mt-0.5 block truncate font-semibold text-slate-800 dark:text-slate-200">
            {selectedMethod ? selectedMethod.name : "No seleccionado"}
          </span>
        </div>
        <div className="text-right min-w-0">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
          <span className="mt-0.5 block font-bold text-blue-700 dark:text-blue-400 text-sm">
            {new Intl.NumberFormat("es-AR", {
              style: "currency",
              currency: "ARS",
              maximumFractionDigits: 2,
            }).format(checkoutTotal)}
          </span>
        </div>
      </div>

      <form id={formId} className="grid gap-4" onSubmit={handleSubmit(submit)}>
        <input type="hidden" {...register("customerId")} />
        <input type="hidden" {...register("paymentMethodId")} />

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Cliente
          </label>
          <div className="relative" ref={customerLookupRef} data-customer-lookup="true">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  value={customerQuery}
                  onChange={(event) => {
                    setCustomerQuery(event.target.value);
                    setIsCustomerMenuOpen(true);
                  }}
                  onFocus={() => setIsCustomerMenuOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setIsCustomerMenuOpen(false);
                      return;
                    }

                    if (event.key === "Enter") {
                      if (!isCustomerMenuOpen) return;
                      event.preventDefault();

                      if (filteredCustomers.length) {
                        selectCustomer(filteredCustomers[0]);
                        return;
                      }

                      selectCustomer(null);
                    }
                  }}
                  placeholder="Buscar cliente por nombre o DNI..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  disabled={disabled || !canWrite}
                />
              </div>
              <button
                type="button"
                title={customerActionLabel}
                aria-label={customerActionLabel}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                disabled={disabled || !canWrite || !canManageCustomers}
                onClick={() => onOpenCustomerModal(selectedCustomer ?? null)}
              >
                {selectedCustomer ? (
                  <Pencil size={15} />
                ) : (
                  <Plus size={16} />
                )}
              </button>
            </div>

            {isCustomerMenuOpen ? (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white p-1.5 shadow-panel">
                <button
                  type="button"
                  className="ui-btn-ghost w-full justify-start px-2 py-1.5 text-xs"
                  onClick={() => selectCustomer(null)}
                >
                  Consumidor final (sin cliente)
                </button>
                {filteredCustomers.length ? (
                  filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className="ui-btn-ghost w-full justify-start px-2 py-1.5 text-xs"
                      onClick={() => selectCustomer(customer)}
                    >
                      <span className="truncate">{customer.full_name}</span>
                      <span className="ml-auto text-slate-500">{customer.document_number}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-1.5 text-xs text-slate-500">Sin coincidencias</p>
                )}
              </div>
            ) : null}
          </div>
          {errors.customerId ? <p className="mt-1 text-xs text-red-600">{errors.customerId.message}</p> : null}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Medio de pago
          </label>
          <PaymentMethodSelector
            paymentMethods={paymentMethodsOrdered}
            selectedPaymentMethodId={watchedPaymentMethodId}
            disabled={disabled || !canWrite}
            columns={isModalLayout ? 3 : 2}
            isMethodDisabled={(method) => {
              const isCurrentAccount = normalizePaymentMethodCode(method.code) === "current_account";
              return isCurrentAccount && (!canUseCurrentAccount || !isCurrentAccountEnabled || isCurrentAccountNoFunds);
            }}
            getMethodBadges={(method) => {
              const isCurrentAccount = normalizePaymentMethodCode(method.code) === "current_account";
              if (!isCurrentAccount) return [];
              if (!canUseCurrentAccount) return ["Requiere cliente"];
              if (!isCurrentAccountEnabled) return ["Credito deshabilitado"];
              if (isCurrentAccountNoFunds) return ["Sin fondo"];
              return [];
            }}
            onChange={(methodId) => {
              setValue("paymentMethodId", methodId, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          />
          {errors.paymentMethodId ? (
            <p className="mt-1 text-xs text-red-600">{errors.paymentMethodId.message}</p>
          ) : null}
        </div>

        {isCurrentAccountMethod ? (
          <div className="rounded-xl bg-slate-50 p-3">
            {!canUseCurrentAccount || !currentAccountSnapshot ? (
              <p className="text-xs text-amber-700">
                Selecciona un cliente para operar con cuenta corriente.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700">Estado de cuenta corriente</p>
                  <span
                    className={
                      !currentAccountSnapshot.enabled
                        ? "ui-badge ui-badge--danger"
                        : isCurrentAccountNoFunds
                          ? "ui-badge ui-badge--warn"
                          : "ui-badge ui-badge--success"
                    }
                  >
                    {!currentAccountSnapshot.enabled
                      ? "Deshabilitada"
                      : isCurrentAccountNoFunds
                        ? "Sin fondo"
                        : "Habilitada"}
                  </span>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-3">
                  <p className="rounded-lg bg-white px-2.5 py-2 text-slate-600">
                    <span className="block text-[11px] text-slate-500">Limite</span>
                    <span className="font-medium text-slate-900">
                      {currentAccountSnapshot.limit == null
                        ? "Sin limite"
                        : new Intl.NumberFormat("es-AR", {
                            style: "currency",
                            currency: "ARS",
                            maximumFractionDigits: 2,
                          }).format(currentAccountSnapshot.limit)}
                    </span>
                  </p>
                  <p className="rounded-lg bg-white px-2.5 py-2 text-slate-600">
                    <span className="block text-[11px] text-slate-500">Deuda actual</span>
                    <span className="font-medium text-slate-900">
                      {new Intl.NumberFormat("es-AR", {
                        style: "currency",
                        currency: "ARS",
                        maximumFractionDigits: 2,
                      }).format(currentAccountSnapshot.debt)}
                    </span>
                  </p>
                  <p className="rounded-lg bg-white px-2.5 py-2 text-slate-600">
                    <span className="block text-[11px] text-slate-500">Disponible</span>
                    <span className="font-medium text-slate-900">
                      {currentAccountSnapshot.available == null
                        ? "Sin tope"
                        : new Intl.NumberFormat("es-AR", {
                            style: "currency",
                            currency: "ARS",
                            maximumFractionDigits: 2,
                          }).format(currentAccountSnapshot.available)}
                    </span>
                  </p>
                </div>
                {!currentAccountSnapshot.enabled ? (
                  <p className="text-xs text-red-600">
                    La cuenta corriente del cliente esta deshabilitada. Activalo desde editar cliente.
                  </p>
                ) : null}
                {currentAccountSnapshot.enabled && isCurrentAccountNoFunds ? (
                  <p className="text-xs text-amber-700">
                    El cliente alcanzo o supero su limite disponible. No se puede cobrar por cuenta corriente.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {requiresPaymentDetails ? (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">Datos contables del cobro</p>
            <p className="text-xs text-slate-600">
              {paymentDetailsSummary ?? "Completa los datos para registrar correctamente este medio."}
            </p>

            {isCreditCardMethod ? (
              <div className="grid gap-2">
                {selectedMethodConfig?.ask_card_brand ? (
                  <input
                    className="ui-input"
                    value={cardCreditDetails.cardBrand}
                    onChange={(event) =>
                      setCardCreditDetails((current) => ({
                        ...current,
                        cardBrand: event.target.value,
                        installmentPlanId: "",
                      }))
                    }
                    placeholder="Tarjeta (Visa, Master, Amex...)"
                    disabled={disabled || !canWrite}
                  />
                ) : null}
                {selectedMethodConfig?.ask_installment_plan ? (
                  <select
                    className="ui-input"
                    value={cardCreditDetails.installmentPlanId}
                    onChange={(event) =>
                      setCardCreditDetails((current) => ({
                        ...current,
                        installmentPlanId: event.target.value,
                      }))
                    }
                    disabled={disabled || !canWrite}
                  >
                    <option value="">Plan de cuotas</option>
                    {availableInstallmentPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} | {plan.installments} cuotas | {plan.interest_percent.toFixed(2)}%
                      </option>
                    ))}
                  </select>
                ) : null}
                {selectedMethodConfig?.ask_coupon_number || selectedMethodConfig?.ask_approval_number ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedMethodConfig?.ask_coupon_number ? (
                      <input
                        className="ui-input"
                        value={cardCreditDetails.couponNumber}
                        onChange={(event) =>
                          setCardCreditDetails((current) => ({
                            ...current,
                            couponNumber: event.target.value,
                          }))
                        }
                        placeholder="Numero de cupon"
                        disabled={disabled || !canWrite}
                      />
                    ) : null}
                    {selectedMethodConfig?.ask_approval_number ? (
                      <input
                        className="ui-input"
                        value={cardCreditDetails.authorizationNumber}
                        onChange={(event) =>
                          setCardCreditDetails((current) => ({
                            ...current,
                            authorizationNumber: event.target.value,
                          }))
                        }
                        placeholder="Numero de autorizacion"
                        disabled={disabled || !canWrite}
                      />
                    ) : null}
                  </div>
                ) : null}
                {selectedMethodConfig?.ask_destination_bank ? (
                  <select
                    className="ui-input"
                    value={cardCreditDetails.destinationBankAccountId}
                    onChange={(event) =>
                      setCardCreditDetails((current) => ({
                        ...current,
                        destinationBankAccountId: event.target.value,
                      }))
                    }
                    disabled={disabled || !canWrite}
                  >
                    <option value="">Cuenta bancaria destino</option>
                    {destinationBankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bank_name} | {account.alias || account.holder_name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {selectedMethodConfig?.ask_installment_plan && selectedInstallmentPlan ? (
                  <p className="text-xs text-slate-500">
                    Interes aplicado: {selectedInstallmentPlan.interest_percent.toFixed(2)}% | Importe credito:{" "}
                    {new Intl.NumberFormat("es-AR", {
                      style: "currency",
                      currency: "ARS",
                      maximumFractionDigits: 2,
                    }).format(creditTotalWithInterest)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {isDebitCardMethod ? (
              <div className="grid gap-2">
                {selectedMethodConfig?.ask_coupon_number || selectedMethodConfig?.ask_approval_number ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedMethodConfig?.ask_coupon_number ? (
                      <input
                        className="ui-input"
                        value={cardDebitDetails.couponNumber}
                        onChange={(event) =>
                          setCardDebitDetails((current) => ({
                            ...current,
                            couponNumber: event.target.value,
                          }))
                        }
                        placeholder="Numero de cupon"
                        disabled={disabled || !canWrite}
                      />
                    ) : null}
                    {selectedMethodConfig?.ask_approval_number ? (
                      <input
                        className="ui-input"
                        value={cardDebitDetails.authorizationNumber}
                        onChange={(event) =>
                          setCardDebitDetails((current) => ({
                            ...current,
                            authorizationNumber: event.target.value,
                          }))
                        }
                        placeholder="Numero de autorizacion"
                        disabled={disabled || !canWrite}
                      />
                    ) : null}
                  </div>
                ) : null}
                {selectedMethodConfig?.ask_destination_bank ? (
                  <select
                    className="ui-input"
                    value={cardDebitDetails.destinationBankAccountId}
                    onChange={(event) =>
                      setCardDebitDetails((current) => ({
                        ...current,
                        destinationBankAccountId: event.target.value,
                      }))
                    }
                    disabled={disabled || !canWrite}
                  >
                    <option value="">Cuenta bancaria destino</option>
                    {destinationBankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bank_name} | {account.alias || account.holder_name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ) : null}

            {isTransferMethod ? (
              <div className="grid gap-2">
                {selectedMethodConfig?.ask_origin_bank ? (
                  <select
                    className="ui-input"
                    value={transferDetails.originBankId}
                    onChange={(event) =>
                      setTransferDetails((current) => ({
                        ...current,
                        originBankId: event.target.value,
                      }))
                    }
                    disabled={disabled || !canWrite || isCreatingOriginBank}
                  >
                    <option value="">Banco de origen</option>
                    {originBanks.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.name}
                      </option>
                    ))}
                    {selectedMethodConfig?.allow_new_origin_bank ? (
                      <option value="__new__">+ Agregar banco de origen</option>
                    ) : null}
                  </select>
                ) : null}
                {selectedMethodConfig?.ask_origin_bank &&
                selectedMethodConfig?.allow_new_origin_bank &&
                transferDetails.originBankId === "__new__" ? (
                  <input
                    className="ui-input"
                    value={transferDetails.newOriginBankName}
                    onChange={(event) =>
                      setTransferDetails((current) => ({
                        ...current,
                        newOriginBankName: event.target.value,
                      }))
                    }
                    placeholder="Nuevo banco de origen"
                    disabled={disabled || !canWrite || isCreatingOriginBank}
                  />
                ) : null}
                {selectedMethodConfig?.ask_voucher_number ||
                selectedMethodConfig?.ask_origin_account_holder ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedMethodConfig?.ask_voucher_number ? (
                      <input
                        className="ui-input"
                        value={transferDetails.voucherNumber}
                        onChange={(event) =>
                          setTransferDetails((current) => ({
                            ...current,
                            voucherNumber: event.target.value,
                          }))
                        }
                        placeholder="Numero de comprobante"
                        disabled={disabled || !canWrite}
                      />
                    ) : null}
                    {selectedMethodConfig?.ask_origin_account_holder ? (
                      <input
                        className="ui-input"
                        value={transferDetails.originAccountHolder}
                        onChange={(event) =>
                          setTransferDetails((current) => ({
                            ...current,
                            originAccountHolder: event.target.value,
                          }))
                        }
                        placeholder="Titular cuenta origen"
                        disabled={disabled || !canWrite}
                      />
                    ) : null}
                  </div>
                ) : null}
                {selectedMethodConfig?.ask_destination_bank ? (
                  <select
                    className="ui-input"
                    value={transferDetails.destinationBankAccountId}
                    onChange={(event) =>
                      setTransferDetails((current) => ({
                        ...current,
                        destinationBankAccountId: event.target.value,
                      }))
                    }
                    disabled={disabled || !canWrite}
                  >
                    <option value="">Cuenta bancaria destino</option>
                    {destinationBankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bank_name} | {account.alias || account.holder_name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {selectedMethodConfig?.ask_destination_bank && selectedTransferDestination ? (
                  <p className="text-xs text-slate-500">
                    Alias destino: {selectedTransferDestination.alias || "Sin alias"}
                  </p>
                ) : null}
              </div>
            ) : null}

            {isChequeMethod ? (
              <div className="grid gap-2">
                {selectedMethodConfig?.ask_origin_bank ? (
                  <select
                    className="ui-input"
                    value={chequeDetails.originBankId}
                    onChange={(event) =>
                      setChequeDetails((current) => ({
                        ...current,
                        originBankId: event.target.value,
                      }))
                    }
                    disabled={disabled || !canWrite || isCreatingOriginBank}
                  >
                    <option value="">Banco emisor</option>
                    {originBanks.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.name}
                      </option>
                    ))}
                    {selectedMethodConfig?.allow_new_origin_bank ? (
                      <option value="__new__">+ Agregar banco emisor</option>
                    ) : null}
                  </select>
                ) : null}
                {selectedMethodConfig?.ask_origin_bank &&
                selectedMethodConfig?.allow_new_origin_bank &&
                chequeDetails.originBankId === "__new__" ? (
                  <input
                    className="ui-input"
                    value={chequeDetails.newOriginBankName}
                    onChange={(event) =>
                      setChequeDetails((current) => ({
                        ...current,
                        newOriginBankName: event.target.value,
                      }))
                    }
                    placeholder="Nuevo banco emisor"
                    disabled={disabled || !canWrite || isCreatingOriginBank}
                  />
                ) : null}
                {selectedMethodConfig?.ask_cheque_number ||
                selectedMethodConfig?.ask_cheque_due_date ||
                selectedMethodConfig?.ask_approval_number ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {selectedMethodConfig?.ask_cheque_number ? (
                      <input
                        className="ui-input"
                        value={chequeDetails.chequeNumber}
                        onChange={(event) =>
                          setChequeDetails((current) => ({
                            ...current,
                            chequeNumber: event.target.value,
                          }))
                        }
                        placeholder="Numero de cheque"
                        disabled={disabled || !canWrite}
                      />
                    ) : null}
                    {selectedMethodConfig?.ask_cheque_due_date ? (
                      <input
                        type="date"
                        className="ui-input"
                        value={chequeDetails.dueDate}
                        onChange={(event) =>
                          setChequeDetails((current) => ({
                            ...current,
                            dueDate: event.target.value,
                          }))
                        }
                        disabled={disabled || !canWrite}
                      />
                    ) : null}
                    {selectedMethodConfig?.ask_approval_number ? (
                      <input
                        className="ui-input"
                        value={chequeDetails.approvalNumber}
                        onChange={(event) =>
                          setChequeDetails((current) => ({
                            ...current,
                            approvalNumber: event.target.value,
                          }))
                        }
                        placeholder="Aprobacion / clearing"
                        disabled={disabled || !canWrite}
                      />
                    ) : null}
                  </div>
                ) : null}
                {selectedMethodConfig?.ask_origin_account_holder ? (
                  <input
                    className="ui-input"
                    value={chequeDetails.originAccountHolder}
                    onChange={(event) =>
                      setChequeDetails((current) => ({
                        ...current,
                        originAccountHolder: event.target.value,
                      }))
                    }
                    placeholder="Titular emisor"
                    disabled={disabled || !canWrite}
                  />
                ) : null}
                {selectedMethodConfig?.ask_destination_bank ? (
                  <select
                    className="ui-input"
                    value={chequeDetails.destinationBankAccountId}
                    onChange={(event) =>
                      setChequeDetails((current) => ({
                        ...current,
                        destinationBankAccountId: event.target.value,
                      }))
                    }
                    disabled={disabled || !canWrite}
                  >
                    <option value="">Cuenta bancaria destino</option>
                    {destinationBankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bank_name} | {account.alias || account.holder_name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ) : null}

            {isMercadoPagoManual ? (
              <div className="grid gap-2">
                <p className="text-xs text-slate-500">
                  Mercado Pago integrado desactivado. Se registrara la operacion manual.
                </p>
                {selectedMethodConfig?.ask_operation_number ? (
                  <input
                    className="ui-input"
                    value={mercadoPagoManualDetails.operationId}
                    onChange={(event) =>
                      setMercadoPagoManualDetails((current) => ({
                        ...current,
                        operationId: event.target.value,
                      }))
                    }
                    placeholder="ID de operacion"
                    disabled={disabled || !canWrite}
                  />
                ) : null}
                {selectedMethodConfig?.ask_destination_bank ? (
                  <select
                    className="ui-input"
                    value={mercadoPagoManualDetails.destinationBankAccountId}
                    onChange={(event) =>
                      setMercadoPagoManualDetails((current) => ({
                        ...current,
                        destinationBankAccountId: event.target.value,
                      }))
                    }
                    disabled={disabled || !canWrite}
                  >
                    <option value="">Cuenta bancaria destino</option>
                    {destinationBankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bank_name} | {account.alias || account.holder_name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ) : null}

            {paymentDetailError ? <p className="text-xs text-red-600">{paymentDetailError}</p> : null}
          </div>
        ) : null}

        {isMercadoPagoMethod && !isMercadoPagoManual ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">Cobro Mercado Pago</p>
            <p className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">Modo</span>
              <span className={mercadoPagoModeBadgeClass}>{mercadoPagoModeLabel}</span>
            </p>
            <p className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">Disponibilidad</span>
              <span className={mercadoPagoStatus.available ? "ui-badge ui-badge--success" : "ui-badge ui-badge--danger"}>
                {mercadoPagoStatus.available ? "Disponible" : "No disponible"}
              </span>
            </p>

            {mercadoPagoIntent ? (
              <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-2 text-xs">
                <p className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Estado</span>
                  <span className={mercadoPagoBadgeClass(mercadoPagoIntent.status)}>
                    {mercadoPagoIntent.status}
                  </span>
                </p>
                <p className="text-slate-600">
                  Referencia: <span className="font-kpi text-slate-900">{mercadoPagoIntent.reference}</span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Todavia no se inicio el cobro digital.</p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="ui-btn-primary"
                onClick={onStartMercadoPago}
                disabled={!canStartMercadoPago}
              >
                {isMercadoPagoLoading ? "Procesando..." : "Iniciar cobro"}
              </button>
              <button
                type="button"
                className="ui-btn-ghost"
                onClick={onRefreshMercadoPago}
                disabled={!mercadoPagoIntent || isMercadoPagoLoading}
              >
                Refrescar
              </button>
              {mercadoPagoStatus.mode === "mock" ? (
                <>
                  <button
                    type="button"
                    className="ui-btn-ghost"
                    onClick={onApproveMercadoPago}
                    disabled={!mercadoPagoIntent || mercadoPagoIntent.status !== "pending" || isMercadoPagoLoading}
                  >
                    Aprobar mock
                  </button>
                  <button
                    type="button"
                    className="ui-btn-ghost"
                    onClick={onRejectMercadoPago}
                    disabled={!mercadoPagoIntent || mercadoPagoIntent.status !== "pending" || isMercadoPagoLoading}
                  >
                    Rechazar mock
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="ui-btn-ghost"
                onClick={onCancelMercadoPago}
                disabled={!mercadoPagoIntent || mercadoPagoIntent.status !== "pending" || isMercadoPagoLoading}
              >
                Cancelar
              </button>
            </div>

            {!isOnline ? (
              <p className="text-xs text-amber-700">
                Sin conexion: no se puede iniciar cobro con Mercado Pago.
              </p>
            ) : null}
            {!mercadoPagoSettings.enabled ? (
              <p className="text-xs text-amber-700">Mercado Pago no configurado.</p>
            ) : null}
            {mercadoPagoStatus.reason ? (
              <p className="text-xs text-amber-700">{mercadoPagoStatus.reason}</p>
            ) : null}
            {mercadoPagoStatus.mode !== "mock" && mercadoPagoStatus.requires_backend ? (
              <p className="text-xs text-slate-500">
                Modo {mercadoPagoModeLabel.toLowerCase()} preparado para backend/edge function.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 transition-colors hover:bg-slate-100/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100/80 text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Emitir Factura Electrónica</p>
              <p className="text-xs text-slate-500">Genera comprobante fiscal formal con AFIP</p>
            </div>
          </div>
          <label className="pos-switch relative inline-flex shrink-0 cursor-pointer items-center" aria-label="Emitir factura electrónica AFIP">
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

        <div className="pos-checkout-submit">
          <button
            type="submit"
            className="ui-btn-primary w-full py-3 text-base disabled:opacity-50"
            disabled={
              disabled ||
              !canWrite ||
              !paymentMethods.length ||
              (isCurrentAccountMethod && !canUseCurrentAccountMethod) ||
              (isMercadoPagoMethod && !isMercadoPagoManual && !isMercadoPagoApproved) ||
              (requiresPaymentDetails && !arePaymentDetailsReady) ||
              isCreatingOriginBank
            }
          >
            Confirmar venta
          </button>
        </div>
      </form>
    </section>
  );
};
