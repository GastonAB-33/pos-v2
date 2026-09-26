import { useCallback, useEffect, useMemo, useState } from "react";
import { employeesService } from "@/services/employees.service";
import { employeeAttendanceService } from "@/services/employee-attendance.service";
import { employeeCurrentAccountsService } from "@/services/employee-current-accounts.service";
import type { Employee } from "@/types/entities";
import type { EmployeeFormValues } from "@/modules/empleados/schemas/employee-form.schema";

interface Feedback {
  type: "success" | "error";
  message: string;
}

export const useEmployeesCrud = (tenantId: string | null, _userId: string | null) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  const loadEmployees = useCallback(async () => {
    if (!tenantId) return;

    setIsLoading(true);
    try {
      const data = await employeesService.getAllByTenant(tenantId);
      if (data.length === 0) {
        const emp1 = await employeesService.create(tenantId, {
          full_name: "Lucas Benítez",
          document_type: "dni",
          document_number: "38452190",
          phone: "11 4455-6677",
          email: "lucas.benitez@comercio.com",
          position: "Cajero / Atención",
          base_salary: 520000,
          hourly_rate: 3250,
          hire_date: "2024-03-01",
          current_balance: 0,
          current_account_enabled: true,
          current_account_limit: 80000,
          observations: "Turno mañana. Autorizado a cuenta corriente para refrigerios.",
          is_active: true,
        });

        await employeeCurrentAccountsService.createMovement(tenantId, {
          employee_id: emp1.id,
          type: "debt",
          amount: 18500,
          category: "product_purchase",
          notes: "Retiro de productos: 2x Gaseosa 1.5L ($4.500), 2x Sándwiches ($14.000)",
          created_by: null,
        });

        const emp2 = await employeesService.create(tenantId, {
          full_name: "Mariana Rossi",
          document_type: "dni",
          document_number: "35891204",
          phone: "11 5566-7788",
          email: "mariana.rossi@comercio.com",
          position: "Encargada de Local",
          base_salary: 680000,
          hourly_rate: 4250,
          hire_date: "2023-08-15",
          current_balance: 0,
          current_account_enabled: true,
          current_account_limit: 120000,
          observations: "Turno completo.",
          is_active: true,
        });

        await employeeAttendanceService.registerCheckIn(tenantId, emp2.id, {
          checkInTime: "08:30",
          notes: "Ingreso turno mañana",
        });

        const refreshed = await employeesService.getAllByTenant(tenantId);
        setEmployees(refreshed.sort((a, b) => a.full_name.localeCompare(b.full_name)));
      } else {
        setEmployees(data.sort((a, b) => a.full_name.localeCompare(b.full_name)));
      }
    } catch {
      setFeedback({ type: "error", message: "Error al cargar los empleados" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;

    return employees.filter(
      (emp) =>
        emp.full_name.toLowerCase().includes(term) ||
        emp.code.toLowerCase().includes(term) ||
        emp.document_number.toLowerCase().includes(term) ||
        emp.position.toLowerCase().includes(term) ||
        (emp.phone && emp.phone.includes(term))
    );
  }, [employees, search]);

  const createEmployee = async (values: EmployeeFormValues): Promise<Employee | null> => {
    if (!tenantId) return null;

    setIsSubmitting(true);
    try {
      const baseSalary = values.baseSalary ? parseFloat(values.baseSalary.replace(",", ".")) : 0;
      const hourlyRate = values.hourlyRate ? parseFloat(values.hourlyRate.replace(",", ".")) : null;
      const currentAccountLimit = values.currentAccountLimit
        ? parseFloat(values.currentAccountLimit.replace(",", "."))
        : null;

      const created = await employeesService.create(tenantId, {
        full_name: values.fullName,
        document_type: values.documentType,
        document_number: values.documentNumber,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        position: values.position,
        base_salary: baseSalary,
        hourly_rate: hourlyRate,
        hire_date: values.hireDate || null,
        current_balance: 0,
        current_account_enabled: values.currentAccountEnabled,
        current_account_limit: currentAccountLimit,
        observations: values.observations || null,
        is_active: true,
      });

      setFeedback({ type: "success", message: "Empleado registrado exitosamente" });
      await loadEmployees();
      return created;
    } catch {
      setFeedback({ type: "error", message: "Error al registrar el empleado" });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateEmployee = async (id: string, values: EmployeeFormValues): Promise<boolean> => {
    if (!tenantId) return false;

    setIsSubmitting(true);
    try {
      const baseSalary = values.baseSalary ? parseFloat(values.baseSalary.replace(",", ".")) : 0;
      const hourlyRate = values.hourlyRate ? parseFloat(values.hourlyRate.replace(",", ".")) : null;
      const currentAccountLimit = values.currentAccountLimit
        ? parseFloat(values.currentAccountLimit.replace(",", "."))
        : null;

      await employeesService.update(tenantId, id, {
        full_name: values.fullName.trim(),
        document_type: values.documentType,
        document_number: values.documentNumber.trim(),
        phone: values.phone?.trim() || null,
        email: values.email?.trim() || null,
        address: values.address?.trim() || null,
        position: values.position.trim(),
        base_salary: baseSalary,
        hourly_rate: hourlyRate,
        hire_date: values.hireDate || null,
        current_account_enabled: values.currentAccountEnabled,
        current_account_limit: currentAccountLimit,
        observations: values.observations?.trim() || null,
      });

      setFeedback({ type: "success", message: "Datos del empleado actualizados" });
      await loadEmployees();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al actualizar el empleado" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteEmployee = async (id: string): Promise<boolean> => {
    if (!tenantId) return false;

    setIsSubmitting(true);
    try {
      await employeesService.delete(tenantId, id);
      setFeedback({ type: "success", message: "Empleado eliminado" });
      await loadEmployees();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al eliminar el empleado" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleEmployeeActive = async (id: string): Promise<boolean> => {
    if (!tenantId) return false;

    const target = employees.find((emp) => emp.id === id);
    if (!target) return false;

    setIsSubmitting(true);
    try {
      await employeesService.update(tenantId, id, { is_active: !target.is_active });
      setFeedback({
        type: "success",
        message: target.is_active ? "Empleado desactivado" : "Empleado activado",
      });
      await loadEmployees();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al modificar estado del empleado" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    employees,
    filteredEmployees,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    toggleEmployeeActive,
  };
};
