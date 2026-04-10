import { useCallback, useEffect, useState } from "react";
import { auditService } from "@/services/audit.service";
import { currentAccountsService } from "@/services/current-accounts.service";
import type { CurrentAccountMovement, Customer } from "@/types/entities";
import type {
  AdjustmentMovementValues,
  PaymentMovementValues,
} from "@/modules/clientes/schemas/current-account-movement.schema";

type FeedbackType = "success" | "error";

interface AccountFeedback {
  type: FeedbackType;
  message: string;
}

export const useCurrentAccount = (
  tenantId: string | null,
  customer: Customer | null,
  userId: string | null
) => {
  const [movements, setMovements] = useState<CurrentAccountMovement[]>([]);
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<AccountFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const loadCurrentAccount = useCallback(async () => {
    if (!tenantId || !customer) {
      setMovements([]);
      setBalance(0);
      return;
    }

    setIsLoading(true);
    try {
      const [list, currentBalance] = await Promise.all([
        currentAccountsService.getByCustomer(tenantId, customer.id),
        currentAccountsService.getCustomerBalance(tenantId, customer.id),
      ]);

      setMovements(list);
      setBalance(currentBalance);
    } catch {
      setFeedback({ type: "error", message: "No se pudo cargar la cuenta corriente" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, customer]);

  useEffect(() => {
    void loadCurrentAccount();
  }, [loadCurrentAccount]);

  const registerPayment = async (values: PaymentMovementValues) => {
    if (!tenantId || !customer) return;

    setIsSubmitting(true);
    try {
      const movement = await currentAccountsService.createMovement(tenantId, {
        customer_id: customer.id,
        sale_id: null,
        type: "payment",
        amount: values.amount,
        notes: values.notes?.trim() || null,
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
          amount: values.amount,
          balance_after: movement.balance_after,
        },
      });

      setFeedback({ type: "success", message: "Pago registrado" });
      await loadCurrentAccount();
    } catch {
      setFeedback({ type: "error", message: "No se pudo registrar el pago" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerAdjustment = async (values: AdjustmentMovementValues) => {
    if (!tenantId || !customer) return;

    setIsSubmitting(true);
    try {
      const movement = await currentAccountsService.createMovement(tenantId, {
        customer_id: customer.id,
        sale_id: null,
        type: "adjustment",
        amount: values.amount,
        notes: values.notes?.trim() || null,
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
          amount: values.amount,
          balance_after: movement.balance_after,
        },
      });

      setFeedback({ type: "success", message: "Ajuste registrado" });
      await loadCurrentAccount();
    } catch {
      setFeedback({ type: "error", message: "No se pudo registrar el ajuste" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    movements,
    balance,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadCurrentAccount,
    registerPayment,
    registerAdjustment,
  };
};
