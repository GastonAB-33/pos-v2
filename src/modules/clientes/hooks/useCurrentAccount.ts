import { useCallback, useEffect, useState } from "react";
import { auditService } from "@/services/audit.service";
import { bankAccountMovementsService } from "@/services/bank-account-movements.service";
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

export interface PendingDebtAllocation {
  movementId: string;
  saleId: string | null;
  createdAt: string;
  originalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  pendingRatio: number;
  saleDetail: CurrentAccountSaleDetail | null;
  updatedAmount: number;
}

export interface CurrentAccountSummary {
  initialDebtTotal: number;
  paymentsTotal: number;
  adjustmentsTotal: number;
  accountingBalance: number;
  pendingDebtTotal: number;
  updatedDebtTotal: number;
  updatedBalance: number;
  pricingRule: CurrentAccountPricingRule;
}

export interface RegisterCurrentAccountPaymentValues {
  amount: number;
  payment_method_id: string;
  notes?: string;
  bank_account_id?: string | null;
  payment_details?: Record<string, unknown> | null;
  pricing_rule?: RegisterCurrentAccountAdjustmentValues | null;
  split_payments?: Array<{
    payment_method_id: string;
    amount: number;
    bank_account_id?: string | null;
    payment_details?: Record<string, unknown> | null;
    notes?: string;
  }>;
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

export const resolveCustomerPricingRule = (customer: Customer | null): CurrentAccountPricingRule => ({
  mode: customer?.current_account_pricing_mode ?? "original",
  surcharge_percent: customer?.current_account_surcharge_percent ?? null,
  surcharge_amount: customer?.current_account_surcharge_amount ?? null,
  updated_at: customer?.current_account_pricing_updated_at ?? null,
});

export interface FifoCalculationResult {
  allocations: PendingDebtAllocation[];
  allocationsByMovementId: Record<string, PendingDebtAllocation>;
  initialDebtTotal: number;
  paymentsTotal: number;
  adjustmentsTotal: number;
  accountingBalance: number;
  pendingDebtTotal: number;
  updatedDebtTotal: number;
  updatedBalance: number;
  debtSales: CurrentAccountDebtSaleOption[];
}

export const calculatePendingDebtsFIFO = (
  movements: CurrentAccountMovement[],
  saleDetailsById: Record<string, CurrentAccountSaleDetail>,
  pricingRule: CurrentAccountPricingRule
): FifoCalculationResult => {
  const debtMovements = movements.filter((m) => m.type === "debt");
  const paymentMovements = movements.filter((m) => m.type === "payment");
  const adjustmentMovements = movements.filter((m) => m.type === "adjustment");

  const initialDebtTotal = roundAmount(
    debtMovements.reduce((sum, m) => sum + Math.abs(m.amount), 0)
  );
  const paymentsTotal = roundAmount(
    paymentMovements.reduce((sum, m) => sum + Math.abs(m.amount), 0)
  );
  const adjustmentsTotal = roundAmount(
    adjustmentMovements.reduce((sum, m) => sum + m.amount, 0)
  );

  // Saldo contable exacto en libro mayor:
  const accountingBalance = roundAmount(initialDebtTotal + adjustmentsTotal - paymentsTotal);

  // Si el cliente no debe nada (saldo <= 0), no hay recargos ni actualización que aplicar
  if (accountingBalance <= 0) {
    const allocations: PendingDebtAllocation[] = debtMovements.map((m) => ({
      movementId: m.id,
      saleId: m.sale_id ?? null,
      createdAt: m.created_at,
      originalAmount: Math.abs(m.amount),
      paidAmount: Math.abs(m.amount),
      pendingAmount: 0,
      pendingRatio: 0,
      saleDetail: m.sale_id ? (saleDetailsById[m.sale_id] ?? null) : null,
      updatedAmount: 0,
    }));
    const allocationsByMovementId = allocations.reduce<Record<string, PendingDebtAllocation>>(
      (acc, a) => {
        acc[a.movementId] = a;
        return acc;
      },
      {}
    );

    return {
      allocations,
      allocationsByMovementId,
      initialDebtTotal,
      paymentsTotal,
      adjustmentsTotal,
      accountingBalance,
      pendingDebtTotal: 0,
      updatedDebtTotal: 0,
      updatedBalance: accountingBalance,
      debtSales: [],
    };
  }

  // Imputación cronológica FIFO: los pagos cancelan deudas de más antigua a más reciente
  const sortedDebts = [...debtMovements].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const negativeAdjustments = roundAmount(
    adjustmentMovements.filter((a) => a.amount < 0).reduce((sum, a) => sum + Math.abs(a.amount), 0)
  );
  let availableCredit = roundAmount(paymentsTotal + negativeAdjustments);

  const allocations: PendingDebtAllocation[] = [];
  for (const debt of sortedDebts) {
    const originalAmount = roundAmount(Math.abs(debt.amount));
    if (originalAmount <= 0) continue;

    let paidAmount = 0;
    if (availableCredit >= originalAmount) {
      paidAmount = originalAmount;
      availableCredit = roundAmount(availableCredit - originalAmount);
    } else if (availableCredit > 0) {
      paidAmount = availableCredit;
      availableCredit = 0;
    } else {
      paidAmount = 0;
    }

    const pendingAmount = roundAmount(originalAmount - paidAmount);
    const pendingRatio = originalAmount > 0 ? pendingAmount / originalAmount : 0;
    const saleDetail = debt.sale_id ? (saleDetailsById[debt.sale_id] ?? null) : null;

    allocations.push({
      movementId: debt.id,
      saleId: debt.sale_id ?? null,
      createdAt: debt.created_at,
      originalAmount,
      paidAmount,
      pendingAmount,
      pendingRatio,
      saleDetail,
      updatedAmount: pendingAmount,
    });
  }

  const pendingDebtTotal = roundAmount(
    allocations.reduce((sum, a) => sum + a.pendingAmount, 0)
  );

  let totalUpdatedDebt = pendingDebtTotal;
  let updatedBalance = accountingBalance;

  if (pricingRule.mode === "today_prices") {
    totalUpdatedDebt = 0;
    for (const alloc of allocations) {
      if (alloc.pendingAmount <= 0) {
        alloc.updatedAmount = 0;
        continue;
      }

      if (alloc.saleDetail && alloc.saleDetail.items.length > 0) {
        // Calcular total actual sumando el precio actual de cada producto
        const todaySaleTotal = roundAmount(
          alloc.saleDetail.items.reduce((sum, item) => {
            const currentUnit = item.current_unit_price ?? item.unit_price;
            return sum + currentUnit * item.quantity;
          }, 0)
        );
        alloc.updatedAmount = roundAmount(todaySaleTotal * alloc.pendingRatio);
      } else {
        // Deuda manual sin items de venta: se preserva su importe pendiente original
        alloc.updatedAmount = alloc.pendingAmount;
      }
      totalUpdatedDebt = roundAmount(totalUpdatedDebt + alloc.updatedAmount);
    }

    // Diferencia por actualización de precios sobre los productos pendientes
    const priceDiff = roundAmount(totalUpdatedDebt - pendingDebtTotal);
    updatedBalance = roundAmount(accountingBalance + priceDiff);

  } else if (pricingRule.mode === "surcharge_percentage") {
    const percent = Number(pricingRule.surcharge_percent ?? 0);
    if (Number.isFinite(percent) && percent > 0) {
      const surcharge = roundAmount(accountingBalance * (percent / 100));
      updatedBalance = roundAmount(accountingBalance + surcharge);

      for (const alloc of allocations) {
        if (alloc.pendingAmount <= 0) {
          alloc.updatedAmount = 0;
        } else {
          alloc.updatedAmount = roundAmount(alloc.pendingAmount * (1 + percent / 100));
        }
      }
      totalUpdatedDebt = roundAmount(pendingDebtTotal * (1 + percent / 100));
    }

  } else if (pricingRule.mode === "surcharge_fixed") {
    const fixedAmount = Number(pricingRule.surcharge_amount ?? 0);
    if (Number.isFinite(fixedAmount) && fixedAmount > 0) {
      updatedBalance = roundAmount(accountingBalance + fixedAmount);

      for (const alloc of allocations) {
        if (alloc.pendingAmount <= 0) {
          alloc.updatedAmount = 0;
        } else if (pendingDebtTotal > 0) {
          alloc.updatedAmount = roundAmount(
            alloc.pendingAmount + fixedAmount * (alloc.pendingAmount / pendingDebtTotal)
          );
        } else {
          alloc.updatedAmount = alloc.pendingAmount;
        }
      }
      totalUpdatedDebt = roundAmount(pendingDebtTotal + fixedAmount);
    }
  }

  const allocationsByMovementId = allocations.reduce<Record<string, PendingDebtAllocation>>(
    (acc, a) => {
      acc[a.movementId] = a;
      return acc;
    },
    {}
  );

  // Construir opciones de ventas para el modal (sólo ventas con deuda pendiente real):
  const debtSales: CurrentAccountDebtSaleOption[] = allocations
    .filter((alloc) => alloc.saleId && alloc.saleDetail && alloc.pendingAmount > 0)
    .map((alloc) => {
      const detail = alloc.saleDetail!;
      const ratio = alloc.pendingRatio;

      const proratedItems: CurrentAccountSaleItemDetail[] = detail.items.map((item) => {
        const proratedQty = Number((item.quantity * ratio).toFixed(2));
        const proratedLineTotal = roundAmount(item.line_total * ratio);
        const currentPrice = item.current_unit_price ?? item.unit_price;
        const proratedCurrentLineTotal = roundAmount(currentPrice * proratedQty);

        return {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: proratedQty,
          unit_price: item.unit_price,
          line_total: proratedLineTotal,
          current_unit_price: item.current_unit_price,
          current_line_total: proratedCurrentLineTotal,
        };
      });

      const currentTotal = roundAmount(
        proratedItems.reduce((sum, item) => sum + (item.current_line_total ?? item.line_total), 0)
      );

      return {
        movement_id: alloc.movementId,
        sale_id: detail.sale_id,
        sale_number: detail.sale_number,
        receipt_number: detail.receipt_number,
        debt_amount: alloc.pendingAmount,
        movement_date: alloc.createdAt,
        sale_total: alloc.pendingAmount,
        current_total: currentTotal,
        items: proratedItems,
      };
    })
    .sort((a, b) => b.movement_date.localeCompare(a.movement_date));

  return {
    allocations,
    allocationsByMovementId,
    initialDebtTotal,
    paymentsTotal,
    adjustmentsTotal,
    accountingBalance,
    pendingDebtTotal,
    updatedDebtTotal: totalUpdatedDebt,
    updatedBalance,
    debtSales,
  };
};

const createEmptySummary = (rule?: CurrentAccountPricingRule): CurrentAccountSummary => ({
  initialDebtTotal: 0,
  paymentsTotal: 0,
  adjustmentsTotal: 0,
  accountingBalance: 0,
  pendingDebtTotal: 0,
  updatedDebtTotal: 0,
  updatedBalance: 0,
  pricingRule: rule ?? {
    mode: "original",
    surcharge_percent: null,
    surcharge_amount: null,
    updated_at: null,
  },
});

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
  const [pendingAllocationsByMovementId, setPendingAllocationsByMovementId] = useState<
    Record<string, PendingDebtAllocation>
  >({});
  const [accountSummary, setAccountSummary] = useState<CurrentAccountSummary>(() =>
    createEmptySummary()
  );
  const [isLoading, setIsLoading] = useState(true);
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
      setPendingAllocationsByMovementId({});
      setAccountSummary(createEmptySummary());
      setHasOpenCashSession(false);
      setOpenCashSessionId(null);
      return;
    }

    setIsLoading(true);
    try {
      const [freshCustomer, list, currentBalance, openSession, methods, activeBankAccounts, activeOriginBanks, activeInstallmentPlans] = await Promise.all([
        customersService.getById(tenantId, customer.id),
        currentAccountsService.getByCustomer(tenantId, customer.id),
        currentAccountsService.getCustomerBalance(tenantId, customer.id),
        userId
          ? cashService.getOpenSessionByUser(tenantId, userId)
          : cashService.getOpenSession(tenantId),
        paymentMethodsService.getActiveByTenant(tenantId),
        bankAccountsService.getActiveByTenant(tenantId),
        originBanksService.getActiveByTenant(tenantId),
        installmentPlansService.getActiveByTenant(tenantId),
      ]);

      const effectiveCustomer = freshCustomer ?? customer;

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
        const [targetSales, targetSaleItems, targetReceipts] = await Promise.all([
          salesService.getByIds(tenantId, saleIds),
          salesService.getItemsBySaleIds(tenantId, saleIds),
          receiptsService.getBySaleIds(tenantId, saleIds),
        ]);

        const productIds = Array.from(
          new Set(targetSaleItems.map((item) => item.product_id).filter(Boolean))
        );
        const targetProducts = productIds.length > 0
          ? await productsService.getByIds(tenantId, productIds)
          : [];

        const salesById = new Map(targetSales.map((sale) => [sale.id, sale]));
        const saleItemsBySaleId = targetSaleItems.reduce<Map<string, typeof targetSaleItems>>((acc, item) => {
          const current = acc.get(item.sale_id) ?? [];
          current.push(item);
          acc.set(item.sale_id, current);
          return acc;
        }, new Map());
        const receiptsBySaleId = targetReceipts.reduce<Map<string, string>>((acc, receipt) => {
          if (!receipt.sale_id) return acc;
          if (acc.has(receipt.sale_id)) return acc;
          acc.set(receipt.sale_id, receipt.receipt_number);
          return acc;
        }, new Map());
        const productPriceById = new Map(targetProducts.map((product) => [product.id, product.price]));

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

      const customerRule = resolveCustomerPricingRule(effectiveCustomer);
      const fifoResult = calculatePendingDebtsFIFO(list, nextSaleDetailsById, customerRule);

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
      setDebtSales(fifoResult.debtSales);
      setPendingAllocationsByMovementId(fifoResult.allocationsByMovementId);
      setAccountSummary({
        initialDebtTotal: fifoResult.initialDebtTotal,
        paymentsTotal: fifoResult.paymentsTotal,
        adjustmentsTotal: fifoResult.adjustmentsTotal,
        accountingBalance: fifoResult.accountingBalance,
        pendingDebtTotal: fifoResult.pendingDebtTotal,
        updatedDebtTotal: fifoResult.updatedDebtTotal,
        updatedBalance: fifoResult.updatedBalance,
        pricingRule: customerRule,
      });
      setHasOpenCashSession(Boolean(openSession));
      setOpenCashSessionId(openSession?.id ?? null);
    } catch (err) {
      console.error("Error al cargar cuenta corriente:", err);
      setFeedback({ type: "error", message: "No se pudo cargar la cuenta corriente" });
      setMovements([]);
      setBalance(0);
      setPaymentMethods([]);
      setBankAccounts([]);
      setOriginBanks([]);
      setInstallmentPlans([]);
      setSaleDetailsById({});
      setDebtSales([]);
      setPendingAllocationsByMovementId({});
      setAccountSummary(createEmptySummary(resolveCustomerPricingRule(customer)));
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

    if (accountingBalanceToPay <= 0) {
      setFeedback({ type: "error", message: "La cuenta corriente no tiene saldo pendiente para cancelar" });
      return false;
    }

    setIsSubmitting(true);
    try {
      const openSession =
        (userId ? await cashService.getOpenSessionByUser(tenantId, userId) : null) ??
        (await cashService.getOpenSession(tenantId));

      const hasCashComponent =
        values.split_payments && values.split_payments.length > 0
          ? values.split_payments.some((p) => {
              const m = paymentMethods.find((meth) => meth.id === p.payment_method_id);
              return (
                !p.bank_account_id &&
                (m
                  ? normalizePaymentMethodCode(m.code) === "cash" ||
                    m.affects_cash !== false
                  : true)
              );
            })
          : normalizedMethodCode === "cash" ||
            (paymentMethod.affects_cash !== false && !values.bank_account_id);

      if (hasCashComponent && !openSession) {
        setFeedback({
          type: "error",
          message: "Debes abrir caja para registrar cobros en efectivo",
        });
        return false;
      }

      if (values.pricing_rule) {
        const ruleSaved = await updatePricingRule(values.pricing_rule);
        if (!ruleSaved) return false;
      }

      // Si el monto cobrado supera la deuda contable histórica (por recargo o precio de hoy),
      // registramos la diferencia como un movimiento de ajuste contable legítimo en CC
      // para que el saldo de Cuenta Corriente y la Caja Diaria cuadren exactamente al centavo.
      const adjustmentAmount = roundAmount(Math.max(0, chargedAmount - accountingBalanceToPay));
      let adjustmentMovement: CurrentAccountMovement | null = null;

      if (adjustmentAmount > 0) {
        adjustmentMovement = await currentAccountsService.createMovement(tenantId, {
          customer_id: customer.id,
          sale_id: null,
          type: "adjustment",
          amount: adjustmentAmount,
          notes: values.notes?.trim() || `Recargo / Ajuste por saldo actualizado (+${currency.format(adjustmentAmount)})`,
          created_by: userId,
        });

        await auditService.createSafe(tenantId, {
          user_id: userId,
          module: "cuentas_corrientes",
          action: "adjustment",
          entity_type: "current_account_movement",
          entity_id: adjustmentMovement.id,
          description: `Ajuste contable por recargo de saldo actualizado: ${customer.full_name} (+${currency.format(adjustmentAmount)})`,
          metadata: {
            customer_id: customer.id,
            adjustment_amount: adjustmentAmount,
            charged_amount: chargedAmount,
            accounting_balance_before: accountingBalanceToPay,
          },
        });
      }

      // Registramos el pago en cuenta corriente por el monto total efectivamente cobrado
      const movement = await currentAccountsService.createMovement(tenantId, {
        customer_id: customer.id,
        sale_id: null,
        type: "payment",
        amount: chargedAmount,
        notes: values.notes?.trim() || null,
        created_by: userId,
      });

      // Registramos los ingresos según corresponda (efectivo / banco / split)
      let primaryCashMovementId: string | null = null;

      if (values.split_payments && values.split_payments.length > 0) {
        for (const split of values.split_payments) {
          const splitMethod = paymentMethods.find((m) => m.id === split.payment_method_id);
          const splitCode = splitMethod ? normalizePaymentMethodCode(splitMethod.code) : "other";

          if (split.bank_account_id) {
            try {
              await bankAccountMovementsService.createMovement(tenantId, {
                bank_account_id: split.bank_account_id,
                type: "income",
                origin_type: "customer_collection",
                concept: `Cobro cuenta corriente - ${customer.full_name}`,
                amount: split.amount,
                reference_id: movement.id,
                voucher_number: null,
                notes: split.notes || values.notes || null,
                created_by: userId,
              });
            } catch (bankErr) {
              console.error("Error al registrar ingreso en cuenta bancaria:", bankErr);
            }
          } else if (openSession && (splitCode === "cash" || splitMethod?.affects_cash !== false)) {
            const cm = await cashService.createMovement(tenantId, {
              cash_session_id: openSession.id,
              movement_type: "income",
              amount: split.amount,
              currency_code: "ARS",
              reference_type: splitCode,
              reference_id: movement.id,
              notes:
                values.notes?.trim() ||
                `Pago de cuenta corriente - ${customer.full_name} (${splitMethod?.name || "Efectivo"})`,
              created_by: userId,
            });
            if (!primaryCashMovementId) primaryCashMovementId = cm.id;
          }
        }
      } else {
        if (values.bank_account_id) {
          try {
            await bankAccountMovementsService.createMovement(tenantId, {
              bank_account_id: values.bank_account_id,
              type: "income",
              origin_type: "customer_collection",
              concept: `Cobro cuenta corriente - ${customer.full_name}`,
              amount: chargedAmount,
              reference_id: movement.id,
              voucher_number: null,
              notes: values.notes || null,
              created_by: userId,
            });
          } catch (bankErr) {
            console.error("Error al registrar ingreso en cuenta bancaria:", bankErr);
          }
        }

        if (
          openSession &&
          (normalizedMethodCode === "cash" ||
            paymentMethod.affects_cash !== false ||
            !values.bank_account_id)
        ) {
          const cm = await cashService.createMovement(tenantId, {
            cash_session_id: openSession.id,
            movement_type: "income",
            amount: chargedAmount,
            currency_code: "ARS",
            reference_type: normalizedMethodCode,
            reference_id: movement.id,
            notes:
              values.notes?.trim() ||
              `Pago de cuenta corriente - ${customer.full_name} (${paymentMethod.name})`,
            created_by: userId,
          });
          primaryCashMovementId = cm.id;
        }
      }

      // Si la deuda quedó totalmente cancelada, reseteamos la regla a 'original'
      // para que las próximas compras del cliente no nazcan con recargos viejos
      const remainingBalance = roundAmount(accountingBalanceToPay + adjustmentAmount - chargedAmount);
      if (remainingBalance <= 0) {
        await customersService.update(tenantId, customer.id, {
          current_account_pricing_mode: "original",
          current_account_surcharge_percent: null,
          current_account_surcharge_amount: null,
          current_account_pricing_updated_at: new Date().toISOString(),
        });
      }

      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "cuentas_corrientes",
        action: "payment",
        entity_type: "current_account_movement",
        entity_id: movement.id,
        description: `Pago registrado en cuenta corriente: ${customer.full_name}`,
        metadata: {
          customer_id: customer.id,
          amount: chargedAmount,
          adjustment_applied: adjustmentAmount,
          balance_after: movement.balance_after,
          payment_method_id: paymentMethod.id,
          payment_method_code: normalizedMethodCode,
          payment_method_name: paymentMethod.name,
          payment_details: values.payment_details ?? null,
          cash_session_id: openSession?.id ?? null,
          cash_movement_id: primaryCashMovementId,
        },
      });

      if (primaryCashMovementId) {
        await auditService.createSafe(tenantId, {
          user_id: userId,
          module: "caja",
          action: "income",
          entity_type: "cash_movement",
          entity_id: primaryCashMovementId,
          description: `Ingreso por pago de cuenta corriente: ${customer.full_name}`,
          metadata: {
            customer_id: customer.id,
            current_account_movement_id: movement.id,
            amount: chargedAmount,
            account_payment_amount: chargedAmount,
            adjustment_amount: adjustmentAmount,
            payment_method_code: normalizedMethodCode,
            payment_method_name: paymentMethod.name,
            payment_details: values.payment_details ?? null,
          },
        });
      }

      setFeedback({ type: "success", message: "Pago registrado correctamente" });
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
    pendingAllocationsByMovementId,
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
