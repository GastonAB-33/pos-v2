import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
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
  posCheckoutSchema,
  type PosCheckoutValues,
} from "@/modules/pos/schemas/pos-checkout.schema";

interface PosCheckoutPanelProps {
  panelId?: string;
  formId?: string;
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
  onSubmit: (values: PosCheckoutValues) => Promise<void>;
}

const getPaymentMethodLabel = (paymentMethod: PaymentMethod) => {
  const labels: Record<PaymentMethod["type"], string> = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
    mercado_pago: "Mercado Pago",
    current_account: "Cuenta corriente",
    other: "Otro",
  };

  return labels[paymentMethod.type];
};

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

const paymentMethodPriority = (method: PaymentMethod): number => {
  const code = method.code.trim().toLowerCase();
  if (code === "cash") return 0;
  if (code === "card_debit") return 1;
  if (code === "card_credit") return 2;
  if (code === "transfer") return 3;
  if (code === "current_account") return 4;
  if (method.type === "mercado_pago") return 5;
  return 6;
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

export const PosCheckoutPanel = ({
  panelId,
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

  const selectedMethodCode = selectedMethod?.code.trim().toLowerCase() ?? "";
  const isCreditCardMethod = selectedMethodCode === "card_credit";
  const isDebitCardMethod = selectedMethodCode === "card_debit";
  const isTransferMethod = selectedMethodCode === "transfer" || selectedMethod?.type === "transfer";
  const isMercadoPagoMethod = selectedMethod?.type === "mercado_pago";
  const isMercadoPagoManual = isMercadoPagoMethod && !mercadoPagoSettings.enabled;
  const isCurrentAccountMethod = selectedMethod?.type === "current_account";
  const requiresPaymentDetails =
    isCreditCardMethod || isDebitCardMethod || isTransferMethod || isMercadoPagoManual;

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

  const selectedCreditDestination = useMemo(
    () =>
      bankAccounts.find((account) => account.id === cardCreditDetails.destinationBankAccountId) ??
      null,
    [bankAccounts, cardCreditDetails.destinationBankAccountId]
  );

  const selectedDebitDestination = useMemo(
    () =>
      bankAccounts.find((account) => account.id === cardDebitDetails.destinationBankAccountId) ??
      null,
    [bankAccounts, cardDebitDetails.destinationBankAccountId]
  );

  const selectedTransferDestination = useMemo(
    () =>
      bankAccounts.find((account) => account.id === transferDetails.destinationBankAccountId) ??
      null,
    [bankAccounts, transferDetails.destinationBankAccountId]
  );

  const selectedManualMpDestination = useMemo(
    () =>
      bankAccounts.find(
        (account) => account.id === mercadoPagoManualDetails.destinationBankAccountId
      ) ?? null,
    [bankAccounts, mercadoPagoManualDetails.destinationBankAccountId]
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
    if (selectedMethod.type !== "current_account") return;
    if (canUseCurrentAccountMethod) return;

    const fallback = paymentMethodsOrdered.find((method) => method.type !== "current_account");
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
    if (!requiresPaymentDetails) return true;

    if (isCreditCardMethod) {
      return Boolean(
        cardCreditDetails.couponNumber.trim() &&
          cardCreditDetails.authorizationNumber.trim() &&
          selectedInstallmentPlan &&
          selectedCreditDestination
      );
    }

    if (isDebitCardMethod) {
      return Boolean(
        cardDebitDetails.couponNumber.trim() &&
          cardDebitDetails.authorizationNumber.trim() &&
          selectedDebitDestination
      );
    }

    if (isTransferMethod) {
      const hasOrigin =
        transferDetails.originBankId === "__new__"
          ? Boolean(transferDetails.newOriginBankName.trim())
          : Boolean(transferDetails.originBankId.trim());
      return Boolean(
        hasOrigin &&
          transferDetails.voucherNumber.trim() &&
          transferDetails.originAccountHolder.trim() &&
          selectedTransferDestination
      );
    }

    if (isMercadoPagoManual) {
      return Boolean(
        mercadoPagoManualDetails.operationId.trim() && selectedManualMpDestination
      );
    }

    return true;
  }, [
    cardCreditDetails.authorizationNumber,
    cardCreditDetails.couponNumber,
    cardDebitDetails.authorizationNumber,
    cardDebitDetails.couponNumber,
    isCreditCardMethod,
    isDebitCardMethod,
    isMercadoPagoManual,
    isTransferMethod,
    mercadoPagoManualDetails.operationId,
    requiresPaymentDetails,
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
    if (!requiresPaymentDetails || !selectedMethod) {
      return { ok: true as const, payload: null as Record<string, unknown> | null };
    }

    const capturedAt = new Date().toISOString();

    if (isCreditCardMethod) {
      if (!selectedInstallmentPlan) {
        return { ok: false as const, error: "Selecciona un plan de cuotas." };
      }
      if (!selectedCreditDestination) {
        return { ok: false as const, error: "Selecciona una cuenta bancaria destino." };
      }
      if (!cardCreditDetails.couponNumber.trim() || !cardCreditDetails.authorizationNumber.trim()) {
        return {
          ok: false as const,
          error: "Completa numero de cupon y autorizacion para tarjeta de credito.",
        };
      }

      return {
        ok: true as const,
        payload: {
          kind: "card_credit",
          captured_at: capturedAt,
          coupon_number: cardCreditDetails.couponNumber.trim(),
          authorization_number: cardCreditDetails.authorizationNumber.trim(),
          card_brand: cardCreditDetails.cardBrand.trim() || null,
          installment_plan_id: selectedInstallmentPlan.id,
          installment_plan_name: selectedInstallmentPlan.name,
          installments: selectedInstallmentPlan.installments,
          interest_percent: selectedInstallmentPlan.interest_percent,
          base_amount: checkoutTotal,
          total_amount_with_interest: creditTotalWithInterest,
          destination_account_id: selectedCreditDestination.id,
          destination_account_bank: selectedCreditDestination.bank_name,
          destination_account_alias: selectedCreditDestination.alias,
        } satisfies Record<string, unknown>,
      };
    }

    if (isDebitCardMethod) {
      if (!selectedDebitDestination) {
        return { ok: false as const, error: "Selecciona una cuenta bancaria destino." };
      }
      if (!cardDebitDetails.couponNumber.trim() || !cardDebitDetails.authorizationNumber.trim()) {
        return {
          ok: false as const,
          error: "Completa numero de cupon y autorizacion para tarjeta de debito.",
        };
      }

      return {
        ok: true as const,
        payload: {
          kind: "card_debit",
          captured_at: capturedAt,
          coupon_number: cardDebitDetails.couponNumber.trim(),
          authorization_number: cardDebitDetails.authorizationNumber.trim(),
          destination_account_id: selectedDebitDestination.id,
          destination_account_bank: selectedDebitDestination.bank_name,
          destination_account_alias: selectedDebitDestination.alias,
        } satisfies Record<string, unknown>,
      };
    }

    if (isTransferMethod) {
      if (!selectedTransferDestination) {
        return { ok: false as const, error: "Selecciona una cuenta bancaria destino." };
      }

      let selectedOriginBank =
        originBanks.find((bank) => bank.id === transferDetails.originBankId) ?? null;

      if (transferDetails.originBankId === "__new__") {
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

      if (!selectedOriginBank) {
        return { ok: false as const, error: "Selecciona banco de origen." };
      }
      if (!transferDetails.voucherNumber.trim() || !transferDetails.originAccountHolder.trim()) {
        return {
          ok: false as const,
          error: "Completa comprobante y titular de cuenta origen.",
        };
      }

      return {
        ok: true as const,
        payload: {
          kind: "transfer",
          captured_at: capturedAt,
          origin_bank_id: selectedOriginBank.id,
          origin_bank_name: selectedOriginBank.name,
          voucher_number: transferDetails.voucherNumber.trim(),
          origin_account_holder: transferDetails.originAccountHolder.trim(),
          destination_account_id: selectedTransferDestination.id,
          destination_account_bank: selectedTransferDestination.bank_name,
          destination_account_alias: selectedTransferDestination.alias,
        } satisfies Record<string, unknown>,
      };
    }

    if (isMercadoPagoManual) {
      if (!selectedManualMpDestination) {
        return { ok: false as const, error: "Selecciona una cuenta bancaria destino." };
      }
      if (!mercadoPagoManualDetails.operationId.trim()) {
        return { ok: false as const, error: "Completa el ID de operacion de Mercado Pago." };
      }

      return {
        ok: true as const,
        payload: {
          kind: "mercado_pago_manual",
          captured_at: capturedAt,
          operation_id: mercadoPagoManualDetails.operationId.trim(),
          destination_account_id: selectedManualMpDestination.id,
          destination_account_bank: selectedManualMpDestination.bank_name,
          destination_account_alias: selectedManualMpDestination.alias,
        } satisfies Record<string, unknown>,
      };
    }

    return { ok: true as const, payload: null as Record<string, unknown> | null };
  }, [
    cardCreditDetails.authorizationNumber,
    cardCreditDetails.cardBrand,
    cardCreditDetails.couponNumber,
    cardDebitDetails.authorizationNumber,
    cardDebitDetails.couponNumber,
    checkoutTotal,
    creditTotalWithInterest,
    isCreditCardMethod,
    isDebitCardMethod,
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

  const paymentDetailsSummary = useMemo(() => {
    if (!requiresPaymentDetails) return null;

    if (isCreditCardMethod) {
      if (!arePaymentDetailsReady || !selectedInstallmentPlan || !selectedCreditDestination) {
        return "Completa los datos de tarjeta de credito.";
      }
      return `${selectedInstallmentPlan.installments} cuotas | ${selectedInstallmentPlan.interest_percent.toFixed(
        2
      )}% | ${selectedCreditDestination.bank_name}`;
    }

    if (isDebitCardMethod) {
      if (!arePaymentDetailsReady || !selectedDebitDestination) {
        return "Completa los datos de tarjeta de debito.";
      }
      return `Cupon ${cardDebitDetails.couponNumber.trim()} | ${selectedDebitDestination.bank_name}`;
    }

    if (isTransferMethod) {
      if (!arePaymentDetailsReady || !selectedTransferDestination) {
        return "Completa los datos de transferencia.";
      }
      return `Comprobante ${transferDetails.voucherNumber.trim()} | ${selectedTransferDestination.bank_name}`;
    }

    if (isMercadoPagoManual) {
      if (!arePaymentDetailsReady || !selectedManualMpDestination) {
        return "Completa los datos manuales de Mercado Pago.";
      }
      return `Operacion ${mercadoPagoManualDetails.operationId.trim()} | ${selectedManualMpDestination.bank_name}`;
    }

    return null;
  }, [
    arePaymentDetailsReady,
    cardDebitDetails.couponNumber,
    isCreditCardMethod,
    isDebitCardMethod,
    isMercadoPagoManual,
    isTransferMethod,
    mercadoPagoManualDetails.operationId,
    requiresPaymentDetails,
    selectedCreditDestination,
    selectedDebitDestination,
    selectedInstallmentPlan,
    selectedManualMpDestination,
    selectedTransferDestination,
    transferDetails.voucherNumber,
  ]);

  return (
    <section id={panelId} className="pos-surface space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Checkout</h2>
        <span className="font-kpi text-2xl font-semibold text-brand-700">
          {new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
            maximumFractionDigits: 2,
          }).format(checkoutTotal)}
        </span>
      </div>

      <div className="pos-summary-panel text-xs">
        <p className="flex items-center justify-between gap-2">
          <span className="text-slate-500">Cliente</span>
          <span className="text-right font-medium text-slate-900">
            {selectedCustomer?.full_name ?? "Consumidor final"}
          </span>
        </p>
        <p className="mt-1 flex items-center justify-between gap-2">
          <span className="text-slate-500">Medio de pago</span>
          <span className="text-right font-medium text-slate-900">
            {selectedMethod ? `${selectedMethod.name}` : "No seleccionado"}
          </span>
        </p>
        <p className="mt-1 flex items-center justify-between gap-2">
          <span className="text-slate-500">Total</span>
          <span className="font-kpi text-base font-semibold text-brand-700">
            {new Intl.NumberFormat("es-AR", {
              style: "currency",
              currency: "ARS",
              maximumFractionDigits: 2,
            }).format(checkoutTotal)}
          </span>
        </p>
      </div>

      <form id={formId} className="grid gap-3" onSubmit={handleSubmit(submit)}>
        <input type="hidden" {...register("customerId")} />
        <input type="hidden" {...register("paymentMethodId")} />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Cliente</label>
          <div className="relative" ref={customerLookupRef} data-customer-lookup="true">
            <div className="flex items-center gap-2">
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
                placeholder="Buscar cliente por nombre o DNI"
                className="ui-input"
                disabled={disabled || !canWrite}
              />
              <button
                type="button"
                title={customerActionLabel}
                aria-label={customerActionLabel}
                className="ui-btn-ghost p-2"
                disabled={disabled || !canWrite || !canManageCustomers}
                onClick={() => onOpenCustomerModal(selectedCustomer ?? null)}
              >
                {selectedCustomer ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="m16.5 3.5 4 4L7 21H3v-4z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
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
          <label className="mb-1 block text-sm font-medium text-slate-700">Medio de pago</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {paymentMethodsOrdered.map((method) => {
              const selected = method.id === watchedPaymentMethodId;
              const isCurrentAccount = method.type === "current_account";
              const isDisabled =
                disabled ||
                !canWrite ||
                (isCurrentAccount && (!canUseCurrentAccount || !isCurrentAccountEnabled || isCurrentAccountNoFunds));

              return (
                <button
                  key={method.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    setValue("paymentMethodId", method.id, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  className={
                    selected
                      ? "rounded-xl bg-brand-600/10 px-3 py-2 text-left shadow-sm ring-1 ring-brand-500/40"
                      : "rounded-xl bg-slate-50 px-3 py-2 text-left"
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={selected ? "text-sm font-semibold text-slate-900" : "text-sm font-medium text-slate-800"}>
                      {method.name}
                    </p>
                    {selected ? <span className="ui-badge ui-badge--info">Seleccionado</span> : null}
                  </div>
                  <p className="text-xs text-slate-500">{getPaymentMethodLabel(method)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {method.surcharge_percent > 0 ? (
                      <span className="ui-badge ui-badge--warn">+{method.surcharge_percent}%</span>
                    ) : null}
                    {method.discount_percent > 0 ? (
                      <span className="ui-badge ui-badge--success">-{method.discount_percent}%</span>
                    ) : null}
                    {isCurrentAccount && !canUseCurrentAccount ? (
                      <span className="ui-badge ui-badge--danger">Requiere cliente</span>
                    ) : null}
                    {isCurrentAccount && canUseCurrentAccount && !isCurrentAccountEnabled ? (
                      <span className="ui-badge ui-badge--danger">Credito deshabilitado</span>
                    ) : null}
                    {isCurrentAccount && canUseCurrentAccount && isCurrentAccountNoFunds ? (
                      <span className="ui-badge ui-badge--warn">Sin fondo</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
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
                <div className="grid gap-2 sm:grid-cols-2">
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
                </div>
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
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.bank_name} | {account.alias || account.holder_name}
                    </option>
                  ))}
                </select>
                {selectedInstallmentPlan ? (
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
                <div className="grid gap-2 sm:grid-cols-2">
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
                </div>
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
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.bank_name} | {account.alias || account.holder_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {isTransferMethod ? (
              <div className="grid gap-2">
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
                  <option value="__new__">+ Agregar banco de origen</option>
                </select>
                {transferDetails.originBankId === "__new__" ? (
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
                <div className="grid gap-2 sm:grid-cols-2">
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
                </div>
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
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.bank_name} | {account.alias || account.holder_name}
                    </option>
                  ))}
                </select>
                {selectedTransferDestination ? (
                  <p className="text-xs text-slate-500">
                    Alias destino: {selectedTransferDestination.alias || "Sin alias"}
                  </p>
                ) : null}
              </div>
            ) : null}

            {isMercadoPagoManual ? (
              <div className="grid gap-2">
                <p className="text-xs text-slate-500">
                  Mercado Pago integrado desactivado. Se registrara la operacion manual.
                </p>
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
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.bank_name} | {account.alias || account.holder_name}
                    </option>
                  ))}
                </select>
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

        <div className="flex items-center justify-end">
          <label className="pos-switch" aria-label="Emitir factura">
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
