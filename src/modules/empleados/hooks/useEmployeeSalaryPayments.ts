import { useCallback, useEffect, useMemo, useState } from "react";
import { employeeSalaryPaymentsService } from "@/services/employee-salary-payments.service";
import type { EmployeeSalaryPayment } from "@/types/entities";

interface Feedback {
  type: "success" | "error";
  message: string;
}

export const useEmployeeSalaryPayments = (
  tenantId: string | null,
  userId: string | null
) => {
  const [payments, setPayments] = useState<EmployeeSalaryPayment[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  const loadPayments = useCallback(async () => {
    if (!tenantId) return;

    setIsLoading(true);
    try {
      const data = await employeeSalaryPaymentsService.getAllByTenant(tenantId);
      setPayments(
        data.sort(
          (a, b) =>
            b.payment_date.localeCompare(a.payment_date) ||
            b.created_at.localeCompare(a.created_at)
        )
      );
    } catch {
      setFeedback({ type: "error", message: "Error al cargar registros de pagos de sueldo" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (selectedEmployeeId !== "all" && p.employee_id !== selectedEmployeeId) {
        return false;
      }
      if (selectedPeriod !== "all" && p.period !== selectedPeriod) {
        return false;
      }
      return true;
    });
  }, [payments, selectedEmployeeId, selectedPeriod]);

  const totalPaid = useMemo(
    () => filteredPayments.reduce((acc, p) => acc + (p.net_amount_paid || 0), 0),
    [filteredPayments]
  );

  const totalCurrentAccountDiscounts = useMemo(
    () =>
      filteredPayments.reduce(
        (acc, p) => acc + (p.current_account_discount_applied || 0),
        0
      ),
    [filteredPayments]
  );

  const createSalaryPayment = async (values: {
    employee_id: string;
    period: string;
    gross_amount: number;
    deductions_amount: number;
    current_account_discount_applied: number;
    bonuses_amount: number;
    net_amount_paid: number;
    payment_method_code: string;
    payment_date: string;
    notes?: string;
  }): Promise<boolean> => {
    if (!tenantId) return false;

    setIsSubmitting(true);
    try {
      await employeeSalaryPaymentsService.registerSalaryPayment(tenantId, {
        employee_id: values.employee_id,
        period: values.period,
        gross_amount: values.gross_amount,
        deductions_amount: values.deductions_amount,
        current_account_discount_applied: values.current_account_discount_applied,
        bonuses_amount: values.bonuses_amount,
        net_amount_paid: values.net_amount_paid,
        payment_method_code: values.payment_method_code,
        payment_date: values.payment_date,
        notes: values.notes?.trim() || null,
        created_by: userId,
      });

      setFeedback({
        type: "success",
        message:
          values.current_account_discount_applied > 0
            ? "Pago de sueldo registrado y descuento en cuenta corriente aplicado"
            : "Pago de sueldo registrado correctamente",
      });
      await loadPayments();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al registrar el pago de sueldo" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const deletePayment = async (id: string): Promise<boolean> => {
    if (!tenantId) return false;

    setIsSubmitting(true);
    try {
      await employeeSalaryPaymentsService.delete(tenantId, id);
      setFeedback({ type: "success", message: "Registro de pago de sueldo eliminado" });
      await loadPayments();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al eliminar el registro" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    payments,
    filteredPayments,
    totalPaid,
    totalCurrentAccountDiscounts,
    selectedEmployeeId,
    setSelectedEmployeeId,
    selectedPeriod,
    setSelectedPeriod,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadPayments,
    createSalaryPayment,
    deletePayment,
  };
};
