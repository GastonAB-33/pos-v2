import { useCallback, useEffect, useState } from "react";
import { auditService } from "@/services/audit.service";
import { bankAccountsService } from "@/services/bank-accounts.service";
import { cashService } from "@/services/cash.service";
import { currentAccountsService } from "@/services/current-accounts.service";
import { customersService } from "@/services/customers.service";
import { installmentPlansService } from "@/services/installment-plans.service";
import { originBanksService } from "@/services/origin-banks.service";
import {
  normalizePaymentMethodCode,
  paymentMethodsService,
} from "@/services/payment-methods.service";
import { productsService } from "@/services/products.service";
import { receiptsService } from "@/services/receipts.service";
import { salesService } from "@/services/sales.service";
import type {
  BankAccount,
  CurrentAccountMovement,
  CurrentAccountPricingMode,
  Customer,
  InstallmentPlan,
  OriginBank,
  PaymentMethod,
} from "@/types/entities";

type FeedbackType = "success" | "error";

interface AccountFeedback {
  type: FeedbackType;
  message: string;
}

const roundAmount = (value: number): number => Number(value.toFixed(2));

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

export interface CurrentAccountSaleItemDetail {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  current_unit_price: number | null;
  current_line_total: number | null;
}

export interface CurrentAccountSaleDetail {
  sale_id: string;
  sale_number: string;
  receipt_number: string | null;
  sale_total: number;
  sale_date: string;
  items: CurrentAccountSaleItemDetail[];
  current_total: number | null;
}

export interface CurrentAccountDebtSaleOption {
  movement_id: string;
  sale_id: string;
  sale_number: string;
  receipt_number: string | null;
  debt_amount: number;
  movement_date: string;
  sale_total: number;
  current_total: number | null;
  items: CurrentAccountSaleItemDetail[];
}

export interface CurrentAccountPricingRule {
  mode: CurrentAccountPricingMode;
  surcharge_percent: number | null;
  surcharge_amount: number | null;
  updated_at: string | null;
}

export interface CurrentAccountSummary {
  initialDebtTotal: number;
  paymentsTotal: number;
  adjustmentsTotal: number;
  accountingBalance: number;
  updatedDebtTotal: number;
  updatedBalance: number;
  pricingRule: CurrentAccountPricingRule;
}

export interface RegisterCurrentAccountPaymentValues {
  amount: number;
  payment_method_id: string;
  notes?: string;
  payment_details?: Record<string, unknown> | null;
  pricing_rule?: RegisterCurrentAccountAdjustmentValues | null;
}

export type CurrentAccountAdjustmentMode =
  | "original"
  | "update_to_today_price"
  | "surcharge_percentage"
  | "surcharge_fixed";

export interface RegisterCurrentAccountAdjustmentValues {
  mode: CurrentAccountAdjustmentMode;
  surcharge_percent?: number;
  surcharge_amount?: number;
  notes?: string;
}

const adjustmentModeToPricingMode = (
  mode: CurrentAccountAdjustmentMode
): CurrentAccountPricingMode => {
  if (mode === "original") return "original";
  if (mode === "update_to_today_price") return "today_prices";
  return mode;
};

const resolveCustomerPricingRule = (customer: Customer | null): CurrentAccountPricingRule => ({
  mode: customer?.current_account_pricing_mode ?? "original",
  surcharge_percent: customer?.current_account_surcharge_percent ?? null,
  surcharge_amount: customer?.current_account_surcharge_amount ?? null,
  updated_at: customer?.current_account_pricing_updated_at ?? null,
});

const calculateUpdatedDebtTotal = (
  debtMovements: CurrentAccountMovement[],
  saleDetailsById: Record<string, CurrentAccountSaleDetail>,
  pricingRule: CurrentAccountPricingRule
): number => {
  const initialDebtTotal = roundAmount(
    debtMovements.reduce((sum, movement) => sum + Math.abs(movement.amount), 0)
  );

  if (pricingRule.mode === "today_prices") {
    return roundAmount(
      debtMovements.reduce((sum, movement) => {
        const saleDetail = movement.sale_id ? saleDetailsById[movement.sale_id] : null;
        return sum + (saleDetail?.current_total ?? Math.abs(movement.amount));
      }, 0)
    );
  }

  if (pricingRule.mode === "surcharge_percentage") {
    const percent = Number(pricingRule.surcharge_percent ?? 0);
    if (!Number.isFinite(percent) || percent <= 0) return initialDebtTotal;
    return roundAmount(initialDebtTotal * (1 + percent / 100));
  }

  if (pricingRule.mode === "surcharge_fixed") {
    const amount = Number(pricingRule.surcharge_amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return initialDebtTotal;
    return roundAmount(initialDebtTotal + amount);
  }

  return initialDebtTotal;
};

const buildAccountSummary = (
  customer: Customer | null,
  movements: CurrentAccountMovement[],
  saleDetailsById: Record<string, CurrentAccountSaleDetail>
): CurrentAccountSummary => {
  const pricingRule = resolveCustomerPricingRule(customer);
  const debtMovements = movements.filter((movement) => movement.type === "debt");
  const paymentMovements = movements.filter((movement) => movement.type === "payment");
  const adjustmentMovements = movements.filter((movement) => movement.type === "adjustment");

  const initialDebtTotal = roundAmount(
    debtMovements.reduce((sum, movement) => sum + Math.abs(movement.amount), 0)
  );
  const paymentsTotal = roundAmount(
    paymentMovements.reduce((sum, movement) => sum + Math.abs(movement.amount), 0)
  );
  const adjustmentsTotal = roundAmount(
    adjustmentMovements.reduce((sum, movement) => sum + movement.amount, 0)
  );
  const accountingBalance = roundAmount(initialDebtTotal + adjustmentsTotal - paymentsTotal);
  const updatedDebtTotal = calculateUpdatedDebtTotal(debtMovements, saleDetailsById, pricingRule);
  const updatedBalance = roundAmount(updatedDebtTotal + adjustmentsTotal - paymentsTotal);

  return {
    initialDebtTotal,
    paymentsTotal,
    adjustmentsTotal,
    accountingBalance,
    updatedDebtTotal,
    updatedBalance,
    pricingRule,
  };
};

export const useCurrentAccount = (
  tenantId: string | null,
  customer: Customer | null,
  userId: string | null
) => {
  const [movements, setMovements] = useState<CurrentAccountMovement[]>([]);
  const [balance, setBalance] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [originBanks, setOriginBanks] = useState<OriginBank[]>([]);
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [saleDetailsById, setSaleDetailsById] = useState<Record<string, CurrentAccountSaleDetail>>({});
  const [debtSales, setDebtSales] = useState<CurrentAccountDebtSaleOption[]>([]);
  const [accountSummary, setAccountSummary] = useState<CurrentAccountSummary>(() =>
    buildAccountSummary(null, [], {})
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasOpenCashSession, setHasOpenCashSession] = useState(false);
  const [openCashSessionId, setOpenCashSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AccountFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const loadCurrentAccount = useCallback(async () => {
    if (!tenantId || !customer) {
      setMovements([]);
      setBalance(0);
      setPaymentMethods([]);
      setBankAccounts([]);
      setOriginBanks([]);
      setInstallmentPlans([]);
      setSaleDetailsById({});
      setDebtSales([]);
      setAccountSummary(buildAccountSummary(null, [], {}));
      setHasOpenCashSession(false);
      setOpenCashSessionId(null);
      return;
    }

    setIsLoading(true);
    try {
      const [list, currentBalance, openSession, methods, activeBankAccounts, activeOriginBanks, activeInstallmentPlans] = await Promise.all([
        currentAccountsService.getByCustomer(tenantId, customer.id),
        currentAccountsService.getCustomerBalance(tenantId, customer.id),
        userId ? cashService.getOpenSessionByUser(tenantId, userId) : Promise.resolve(null),
        paymentMethodsService.getActiveByTenant(tenantId),
        bankAccountsService.getActiveByTenant(tenantId),
        originBanksService.getActiveByTenant(tenantId),
        installmentPlansService.getActiveByTenant(tenantId),
      ]);

      const availableMethods = methods.sort((a, b) => {
        const priorityDiff = paymentMethodPriority(a) - paymentMethodPriority(b);
        if (priorityDiff !== 0) return priorityDiff;
        return a.name.localeCompare(b.name);
      });

      const saleIds = Array.from(
        new Set(
          list
            .map((movement) => movement.sale_id)
            .filter((saleId): saleId is string => Boolean(saleId))
        )
      );

      let nextSaleDetailsById: Record<string, CurrentAccountSaleDetail> = {};

      if (saleIds.length) {
        const saleIdSet = new Set(saleIds);
        const [allSales, allSaleItems, allReceipts, allProducts] = await Promise.all([
          salesService.getAllByTenant(tenantId),
          salesService.getAllItemsByTenant(tenantId),
          receiptsService.getAllByTenant(tenantId),
          productsService.getAllByTenant(tenantId),
        ]);

        const salesById = new Map(
          allSales.filter((sale) => saleIdSet.has(sale.id)).map((sale) => [sale.id, sale])
        );
        const saleItemsBySaleId = allSaleItems.reduce<Map<string, typeof allSaleItems>>((acc, item) => {
          if (!saleIdSet.has(item.sale_id)) return acc;
          const current = acc.get(item.sale_id) ?? [];
          current.push(item);
          acc.set(item.sale_id, current);
          return acc;
        }, new Map());
        const receiptsBySaleId = allReceipts.reduce<Map<string, string>>((acc, receipt) => {
          if (!saleIdSet.has(receipt.sale_id)) return acc;
          if (acc.has(receipt.sale_id)) return acc;
          acc.set(receipt.sale_id, receipt.receipt_number);
          return acc;
        }, new Map());
        const productPriceById = new Map(allProducts.map((product) => [product.id, product.price]));

        nextSaleDetailsById = saleIds.reduce<Record<string, CurrentAccountSaleDetail>>(
          (acc, saleId) => {
            const sale = salesById.get(saleId);
            const saleItems = saleItemsBySaleId.get(saleId) ?? [];

            const items: CurrentAccountSaleItemDetail[] = saleItems.map((item) => {
              const currentUnitPrice = productPriceById.get(item.product_id) ?? null;
              return {
                product_id: item.product_id,
                product_name: item.product_name_snapshot,
                quantity: item.quantity,
                unit_price: item.unit_price,
                line_total: item.line_total,
                current_unit_price: currentUnitPrice,
                current_line_total:
                  currentUnitPrice == null ? null : roundAmount(currentUnitPrice * item.quantity),
              };
            });

            const fallbackMovement = list.find((movement) => movement.sale_id === saleId);
            const saleTotalFromItems = roundAmount(
              saleItems.reduce((sum, item) => sum + item.line_total, 0)
            );
            const saleTotal = sale?.total ?? saleTotalFromItems;
            const currentTotal =
              items.length && items.every((item) => item.current_line_total != null)
                ? roundAmount(items.reduce((sum, item) => sum + (item.current_line_total ?? 0), 0))
                : null;

            acc[saleId] = {
              sale_id: saleId,
              sale_number: sale?.sale_number ?? `VTA-${saleId.slice(0, 8)}`,
              receipt_number: receiptsBySaleId.get(saleId) ?? null,
              sale_total: saleTotal,
              sale_date: sale?.created_at ?? fallbackMovement?.created_at ?? new Date().toISOString(),
              items,
              current_total: currentTotal,
            };

            return acc;
          },
          {}
        );
      }

      const nextDebtSales = list
        .filter((movement) => movement.type === "debt" && movement.sale_id)
        .map((movement) => {
          const detail = movement.sale_id ? nextSaleDetailsById[movement.sale_id] : null;
          if (!detail) return null;

          return {
            movement_id: movement.id,
            sale_id: detail.sale_id,
            sale_number: detail.sale_number,
            receipt_number: detail.receipt_number,
            debt_amount: movement.amount,
            movement_date: movement.created_at,
            sale_total: detail.sale_total,
            current_total: detail.current_total,
            items: detail.items,
          } satisfies CurrentAccountDebtSaleOption;
        })
        .filter((item): item is CurrentAccountDebtSaleOption => Boolean(item))
        .sort((a, b) => b.movement_date.localeCompare(a.movement_date));

      setMovements(list);
      setBalance(currentBalance);
      setPaymentMethods(availableMethods);
      setBankAccounts(
        [...activeBankAccounts].sort((a, b) => a.bank_name.localeCompare(b.bank_name))
      );
      setOriginBanks([...activeOriginBanks].sort((a, b) => a.name.localeCompare(b.name)));
      setInstallmentPlans(
        [...activeInstallmentPlans].sort((a, b) => {
          if (a.installments !== b.installments) return a.installments - b.installments;
          return a.name.localeCompare(b.name);
        })
      );
      setSaleDetailsById(nextSaleDetailsById);
      setDebtSales(nextDebtSales);
      setAccountSummary(buildAccountSummary(customer, list, nextSaleDetailsById));
      setHasOpenCashSession(Boolean(openSession));
      setOpenCashSessionId(openSession?.id ?? null);
    } catch {
      setFeedback({ type: "error", message: "No se pudo cargar la cuenta corriente" });
      setMovements([]);
      setBalance(0);
      setPaymentMethods([]);
      setBankAccounts([]);
      setOriginBanks([]);
      setInstallmentPlans([]);
      setSaleDetailsById({});
      setDebtSales([]);
      setAccountSummary(buildAccountSummary(customer, [], {}));
      setHasOpenCashSession(false);
      setOpenCashSessionId(null);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, customer, userId]);

  useEffect(() => {
    void loadCurrentAccount();
  }, [loadCurrentAccount]);

  const updatePricingRule = async (
    values: RegisterCurrentAccountAdjustmentValues
  ): Promise<boolean> => {
    if (!tenantId || !customer) return false;
    if (!userId) {
      setFeedback({ type: "error", message: "No se pudo identificar el usuario responsable" });
      return false;
    }

    const pricingMode = adjustmentModeToPricingMode(values.mode);
    const percent = Number(values.surcharge_percent ?? 0);
    const fixedAmount = Number(values.surcharge_amount ?? 0);

    if (
      pricingMode === "surcharge_percentage" &&
      (!Number.isFinite(percent) || percent <= 0)
    ) {
      setFeedback({ type: "error", message: "Ingresa un porcentaje de recargo valido" });
      return false;
    }

    if (
      pricingMode === "surcharge_fixed" &&
      (!Number.isFinite(fixedAmount) || fixedAmount <= 0)
    ) {
      setFeedback({ type: "error", message: "Ingresa un recargo fijo valido" });
      return false;
    }

    const surchargePercentValue = pricingMode === "surcharge_percentage" ? percent : null;
    const surchargeAmountValue = pricingMode === "surcharge_fixed" ? fixedAmount : null;

    setIsSubmitting(true);
    try {
      const updatedAt = new Date().toISOString();
      await customersService.update(tenantId, customer.id, {
        current_account_pricing_mode: pricingMode,
        current_account_surcharge_percent: surchargePercentValue,
        current_account_surcharge_amount: surchargeAmountValue,
        current_account_pricing_updated_at: updatedAt,
      });

      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "cuentas_corrientes",
        action: "pricing_rule_update",
        entity_type: "customer",
        entity_id: customer.id,
        description: `Regla de saldo actualizado en cuenta corriente: ${customer.full_name}`,
        metadata: {
          customer_id: customer.id,
          pricing_mode: pricingMode,
          surcharge_percent: surchargePercentValue,
          surcharge_amount: surchargeAmountValue,
          notes: values.notes?.trim() || null,
          updated_at: updatedAt,
        },
      });

      setFeedback({ type: "success", message: "Regla de saldo actualizado guardada" });
      await loadCurrentAccount();
      return true;
    } catch {
      setFeedback({ type: "error", message: "No se pudo guardar la regla de saldo actualizado" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerPayment = async (values: RegisterCurrentAccountPaymentValues): Promise<boolean> => {
    if (!tenantId || !customer) return false;
    if (!userId) {
      setFeedback({ type: "error", message: "No se pudo identificar el usuario responsable" });
      return false;
    }

    const paymentMethod = paymentMethods.find(
      (method) => method.id === values.payment_method_id
    );
    if (!paymentMethod) {
      setFeedback({ type: "error", message: "Selecciona un medio de pago valido" });
      return false;
    }

    const normalizedMethodCode = normalizePaymentMethodCode(paymentMethod.code);
    if (normalizedMethodCode === "current_account") {
      setFeedback({
        type: "error",
        message: "Para registrar pagos debes usar un medio distinto a cuenta corriente",
      });
      return false;
    }

    const chargedAmount = Math.abs(Number(values.amount ?? 0));
    if (!Number.isFinite(chargedAmount) || chargedAmount <= 0) {
      setFeedback({ type: "error", message: "El monto del pago debe ser mayor a 0" });
      return false;
    }
    const accountingBalanceToPay = Math.max(0, accountSummary.accountingBalance);
    const accountPaymentAmount = Math.min(chargedAmount, accountingBalanceToPay);

    if (accountPaymentAmount <= 0) {
      setFeedback({ type: "error", message: "La cuenta corriente no tiene saldo contable para cancelar" });
      return false;
    }

    setIsSubmitting(true);
    try {
      const openSession = await cashService.getOpenSessionByUser(tenantId, userId);
      if (!openSession) {
        setFeedback({
          type: "error",
          message: "Debes abrir caja para registrar movimientos contables",
        });
        return false;
      }

      if (values.pricing_rule) {
        const ruleSaved = await updatePricingRule(values.pricing_rule);
        if (!ruleSaved) return false;
      }

      const movement = await currentAccountsService.createMovement(tenantId, {
        customer_id: customer.id,
        sale_id: null,
        type: "payment",
        amount: accountPaymentAmount,
        notes: values.notes?.trim() || null,
        created_by: userId,
      });
      const cashMovement = await cashService.createMovement(tenantId, {
        cash_session_id: openSession.id,
        movement_type: "income",
        amount: chargedAmount,
        currency_code: "ARS",
        reference_type: normalizedMethodCode,
        reference_id: movement.id,
        notes:
          values.notes?.trim() || `Pago de cuenta corriente - ${customer.full_name} (${paymentMethod.name})`,
        created_by: userId,
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "cuentas_corrientes",
        action: "payment",
        entity_type: "current_account_movement",
        entity_id: movement.id,
        description: `Pago registrado en cuenta corriente: ${customer.full_name}`,
        metadata: {
          customer_id: customer.id,
          amount: accountPaymentAmount,
          charged_amount: chargedAmount,
          updated_balance_reference: accountSummary.updatedBalance,
          updated_amount_difference: roundAmount(chargedAmount - accountPaymentAmount),
          balance_after: movement.balance_after,
          payment_method_id: paymentMethod.id,
          payment_method_code: normalizedMethodCode,
          payment_method_name: paymentMethod.name,
          payment_details: values.payment_details ?? null,
          cash_session_id: openSession.id,
          cash_movement_id: cashMovement.id,
        },
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "caja",
        action: "income",
        entity_type: "cash_movement",
        entity_id: cashMovement.id,
        description: `Ingreso por pago de cuenta corriente: ${customer.full_name}`,
        metadata: {
          customer_id: customer.id,
          current_account_movement_id: movement.id,
          amount: chargedAmount,
          account_payment_amount: accountPaymentAmount,
          updated_amount_difference: roundAmount(chargedAmount - accountPaymentAmount),
          payment_method_code: normalizedMethodCode,
          payment_method_name: paymentMethod.name,
          payment_details: values.payment_details ?? null,
        },
      });

      setFeedback({ type: "success", message: "Pago registrado" });
      await loadCurrentAccount();
      return true;
    } catch {
      setFeedback({ type: "error", message: "No se pudo registrar el pago" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerAdjustment = async (
    values: RegisterCurrentAccountAdjustmentValues
  ): Promise<boolean> => {
    return updatePricingRule(values);
  };

  return {
    movements,
    balance,
    paymentMethods,
    bankAccounts,
    originBanks,
    installmentPlans,
    saleDetailsById,
    debtSales,
    accountSummary,
    isLoading,
    isSubmitting,
    hasOpenCashSession,
    openCashSessionId,
    feedback,
    clearFeedback,
    reload: loadCurrentAccount,
    registerPayment,
    registerAdjustment,
  };
};
