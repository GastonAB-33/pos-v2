import { useCallback, useEffect, useState } from "react";
import { employeeCurrentAccountsService } from "@/services/employee-current-accounts.service";
import type { Employee, EmployeeCurrentAccountMovement, EmployeeCurrentAccountCategory } from "@/types/entities";

interface Feedback {
  type: "success" | "error";
  message: string;
}

export const useEmployeeCurrentAccount = (
  tenantId: string | null,
  employee: Employee | null,
  userId: string | null
) => {
  const [movements, setMovements] = useState<EmployeeCurrentAccountMovement[]>([]);
  const [balance, setBalance] = useState<number>(employee?.current_balance ?? 0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  const loadMovements = useCallback(async () => {
    if (!tenantId || !employee) return;

    setIsLoading(true);
    try {
      const data = await employeeCurrentAccountsService.getByEmployee(tenantId, employee.id);
      setMovements(data.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      const currentBal = await employeeCurrentAccountsService.getEmployeeBalance(tenantId, employee.id);
      setBalance(currentBal);
    } catch {
      setFeedback({ type: "error", message: "Error al cargar movimientos de cuenta corriente" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, employee]);

  useEffect(() => {
    if (employee) {
      setBalance(employee.current_balance ?? 0);
      void loadMovements();
    } else {
      setMovements([]);
      setBalance(0);
    }
  }, [employee, loadMovements]);

  const registerDebt = async (values: {
    amount: number;
    notes: string;
    category?: EmployeeCurrentAccountCategory;
  }): Promise<boolean> => {
    if (!tenantId || !employee) return false;

    setIsSubmitting(true);
    try {
      await employeeCurrentAccountsService.createMovement(tenantId, {
        employee_id: employee.id,
        type: "debt",
        amount: values.amount,
        category: values.category || "product_purchase",
        notes: values.notes,
        created_by: userId,
      });

      setFeedback({ type: "success", message: "Deuda / consumo registrado correctamente" });
      await loadMovements();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al registrar movimiento en cuenta corriente" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerPayment = async (values: {
    amount: number;
    notes: string;
    category?: EmployeeCurrentAccountCategory;
  }): Promise<boolean> => {
    if (!tenantId || !employee) return false;

    setIsSubmitting(true);
    try {
      await employeeCurrentAccountsService.createMovement(tenantId, {
        employee_id: employee.id,
        type: "payment",
        amount: values.amount,
        category: values.category || "cash_payment",
        notes: values.notes,
        created_by: userId,
      });

      setFeedback({ type: "success", message: "Pago / descuento registrado correctamente" });
      await loadMovements();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al registrar cobro en cuenta corriente" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerAdjustment = async (values: {
    amount: number;
    notes: string;
  }): Promise<boolean> => {
    if (!tenantId || !employee) return false;

    setIsSubmitting(true);
    try {
      await employeeCurrentAccountsService.createMovement(tenantId, {
        employee_id: employee.id,
        type: "adjustment",
        amount: values.amount,
        category: "adjustment",
        notes: values.notes,
        created_by: userId,
      });

      setFeedback({ type: "success", message: "Ajuste registrado correctamente" });
      await loadMovements();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al registrar ajuste" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const recalculate = async (): Promise<boolean> => {
    if (!tenantId || !employee) return false;

    setIsSubmitting(true);
    try {
      const newBal = await employeeCurrentAccountsService.recalculateEmployeeBalance(tenantId, employee.id);
      setBalance(newBal);
      setFeedback({ type: "success", message: "Saldo recalculado con éxito" });
      await loadMovements();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al recalcular saldo" });
      return false;
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
    reload: loadMovements,
    registerDebt,
    registerPayment,
    registerAdjustment,
    recalculate,
  };
};
