import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
} from "@/services/base/tenant-crud.service";
import { employeeCurrentAccountsService } from "@/services/employee-current-accounts.service";
import { employeesService } from "@/services/employees.service";
import type { EmployeeSalaryPayment } from "@/types/entities";

const salaryCrud = new TenantCrudService<EmployeeSalaryPayment>(
  dbTables.employee_salary_payments
);

export type CreateSalaryPaymentInput = CreateEntityInput<EmployeeSalaryPayment>;

export const employeeSalaryPaymentsService = {
  getAllByTenant: (tenantId: string) => salaryCrud.getAllByTenant(tenantId),

  getByEmployee: async (
    tenantId: string,
    employeeId: string
  ): Promise<EmployeeSalaryPayment[]> => {
    const all = await salaryCrud.getAllByTenant(tenantId);
    return all
      .filter((payment) => payment.employee_id === employeeId)
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date) || b.created_at.localeCompare(a.created_at));
  },

  registerSalaryPayment: async (
    tenantId: string,
    input: CreateSalaryPaymentInput
  ): Promise<EmployeeSalaryPayment> => {
    const employee = await employeesService.getById(tenantId, input.employee_id);
    if (!employee) {
      throw new Error("Empleado no encontrado para registrar pago de sueldo");
    }

    // Registrar el comprobante de liquidación / pago de sueldo
    const payment = await salaryCrud.create(tenantId, input);

    // Si se especificó un descuento de cuenta corriente por productos/vales retirados,
    // se crea un movimiento de tipo "payment" en su cuenta corriente para descontarlo.
    if (input.current_account_discount_applied > 0) {
      await employeeCurrentAccountsService.createMovement(tenantId, {
        employee_id: input.employee_id,
        type: "payment",
        amount: input.current_account_discount_applied,
        category: "salary_deduction",
        notes: `Descuento aplicado por pago de sueldo - Periodo ${input.period}`,
        created_by: input.created_by ?? null,
      });
    }

    return payment;
  },

  delete: (tenantId: string, id: string) => salaryCrud.delete(tenantId, id),
};
