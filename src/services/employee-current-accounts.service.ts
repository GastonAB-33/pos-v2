import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
} from "@/services/base/tenant-crud.service";
import { employeesService } from "@/services/employees.service";
import type { EmployeeCurrentAccountMovement, EmployeeCurrentAccountCategory } from "@/types/entities";

const movementsCrud = new TenantCrudService<EmployeeCurrentAccountMovement>(
  dbTables.employee_current_account_movements
);

export type CreateEmployeeCurrentAccountMovementInput = Omit<
  CreateEntityInput<EmployeeCurrentAccountMovement>,
  "balance_after" | "sale_id" | "category"
> & {
  sale_id?: string | null;
  category?: EmployeeCurrentAccountCategory;
};

const normalizeAmountByType = (
  type: EmployeeCurrentAccountMovement["type"],
  amount: number
): number => {
  const absAmount = Math.abs(amount);
  if (type === "debt") return absAmount;
  if (type === "payment") return -absAmount;
  return amount;
};

export const employeeCurrentAccountsService = {
  getAllByTenant: (tenantId: string) => movementsCrud.getAllByTenant(tenantId),

  getByEmployee: async (
    tenantId: string,
    employeeId: string
  ): Promise<EmployeeCurrentAccountMovement[]> => {
    const all = await movementsCrud.getAllByTenant(tenantId);
    return all
      .filter((movement) => movement.employee_id === employeeId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  getEmployeeBalance: async (tenantId: string, employeeId: string): Promise<number> => {
    const employee = await employeesService.getById(tenantId, employeeId);
    return employee?.current_balance ?? 0;
  },

  createMovement: async (
    tenantId: string,
    payload: CreateEmployeeCurrentAccountMovementInput
  ): Promise<EmployeeCurrentAccountMovement> => {
    const employee = await employeesService.getById(tenantId, payload.employee_id);
    if (!employee) {
      throw new Error("Empleado no encontrado para registrar movimiento en cuenta corriente");
    }

    const signedDelta = normalizeAmountByType(payload.type, payload.amount);
    const nextBalance = Number((employee.current_balance + signedDelta).toFixed(2));

    const category: EmployeeCurrentAccountCategory =
      payload.category ||
      (payload.type === "debt"
        ? "product_purchase"
        : payload.type === "payment"
        ? "salary_deduction"
        : "adjustment");

    const movement = await movementsCrud.create(tenantId, {
      employee_id: payload.employee_id,
      sale_id: payload.sale_id ?? null,
      type: payload.type,
      amount: Math.abs(payload.amount),
      balance_after: nextBalance,
      category,
      notes: payload.notes ?? null,
      created_by: payload.created_by ?? null,
    });

    await employeesService.update(tenantId, payload.employee_id, {
      current_balance: nextBalance,
    });

    return movement;
  },

  recalculateEmployeeBalance: async (
    tenantId: string,
    employeeId: string
  ): Promise<number> => {
    const employee = await employeesService.getById(tenantId, employeeId);
    if (!employee) {
      throw new Error("Empleado no encontrado para recalcular saldo");
    }

    const movements = await employeeCurrentAccountsService.getByEmployee(tenantId, employeeId);

    let runningBalance = 0;
    for (const movement of movements) {
      const signedDelta = normalizeAmountByType(movement.type, movement.amount);
      runningBalance = Number((runningBalance + signedDelta).toFixed(2));

      await movementsCrud.update(tenantId, movement.id, {
        balance_after: runningBalance,
      });
    }

    await employeesService.update(tenantId, employeeId, {
      current_balance: runningBalance,
    });

    return runningBalance;
  },
};
