import { useCallback, useEffect, useMemo, useState } from "react";
import { employeeSalaryPaymentsService } from "@/services/employee-salary-payments.service";
import type { EmployeeSalaryPayment } from "@/types/entities";

export type SalaryPaymentFilterType = "all" | "salary" | "advance";
export type SalaryDatePreset =
  | "all"
  | "last_2_weeks"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

export const isAdvancePayment = (payment: EmployeeSalaryPayment): boolean => {
  if (payment.payment_type === "advance") return true;
  if (payment.notes?.startsWith("[ADELANTO]")) return true;
  if (payment.period?.toLowerCase().includes("adelanto")) return true;
  return false;
};

interface Feedback {
  type: "success" | "error";
  message: string;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const useEmployeeSalaryPayments = (
  tenantId: string | null,
  userId: string | null
) => {
  const [payments, setPayments] = useState<EmployeeSalaryPayment[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<SalaryPaymentFilterType>("all");
  const [datePreset, setDatePreset] = useState<SalaryDatePreset>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
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
      setFeedback({ type: "error", message: "Error al cargar registros de pagos y adelantos" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const filteredPayments = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    return payments.filter((p) => {
      // 1. Filtro por Empleado
      if (selectedEmployeeId !== "all" && p.employee_id !== selectedEmployeeId) {
        return false;
      }

      // 2. Filtro por Tipo (Sueldo vs Adelanto)
      const isAdv = isAdvancePayment(p);
      if (selectedType === "salary" && isAdv) return false;
      if (selectedType === "advance" && !isAdv) return false;

      // 3. Filtro por Período exacto
      if (selectedPeriod !== "all" && p.period !== selectedPeriod) {
        return false;
      }

      // 4. Filtro por Rango Temporal / Semanas / Preset
      const pDate = p.payment_date;
      if (pDate) {
        if (datePreset === "last_2_weeks") {
          const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          const twoWeeksAgoStr = twoWeeksAgo.toISOString().split("T")[0];
          if (pDate < twoWeeksAgoStr || pDate > todayStr) return false;
        } else if (datePreset === "last_week") {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const oneWeekAgoStr = oneWeekAgo.toISOString().split("T")[0];
          if (pDate < oneWeekAgoStr || pDate > todayStr) return false;
        } else if (datePreset === "this_month") {
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, "0");
          if (!pDate.startsWith(`${year}-${month}`)) return false;
        } else if (datePreset === "last_month") {
          const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const year = prevMonth.getFullYear();
          const month = String(prevMonth.getMonth() + 1).padStart(2, "0");
          if (!pDate.startsWith(`${year}-${month}`)) return false;
        } else if (datePreset === "custom") {
          if (customStartDate && pDate < customStartDate) return false;
          if (customEndDate && pDate > customEndDate) return false;
        }
      }

      return true;
    });
  }, [
    payments,
    selectedEmployeeId,
    selectedType,
    selectedPeriod,
    datePreset,
    customStartDate,
    customEndDate,
  ]);

  const totalPaid = useMemo(
    () => filteredPayments.reduce((acc, p) => acc + (p.net_amount_paid || 0), 0),
    [filteredPayments]
  );

  const totalSalariesPaid = useMemo(
    () =>
      filteredPayments
        .filter((p) => !isAdvancePayment(p))
        .reduce((acc, p) => acc + (p.net_amount_paid || 0), 0),
    [filteredPayments]
  );

  const totalAdvancesPaid = useMemo(
    () =>
      filteredPayments
        .filter((p) => isAdvancePayment(p))
        .reduce((acc, p) => acc + (p.net_amount_paid || 0), 0),
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

  // Helper para buscar adelantos entregados a un empleado en un rango o período
  const getAdvancesForEmployee = useCallback(
    (
      employeeId: string,
      options?: {
        daysBack?: number;
        startDate?: string;
        endDate?: string;
      }
    ) => {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const minDateStr = options?.startDate
        ? options.startDate
        : options?.daysBack
        ? new Date(now.getTime() - options.daysBack * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        : null;
      const maxDateStr = options?.endDate || todayStr;

      return payments.filter((p) => {
        if (p.employee_id !== employeeId) return false;
        if (!isAdvancePayment(p)) return false;
        if (minDateStr && p.payment_date < minDateStr) return false;
        if (maxDateStr && p.payment_date > maxDateStr) return false;
        return true;
      });
    },
    [payments]
  );

  // Registrar pago de sueldo normal o quincenal
  const createSalaryPayment = async (values: {
    employee_id: string;
    period: string;
    gross_amount: number;
    deductions_amount: number;
    current_account_discount_applied: number;
    advances_discount_applied?: number;
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
        advances_discount_applied: values.advances_discount_applied ?? 0,
        bonuses_amount: values.bonuses_amount,
        net_amount_paid: values.net_amount_paid,
        payment_method_code: values.payment_method_code,
        payment_date: values.payment_date,
        notes: values.notes?.trim() || null,
        created_by: userId,
        payment_type: "salary",
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

  // Registrar adelanto de sueldo en efectivo o transferencia
  const createSalaryAdvance = async (values: {
    employee_id: string;
    amount: number;
    payment_method_code: string;
    payment_date: string;
    period?: string;
    notes?: string;
  }): Promise<boolean> => {
    if (!tenantId) return false;

    setIsSubmitting(true);
    try {
      const cleanNotes = values.notes?.trim()
        ? `[ADELANTO] ${values.notes.trim()}`
        : `[ADELANTO] Anticipo de sueldo`;

      await employeeSalaryPaymentsService.registerSalaryPayment(tenantId, {
        employee_id: values.employee_id,
        period: values.period?.trim() || `Adelanto - ${values.payment_date}`,
        gross_amount: values.amount,
        deductions_amount: 0,
        current_account_discount_applied: 0,
        bonuses_amount: 0,
        net_amount_paid: values.amount,
        payment_method_code: values.payment_method_code,
        payment_date: values.payment_date,
        notes: cleanNotes,
        created_by: userId,
        payment_type: "advance",
      });

      setFeedback({
        type: "success",
        message: `Adelanto de ${currency.format(values.amount)} registrado correctamente`,
      });
      await loadPayments();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al registrar el adelanto" });
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
      setFeedback({ type: "success", message: "Registro eliminado correctamente" });
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
    totalSalariesPaid,
    totalAdvancesPaid,
    totalCurrentAccountDiscounts,
    selectedEmployeeId,
    setSelectedEmployeeId,
    selectedPeriod,
    setSelectedPeriod,
    selectedType,
    setSelectedType,
    datePreset,
    setDatePreset,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadPayments,
    getAdvancesForEmployee,
    createSalaryPayment,
    createSalaryAdvance,
    deletePayment,
  };
};
