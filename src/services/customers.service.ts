import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { Customer } from "@/types/entities";

const crud = new TenantCrudService<Customer>(dbTables.customers);

export type CreateCustomerInput = CreateEntityInput<Customer>;
export type UpdateCustomerInput = UpdateEntityInput<Customer>;

export const customersService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreateCustomerInput) => crud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateCustomerInput) => crud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),
};