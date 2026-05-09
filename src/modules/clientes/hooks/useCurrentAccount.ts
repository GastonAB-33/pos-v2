import { useCallback, useEffect, useState } from "react";
import { auditService } from "@/services/audit.service";
import { bankAccountsService } from "@/services/bank-accounts.service";
import { cashService } from "@/services/cash.service";
import { currentAccountsService } from "@/services/current-accounts.service";
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

export interface RegisterCurrentAccountPaymentValues {
  amount: number;
  payment_method_id: string;
  notes?: string;
  payment_details?: Record<string, unknown> | null;
}

export type CurrentAccountAdjustmentMode =
  | "update_to_today_price"
  | "surcharge_percentage"
  | "surcharge_fixed";

export interface RegisterCurrentAccountAdjustmentValues {
  sale_id: string;
  mode: CurrentAccountAdjustmentMode;
  surcharge_percent?: number;
  surcharge_amount?: number;
  notes?: string;
}

const resolveAdjustmentFromInput = (
  input: RegisterCurrentAccountAdjustmentValues,
  saleDetail: CurrentAccountSaleDetail
): {
  amount: number;
  modeLabel: string;
  modeData: Record<string, unknown>;
} | null => {
  if (input.mode === "update_to_today_price") {
    if (saleDetail.current_total == null) return null;
    return {
      amount: roundAmount(saleDetail.current_total - saleDetail.sale_total),
      modeLabel: "Actualizacion a precio de hoy",
      modeData: {
        sale_total_original: saleDetail.sale_total,
        sale_total_today: saleDetail.current_total,
      },
    };
  }

  if (input.mode === "surcharge_percentage") {
    const percent = Number(input.surcharge_percent ?? 0);
    if (!Number.isFinite(percent) || percent <= 0) return null;
    return {
      amount: roundAmount(saleDetail.sale_total * (percent / 100)),
      modeLabel: `Recargo ${percent}%`,
      modeData: {
        surcharge_percent: percent,
        base_total: saleDetail.sale_total,
      },
    };
  }

  const fixedAmount = Number(input.surcharge_amount ?? 0);
  if (!Number.isFinite(fixedAmount) || fixedAmount <= 0) return null;
  return {
    amount: roundAmount(fixedAmount),
    modeLabel: "Recargo fijo",
    modeData: {
      surcharge_amount: fixedAmount,
      base_total: saleDetail.sale_total,
    },
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
      setHasOpenCashSession(false);
      setOpenCashSessionId(null);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, customer, userId]);

  useEffect(() => {
    void loadCurrentAccount();
  }, [loadCurrentAccount]);

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

    const amount = Math.abs(Number(values.amount ?? 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      setFeedback({ type: "error", message: "El monto del pago debe ser mayor a 0" });
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

      const movement = await currentAccountsService.createMovement(tenantId, {
        customer_id: customer.id,
        sale_id: null,
        type: "payment",
        amount,
        notes: values.notes?.trim() || null,
        created_by: userId,
      });
      const cashMovement = await cashService.createMovement(tenantId, {
        cash_session_id: openSession.id,
        movement_type: "income",
        amount,
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
          amount,
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
          amount,
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
    if (!tenantId || !customer) return false;
    if (!userId) {
      setFeedback({ type: "error", message: "No se pudo identificar el usuario responsable" });
      return false;
    }

    const saleDetail = saleDetailsById[values.sale_id];
    if (!saleDetail) {
      setFeedback({ type: "error", message: "Selecciona un comprobante valido para ajustar" });
      return false;
    }

    const resolvedAdjustment = resolveAdjustmentFromInput(values, saleDetail);
    if (!resolvedAdjustment) {
      setFeedback({
        type: "error",
        message: "Completa correctamente los datos del ajuste",
      });
      return false;
    }

    if (resolvedAdjustment.amount === 0) {
      setFeedback({
        type: "error",
        message: "No hay diferencia para registrar en el ajuste",
      });
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

      const movement = await currentAccountsService.createMovement(tenantId, {
        customer_id: customer.id,
        sale_id: saleDetail.sale_id,
        type: "adjustment",
        amount: resolvedAdjustment.amount,
        notes:
          values.notes?.trim() ||
          `${resolvedAdjustment.modeLabel} - ${saleDetail.sale_number} - ${customer.full_name}`,
        created_by: userId,
      });
      const cashMovement = await cashService.createMovement(tenantId, {
        cash_session_id: openSession.id,
        movement_type: "adjustment",
        amount: resolvedAdjustment.amount,
        currency_code: "ARS",
        reference_type: "current_account_adjustment",
        reference_id: movement.id,
        notes:
          values.notes?.trim() ||
          `Ajuste de cuenta corriente - ${saleDetail.sale_number} - ${customer.full_name}`,
        created_by: userId,
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "cuentas_corrientes",
        action: "adjustment",
        entity_type: "current_account_movement",
        entity_id: movement.id,
        description: `Ajuste registrado en cuenta corriente: ${customer.full_name}`,
        metadata: {
          customer_id: customer.id,
          sale_id: saleDetail.sale_id,
          sale_number: saleDetail.sale_number,
          amount: resolvedAdjustment.amount,
          balance_after: movement.balance_after,
          mode: values.mode,
          mode_data: resolvedAdjustment.modeData,
          cash_session_id: openSession.id,
          cash_movement_id: cashMovement.id,
        },
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "caja",
        action: "adjustment",
        entity_type: "cash_movement",
        entity_id: cashMovement.id,
        description: `Ajuste de caja por cuenta corriente: ${customer.full_name}`,
        metadata: {
          customer_id: customer.id,
          sale_id: saleDetail.sale_id,
          sale_number: saleDetail.sale_number,
          current_account_movement_id: movement.id,
          amount: resolvedAdjustment.amount,
          mode: values.mode,
        },
      });

      setFeedback({ type: "success", message: "Ajuste registrado" });
      await loadCurrentAccount();
      return true;
    } catch {
      setFeedback({ type: "error", message: "No se pudo registrar el ajuste" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
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
