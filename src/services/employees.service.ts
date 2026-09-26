import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { Employee } from "@/types/entities";

const crud = new TenantCrudService<Employee>(dbTables.employees);

export type CreateEmployeeInput = CreateEntityInput<Employee>;
export type UpdateEmployeeInput = UpdateEntityInput<Employee>;

const generateEmployeeCode = (existingEmployees: Employee[]): string => {
  const existingNumbers = existingEmployees
    .map((emp) => {
      const match = emp.code.match(/EMP-(\d+)/i);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => !isNaN(n) && n > 0);

  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  return `EMP-${String(nextNumber).padStart(3, "0")}`;
};

export const employeesService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),

  create: async (tenantId: string, input: Partial<CreateEmployeeInput> & { full_name: string; document_number: string }) => {
    const existing = await crud.getAllByTenant(tenantId);
    const code = input.code?.trim() || generateEmployeeCode(existing);

    const payload: CreateEmployeeInput = {
      code,
      full_name: input.full_name.trim(),
      document_type: input.document_type || "dni",
      document_number: input.document_number.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      position: input.position?.trim() || "Empleado",
      base_salary: Number(input.base_salary) || 0,
      hourly_rate: input.hourly_rate ? Number(input.hourly_rate) : null,
      hire_date: input.hire_date || new Date().toISOString().split("T")[0],
      current_balance: Number(input.current_balance) || 0,
      current_account_enabled: input.current_account_enabled ?? true,
      current_account_limit: input.current_account_limit ? Number(input.current_account_limit) : null,
      observations: input.observations?.trim() || null,
      is_active: input.is_active ?? true,
    };

    return crud.create(tenantId, payload);
  },

  update: (tenantId: string, id: string, input: UpdateEmployeeInput) =>
    crud.update(tenantId, id, input),

  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),
};
